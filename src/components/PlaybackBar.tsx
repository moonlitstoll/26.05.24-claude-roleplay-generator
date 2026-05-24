'use client';

import React from 'react';
import { Play, RefreshCw, ChevronRight, MessageSquare } from 'lucide-react';

interface PlaybackBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  repeatMode: 'sentence' | 'session';
  showAnalysis: boolean;
  showSpeedPopup: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  onRepeatModeToggle: () => void;
  onToggleAnalysis: () => void;
  onToggleSpeedPopup: () => void;
}

export default React.memo(function PlaybackBar({
  isPlaying, currentTime, duration, playbackSpeed, repeatMode,
  showAnalysis, showSpeedPopup,
  onTogglePlay, onPrev, onNext, onSpeedChange,
  onRepeatModeToggle, onToggleAnalysis, onToggleSpeedPopup
}: PlaybackBarProps) {
  return (
    <div role="toolbar" aria-label="Playback controls" className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 z-50 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 md:gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={onToggleSpeedPopup}
                className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-gray-50 rounded-full text-[10px] md:text-sm font-bold text-gray-700 hover:bg-gray-100 w-16 md:w-20 justify-center"
              >
                <RefreshCw className="w-3 md:w-4 h-3 md:h-4 text-blue-500" />
                {playbackSpeed.toFixed(1)}x
              </button>
              {showSpeedPopup && (
                <div className="absolute bottom-16 left-0 bg-white border border-gray-200 p-4 w-[280px] shadow-2xl rounded-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200 origin-bottom-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">Speed Control</span>
                    <span className="text-sm font-black text-blue-600">{playbackSpeed.toFixed(1)}x</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 16 }, (_, i) => (0.5 + i * 0.1).toFixed(1)).map((speedStr) => {
                      const speed = parseFloat(speedStr);
                      const isSelected = Math.abs(playbackSpeed - speed) < 0.01;
                      return (
                        <button
                          key={speedStr}
                          onClick={() => onSpeedChange(speed)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all ${isSelected
                            ? 'bg-blue-600 text-white shadow-md scale-105'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-blue-600'
                            }`}
                        >
                          {speedStr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onToggleAnalysis}
              className={`flex items-center justify-center p-2 md:p-2 rounded-full transition-all ${showAnalysis ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              title="Toggle Analysis"
            >
              <div className="relative">
                <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                <span className="absolute -bottom-1 -right-1 text-[8px] font-black">{showAnalysis ? 'ON' : 'OFF'}</span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={onPrev} aria-label="Previous sentence" className="p-2 md:p-3 text-gray-400 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-6 md:w-8 h-6 md:h-8 rotate-180" />
            </button>
            <button onClick={onTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-10 md:w-14 h-10 md:h-14 bg-blue-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
              {isPlaying
                ? <div className="flex gap-1"><div className="w-1 md:w-1.5 h-4 md:h-6 bg-white animate-pulse" /><div className="w-1 md:w-1.5 h-4 md:h-6 bg-white animate-pulse delay-75" /></div>
                : <Play className="w-5 md:w-8 h-5 md:h-8 ml-0.5 md:l-1 fill-current" />
              }
            </button>
            <button onClick={onNext} aria-label="Next sentence" className="p-2 md:p-3 text-gray-400 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-6 md:w-8 h-6 md:h-8" />
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onRepeatModeToggle}
              aria-label={`Repeat mode: ${repeatMode === 'sentence' ? 'single' : 'all'}`}
              className="flex flex-col items-center gap-0.5 p-1.5 md:p-2 rounded-lg md:rounded-xl border bg-blue-50 border-blue-200 text-blue-600"
            >
              <RefreshCw className={`w-4 md:w-6 h-4 md:h-6 stroke-[2.5] ${repeatMode === 'session' ? 'animate-spin-slow' : ''}`} />
              <span className="text-[6px] md:text-[8px] font-black uppercase">{repeatMode === 'sentence' ? '1-L' : 'ALL'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
