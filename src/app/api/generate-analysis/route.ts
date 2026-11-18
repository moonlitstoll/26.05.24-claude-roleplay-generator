import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  generateContentWithRetry,
  parseModelJson,
  classifyGeminiError,
  thinkingOffConfig,
  GEMINI_REQUEST_TIMEOUT_MS,
} from '@/utils/gemini';
import { resolveModel } from '@/constants/models';
import { z } from 'zod';
import { ANALYSIS_SCHEMA, buildAnalysisPrompt } from '../generate-script/prompts';

export const maxDuration = 60;

const MAX_LINES = 120;
const MAX_TARGETS = 8;

const RequestSchema = z.object({
  language: z.enum(['Vietnamese', 'English']).default('Vietnamese'),
  apiKey: z.string().optional().default(''),
  model: z.string().optional().default(''),
  // The whole script, sent with every batch as context.
  lines: z.array(z.object({
    index: z.number().int().min(0),
    speaker: z.string().max(10),
    text: z.string().max(2000),
    translation: z.string().max(2000).default(''),
  })).min(1).max(MAX_LINES),
  // Line numbers to analyze in this request.
  targets: z.array(z.number().int().min(0)).min(1).max(MAX_TARGETS),
});

interface AnalysisItem {
  index: number;
  word_analysis: { word: string; meaning: string; grammar: string }[];
}

/**
 * Stage 2 of generation: word analysis for a small batch of lines.
 * The browser sends several of these in parallel; results are matched back by line number,
 * and any line the model skipped is reported in `missing` so the caller can ask again.
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

    const { language, apiKey, model: modelName, lines } = parsed.data;
    const known = new Set(lines.map(l => l.index));
    const targets = [...new Set(parsed.data.targets)].filter(t => known.has(t));

    if (targets.length === 0) {
      return NextResponse.json({ error: 'Invalid request', details: 'targets do not match any line' }, { status: 400 });
    }

    const finalApiKey = process.env.GEMINI_API_KEY || apiKey;
    if (!finalApiKey || finalApiKey === 'YOUR_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Gemini API Key is currently missing.',
        details: 'Please enter a valid API Key in the settings panel.'
      }, { status: 400 });
    }

    const selectedModel = resolveModel(modelName);
    const genAI = new GoogleGenerativeAI(finalApiKey);
    const model = genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        // Analysis explains existing text, so it runs cooler than the creative dialogue request (1.2).
        temperature: 0.3,
        // Thinking off: measured 2026-11-18 at 2-3x faster with no drop in analysis quality.
        ...thinkingOffConfig(selectedModel),
      },
    }, { timeout: GEMINI_REQUEST_TIMEOUT_MS });

    const prompt = buildAnalysisPrompt(language, lines, targets);

    const data = await generateContentWithRetry(model, prompt, {
      validate: (result) => parseModelJson<{ items?: AnalysisItem[] }>(result),
    });

    // Keep only what was asked for, first answer per line, with at least one chunk.
    const wanted = new Set(targets);
    const byIndex = new Map<number, AnalysisItem>();
    for (const item of data.items ?? []) {
      if (!wanted.has(item?.index) || byIndex.has(item.index)) continue;
      if (!Array.isArray(item.word_analysis) || item.word_analysis.length === 0) continue;
      byIndex.set(item.index, { index: item.index, word_analysis: item.word_analysis });
    }

    return NextResponse.json({
      items: targets.filter(t => byIndex.has(t)).map(t => byIndex.get(t)),
      missing: targets.filter(t => !byIndex.has(t)),
    });
  } catch (error: unknown) {
    const failure = classifyGeminiError(error);
    console.error(`[API] Error generating analysis (${failure.reason}):`, failure.message);

    return NextResponse.json({
      error: failure.reason === 'rate_limit' ? 'Rate limit exceeded' : 'Failed to generate analysis',
      details: failure.message,
      reason: failure.reason,
      retryable: failure.retryable,
    }, { status: failure.status });
  }
}
