'use client';

import { useEffect, useRef } from 'react';
import { GeneratedSet } from '../types';

interface MediaSessionHandlers {
  togglePlay: () => void;
  handlePrev: () => void;
  handleNext: () => void;
}

interface MediaSessionConfig {
  currentSentenceIndex: number;
  generatedSets: GeneratedSet[];
  isPlaying: boolean;
  activePlayerRef: React.MutableRefObject<'A' | 'B' | 'Merged'>;
  mergedAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

export function useMediaSession(
  handlers: MediaSessionHandlers,
  config: MediaSessionConfig
) {
  const handlersRef = useRef(handlers);
  const generatedSetsRef = useRef(config.generatedSets);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    generatedSetsRef.current = config.generatedSets;
  }, [config.generatedSets]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || config.currentSentenceIndex === -1 || config.generatedSets.length === 0) return;

    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Sentence ${config.currentSentenceIndex + 1} of ${total}`,
      artist: "RealWait Roleplay",
      album: generatedSetsRef.current[0]?.input || "Roleplay Session",
    });

    if (config.activePlayerRef.current === 'Merged' && config.mergedAudioRef.current && config.mergedAudioRef.current.duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: config.mergedAudioRef.current.duration,
          playbackRate: config.mergedAudioRef.current.playbackRate || 1.0,
          position: config.mergedAudioRef.current.currentTime
        });
      } catch (e) {
        console.warn("setPositionState failed", e);
      }
    }

    navigator.mediaSession.setActionHandler('play', () => handlersRef.current.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => handlersRef.current.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.handlePrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.handleNext());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && config.activePlayerRef.current === 'Merged' && config.mergedAudioRef.current) {
        config.mergedAudioRef.current.currentTime = details.seekTime;
      }
    });
  }, [config.currentSentenceIndex, config.generatedSets, config.isPlaying]);
}
