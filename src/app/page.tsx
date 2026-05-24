'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { mergeAudioToWav } from '../utils/audioMerge';
import { saveSession, getSessions, deleteSession, clearSessions, SavedSession } from '../utils/storage';
import { ScriptItem, GeneratedSet, AudioMap, TimelineSegment } from '../types';
import { usePlaybackReducer } from '../hooks/usePlaybackReducer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useMediaSession } from '../hooks/useMediaSession';

import HeaderBar from '../components/HeaderBar';
import AdvancedSettings from '../components/AdvancedSettings';
import ScriptViewer from '../components/ScriptViewer';
import PlaybackBar from '../components/PlaybackBar';
import HistorySidebar from '../components/HistorySidebar';
import InputModal from '../components/InputModal';
import TurnsPopup from '../components/TurnsPopup';
import EmptyState from '../components/EmptyState';

export default function Home() {
  // --- Configuration State ---
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [modelType, setModelType] = useState('gemini-2.5-flash');
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [turnCount, setTurnCount] = useState(3);
  const [mode, setMode] = useState<'roleplay' | 'analysis'>('roleplay');
  const [accentMode, setAccentMode] = useState('standard-simulated');
  const [vietnameseAccent, setVietnameseAccent] = useState<'north' | 'south'>('south');

  // --- Loading State ---
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- Data State ---
  const [generatedSets, setGeneratedSets] = useState<GeneratedSet[]>([]);
  const [audioUrls, setAudioUrls] = useState<AudioMap>({});
  const [audioUrlsSouth, setAudioUrlsSouth] = useState<AudioMap>({});

  // --- Merged Audio State ---
  const [isMergedMode, setIsMergedMode] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const [audioTimeline, setAudioTimeline] = useState<TimelineSegment[]>([]);
  const mergedAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Playback State (useReducer) ---
  const [playback, dispatch] = usePlaybackReducer();
  const { isPlaying, currentTime, duration, playbackSpeed, repeatMode, currentSentenceIndex, totalSentences, isGapActive } = playback;

  // --- UI State ---
  const [showSpeedPopup, setShowSpeedPopup] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showTurnsPopup, setShowTurnsPopup] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [tempInput, setTempInput] = useState('');
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // --- Audio Refs ---
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const activePlayerRef = useRef<'A' | 'B' | 'Merged'>('A');
  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // --- State Sync Refs (for background playback event handlers) ---
  const generatedSetsRef = useRef(generatedSets);
  const audioUrlsRef = useRef(audioUrls);
  const audioUrlsSouthRef = useRef(audioUrlsSouth);
  const currentSentenceIndexRef = useRef(currentSentenceIndex);
  const repeatModeRef = useRef(repeatMode);
  const languageRef = useRef(language);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    generatedSetsRef.current = generatedSets;
    audioUrlsRef.current = audioUrls;
    audioUrlsSouthRef.current = audioUrlsSouth;
    currentSentenceIndexRef.current = currentSentenceIndex;
    repeatModeRef.current = repeatMode;
    languageRef.current = language;
  }, [generatedSets, audioUrls, audioUrlsSouth, currentSentenceIndex, repeatMode, language]);

  useEffect(() => {
    if (audioRefA.current) audioRefA.current.playbackRate = playbackSpeed;
    if (audioRefB.current) audioRefB.current.playbackRate = playbackSpeed;
  }, [playbackSpeed, isPlaying]);

  // --- Audio Cleanup ---
  const cleanupAudio = React.useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: false });

    // Fully reset each audio element to prevent ghost playback
    [audioRefA, audioRefB, mergedAudioRef].forEach(ref => {
      if (ref.current) {
        ref.current.pause();
        ref.current.removeAttribute('src');
        ref.current.load(); // Reset media element state
      }
    });

    // Revoke all blob URLs to free memory
    Object.values(audioUrlsRef.current).forEach(url => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    Object.values(audioUrlsSouthRef.current).forEach(url => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    setAudioUrls({});
    setAudioUrlsSouth({});
    setMergedAudioUrl(null);
    setIsMergedMode(false);
  }, []);

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  // --- Audio Merge ---
  const mergeAudio = async (urls: AudioMap) => {
    if (Object.keys(urls).length === 0) return;
    setIsMerging(true);
    try {
      const sortedIndices = Object.keys(urls).map(Number).sort((a, b) => a - b);
      const blobs: Blob[] = [];
      for (const idx of sortedIndices) {
        const blob = await fetch(urls[idx]).then(r => r.blob());
        blobs.push(blob);
      }

      const { blob, timeline: wavTimeline } = await mergeAudioToWav(blobs);
      const mappedTimeline = wavTimeline.map((item, i) => ({
        ...item,
        index: sortedIndices[i]
      }));

      const combinedUrl = URL.createObjectURL(blob);
      setMergedAudioUrl(combinedUrl);
      setAudioTimeline(mappedTimeline);
      setIsMergedMode(true);
    } catch (e) {
      console.error("Merge failed", e);
      setIsMergedMode(false);
    } finally {
      setIsMerging(false);
    }
  };

  useEffect(() => {
    const hasAudio = Object.keys(audioUrls).length > 0 || Object.keys(audioUrlsSouth).length > 0;
    if (!loading && !audioLoading && generatedSets.length > 0 && hasAudio) {
      const activeUrls = (language === 'Vietnamese' && vietnameseAccent === 'south') ? audioUrlsSouth : audioUrls;
      if (Object.keys(activeUrls).length === totalSentences && totalSentences > 0) {
        mergeAudio(activeUrls);
      }
    }
  }, [loading, audioLoading, audioUrls, audioUrlsSouth, totalSentences, language, vietnameseAccent]);

  // --- URL Resolution Helper ---
  const getUrlForIndex = React.useCallback((index: number) => {
    if (index < 0) return undefined;
    if (language === 'Vietnamese' && vietnameseAccent === 'south') {
      return audioUrlsSouth[index] || audioUrls[index];
    }
    return audioUrls[index];
  }, [language, vietnameseAccent, audioUrls, audioUrlsSouth]);

  const getNextStep = React.useCallback((currentIdx: number, total: number, _sets: GeneratedSet[], mode: 'sentence' | 'session') => {
    if (mode === 'sentence') {
      return { index: currentIdx, url: getUrlForIndex(currentIdx) };
    }
    let nextIdx = currentIdx + 1;
    if (nextIdx >= total) nextIdx = 0;
    return { index: nextIdx, url: getUrlForIndex(nextIdx) };
  }, [getUrlForIndex]);

  const preloadNextTrack = React.useCallback((nextStep: { index: number, url?: string } | null, targetPlayer: 'A' | 'B') => {
    const targetAudio = targetPlayer === 'A' ? audioRefA.current : audioRefB.current;
    if (!targetAudio || !nextStep || !nextStep.url) return;
    targetAudio.src = nextStep.url;
    targetAudio.load();
  }, []);

  // --- Auto-scroll ---
  const scrollToActive = React.useCallback(() => {
    if (currentSentenceIndex !== -1) {
      const activeElement = scrollRefs.current[`${currentSentenceIndex}`];
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [currentSentenceIndex]);

  useEffect(() => {
    const t = setTimeout(() => scrollToActive(), 100);
    return () => clearTimeout(t);
  }, [currentSentenceIndex, showAnalysis, scrollToActive]);

  // --- Playback Controls ---
  const togglePlay = React.useCallback(() => {
    const currentIdx = currentSentenceIndexRef.current;

    if (currentIdx === -1 && totalSentences > 0) {
      const url = getUrlForIndex(0);
      if (!url) return;
      handlersRef.current.playSentence?.(0);
      return;
    }

    if (isPlaying) {
      if (activePlayerRef.current === 'Merged' && mergedAudioRef.current) {
        mergedAudioRef.current.pause();
      } else {
        const activeAudio = activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
        activeAudio?.pause();
        const otherAudio = activePlayerRef.current === 'A' ? audioRefB.current : audioRefA.current;
        otherAudio?.pause();
      }
      dispatch({ type: 'SET_PLAYING', payload: false });
    } else {
      if (activePlayerRef.current === 'Merged' && mergedAudioRef.current) {
        mergedAudioRef.current.playbackRate = playbackSpeed;
        mergedAudioRef.current.play().catch(console.error);
      } else if (isMergedMode && mergedAudioRef.current) {
        activePlayerRef.current = 'Merged';
        mergedAudioRef.current.playbackRate = playbackSpeed;
        mergedAudioRef.current.play().catch(console.error);
      } else {
        const activeAudio = activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
        if (activeAudio) {
          activeAudio.playbackRate = playbackSpeed;
          activeAudio.play().catch(e => console.error("Play failed", e));
        }
      }
      dispatch({ type: 'SET_PLAYING', payload: true });
    }
  }, [isPlaying, playbackSpeed, totalSentences, getUrlForIndex, isMergedMode]);

  const playSentence = React.useCallback((index: number) => {
    if (index < 0 || index >= totalSentences) return;

    const url = getUrlForIndex(index);
    if (!url) return;

    dispatch({ type: 'PLAY_SENTENCE', payload: { index } });

    activePlayerRef.current = 'A';
    const activeAudio = audioRefA.current;
    const inactiveAudio = audioRefB.current;

    if (isMergedMode && mergedAudioRef.current) {
      const segment = audioTimeline.find(s => s.index === index);
      if (segment) {
        activePlayerRef.current = 'Merged';
        audioRefA.current?.pause();
        audioRefB.current?.pause();
        mergedAudioRef.current.currentTime = segment.start;
        mergedAudioRef.current.playbackRate = playbackSpeed;
        mergedAudioRef.current.play().catch(console.error);
      }
    } else if (activeAudio && inactiveAudio) {
      inactiveAudio.pause();
      inactiveAudio.currentTime = 0;
      activeAudio.src = url;
      activeAudio.currentTime = 0;
      activeAudio.playbackRate = playbackSpeed;
      activeAudio.play().catch(e => console.error("Manual jump play failed", e));

      const nextStep = getNextStep(index, totalSentences, generatedSets, repeatMode);
      if (nextStep) preloadNextTrack(nextStep, 'B');
    }

    currentSentenceIndexRef.current = index;
  }, [totalSentences, getUrlForIndex, getNextStep, generatedSets, repeatMode, playbackSpeed, preloadNextTrack, isMergedMode, audioTimeline]);

  const handleTrackEnded = React.useCallback((playerKey: 'A' | 'B') => {
    if (playerKey !== activePlayerRef.current) return;

    if (repeatModeRef.current === 'sentence') {
      const activeAudio = playerKey === 'A' ? audioRefA.current : audioRefB.current;
      if (activeAudio) {
        activeAudio.currentTime = 0;
        activeAudio.play().catch(e => console.error("Loop re-play failed", e));
        return;
      }
    }

    const currIdx = currentSentenceIndexRef.current;
    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);
    const nextStep = getNextStep(currIdx, total, generatedSetsRef.current, repeatModeRef.current);

    if (!nextStep) {
      dispatch({ type: 'SET_PLAYING', payload: false });
      return;
    }

    const nextPlayerKey = playerKey === 'A' ? 'B' : 'A';
    activePlayerRef.current = nextPlayerKey;
    const nextAudio = nextPlayerKey === 'A' ? audioRefA.current : audioRefB.current;

    if (nextAudio) {
      nextAudio.playbackRate = playbackSpeed;
      const playPromise = nextAudio.play();
      playPromise.catch(e => {
        console.error(`[DualPlayback] Auto-play failed for ${nextPlayerKey}`, e);
        if (nextStep.url) {
          nextAudio.src = nextStep.url;
          nextAudio.play();
        }
      });
    }

    currentSentenceIndexRef.current = nextStep.index;
    dispatch({ type: 'SET_CURRENT_INDEX', payload: nextStep.index });

    const nextNextStep = getNextStep(nextStep.index, total, generatedSetsRef.current, repeatModeRef.current);
    preloadNextTrack(nextNextStep, playerKey);
  }, [getNextStep, playbackSpeed, preloadNextTrack]);

  // --- Navigation ---
  const handleNext = React.useCallback(() => {
    const currIdx = currentSentenceIndex;
    let nextIdx = currIdx + 1;
    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);
    if (nextIdx >= total) nextIdx = 0;
    playSentence(nextIdx);
  }, [currentSentenceIndex, playSentence]);

  const handlePrev = React.useCallback(() => {
    const activeAudio = activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
    if (activeAudio && activeAudio.currentTime > 2) {
      activeAudio.currentTime = 0;
      return;
    }
    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);
    let prevIdx = currentSentenceIndex - 1;
    if (prevIdx < 0) prevIdx = total - 1;
    playSentence(prevIdx);
  }, [currentSentenceIndex, playSentence]);

  // --- Handlers Ref (for playSentence access in togglePlay) ---
  const handlersRef = useRef({ playSentence });
  useEffect(() => { handlersRef.current = { playSentence }; }, [playSentence]);

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts({ togglePlay, handlePrev, handleNext, dispatch, setShowAnalysis });

  // --- Media Session ---
  useMediaSession(
    { togglePlay, handlePrev, handleNext },
    { currentSentenceIndex, generatedSets, isPlaying, activePlayerRef, mergedAudioRef }
  );

  // --- Dual Audio Event Handlers ---
  useEffect(() => {
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    if (!audioA || !audioB) return;

    const handleTimeUpdateA = () => { if (activePlayerRef.current === 'A' && document.visibilityState === 'visible') dispatch({ type: 'SET_CURRENT_TIME', payload: audioA.currentTime }); };
    const handleTimeUpdateB = () => { if (activePlayerRef.current === 'B' && document.visibilityState === 'visible') dispatch({ type: 'SET_CURRENT_TIME', payload: audioB.currentTime }); };
    const handleDurationA = () => { if (activePlayerRef.current === 'A') dispatch({ type: 'SET_DURATION', payload: audioA.duration }); };
    const handleDurationB = () => { if (activePlayerRef.current === 'B') dispatch({ type: 'SET_DURATION', payload: audioB.duration }); };
    const handleEndedA = () => handleTrackEnded('A');
    const handleEndedB = () => handleTrackEnded('B');

    audioA.addEventListener('timeupdate', handleTimeUpdateA);
    audioB.addEventListener('timeupdate', handleTimeUpdateB);
    audioA.addEventListener('durationchange', handleDurationA);
    audioB.addEventListener('durationchange', handleDurationB);
    audioA.addEventListener('ended', handleEndedA);
    audioB.addEventListener('ended', handleEndedB);

    return () => {
      audioA.removeEventListener('timeupdate', handleTimeUpdateA);
      audioB.removeEventListener('timeupdate', handleTimeUpdateB);
      audioA.removeEventListener('durationchange', handleDurationA);
      audioB.removeEventListener('durationchange', handleDurationB);
      audioA.removeEventListener('ended', handleEndedA);
      audioB.removeEventListener('ended', handleEndedB);
    };
  }, [handleTrackEnded]);

  // --- Merged Audio Listeners ---
  useEffect(() => {
    const mAudio = mergedAudioRef.current;
    if (!mAudio) return;

    const handleTimeUpdate = () => {
      if (!isMergedMode) return;
      const t = mAudio.currentTime;
      dispatch({ type: 'SET_CURRENT_TIME', payload: t });

      if (repeatModeRef.current === 'sentence') {
        const currentIdx = currentSentenceIndexRef.current;
        const currentSegment = audioTimeline.find(s => s.index === currentIdx);
        if (currentSegment && t >= currentSegment.end - 0.05) {
          mAudio.currentTime = currentSegment.start;
          mAudio.play().catch(console.error);
          return;
        }
      }

      const segment = audioTimeline.find(s => t >= s.start && t < s.end);
      if (segment && segment.index !== currentSentenceIndexRef.current) {
        if (repeatModeRef.current !== 'sentence') {
          dispatch({ type: 'SET_CURRENT_INDEX', payload: segment.index });
          currentSentenceIndexRef.current = segment.index;
        }
      }
    };

    const handleEnded = () => {
      if (repeatModeRef.current === 'session') {
        mAudio.currentTime = 0;
        mAudio.play().catch(console.error);
      } else if (repeatModeRef.current === 'sentence') {
        const currentIdx = currentSentenceIndexRef.current;
        const currentSegment = audioTimeline.find(s => s.index === currentIdx);
        if (currentSegment) {
          mAudio.currentTime = currentSegment.start;
        } else {
          mAudio.currentTime = 0;
        }
        mAudio.play().catch(console.error);
      }
    };

    mAudio.addEventListener('timeupdate', handleTimeUpdate);
    mAudio.addEventListener('ended', handleEnded);
    return () => {
      mAudio.removeEventListener('timeupdate', handleTimeUpdate);
      mAudio.removeEventListener('ended', handleEnded);
    };
  }, [audioTimeline, isMergedMode]);

  useEffect(() => {
    if (mergedAudioRef.current) mergedAudioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // --- LocalStorage Init ---
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
    const storedModel = localStorage.getItem('gemini_model_type');
    if (storedModel) setModelType(storedModel);
    loadHistory();
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  const loadHistory = async () => {
    const sessions = await getSessions();
    setHistory(sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  // --- Generation ---
  const generateAudioForSegments = async (segments: any[], audioMode: 'north' | 'south', updateMap: React.Dispatch<React.SetStateAction<AudioMap>>) => {
    if (segments.length === 0) return;
    setProgress(`Generating Audio (${audioMode})...`);

    try {
      const res = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          speakers: segments[0]?.speakers,
          language: languageRef.current,
          accentMode: audioMode === 'south' ? 'south' : (languageRef.current === 'Vietnamese' ? 'all-standard' : accentMode)
        })
      });

      if (!res.ok) throw new Error(`Batch TTS failed: ${res.statusText}`);

      const data = await res.json();
      const results = data.segments || [];

      updateMap((prev) => {
        const next = { ...prev };
        results.forEach((r: any) => {
          if (r.audioContent) {
            const binary = atob(r.audioContent);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            const blob = new Blob([array], { type: 'audio/mpeg' });
            next[r.idx] = URL.createObjectURL(blob);
          }
        });
        return next;
      });

      setProgress('');
    } catch (e) {
      console.error(`Batch Audio Generation Error (${audioMode}):`, e);
      setError(`Failed to generate audio for ${audioMode} accent.`);
    }
  };

  const handleGenerate = async () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLoading(true);
    setAudioLoading(true);
    setProgress('Initializing...');
    cleanupAudio();
    setGeneratedSets([]);
    dispatch({ type: 'SET_CURRENT_INDEX', payload: -1 });
    setError(null);
    isGeneratingRef.current = true;

    try {
      const newSets: GeneratedSet[] = [];
      const allSegmentData: any[] = [];
      let globalSegIdx = 0;

      setProgress('Generating script...');

      const scriptRes = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input, language,
          count: mode === 'analysis' ? 0 : turnCount,
          mode, apiKey,
          model: modelType,
          accentMode
        }),
      });

      if (!scriptRes.ok) {
        let errData;
        try { errData = await scriptRes.json(); } catch (e) {
          throw new Error(`Server Gateway Timeout ${scriptRes.status} (${scriptRes.statusText}). The request may have taken too long.`);
        }
        throw new Error(errData?.details || errData?.error || 'Failed to generate script');
      }

      const data = await scriptRes.json();
      const { script, speakers } = data;

      const scriptWithIndices = script.map((item: ScriptItem) => {
        const idx = globalSegIdx++;
        allSegmentData.push({ idx, text: item.text, speaker: item.speaker, speakers });
        return { ...item, segmentIndex: idx };
      });

      newSets.push({
        id: crypto.randomUUID(),
        script: scriptWithIndices,
        timestamp: new Date(),
        input: input || "Random Topic",
      });

      setGeneratedSets(newSets);
      dispatch({ type: 'SET_TOTAL_SENTENCES', payload: globalSegIdx });

      setProgress('Generating Audio...');

      if (language === 'Vietnamese') {
        if (vietnameseAccent === 'south') {
          await generateAudioForSegments(allSegmentData, 'south', setAudioUrlsSouth);
        } else {
          await generateAudioForSegments(allSegmentData, 'north', setAudioUrls);
        }
      } else {
        await generateAudioForSegments(allSegmentData, 'north', setAudioUrls);
      }

      setAudioLoading(false);
      setProgress('');

      if (globalSegIdx > 0) dispatch({ type: 'SET_CURRENT_INDEX', payload: 0 });
    } catch (error: any) {
      console.error(error);
      setError(error.message || 'An unexpected error occurred during generation');
    } finally {
      setLoading(false);
      setAudioLoading(false);
    }
  };

  // --- Auto-save & Auto-play ---
  useEffect(() => {
    const hasAudio = Object.keys(audioUrls).length > 0 || Object.keys(audioUrlsSouth).length > 0;
    if (!loading && !audioLoading && generatedSets.length > 0 && hasAudio) {
      const autoSave = async () => {
        const saveMap = async (map: AudioMap) => {
          const blobMap: { [key: number]: Blob } = {};
          for (const [k, url] of Object.entries(map)) {
            const b = await fetch(url).then(r => r.blob());
            blobMap[Number(k)] = b;
          }
          return blobMap;
        };

        const northMap = await saveMap(audioUrls);
        const southMap = await saveMap(audioUrlsSouth);

        const session: SavedSession = {
          id: generatedSets[0].id,
          timestamp: new Date(),
          input: input || "Random",
          language,
          sets: generatedSets,
          audioBlob: null,
          audioMap: northMap,
          audioMapSouth: southMap,
          lastAccent: vietnameseAccent
        };
        await saveSession(session);
        loadHistory();
      };
      autoSave();

      if (isGeneratingRef.current) {
        playSentence(0);
        isGeneratingRef.current = false;
      }
    }
  }, [loading, audioLoading, generatedSets]);

  // --- Session Management ---
  const loadSession = (session: SavedSession) => {
    setGeneratedSets(session.sets);
    setLanguage(session.language as any);
    setInput(session.input || '');
    setVietnameseAccent(session.lastAccent || 'north');
    cleanupAudio();

    if (session.audioMap) {
      const restoreMap = (blobMap: { [key: number]: Blob }) => {
        const urlMap: AudioMap = {};
        for (const [k, blob] of Object.entries(blobMap)) {
          urlMap[Number(k)] = URL.createObjectURL(blob);
        }
        return urlMap;
      };
      setAudioUrls(restoreMap(session.audioMap));
      if (session.audioMapSouth) setAudioUrlsSouth(restoreMap(session.audioMapSouth));

      const totalCount = session.sets.reduce((sum, s) => sum + s.script.length, 0);
      dispatch({ type: 'SET_TOTAL_SENTENCES', payload: totalCount });
      dispatch({ type: 'SET_CURRENT_INDEX', payload: 0 });
    } else {
      alert("Audio regeneration required for old history items.");
    }
    setShowHistory(false);
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this history item?')) {
      await deleteSession(id);
      loadHistory();
    }
  };

  const clearHistoryAll = async () => {
    if (confirm('Are you sure you want to delete ALL history? This cannot be undone.')) {
      await clearSessions();
      setHistory([]);
    }
  };

  const handleModelChange = (model: string) => {
    setModelType(model);
    localStorage.setItem('gemini_model_type', model);
  };

  return (
    <main className="min-h-screen px-0 py-2 md:p-2 flex flex-col gap-4 relative overflow-x-hidden bg-gray-50">
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-purple-200/40 rounded-full blur-[100px] pointer-events-none" />

      <HeaderBar
        input={input}
        mode={mode}
        language={language}
        loading={loading}
        progress={progress}
        turnCount={turnCount}
        isMerging={isMerging}
        isMergedMode={isMergedMode}
        mergedAudioUrl={mergedAudioUrl}
        showAdvanced={showAdvanced}
        showTurnsPopup={showTurnsPopup}
        onInputClick={() => { setTempInput(input); setShowInputModal(true); }}
        onGenerate={handleGenerate}
        onModeChange={setMode}
        onLanguageChange={setLanguage}
        onShowHistory={() => setShowHistory(true)}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        onToggleTurnsPopup={() => setShowTurnsPopup(!showTurnsPopup)}
      />

      {showAdvanced && (
        <AdvancedSettings
          apiKey={apiKey}
          modelType={modelType}
          onApiKeyChange={setApiKey}
          onModelChange={handleModelChange}
        />
      )}

      {error && (
        <div className="w-full px-4 md:px-6 animate-in slide-in-from-top-2">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="bg-red-100 p-1 rounded-full"><X className="w-3 h-3" /></span>
              {error}
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 text-xs font-bold uppercase">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-6 z-10 min-w-0">
        {generatedSets.length > 0 && (
          <ScriptViewer
            generatedSets={generatedSets}
            currentSentenceIndex={currentSentenceIndex}
            showAnalysis={showAnalysis}
            scrollRefs={scrollRefs}
            onPlaySentence={playSentence}
          />
        )}

        {generatedSets.length === 0 && !loading && <EmptyState />}
      </div>

      {/* Dual Audio Engine */}
      <audio ref={audioRefA} className="hidden" preload="auto" playsInline />
      <audio ref={audioRefB} className="hidden" preload="auto" playsInline />
      <audio
        ref={mergedAudioRef}
        src={mergedAudioUrl || undefined}
        className="hidden"
        preload="auto"
        playsInline
        loop={isMergedMode && repeatMode === 'session'}
      />

      {totalSentences > 0 && (
        <PlaybackBar
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          playbackSpeed={playbackSpeed}
          repeatMode={repeatMode}
          showAnalysis={showAnalysis}
          showSpeedPopup={showSpeedPopup}
          onTogglePlay={togglePlay}
          onPrev={handlePrev}
          onNext={handleNext}
          onSpeedChange={(speed) => dispatch({ type: 'SET_SPEED', payload: speed })}
          onRepeatModeToggle={() => dispatch({ type: 'TOGGLE_REPEAT_MODE' })}
          onToggleAnalysis={() => setShowAnalysis(!showAnalysis)}
          onToggleSpeedPopup={() => setShowSpeedPopup(!showSpeedPopup)}
        />
      )}

      {showHistory && (
        <HistorySidebar
          history={history}
          onLoadSession={loadSession}
          onDeleteItem={deleteHistoryItem}
          onClearAll={clearHistoryAll}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showTurnsPopup && (
        <TurnsPopup
          turnCount={turnCount}
          onSelect={(num) => { setTurnCount(num); setShowTurnsPopup(false); }}
          onClose={() => setShowTurnsPopup(false)}
        />
      )}

      {showInputModal && (
        <InputModal
          mode={mode}
          tempInput={tempInput}
          onTempInputChange={setTempInput}
          onConfirm={() => { setInput(tempInput); setShowInputModal(false); }}
          onClose={() => setShowInputModal(false)}
        />
      )}
    </main>
  );
}
