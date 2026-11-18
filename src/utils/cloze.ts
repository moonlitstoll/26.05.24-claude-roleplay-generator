import { ScriptItem } from '../types';
import { normalizeAnalysis } from './analysis';

export type ClozeLevel = 'easy' | 'mid' | 'hard' | 'recall';

export const CLOZE_LEVELS: [ClozeLevel, string][] = [
  ['easy', '초급'],
  ['mid', '중급'],
  ['hard', '고급'],
  ['recall', '회상'],
];

export function normalizeClozeLevel(value: unknown): ClozeLevel {
  return CLOZE_LEVELS.some(([level]) => level === value) ? (value as ClozeLevel) : 'easy';
}

export type ClozePart =
  | { type: 'text'; value: string }
  | { type: 'blank'; answer: string; meaning: string; grammar: string };

export interface ClozeResult {
  ok: boolean;
  parts: ClozePart[];
  wholeSentence: boolean;
  recall: boolean;
}

// Seeded so the same line, round and level always give the same blanks.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickK(n: number, k: number, rand: () => number) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return new Set(order.slice(0, Math.min(k, n)));
}

type Piece =
  | { type: 'text'; value: string }
  | { type: 'chunk'; answer: string; meaning: string; grammar: string };

/**
 * Finds each analysed chunk in the sentence, in order, so punctuation and any words the analysis
 * skipped stay visible. A chunk that cannot be found is simply not used as a blank.
 */
function locateChunks(line: ScriptItem): Piece[] {
  const text = (line.text || '').normalize('NFC');
  const lower = text.toLowerCase();
  const search = lower.length === text.length ? lower : text;
  const pieces: Piece[] = [];
  let pos = 0;
  for (const item of normalizeAnalysis(line.word_analysis)) {
    const raw = item.word.trim().normalize('NFC');
    const needle = search === lower ? raw.toLowerCase() : raw;
    const at = search.indexOf(needle, pos);
    if (at < 0) continue;
    if (at > pos) pieces.push({ type: 'text', value: text.slice(pos, at) });
    pieces.push({ type: 'chunk', answer: text.slice(at, at + needle.length), meaning: item.meaning, grammar: item.grammar });
    pos = at + needle.length;
  }
  if (pos < text.length) pieces.push({ type: 'text', value: text.slice(pos) });
  return pieces;
}

const LEVEL_SEED: Record<ClozeLevel, number> = { easy: 1, mid: 2, hard: 3, recall: 4 };

export function buildCloze(line: ScriptItem, idx: number, round: number, level: ClozeLevel): ClozeResult {
  const recall = level === 'recall';
  const pieces = locateChunks(line);
  const chunkCount = pieces.filter(p => p.type === 'chunk').length;
  if (chunkCount === 0) return { ok: false, parts: [], wholeSentence: false, recall };

  const rand = mulberry32((idx + 1) * 100003 + round * 131 + LEVEL_SEED[level]);
  let hidden: Set<number>;
  if (chunkCount === 1 || level === 'hard' || recall) {
    hidden = new Set(Array.from({ length: chunkCount }, (_, i) => i));
  } else {
    // Easy and medium always leave at least one chunk visible as context.
    const max = chunkCount - 1;
    let count: number;
    if (level === 'easy') {
      count = Math.min(1 + Math.floor(rand() * 2), max);
    } else {
      const min = Math.min(Math.max(2, Math.ceil(chunkCount * 0.5)), max);
      count = min + Math.floor(rand() * (max - min + 1));
    }
    hidden = pickK(chunkCount, count, rand);
  }

  let chunkIndex = -1;
  const parts: ClozePart[] = pieces.map(piece => {
    if (piece.type === 'text') return piece;
    chunkIndex += 1;
    return hidden.has(chunkIndex)
      ? { type: 'blank', answer: piece.answer, meaning: piece.meaning, grammar: piece.grammar }
      : { type: 'text', value: piece.answer };
  });

  return { ok: true, parts, wholeSentence: hidden.size >= chunkCount, recall };
}
