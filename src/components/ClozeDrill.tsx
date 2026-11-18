'use client';

import React, { useMemo, useState } from 'react';
import { Check, Languages, X } from 'lucide-react';
import { ScriptItem } from '../types';
import { buildCloze, ClozeLevel } from '../utils/cloze';
import GlossText from './GlossText';

interface ClozeDrillProps {
  line: ScriptItem;
  idx: number;
  level: ClozeLevel;
  round: number;
  onMark: (idx: number, known: boolean) => void;
  onJump: () => void;
}

// One box per chunk with a separate underline per word. The real word sits underneath in transparent
// text so the blank is as wide as the answer; select-none keeps it from being revealed by dragging.
function BlankChunk({ text, label, onReveal }: { text: string; label: string; onReveal: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onReveal(); }}
      aria-label={label}
      className="align-baseline mx-0.5 px-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors inline-flex flex-wrap gap-x-1.5 max-w-full"
    >
      {text.split(/\s+/).filter(Boolean).map((word, i) => (
        <span key={i} className="border-b-2 border-amber-400 text-transparent select-none">{word}</span>
      ))}
    </button>
  );
}

/** Tap a blank to reveal it; once everything is open the learner marks the line known or unknown. */
export default function ClozeDrill({ line, idx, level, round, onMark, onJump }: ClozeDrillProps) {
  const drill = useMemo(() => buildCloze(line, idx, round, level), [line, idx, round, level]);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [marked, setMarked] = useState<boolean | null>(null);

  if (!drill.ok) {
    return (
      <div onClick={onJump} className="text-lg sm:text-xl leading-snug px-1 font-medium text-slate-400 dark:text-slate-500 cursor-pointer">
        {line.text}
        <span className="ml-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">(풀이가 없어 가릴 수 없어요)</span>
      </div>
    );
  }

  const blankIdxs = drill.parts.flatMap((part, i) => (part.type === 'blank' ? [i] : []));
  const allRevealed = blankIdxs.every(i => revealed.has(i));

  const reveal = (i: number) => setRevealed(prev => new Set(prev).add(i));
  const revealAll = () => setRevealed(new Set(blankIdxs));
  const hide = (i: number) => {
    setRevealed(prev => { const next = new Set(prev); next.delete(i); return next; });
    setMarked(null);
  };
  const hideAll = () => { setRevealed(new Set()); setMarked(null); };
  const mark = (known: boolean) => { setMarked(known); onMark(idx, known); };

  return (
    <div onClick={onJump} className="px-1 cursor-pointer">
      {drill.recall && line.translation && (
        // Tapping the hint must not play the line: the audio would give the answer away.
        <div onClick={(e) => e.stopPropagation()} className="mb-2 rounded-xl px-3 py-1.5 border bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900 cursor-default">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] mb-0.5">
            <Languages size={12} /> 번역을 보고 원문을 말해 보세요
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-snug whitespace-pre-line font-medium">
            {line.translation.replace(/\\n/g, '\n')}
          </p>
        </div>
      )}

      <div className="text-lg sm:text-xl md:text-2xl leading-relaxed font-medium text-slate-900 dark:text-slate-100 mb-2">
        {drill.parts.map((part, i) => {
          if (part.type === 'text') return <span key={i}>{part.value}</span>;
          if (revealed.has(i)) {
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); if (drill.wholeSentence) hideAll(); else hide(i); }}
                aria-label="다시 가리기"
                className="align-baseline text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded px-1 transition-colors"
              >
                {part.answer}
              </button>
            );
          }
          return (
            <BlankChunk
              key={i}
              text={part.answer}
              label={drill.wholeSentence ? '빈칸, 누르면 문장 전체 공개' : '빈칸, 누르면 공개'}
              onReveal={() => (drill.wholeSentence ? revealAll() : reveal(i))}
            />
          );
        })}
      </div>

      {allRevealed && (
        <div className="mb-2 space-y-1">
          {drill.parts.map((part, i) => part.type === 'blank' && (
            <div key={i} className="text-[13px] leading-snug text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{part.answer}</span>
              {part.meaning && <span> : {part.meaning}</span>}
              {part.grammar && <span className="block"><GlossText text={part.grammar} /></span>}
            </div>
          ))}
        </div>
      )}

      {/* Stays visible after answering, so a wrong tap can be corrected. */}
      {allRevealed && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">알았나요?</span>
          <button
            onClick={(e) => { e.stopPropagation(); mark(true); }}
            aria-pressed={marked === true}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 ${marked === true ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <Check size={13} /> 알았음
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); mark(false); }}
            aria-pressed={marked === false}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 ${marked === false ? 'ring-2 ring-amber-500' : ''}`}
          >
            <X size={13} /> 몰랐음
          </button>
        </div>
      )}
    </div>
  );
}
