'use client';

import React from 'react';
import { ArrowLeft, History as HistoryIcon, Mic, RefreshCw } from 'lucide-react';

type Mode = 'roleplay' | 'analysis';
type Language = 'Vietnamese' | 'English';

interface ComposePanelProps {
  input: string;
  mode: Mode;
  language: Language;
  turnCount: number;
  loading: boolean;
  hasScript: boolean;
  onInputChange: (value: string) => void;
  onModeChange: (mode: Mode) => void;
  onLanguageChange: (language: Language) => void;
  onTurnCountChange: (count: number) => void;
  onGenerate: () => void;
  onShowHistory: () => void;
  onBackToScript: () => void;
}

const LABEL = 'text-sm font-bold text-slate-700 dark:text-slate-300';

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex-1 py-2 text-sm font-bold transition-colors ${value === option.value
            ? 'bg-indigo-600 text-white'
            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function ComposePanel({
  input, mode, language, turnCount, loading, hasScript,
  onInputChange, onModeChange, onLanguageChange, onTurnCountChange,
  onGenerate, onShowHistory, onBackToScript,
}: ComposePanelProps) {
  return (
    <div className="max-w-xl mx-auto px-3 py-4 sm:py-8 space-y-4">
      <p className="px-1 text-sm text-slate-500 dark:text-slate-400">주제를 적으면 대본과 음성, 단어 풀이를 만들어 드려요.</p>

      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
        <div className="space-y-2">
          <label htmlFor="compose-input" className={LABEL}>{mode === 'roleplay' ? '주제' : '분석할 문장'}</label>
          <textarea
            id="compose-input"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            rows={4}
            placeholder={mode === 'roleplay' ? '상황, 주제, 단어를 적어 주세요. 비워 두면 임의로 정합니다.' : '분석할 문장을 그대로 붙여 넣어 주세요.'}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-base resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="space-y-2">
          <span className={LABEL}>종류</span>
          <Segmented
            value={mode}
            onChange={onModeChange}
            options={[{ value: 'roleplay', label: '대화' }, { value: 'analysis', label: '문장 분석' }]}
          />
        </div>

        <div className="space-y-2">
          <span className={LABEL}>언어</span>
          <Segmented
            value={language}
            onChange={onLanguageChange}
            options={[{ value: 'Vietnamese', label: '베트남어' }, { value: 'English', label: '영어' }]}
          />
        </div>

        {mode === 'roleplay' && (
          <div className="space-y-2">
            <span className={LABEL}>주고받는 횟수</span>
            <Segmented
              value={turnCount}
              onChange={onTurnCountChange}
              options={[0, 1, 2, 3, 4, 5].map(n => ({ value: n, label: n === 0 ? '독백' : String(n) }))}
            />
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={loading}
          className="w-full py-3 rounded-xl inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700/60 disabled:text-slate-400 text-white font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-black/40 disabled:shadow-none"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Mic size={16} />}
          대본 만들기
        </button>
      </div>

      <div className="flex gap-2">
        {hasScript && (
          <button onClick={onBackToScript} className="flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft size={15} /> 지금 대본으로
          </button>
        )}
        <button onClick={onShowHistory} className="flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <HistoryIcon size={15} /> 저장된 대본
        </button>
      </div>
    </div>
  );
}
