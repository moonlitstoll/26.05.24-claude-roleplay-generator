'use client';

import { useEffect, useRef } from 'react';

interface KeyboardHandlers {
  togglePlay: () => void;
  handlePrev: () => void;
  handleNext: () => void;
  toggleRepeat: () => void;
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
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || target.closest('[contenteditable="true"]');
      if (isInput) return;
      // A control reached with Tab keeps its own Space/Enter. After a mouse tap it does not match
      // :focus-visible, so Space still means play/pause there.
      if (target.closest('button, a, [role="button"]') && target.matches(':focus-visible')) return;

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
        handlersRef.current.toggleRepeat();
      } else if (key.toLowerCase() === 'b' || code === 'KeyB') {
        e.preventDefault();
        handlersRef.current.setShowAnalysis((prev: boolean) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
}
