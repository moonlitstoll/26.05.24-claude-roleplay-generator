'use client';

import React from 'react';
import { X } from 'lucide-react';

interface InputModalProps {
  mode: 'roleplay' | 'analysis';
  tempInput: string;
  onTempInputChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function InputModal({ mode, tempInput, onTempInputChange, onConfirm, onClose }: InputModalProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Enter Context</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <textarea
            autoFocus
            value={tempInput}
            onChange={(e) => onTempInputChange(e.target.value)}
            placeholder={mode === 'roleplay' ? "Describe a situation, conversation topic, or just a word..." : "Paste the sentence you want to analyze verbatim..."}
            className="w-full h-48 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-black font-semibold focus:ring-2 focus:ring-black outline-none resize-none"
          />
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onTempInputChange('')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all"
            >
              Clear
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-black text-white py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-gray-900 active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
