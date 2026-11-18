'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Play, RefreshCw } from 'lucide-react';
import { GeneratedSet, ScriptItem } from '../types';
import { normalizeAnalysis } from '../utils/analysis';
import { ClozeLevel } from '../utils/cloze';
import ClozeDrill from './ClozeDrill';
import GlossText from './GlossText';

interface ScriptViewerProps {
  generatedSets: GeneratedSet[];
  currentSentenceIndex: number;
  showAnalysis: boolean;
  showBreakdown: boolean;
  scrollRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onPlaySentence: (index: number) => void;
  /** Shown on lines still waiting for analysis (e.g. why a retry is in progress). */
  analysisNote?: string;
  onRetryAnalysis?: () => void;
  drillMode: boolean;
  drillLevel: ClozeLevel;
  drillRound: number;
  wrongIndices: number[];
  mistakeOnly: boolean;
  onMarkAnswer: (idx: number, known: boolean) => void;
  onExitMistakes: () => void;
}

// Keeps the visible pill small while giving a finger a 40px target, without making the card taller.
const HIT_AREA = "relative before:content-[''] before:absolute before:-inset-x-1 before:-inset-y-3";

const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    fn();
  }
};

interface ScriptLineProps {
  line: ScriptItem;
  idx: number;
  isActive: boolean;
  isWrong: boolean;
  scrollRefs: ScriptViewerProps['scrollRefs'];
  onPlaySentence: (index: number) => void;
  showAnalysis: boolean;
  showBreakdown: boolean;
  pendingNote?: string;
  onRetryAnalysis?: () => void;
  drillMode: boolean;
  drillLevel: ClozeLevel;
  drillRound: number;
  reviewing: boolean;
  onMarkAnswer: (idx: number, known: boolean) => void;
}

