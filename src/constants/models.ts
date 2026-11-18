// Single source of truth for selectable Gemini models (settings UI + API routes).
// gemini-2.0-flash was removed: it is no longer served by the Gemini API (checked 2026-11-18).
export const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (recommended)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (faster, thinner analysis)' },
] as const;

export const DEFAULT_MODEL = 'gemini-2.5-flash';

// Unknown or retired ids (e.g. a stale value in localStorage) fall back to the default.
export function resolveModel(id?: string | null): string {
  return MODELS.some(m => m.id === id) ? (id as string) : DEFAULT_MODEL;
}
