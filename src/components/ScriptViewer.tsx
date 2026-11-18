'use client';

import React from 'react';
import { Languages, BookOpen, RefreshCw } from 'lucide-react';
import { GeneratedSet, ScriptItem, WordAnalysisObj } from '../types';

interface ScriptViewerProps {
  generatedSets: GeneratedSet[];
  currentSentenceIndex: number;
  showAnalysis: boolean;
  scrollRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onPlaySentence: (index: number) => void;
  /** Shown on lines still waiting for analysis (e.g. why a retry is in progress). */
  analysisNote?: string;
  onRetryAnalysis?: () => void;
}

function WordAnalysisArray({ items }: { items: WordAnalysisObj[] }) {
  const filtered = items.filter(item => {
    const cleanWord = item.word?.trim();
    return cleanWord && !(/^[\p{P}\p{S}]+$/u.test(cleanWord));
  });

  return (
    <>
      {filtered.map((item, wIdx) => (
        <div key={wIdx} className={`px-3 md:px-4 py-1.5 flex items-start gap-2 hover:bg-emerald-50/50 transition-colors ${wIdx !== filtered.length - 1 ? 'border-b border-gray-100' : ''}`}>
          <div className="shrink-0 max-w-[30%] w-full break-words">
            <span className="text-emerald-700 font-semibold text-base">{item.word}</span>
          </div>
          <div className="flex-1">
            <p className="text-[#1a1a1a] font-semibold text-sm leading-[1.7]">{item.meaning}</p>
            {item.grammar && (
              <p className="text-gray-600 text-xs mt-0.5 whitespace-pre-wrap leading-[1.7]">{item.grammar}</p>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function WordAnalysisString({ text }: { text: string }) {
  const lines = text.split('\n').filter((w: string) => w.trim());

  return (
    <>
      {lines.map((wordLine: string, wIdx: number) => {
        const cleanLine = wordLine.replace(/^•\s*/, '');
        const parts = cleanLine.split('|').map((s: string) => s.trim());
        const word = parts[0];
        const meaning = parts[1] || '';
        const grammarRole = parts[2] || '';
        return (
          <div key={wIdx} className={`px-4 py-3 flex items-start gap-2 hover:bg-emerald-50/50 transition-colors ${wIdx !== lines.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div className="shrink-0 max-w-[30%] w-full break-words">
              <span className="text-emerald-700 font-bold text-base">{word}</span>
            </div>
            <div className="flex-1">
              <p className="text-black font-bold text-sm leading-snug">{meaning}</p>
              {grammarRole && (
                <p className="text-black text-xs mt-0.5 whitespace-pre-wrap leading-snug">{grammarRole}</p>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

const ScriptLine = React.memo(function ScriptLine({
  line, isActive, scrollRefs, onPlaySentence, showAnalysis, pendingNote, onRetryAnalysis
}: {
  line: ScriptItem;
  isActive: boolean;
  scrollRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onPlaySentence: (index: number) => void;
  showAnalysis: boolean;
  pendingNote?: string;
  onRetryAnalysis?: () => void;
}) {
  const segmentKey = `${line.segmentIndex ?? 0}`;

  return (
    <div
      ref={el => { scrollRefs.current[segmentKey] = el; }}
      className={`flex flex-col md:gap-4 group transition-all duration-500 snap-start snap-always
        ${line.speaker === 'A' ? 'md:flex-row' : 'md:flex-row-reverse'}
        ${isActive ? 'scale-[1.00] md:scale-[1.01]' : ''}`}
    >
      {/* Desktop Speaker Indicator */}
      <div className={`hidden md:flex w-10 h-10 rounded-full items-center justify-center shrink-0 font-bold text-sm shadow-md transition-all self-start mt-2 ${isActive
        ? 'ring-4 ring-black/20 ring-offset-2 scale-110 z-30'
        : ''
        } ${line.speaker === 'A' ? 'bg-black text-white' : 'bg-gray-200 text-black border border-gray-400'
        }`}>
        {line.speaker}
      </div>

      <div
        className={`w-full md:max-w-[85%] rounded-none md:rounded-3xl transition-all relative group/item shadow-sm border-b md:border border-gray-200 cursor-pointer overflow-hidden ${isActive
          ? 'border-l-4 border-l-blue-600 bg-blue-50/30 ring-0 md:ring-1 ring-blue-100 shadow-lg z-20'
          : (line.speaker === 'A' ? 'bg-white hover:shadow-md' : 'bg-gray-50 hover:shadow-md')
          }`}
        onClick={() => line.segmentIndex != null && onPlaySentence(line.segmentIndex)}
      >
        {/* STICKY HEADER */}
        <div className={`p-4 transition-all ${isActive ? 'sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-blue-100/50 py-4 shadow-sm' : 'p-3'}`}>
          <div className="flex flex-col md:block">
            {/* Mobile Speaker Badge */}
            <div className="flex md:hidden items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${line.speaker === 'A' ? 'bg-black text-white' : 'bg-gray-200 text-black border border-gray-400'}`}>
                {line.speaker}
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Speaker {line.speaker}</span>
            </div>

            <div className="flex justify-between items-start gap-4">
              <p className="text-lg md:text-2xl font-semibold text-[#1a1a1a] mb-0 leading-[1.7] flex-1 text-left tracking-normal">{line.text}</p>
            </div>
          </div>
        </div>

        {/* NON-STICKY BODY */}
        <div className="p-3 md:p-4 pt-0">
          {showAnalysis && (
            <div className="mt-1 pt-1 border-t border-gray-100 space-y-2 animate-in fade-in duration-300">
              <div className="bg-gray-50 rounded-xl p-1.5 md:p-2 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-black">
                  <Languages className="w-4 h-4" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">Translation</span>
                </div>
                <p className="text-[#1a1a1a] font-semibold leading-[1.7]">{line.translation}</p>
              </div>

              {!line.word_analysis && line.analysisStatus === 'pending' && (
                <div className="flex items-center gap-2 text-emerald-700 pl-1 py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs font-semibold">{pendingNote || '풀이 작성 중…'}</span>
                </div>
              )}

              {!line.word_analysis && line.analysisStatus === 'failed' && (
                <div className="flex items-center justify-between gap-2 pl-1 py-1">
                  <span className="text-xs font-semibold text-gray-500">풀이를 받지 못했습니다.</span>
                  {onRetryAnalysis && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRetryAnalysis(); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-black hover:bg-gray-50 active:scale-95"
                    >
                      <RefreshCw className="w-3 h-3" />
                      다시 받기
                    </button>
                  )}
                </div>
              )}

              {line.word_analysis && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 pl-1">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Word Analysis</span>
                  </div>
                  <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden shadow-sm">
                    {Array.isArray(line.word_analysis) ? (
                      <WordAnalysisArray items={line.word_analysis} />
                    ) : (
                      <WordAnalysisString text={line.word_analysis as string} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default React.memo(function ScriptViewer({ generatedSets, currentSentenceIndex, showAnalysis, scrollRefs, onPlaySentence, analysisNote, onRetryAnalysis }: ScriptViewerProps) {
  return (
    <div className="glass p-1 md:p-6 rounded-none md:rounded-3xl min-h-screen flex flex-col bg-white shadow-sm border-0 md:border border-gray-300 mb-24 md:mb-20">
      <div className="space-y-2 md:space-y-4">
        {generatedSets.map((set, setIdx) => (
          <div key={set.id} className="space-y-1">
            {generatedSets.length > 1 && (
              <div className="relative flex items-center justify-center pt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <span className="relative bg-white px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Set {setIdx + 1}
                </span>
              </div>
            )}

            {set.script.map((line, idx) => (
              <ScriptLine
                key={idx}
                line={line}
                isActive={currentSentenceIndex === line.segmentIndex}
                scrollRefs={scrollRefs}
                onPlaySentence={onPlaySentence}
                showAnalysis={showAnalysis}
                pendingNote={line.analysisStatus === 'pending' ? analysisNote : undefined}
                onRetryAnalysis={line.analysisStatus === 'failed' ? onRetryAnalysis : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
