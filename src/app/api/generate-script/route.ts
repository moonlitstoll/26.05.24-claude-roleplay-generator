import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  generateContentWithRetry,
  parseModelJson,
  classifyGeminiError,
  BadModelOutputError,
  GEMINI_REQUEST_TIMEOUT_MS,
} from '@/utils/gemini';
import { resolveModel } from '@/constants/models';
import { z } from 'zod';
import { DIALOGUE_SCHEMA, getBaseInstruction, buildDialoguePrompt } from './prompts';

export const maxDuration = 60;

const RequestSchema = z.object({
  input: z.string().max(2000).default(''),
  language: z.enum(['Vietnamese', 'English']).default('Vietnamese'),
  count: z.number().int().min(0).max(10).default(3),
  apiKey: z.string().optional().default(''),
  model: z.string().optional().default(''),
  accentMode: z.string().default('all-standard'),
  mode: z.enum(['roleplay', 'analysis']).default('roleplay'),
});

interface DialogueResult {
  speakers: Record<string, { gender?: 'male' | 'female' } | null>;
  script: { speaker: string; text: string; translation: string }[];
}

/**
 * Stage 1 of generation: the lines and their Korean translation only.
 * Word analysis is requested separately (/api/generate-analysis) so the script and audio
 * can be shown while the much longer analysis is still being written.
 */
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

    const { input, language, count, apiKey, model: modelName, mode } = parsed.data;
    const selectedModel = resolveModel(modelName);

    console.log('[API] Script request:', { input, language, count, selectedModel });

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
    const model = genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: DIALOGUE_SCHEMA,
        temperature: 1.2,
      },
    }, { timeout: GEMINI_REQUEST_TIMEOUT_MS });

    const isInputEmpty = !input || input.trim() === '';
    const promptInput = isInputEmpty
      ? "Generate a random common day-to-day scenario or a creative conflict. It is perfectly fine to use textbook topics (like ordering food, asking for directions, returning an item), BUT the dialogue MUST focus heavily on highly authentic, real-world native conversational expressions, slang, and natural flow."
      : input;

    const baseInstruction = getBaseInstruction(mode, count, language, promptInput);
    const prompt = buildDialoguePrompt(promptInput, language, baseInstruction);

    const data = await generateContentWithRetry(model, prompt, {
      validate: (result) => {
        const json = parseModelJson<DialogueResult>(result);
        if (!Array.isArray(json?.script) || json.script.length === 0) {
          throw new BadModelOutputError('Model returned an empty script');
        }
        return json;
      },
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const failure = classifyGeminiError(error);
    console.error(`[API] Error generating script (${failure.reason}):`, failure.message);

    return NextResponse.json({
      error: failure.reason === 'rate_limit' ? 'Rate limit exceeded' : 'Failed to generate script',
      details: failure.reason === 'rate_limit'
        ? 'The Gemini API rate limit was hit. Please try again in 30-60 seconds.'
        : failure.message,
      reason: failure.reason,
      retryable: failure.retryable,
    }, { status: failure.status });
  }
}
