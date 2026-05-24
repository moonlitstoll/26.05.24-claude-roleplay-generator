'use client';

import React from 'react';
import { History as HistoryIcon, Trash2, X, Mic } from 'lucide-react';
import { SavedSession } from '../utils/storage';

interface HistorySidebarProps {
  history: SavedSession[];
  onLoadSession: (session: SavedSession) => void;
  onDeleteItem: (e: React.MouseEvent, id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export default function HistorySidebar({ history, onLoadSession, onDeleteItem, onClearAll, onClose }: HistorySidebarProps) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in transition-all" onClick={onClose}>
      <div
        className="w-full md:max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-right duration-300 transform"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-blue-500" />
            History
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {history.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">No history yet.</div>
          )}

          {history.map(session => (
            <div key={session.id} onClick={() => onLoadSession(session)} className="group p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all relative">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wide">{session.language}</span>
                <button onClick={(e) => onDeleteItem(e, session.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-md transition-all border border-red-100 shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <h3 className="font-bold text-gray-800 line-clamp-2 leading-snug mb-1">{session.input || "Random Topic"}</h3>
              <p className="text-[10px] text-gray-400 font-medium">{new Date(session.timestamp).toLocaleString()}</p>
              {session.audioMap && <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600 font-bold"><Mic className="w-3 h-3" /> <span>Audio Saved</span></div>}
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={onClearAll}
              className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete All History
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