const ScriptLine = React.memo(function ScriptLine({
  line, idx, isActive, isWrong, scrollRefs, onPlaySentence, showAnalysis, showBreakdown,
  pendingNote, onRetryAnalysis, drillMode, drillLevel, drillRound, reviewing, onMarkAnswer,
}: ScriptLineProps) {
  const play = () => onPlaySentence(idx);

  const analysis = useMemo(() => normalizeAnalysis(line.word_analysis), [line.word_analysis]);
  const hasBreakdown = analysis.some(item => item.grammar?.trim());

  // The eye button sets the default for all cards; tapping a card flips just that card.
  const [flipped, setFlipped] = useState(false);
  const [prevShowBreakdown, setPrevShowBreakdown] = useState(showBreakdown);
  if (prevShowBreakdown !== showBreakdown) {
    setPrevShowBreakdown(showBreakdown);
    setFlipped(false);
  }
  const breakdownOpen = showBreakdown !== flipped;
  const toggleBreakdown = () => setFlipped(f => !f);

  return (
    <div
      ref={el => { scrollRefs.current[`${idx}`] = el; }}
      data-idx={idx}
      className={`relative transition-colors duration-300 mb-1 rounded-xl border border-l-[4px] p-2 sm:px-4 sm:py-3 ${isActive
        ? 'bg-transparent border-l-purple-700 dark:border-l-purple-400 border-t-slate-100 dark:border-t-slate-700 border-r-slate-100 dark:border-r-slate-700 border-b-slate-100 dark:border-b-slate-700 shadow-md z-10'
        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
        {isWrong && (
          <span title="몰랐던 문장" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 text-[10px] font-black">
            !
          </span>
        )}
        <button
          onClick={play}
          aria-label={`${idx + 1}번 문장 재생`}
          className={`${HIT_AREA} flex items-center gap-1 px-1.5 py-0 leading-4 rounded-full text-[11px] font-bold font-mono tracking-wide transition-all ${isActive
            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
        >
          <Play size={9} fill="currentColor" /> {idx + 1}
        </button>
        {line.speaker && (
          <span className={`px-1.5 py-0 leading-4 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${isActive
            ? 'bg-purple-600 text-white border-purple-700 dark:border-purple-400 shadow-sm'
            : 'bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800 border-slate-900 dark:border-slate-300 opacity-80'}`}>
            {line.speaker}
          </span>
        )}
      </div>

      {drillMode ? (
        <ClozeDrill
          // A new key starts the line covered again: new level, new round, or entering review.
          key={`cloze-${drillLevel}-${drillRound}-${reviewing ? 'review' : 'all'}`}
          line={line}
          idx={idx}
          level={drillLevel}
          round={drillRound}
          onMark={onMarkAnswer}
          onJump={play}
        />
      ) : (
        <>
          {/* Vietnamese stays at medium weight: heavier strokes fill in the tone marks on a phone. */}
          <div
            onClick={play}
            onKeyDown={onKeyActivate(play)}
            role="button"
            tabIndex={0}
            aria-label={`${idx + 1}번 문장 재생`}
            className={`text-lg sm:text-xl md:text-2xl leading-snug cursor-pointer mb-0.5 px-1 font-medium ${isActive ? 'text-black dark:text-white' : 'text-slate-900 dark:text-slate-100'}`}
          >
            {line.text}
          </div>

          {showAnalysis && (
            <div className="mt-0.5 pt-1 border-t border-slate-100 dark:border-slate-700">
              {line.translation && (
                <div onClick={play} className="rounded-xl px-2.5 py-1 border mb-1 bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900 cursor-pointer">
                  <p className="text-slate-700 dark:text-slate-300 text-[16px] leading-[1.5] whitespace-pre-line font-medium">
                    {line.translation.replace(/\\n/g, '\n')}
                  </p>
                </div>
              )}

              {analysis.length === 0 && line.analysisStatus === 'pending' && (
                <div className="flex items-center gap-2 px-1 py-1 text-slate-500 dark:text-slate-400">
                  <RefreshCw size={13} className="animate-spin shrink-0" />
                  <span className="text-[13px] font-bold">{pendingNote || '풀이 작성 중…'}</span>
                </div>
              )}

              {analysis.length === 0 && line.analysisStatus === 'failed' && (
                <div className="py-2 px-3 my-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 min-w-0">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span className="text-[13px] font-bold leading-tight">풀이를 받지 못했어요</span>
                  </div>
                  {onRetryAnalysis && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetryAnalysis(); }}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 dark:bg-amber-500/25 dark:hover:bg-amber-500/40 dark:text-amber-100 dark:border dark:border-amber-600 transition-colors"
                    >
                      <RefreshCw size={13} /> 다시 받기
                    </button>
                  )}
                </div>
              )}

              {analysis.length > 0 && (
                <div
                  onClick={hasBreakdown ? toggleBreakdown : undefined}
                  onKeyDown={hasBreakdown ? onKeyActivate(toggleBreakdown) : undefined}
                  role={hasBreakdown ? 'button' : undefined}
                  tabIndex={hasBreakdown ? 0 : undefined}
                  aria-expanded={hasBreakdown ? breakdownOpen : undefined}
                  aria-label={hasBreakdown ? (breakdownOpen ? '단어 풀이 접기' : '단어 풀이 펼치기') : undefined}
                  className={`px-1 space-y-0.5 text-slate-800 dark:text-slate-200 text-[16px] leading-[1.5] ${hasBreakdown ? 'cursor-pointer' : ''}`}
                >
                  {analysis.map((item, i) => (
                    <div key={i} className="font-medium">
                      <strong className="text-emerald-800 dark:text-emerald-300 font-semibold">{item.word}</strong>
                      {item.meaning && <span> : {item.meaning}</span>}
                      {hasBreakdown && i === analysis.length - 1 && (
                        <span aria-hidden="true" className="float-right mt-1 text-slate-300 dark:text-slate-600">
                          {breakdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      )}
                      {breakdownOpen && item.grammar && (
                        <span className="block text-slate-600 dark:text-slate-300 font-normal">
                          <GlossText text={item.grammar} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default React.memo(function ScriptViewer({
  generatedSets, currentSentenceIndex, showAnalysis, showBreakdown, scrollRefs, onPlaySentence,
  analysisNote, onRetryAnalysis, drillMode, drillLevel, drillRound, wrongIndices, mistakeOnly,
  onMarkAnswer, onExitMistakes,
}: ScriptViewerProps) {
  const wrongSet = useMemo(() => new Set(wrongIndices), [wrongIndices]);

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-6 pt-2 pb-32">
      {mistakeOnly && wrongIndices.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-slate-600 dark:text-slate-300 font-bold">이 대본의 오답을 다 맞혔어요!</p>
          <button
            onClick={onExitMistakes}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-black/40"
          >
            전체 대본으로 돌아가기
          </button>
        </div>
      ) : generatedSets.map(set => (
        <div key={set.id}>
          {set.script.map((line, i) => {
            const idx = line.segmentIndex ?? i;
            // Line numbers are kept in review mode; only the rendering is filtered.
            if (mistakeOnly && !wrongSet.has(idx)) return null;
            return (
              <ScriptLine
                key={i}
                line={line}
                idx={idx}
                isActive={currentSentenceIndex === idx}
                isWrong={wrongSet.has(idx)}
                scrollRefs={scrollRefs}
                onPlaySentence={onPlaySentence}
                showAnalysis={showAnalysis}
                showBreakdown={showBreakdown}
                pendingNote={line.analysisStatus === 'pending' ? analysisNote : undefined}
                onRetryAnalysis={line.analysisStatus === 'failed' ? onRetryAnalysis : undefined}
                drillMode={drillMode}
                drillLevel={drillLevel}
                drillRound={drillRound}
                reviewing={mistakeOnly}
                onMarkAnswer={onMarkAnswer}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});
