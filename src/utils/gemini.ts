import { GenerativeModel, GenerateContentResult } from '@google/generative-ai';

/**
 * Generates content using the Gemini model with an exponential backoff retry mechanism.
 * Specifically handles 429 (Too Many Requests) errors.
 */
export async function generateContentWithRetry(
    model: GenerativeModel,
    prompt: string,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<GenerateContentResult> {
    let lastError: unknown;
    // Access internal model name for logging
    const modelName = (model as unknown as { model?: string }).model || 'unknown-model';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`[Gemini][${modelName}] Attempt ${attempt + 1}: Retrying in ${delay}ms due to rate limit...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            return await model.generateContent(prompt);
        } catch (error: unknown) {
            lastError = error;
            const errorMessage = error instanceof Error ? error.message : String(error);

            const isRateLimit = errorMessage.includes('429') ||
                errorMessage.includes('Resource exhausted') ||
                errorMessage.includes('Too Many Requests');

            if (isRateLimit && attempt < maxRetries) {
                console.warn(`[Gemini][${modelName}] Rate limit hit on attempt ${attempt + 1}.`);
                continue;
            }

            console.error(`[Gemini][${modelName}] Error after ${attempt + 1} attempts:`, errorMessage);
            throw error;
        }
    }

    throw lastError;
}
