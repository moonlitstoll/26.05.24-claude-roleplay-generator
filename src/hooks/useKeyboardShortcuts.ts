'use client';

import { useEffect, useRef } from 'react';
import { PlaybackAction } from './usePlaybackReducer';

interface KeyboardHandlers {
  togglePlay: () => void;
  handlePrev: () => void;
  handleNext: () => void;
  dispatch: React.Dispatch<PlaybackAction>;
  setShowAnalysis: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardShortcuts(handlers: KeyboardHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[contenteditable="true"]');
      if (isInput) return;

      const key = e.key;
      const code = e.code;

      if (key === ' ' || code === 'Space') {
        e.preventDefault();
        handlersRef.current.togglePlay();
      } else if (key === 'ArrowLeft' || code === 'ArrowLeft') {
        e.preventDefault();
        handlersRef.current.handlePrev();
      } else if (key === 'ArrowRight' || code === 'ArrowRight') {
        e.preventDefault();
        handlersRef.current.handleNext();
      } else if (key === 'Enter' || code === 'Enter') {
        e.preventDefault();
        handlersRef.current.dispatch({ type: 'TOGGLE_REPEAT_MODE' });
      } else if (key.toLowerCase() === 'b' || code === 'KeyB') {
        e.preventDefault();
        handlersRef.current.setShowAnalysis((prev: boolean) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
}
