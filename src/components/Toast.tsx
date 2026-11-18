'use client';

import React, { useEffect, useRef } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export interface ToastState {
  message: string;
  type?: 'success' | 'error';
}

interface ToastProps extends ToastState {
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'success', onClose, duration = 2500 }: ToastProps) {
  // The page re-renders many times a second during playback. Keeping onClose out of the timer's
  // dependencies stops those renders from restarting the timer forever.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), type === 'error' ? 4000 : duration);
    return () => clearTimeout(timer);
  }, [duration, type, message]);

  return (
    <div
      onClick={onClose}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] cursor-pointer w-max max-w-[calc(100vw-32px)]"
    >
      <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white dark:shadow-black/40 ${type === 'success' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-red-600 shadow-red-200'}`}>
        {type === 'success' ? <CheckCircle size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
        {message}
      </div>
    </div>
  );
}
