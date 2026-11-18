import { WordAnalysisObj } from '../types';

const PUNCTUATION_ONLY = /^[\p{P}\p{S}]+$/u;
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

/** Word analysis in one shape: new sessions store objects, old ones "• word | meaning | grammar" lines. */
export function normalizeAnalysis(value: string | WordAnalysisObj[] | undefined): WordAnalysisObj[] {
  if (!value) return [];
  const items: WordAnalysisObj[] = Array.isArray(value)
    ? value
    : value.split('\n').filter(l => l.trim()).map(l => {
        const [word = '', meaning = '', grammar = ''] = l.replace(/^•\s*/, '').split('|').map(s => s.trim());
        return { word, meaning, grammar };
      });
  return items.filter(item => {
    const word = item.word?.trim();
    return word && !PUNCTUATION_ONLY.test(word);
  });
}

export type GlossPart = { type: 'word' | 'mark' | 'text'; text: string };

/** Splits the text on " + " so the plus signs can be dimmed. */
function withPlusMarks(text: string): GlossPart[] {
  return text.split(/( \+ )/).filter(Boolean).map(piece =>
    piece === ' + ' ? { type: 'mark', text: piece } : { type: 'text', text: piece }
  );
}

/**
 * One gloss line, "word / meaning / note", cut into coloured parts. Joining the parts gives the line back.
 * Only the first two slashes are separators; a line without a foreign word stays plain text.
 */
export function splitGlossLine(line: string): GlossPart[] {
  const first = line.indexOf(' / ');
  const word = first < 0 ? '' : line.slice(0, first);
  if (!word.trim() || HANGUL.test(word)) return withPlusMarks(line);

  const parts: GlossPart[] = [{ type: 'word', text: word }, { type: 'mark', text: ' / ' }];
  const rest = line.slice(first + 3);
  const second = rest.indexOf(' / ');
  if (second < 0) return [...parts, ...withPlusMarks(rest)];
  return [
    ...parts,
    ...withPlusMarks(rest.slice(0, second)),
    { type: 'mark', text: ' / ' },
    ...withPlusMarks(rest.slice(second + 3)),
  ];
}

export function glossLines(grammar: string | undefined): string[] {
  return (grammar || '').replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
}
