'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronDown, EyeOff, Shuffle } from 'lucide-react';
import { CLOZE_LEVELS, ClozeLevel } from '../utils/cloze';

interface StudyToolbarProps {
  drillMode: boolean;
  drillLevel: ClozeLevel;
  wrongCount: number;
  mistakeOnly: boolean;
  onToggleDrill: () => void;
  onPickLevel: (level: ClozeLevel) => void;
  onNewRound: () => void;
  onToggleMistakes: () => void;
}

const CHIP_BASE = 'shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-[min(0.9vw,4px)] px-[min(1.6vw,6px)] text-[min(3.1vw,13px)] font-bold transition-colors';
const CHIP_ICON = 'w-[min(3.4vw,14px)] h-[min(3.4vw,14px)] shrink-0';
const POPOVER_WIDTH = 240;

export default function StudyToolbar({
  drillMode, drillLevel, wrongCount, mistakeOnly,
  onToggleDrill, onPickLevel, onNewRound, onToggleMistakes,
}: StudyToolbarProps) {
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const levelLabel = CLOZE_LEVELS.find(([level]) => level === drillLevel)?.[1] ?? '초급';

  const openLevels = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
    setAnchor({ left, bottom: rect.bottom });
  };

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95">
      <div className="max-w-3xl mx-auto px-3 md:px-6 py-0.5 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`shrink-0 h-6 inline-flex items-stretch rounded-lg border overflow-hidden ${drillMode ? 'border-indigo-600' : 'border-indigo-100 dark:border-indigo-900'}`}>
          <button
            onClick={onToggleDrill}
            aria-pressed={drillMode}
            aria-label={drillMode ? '가리기 끄기' : undefined}
            className={`${CHIP_BASE} ${drillMode
              ? 'min-w-8 bg-indigo-600 text-white hover:bg-indigo-700'
              : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}`}
          >
            <EyeOff className={CHIP_ICON} />{!drillMode && ' 가리기'}
          </button>
          {drillMode && (
            <button
              onClick={openLevels}
              aria-label="가리기 난이도와 새 문제"
              aria-haspopup="dialog"
              className={`${CHIP_BASE} border-l border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-700`}
            >
              {levelLabel}
              <ChevronDown className={CHIP_ICON} />
            </button>
          )}
        </div>

        {(wrongCount > 0 || mistakeOnly) && (
          <button
            onClick={onToggleMistakes}
            aria-pressed={mistakeOnly}
            className={`${CHIP_BASE} h-6 rounded-lg border ${mistakeOnly
              ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500/25 dark:hover:bg-amber-500/40 dark:text-amber-100 dark:border-amber-600'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'}`}
          >
            <AlertCircle className={CHIP_ICON} />
            오답 {wrongCount}
          </button>
        )}
      </div>

      {/* Rendered on body: the chip row scrolls sideways and would clip a popover placed inside it. */}
      {anchor && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setAnchor(null)} />
          <div
            role="dialog"
            aria-label="가리기 난이도"
            className="fixed z-[61] p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg"
            style={{ left: anchor.left, top: anchor.bottom + 6, width: POPOVER_WIDTH }}
          >
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {CLOZE_LEVELS.map(([level, label]) => (
                <button
                  key={level}
                  onClick={() => { onPickLevel(level); setAnchor(null); }}
                  aria-pressed={drillLevel === level}
                  className={`flex-1 h-10 px-2 text-[13px] font-bold transition-colors ${drillLevel === level
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { onNewRound(); setAnchor(null); }}
              className="mt-2 w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg border text-[13px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" /> 새 문제
              <span className="font-normal text-xs text-slate-400 dark:text-slate-500">· 오답 표시도 지움</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
