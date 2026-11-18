'use client';

import React from 'react';
import { ChevronDown, Home, Music, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react';

interface HeaderBarProps {
  title: string;
  busy: boolean;
  isMerging: boolean;
  backgroundReady: boolean;
  toolbarAvailable: boolean;
  toolbarOpen: boolean;
  toolbarModesOn: boolean;
  onHome: () => void;
  onShowHistory: () => void;
  onOpenSettings: () => void;
  onToggleToolbar: () => void;
}

const ICON_BTN = 'p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-all';

export default function HeaderBar({
  title, busy, isMerging, backgroundReady, toolbarAvailable, toolbarOpen, toolbarModesOn,
  onHome, onShowHistory, onOpenSettings, onToggleToolbar,
}: HeaderBarProps) {
  return (
    <header className="relative z-50 bg-white/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700 flex-none h-10 sm:h-11 flex items-center justify-between px-2 sm:px-4">
      <button onClick={onHome} aria-label="새 대본 만들기" title="새 대본 만들기" className={ICON_BTN}>
        <Home size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <button
          onClick={onShowHistory}
          aria-label="저장된 대본 목록 열기"
          className="w-full text-center px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors group"
        >
          <span className="flex items-center justify-center gap-1.5 text-slate-900 dark:text-slate-100">
            {busy && <RefreshCw size={13} className="shrink-0 animate-spin text-slate-400 dark:text-slate-500" />}
            <span className={`text-sm font-bold truncate group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors ${busy ? 'text-slate-500 dark:text-slate-400' : ''}`}>
              {title}
            </span>
          </span>
        </button>
      </div>

      <div className="flex items-center">
        {(isMerging || backgroundReady) && (
          <span
            title={isMerging ? '백그라운드 재생 준비 중' : '백그라운드 재생 준비됨'}
            className={`hidden sm:inline-flex p-1.5 ${isMerging ? 'text-slate-400 dark:text-slate-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}
          >
            <Music size={16} />
          </span>
        )}
        {toolbarAvailable && (
          <button
            onClick={onToggleToolbar}
            aria-pressed={toolbarOpen}
            aria-label={toolbarOpen ? '도구 줄 숨기기' : '도구 줄 열기'}
            className={`relative h-7 px-2 mr-0.5 inline-flex items-center gap-1 rounded-lg border text-xs font-bold transition-all ${toolbarOpen
              ? 'text-white bg-indigo-600 border-indigo-600'
              : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}`}
          >
            <SlidersHorizontal size={13} />
            도구
            <ChevronDown size={12} className={`transition-transform ${toolbarOpen ? 'rotate-180' : ''}`} />
            {!toolbarOpen && toolbarModesOn && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900">
                <span className="sr-only">켜진 모드 있음</span>
              </span>
            )}
          </button>
        )}
        <button onClick={onOpenSettings} aria-label="설정" title="설정" className={ICON_BTN}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
