'use client';

import React from 'react';
import { BookOpen, Eye, EyeOff, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react';

interface PlaybackBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  repeatMode: 'sentence' | 'session';
  showAnalysis: boolean;
  showBreakdown: boolean;
  showSpeedPopup: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  onRepeatModeToggle: () => void;
  onCycleAnalysis: () => void;
  onToggleSpeedPopup: () => void;
}

// Sizes use min(vw, px) so all controls stay on one line on narrow phones and when zoomed.
const SMALL_BTN = 'flex items-center justify-center shrink-0 min-w-[min(9vw,44px)] min-h-[min(11vw,44px)]';
const ICON_SM = 'w-[min(4.4vw,18px)] h-[min(4.4vw,18px)]';
const ICON_MD = 'w-[min(5vw,20px)] h-[min(5vw,20px)]';
const ICON_LG = 'w-[min(5vw,20px)] h-[min(5vw,20px)]';

const SPEEDS = Array.from({ length: 16 }, (_, i) => (0.5 + i * 0.1).toFixed(1));

export default React.memo(function PlaybackBar({
  isPlaying, currentTime, duration, playbackSpeed, repeatMode, showAnalysis, showBreakdown, showSpeedPopup,
  onTogglePlay, onPrev, onNext, onSpeedChange, onRepeatModeToggle, onCycleAnalysis, onToggleSpeedPopup,
}: PlaybackBarProps) {
  const sentenceRepeat = repeatMode === 'sentence';

  return (
    // No backdrop blur here: it would trap the speed popup's full-screen tap-to-close layer inside this bar.
    <div role="toolbar" aria-label="재생 조작" className="relative flex-none bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700 z-50 shadow-lg">
      <div className="absolute inset-x-0 -top-px h-1 bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
      </div>

      <div className="max-w-5xl mx-auto h-14 flex items-center justify-between px-2 gap-[min(1vw,4px)]">
        <div className="flex items-center gap-[min(1vw,4px)]">
          <div className="relative">
            <button
              onClick={onToggleSpeedPopup}
              aria-label={`재생 속도 ${playbackSpeed.toFixed(1)}배`}
              aria-expanded={showSpeedPopup}
              className={`${SMALL_BTN} px-[min(1.5vw,6px)] rounded-lg font-bold transition-all border text-[min(2.9vw,11px)] ${showSpeedPopup
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {playbackSpeed.toFixed(1)}x
            </button>
            {showSpeedPopup && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={onToggleSpeedPopup} />
                <div role="dialog" aria-label="재생 속도" className="absolute bottom-full left-0 mb-2 z-[61] w-[232px] grid grid-cols-4 gap-1 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                  {SPEEDS.map(speedStr => {
                    const speed = parseFloat(speedStr);
                    const selected = Math.abs(playbackSpeed - speed) < 0.01;
                    return (
                      <button
                        key={speedStr}
                        onClick={() => onSpeedChange(speed)}
                        aria-pressed={selected}
                        className={`h-10 rounded-lg text-[13px] font-bold transition-colors ${selected
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        {speedStr}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onCycleAnalysis}
            aria-label={!showAnalysis ? '번역과 풀이 보기' : showBreakdown ? '번역과 풀이 숨기기' : '단어 풀이 펼치기'}
            className={`${SMALL_BTN} rounded-lg border transition-all ${!showAnalysis
              ? 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
              : showBreakdown
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900'}`}
          >
            {!showAnalysis ? <EyeOff className={ICON_SM} /> : showBreakdown ? <BookOpen className={ICON_SM} /> : <Eye className={ICON_SM} />}
          </button>
        </div>

        <div className="flex items-center gap-[min(1.2vw,6px)]">
          <button onClick={onPrev} aria-label="이전 문장" className={`${SMALL_BTN} text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors`}>
            <SkipBack className={`${ICON_MD} fill-current`} />
          </button>
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? '일시정지' : '재생'}
            className="w-[min(10vw,44px)] h-[min(10vw,44px)] shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-black/40 transition-transform active:scale-95"
          >
            {isPlaying ? <Pause className={ICON_LG} fill="currentColor" /> : <Play className={`${ICON_LG} ml-0.5`} fill="currentColor" />}
          </button>
          <button onClick={onNext} aria-label="다음 문장" className={`${SMALL_BTN} text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors`}>
            <SkipForward className={`${ICON_MD} fill-current`} />
          </button>
        </div>

        <button
          onClick={onRepeatModeToggle}
          aria-label={sentenceRepeat ? '한 문장 반복 끄기' : '한 문장 반복 켜기'}
          aria-pressed={sentenceRepeat}
          className={`${SMALL_BTN} rounded-lg border transition-all ${sentenceRepeat
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'}`}
        >
          {sentenceRepeat ? <Repeat1 className={ICON_SM} /> : <Repeat className={ICON_SM} />}
        </button>
      </div>
    </div>
  );
});
