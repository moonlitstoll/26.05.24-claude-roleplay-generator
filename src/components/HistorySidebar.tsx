'use client';

import React from 'react';
import { History as HistoryIcon, Trash2, Volume2, X } from 'lucide-react';
import { SavedSession } from '../utils/storage';
import { sessionTitle } from '../utils/sessionTitle';

interface HistorySidebarProps {
  history: SavedSession[];
  activeId?: string;
  onLoadSession: (session: SavedSession) => void;
  onDeleteItem: (e: React.MouseEvent, id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const LANGUAGE_LABEL: Record<string, string> = { Vietnamese: '베트남어', English: '영어' };

export default function HistorySidebar({ history, activeId, onLoadSession, onDeleteItem, onClearAll, onClose }: HistorySidebarProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="저장된 대본"
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[90dvh] sm:max-h-[80dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HistoryIcon size={20} className="text-indigo-600 dark:text-indigo-400" />
            저장된 대본
          </h2>
          <button onClick={onClose} aria-label="닫기" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
          {history.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400 py-10 text-sm">아직 저장된 대본이 없어요.</p>
          )}

          {history.map(session => (
            <div
              key={session.id}
              className={`flex items-stretch rounded-xl border transition-colors ${session.id === activeId
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900'
                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <button onClick={() => onLoadSession(session)} className="flex-1 min-w-0 text-left px-3 py-2">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{sessionTitle(session.input)}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {LANGUAGE_LABEL[session.language] ?? session.language}
                  <span aria-hidden="true">·</span>
                  {new Date(session.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {session.audioMap && <Volume2 size={11} aria-label="음성 저장됨" className="text-emerald-600 dark:text-emerald-400" />}
                </span>
              </button>
              <button
                onClick={(e) => onDeleteItem(e, session.id)}
                aria-label="이 대본 삭제"
                className="shrink-0 px-3 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={onClearAll}
              className="w-full py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={15} /> 전체 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
