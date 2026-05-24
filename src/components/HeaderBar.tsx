'use client';

import React from 'react';
import { RefreshCw, Mic, MessageSquare, History as HistoryIcon, Settings, Music } from 'lucide-react';

interface HeaderBarProps {
  input: string;
  mode: 'roleplay' | 'analysis';
  language: 'Vietnamese' | 'English';
  loading: boolean;
  progress: string;
  turnCount: number;
  isMerging: boolean;
  isMergedMode: boolean;
  mergedAudioUrl: string | null;
  showAdvanced: boolean;
  showTurnsPopup: boolean;
  onInputClick: () => void;
  onGenerate: () => void;
  onModeChange: (mode: 'roleplay' | 'analysis') => void;
  onLanguageChange: (lang: 'Vietnamese' | 'English') => void;
  onShowHistory: () => void;
  onToggleAdvanced: () => void;
  onToggleTurnsPopup: () => void;
}

export default function HeaderBar({
  input, mode, language, loading, progress, turnCount,
  isMerging, isMergedMode, mergedAudioUrl, showAdvanced, showTurnsPopup,
  onInputClick, onGenerate, onModeChange, onLanguageChange,
  onShowHistory, onToggleAdvanced, onToggleTurnsPopup
}: HeaderBarProps) {
  return (
    <div className="w-full space-y-4 z-10 transition-all px-2 md:px-0">
      <div className="glass px-4 lg:px-6 py-4 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-indigo-900 tracking-tighter">
                RealWait
              </h1>
              <p className="text-gray-900 text-[10px] font-bold uppercase tracking-widest">Roleplay Gen</p>
            </div>
            <div className="flex lg:hidden gap-2">
              <button onClick={onShowHistory} className="p-2 rounded-lg bg-gray-100 border border-gray-300 text-black"><HistoryIcon className="w-4 h-4" /></button>
              <button onClick={onToggleAdvanced} className="p-2 rounded-lg bg-gray-100 border border-gray-300 text-black"><Settings className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="h-px lg:h-8 w-full lg:w-px bg-gray-100" />

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div
              className="relative flex-1 lg:w-96 cursor-pointer"
              onClick={onInputClick}
            >
              <div className="w-full bg-white border border-gray-300 rounded-xl py-2.5 px-4 text-sm text-black font-medium transition-all hover:border-gray-400 min-h-[42px] flex items-center overflow-hidden whitespace-nowrap overflow-ellipsis">
                {input || (mode === 'roleplay' ? "Enter topic or word..." : "Enter sentence to analyze...")}
              </div>
            </div>

            <button
              onClick={onGenerate}
              disabled={loading}
              className={`px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-md transition-all ${loading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-900 active:scale-95'}`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progress.split(' ')[0]}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          {/* Mode Selector */}
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200 shrink-0">
            <button
              onClick={() => onModeChange('roleplay')}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-widest transition-all flex items-center gap-1 ${mode === 'roleplay' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              <RefreshCw className={`w-3 h-3 ${mode === 'roleplay' && loading ? 'animate-spin' : ''}`} />
              ROLEPLAY
            </button>
            <button
              onClick={() => onModeChange('analysis')}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold tracking-widest transition-all flex items-center gap-1 ${mode === 'analysis' ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
            >
              <MessageSquare className="w-3 h-3" />
              ANALYSIS
            </button>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200 shrink-0">
            {(['Vietnamese', 'English'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${language === lang ? 'bg-black text-white shadow-sm' : 'text-gray-500 hover:text-black'}`}
              >
                {lang === 'Vietnamese' ? 'VN' : 'EN'}
              </button>
            ))}
          </div>

          {mode === 'roleplay' && (
            <div className="relative">
              <button
                onClick={onToggleTurnsPopup}
                className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-xl shadow-sm hover:border-blue-200 transition-colors"
              >
                <MessageSquare className="w-3 h-3 text-black" />
                <span className="w-4 text-center text-[10px] font-bold text-black">{turnCount === 0 ? 'M' : turnCount}</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">Turns</span>
              </button>

              {showTurnsPopup && (
                <div className="fixed inset-0 z-40" onClick={onToggleTurnsPopup} />
              )}
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isMergedMode && mergedAudioUrl ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
              title={isMerging ? "Preparing Background Play..." : (mergedAudioUrl ? "Background Ready" : "Initializing...")}
            >
              {isMerging ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Music className="w-4 h-4" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-tight">
                {isMerging ? 'Preparing' : (mergedAudioUrl ? 'BG READY' : 'WAIT')}
              </span>
            </div>

            <button
              onClick={onShowHistory}
              className="p-2.5 rounded-xl border bg-white border-gray-200 text-gray-500 hover:bg-gray-50 relative group"
            >
              <HistoryIcon className="w-5 h-5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">History</span>
            </button>
            <button
              onClick={onToggleAdvanced}
              className="p-2.5 rounded-xl border bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
