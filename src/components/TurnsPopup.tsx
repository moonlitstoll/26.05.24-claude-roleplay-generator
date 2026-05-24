'use client';

import React from 'react';

interface TurnsPopupProps {
  turnCount: number;
  onSelect: (count: number) => void;
  onClose: () => void;
}

export default function TurnsPopup({ turnCount, onSelect, onClose }: TurnsPopupProps) {
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/10 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 w-72 grid grid-cols-6 gap-2 animate-in zoom-in-95 duration-200">
        <div className="col-span-6 text-center text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest w-full">Select Turns</div>
        <div className="col-span-6 flex justify-center gap-2 flex-wrap">
          {[0, 1, 2, 3, 4, 5].map(num => (
            <button
              key={num}
              onClick={() => onSelect(num)}
              className={`w-10 h-10 flex items-center justify-center text-sm font-bold rounded-xl transition-all ${turnCount === num ? 'bg-black text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              {num === 0 ? 'M' : num}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
