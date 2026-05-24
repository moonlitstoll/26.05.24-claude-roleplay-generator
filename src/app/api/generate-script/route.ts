import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateContentWithRetry } from '@/utils/gemini';
import { z } from 'zod';
import { RESPONSE_SCHEMA, getBaseInstruction, buildPrompt } from './prompts';

export const maxDuration = 60;

const RequestSchema = z.object({
  input: z.string().max(2000).default(''),
  language: z.enum(['Vietnamese', 'English']).default('Vietnamese'),
  count: z.number().int().min(0).max(10).default(3),
  apiKey: z.string().optional().default(''),
  model: z.string().optional().default('gemini-2.5-flash'),
  accentMode: z.string().default('all-standard'),
  mode: z.enum(['roleplay', 'analysis']).default('roleplay'),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      }, { status: 400 });
    }

    const { input, language, count, apiKey, model: modelName, accentMode, mode } = parsed.data;

    console.log('[API] Request received:', { input, language, count, modelName });

    // Server env var takes priority; client key is fallback only when no server key exists
    const finalApiKey = process.env.GEMINI_API_KEY || apiKey;

    if (!finalApiKey || finalApiKey === 'YOUR_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Gemini API Key is currently missing.',
        details: process.env.GEMINI_API_KEY
          ? 'Server API key is misconfigured. Please contact the administrator.'
          : 'Please enter a valid API Key in the settings panel.'
      }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(finalApiKey);
    const selectedModel = modelName || 'gemini-2.5-flash';

    const model = genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 1.2,
      },
    });

    const isInputEmpty = !input || input.trim() === '';
    const promptInput = isInputEmpty
      ? "Generate a random common day-to-day scenario or a creative conflict. It is perfectly fine to use textbook topics (like ordering food, asking for directions, returning an item), BUT the dialogue MUST focus heavily on highly authentic, real-world native conversational expressions, slang, and natural flow."
      : input;

    const baseInstruction = getBaseInstruction(mode, count, language, promptInput);
    const prompt = buildPrompt(promptInput, language, baseInstruction);

    const result = await generateContentWithRetry(model, prompt);
    let text = result.response.text();

    // Clean up markdown code blocks if present
    if (text.includes('```')) {
      text = text.replace(/```json|```/g, '').trim();
    }

    const data = JSON.parse(text);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[API] Error generating script:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    const isRateLimit = errMsg.includes('429') ||
      errMsg.includes('Resource exhausted') ||
      errMsg.includes('Too Many Requests');

    return NextResponse.json({
      error: isRateLimit ? 'Rate limit exceeded' : 'Failed to generate script',
      details: isRateLimit
        ? 'Gemini 2.0 Flash has lower rate limits. Please try again in 30-60 seconds, or switch to Gemini 2.5 Flash for better stability.'
        : errMsg
    }, { status: isRateLimit ? 429 : 500 });
  }
}
