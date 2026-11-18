import { GenerativeModel, GenerateContentResult } from '@google/generative-ai';

export type GeminiFailReason =
    | 'rate_limit'
    | 'overloaded'
    | 'timeout'
    | 'network'
    | 'bad_output'
    | 'bad_request'
    | 'other';

export interface GeminiFailure {
    reason: GeminiFailReason;
    retryable: boolean;
    /** HTTP status the route should answer with. */
    status: number;
    message: string;
}

/** Thrown when the model answered but the answer could not be used (e.g. broken JSON). */
export class BadModelOutputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BadModelOutputError';
    }
}

// Per-request timeout handed to the SDK. Kept under the 60s Vercel function limit.
export const GEMINI_REQUEST_TIMEOUT_MS = 45000;

/**
 * Sorts a Gemini failure into "worth retrying" (rate limit, server overload, network, timeout,
 * unusable output) and "retrying will not help" (bad key, bad request).
 */
export function classifyGeminiError(error: unknown): GeminiFailure {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : '';
    const statusFromError = (error as { status?: unknown } | null)?.status;
    const statusFromMessage = message.match(/\[(\d{3})\b/)?.[1];
    const status = typeof statusFromError === 'number'
        ? statusFromError
        : (statusFromMessage ? Number(statusFromMessage) : 0);

    if (error instanceof BadModelOutputError) {
        return { reason: 'bad_output', retryable: true, status: 502, message };
    }
    if (status === 429 || /Resource exhausted|Too Many Requests/i.test(message)) {
        return { reason: 'rate_limit', retryable: true, status: 429, message };
    }
    if (status >= 500 && status <= 599) {
        return { reason: 'overloaded', retryable: true, status: 503, message };
    }
    if (name === 'AbortError' || /aborted|timed? ?out/i.test(message)) {
        return { reason: 'timeout', retryable: true, status: 504, message };
    }
    if (/fetch failed|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network/i.test(message)) {
        return { reason: 'network', retryable: true, status: 503, message };
    }
    if (status >= 400 && status <= 499) {
        return { reason: 'bad_request', retryable: false, status: 400, message };
    }
    return { reason: 'other', retryable: false, status: 500, message };
}

/**
 * 2.5 Flash / Flash Lite accept thinkingBudget 0 (no thinking tokens). 2.5 Pro rejects 0, so it is left alone.
 * Used for the word-analysis request only; the dialogue request keeps the model default.
 */
export function thinkingOffConfig(modelName: string): Record<string, unknown> {
    return (modelName.includes('2.5') && !modelName.includes('pro'))
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {};
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calls Gemini and retries quick, transient failures (rate limit, 5xx, network, unusable output).
 * Timeouts are not retried here: the serverless function only lives 60s, so the caller (browser) retries those.
 * `validate` lets the caller turn an unusable answer into a retryable failure by throwing BadModelOutputError.
 */
export async function generateContentWithRetry<T = GenerateContentResult>(
    model: GenerativeModel,
    prompt: string,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        /** Do not start another attempt once this much time has passed. */
        budgetMs?: number;
        validate?: (result: GenerateContentResult) => T;
    } = {}
): Promise<T> {
    const { maxRetries = 2, initialDelay = 1500, budgetMs = 25000, validate } = options;
    const modelName = (model as unknown as { model?: string }).model || 'unknown-model';
    const startedAt = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return validate ? validate(result) : (result as unknown as T);
        } catch (error: unknown) {
            lastError = error;
            const failure = classifyGeminiError(error);
            const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
            const outOfTime = Date.now() - startedAt + delay > budgetMs;

            if (!failure.retryable || failure.reason === 'timeout' || attempt >= maxRetries || outOfTime) {
                console.error(`[Gemini][${modelName}] Failed after ${attempt + 1} attempt(s) (${failure.reason}):`, failure.message);
                throw error;
            }

            console.warn(`[Gemini][${modelName}] Attempt ${attempt + 1} failed (${failure.reason}). Retrying in ${Math.round(delay)}ms...`);
            await sleep(delay);
        }
    }

    throw lastError;
}

/** Parses the model's JSON answer; a broken answer becomes a retryable BadModelOutputError. */
export function parseModelJson<T>(result: GenerateContentResult): T {
    let text = result.response.text();
    if (text.includes('```')) {
        text = text.replace(/```json|```/g, '').trim();
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new BadModelOutputError('Model returned invalid JSON');
    }
}
