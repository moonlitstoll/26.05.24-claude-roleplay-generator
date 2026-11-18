'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, X } from 'lucide-react';
import { mergeAudioToWav } from '../utils/audioMerge';
import { saveSession, getSessions, deleteSession, clearSessions, SavedSession } from '../utils/storage';
import { ScriptItem, GeneratedSet, AudioMap, TimelineSegment, WordAnalysisObj } from '../types';
import { DEFAULT_MODEL, resolveModel } from '../constants/models';
import { postJsonWithRetry, ApiError, API_KEY_MESSAGE, FAIL_REASON_LABEL, RetryInfo, userMessage } from '../utils/apiRetry';
import { readLocal, writeLocal } from '../utils/safeStorage';
import { isOffline, OFFLINE_MESSAGE, registerOfflineShell, requestPersistentStorage } from '../utils/offline';
import { ClozeLevel, normalizeClozeLevel } from '../utils/cloze';
import { sessionTitle } from '../utils/sessionTitle';
import { usePlaybackReducer } from '../hooks/usePlaybackReducer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useMediaSession } from '../hooks/useMediaSession';
import { useTheme } from '../hooks/useTheme';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { useLearningProgress } from '../hooks/useLearningProgress';

import HeaderBar from '../components/HeaderBar';
import AdvancedSettings from '../components/AdvancedSettings';
import ScriptViewer from '../components/ScriptViewer';
import PlaybackBar from '../components/PlaybackBar';
import HistorySidebar from '../components/HistorySidebar';
import ComposePanel from '../components/ComposePanel';
import StudyToolbar from '../components/StudyToolbar';
import Toast, { ToastState } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

// Word analysis is requested in small batches sent side by side (measured 2026-11-18:
// 3 lines per batch answers in about 7s; one big request took 20-55s).
const ANALYSIS_CONCURRENCY = 4;
const analysisBatchSize = (lineCount: number) => (lineCount <= 12 ? 3 : 4);

interface AnalysisResponse {
  items: { index: number; word_analysis: WordAnalysisObj[] }[];
  missing: number[];
}

export default function Home() {
  // --- Configuration State ---
  // `language` belongs to the script on screen; `draftLanguage` is the choice on the compose screen,
  // so changing it there cannot disturb the audio of the script still playing.
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [draftLanguage, setDraftLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [modelType, setModelType] = useState<string>(DEFAULT_MODEL);
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
  const [analysisNote, setAnalysisNote] = useState('');

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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; confirmText?: string; onConfirm: () => void } | null>(null);
  const { theme, setTheme } = useTheme();
  const updateAvailable = useAppUpdate();

  // --- Study Mode State ---
  // The level and round are remembered; the modes themselves always start off.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [drillMode, setDrillMode] = useState(false);
  const [mistakeOnly, setMistakeOnly] = useState(false);
  const [drillLevel, setDrillLevel] = useState<ClozeLevel>(() =>
    typeof window === 'undefined' ? 'easy' : normalizeClozeLevel(readLocal('roleplay_cloze_level'))
  );
  const [drillRound, setDrillRound] = useState(() =>
    typeof window === 'undefined' ? 0 : Number(readLocal('roleplay_cloze_round')) || 0
  );
  const repeatBeforeMistakesRef = useRef<'sentence' | 'session'>('session');
  const drillBeforeMistakesRef = useRef(false);

  const sessionId = generatedSets[0]?.id;
  const scriptLineCount = React.useMemo(
    () => generatedSets.reduce((sum, set) => sum + set.script.length, 0),
    [generatedSets]
  );
  const { mark: markLine, wrongIndices, clearSession: clearProgress, clearAll: clearAllProgress } =
    useLearningProgress(sessionId, scriptLineCount);

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
  // Id of the set currently on screen; late analysis answers for an older set are dropped.
  const activeSetIdRef = useRef<string | null>(null);
  // History saves run one after another so an older snapshot cannot overwrite a newer one.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

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
    activePlayerRef.current = 'A';

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
  }, [currentSentenceIndex, showAnalysis, scrollToActive, composeOpen, sessionId, mistakeOnly]);

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
        // Nothing loaded yet (a saved script just opened, background audio still being prepared).
        if (activeAudio && !activeAudio.getAttribute('src')) {
          handlersRef.current.playSentence?.(currentIdx);
          return;
        }
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
  // Moves to a line. If nothing is playing it only moves the position, so review mode never starts audio by itself.
  const goToLine = React.useCallback((index: number) => {
    if (isPlaying) {
      playSentence(index);
      return;
    }
    const segment = isMergedMode ? audioTimeline.find(s => s.index === index) : undefined;
    const url = getUrlForIndex(index);
    if (segment && mergedAudioRef.current) {
      activePlayerRef.current = 'Merged';
      mergedAudioRef.current.currentTime = segment.start;
    } else if (url && audioRefA.current) {
      activePlayerRef.current = 'A';
      audioRefA.current.src = url;
      audioRefA.current.currentTime = 0;
    }
    currentSentenceIndexRef.current = index;
    dispatch({ type: 'SET_CURRENT_INDEX', payload: index });
  }, [isPlaying, playSentence, isMergedMode, audioTimeline, getUrlForIndex]);

  const handleNext = React.useCallback(() => {
    const currIdx = currentSentenceIndex;
    if (mistakeOnly) {
      if (wrongIndices.length === 0) return;
      playSentence(wrongIndices.find(w => w > currIdx) ?? wrongIndices[0]);
      return;
    }
    let nextIdx = currIdx + 1;
    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);
    if (nextIdx >= total) nextIdx = 0;
    playSentence(nextIdx);
  }, [currentSentenceIndex, playSentence, mistakeOnly, wrongIndices]);

  const handlePrev = React.useCallback(() => {
    const activeAudio = activePlayerRef.current === 'A' ? audioRefA.current : audioRefB.current;
    if (activeAudio && activeAudio.currentTime > 2) {
      activeAudio.currentTime = 0;
      return;
    }
    if (mistakeOnly) {
      if (wrongIndices.length === 0) return;
      const earlier = wrongIndices.filter(w => w < currentSentenceIndex);
      playSentence(earlier.length ? earlier[earlier.length - 1] : wrongIndices[wrongIndices.length - 1]);
      return;
    }
    const total = generatedSetsRef.current.reduce((acc, set) => acc + set.script.length, 0);
    let prevIdx = currentSentenceIndex - 1;
    if (prevIdx < 0) prevIdx = total - 1;
    playSentence(prevIdx);
  }, [currentSentenceIndex, playSentence, mistakeOnly, wrongIndices]);

  // --- Handlers Ref (for playSentence access in togglePlay) ---
  const handlersRef = useRef({ playSentence });
  useEffect(() => { handlersRef.current = { playSentence }; }, [playSentence]);

  // --- Study Modes ---
  // Review keeps one sentence on repeat so playback cannot run on into lines that are hidden.
  const toggleRepeat = () => {
    if (mistakeOnly) {
      setToast({ message: '오답 복습 중에는 한 문장 반복이 켜져 있어요', type: 'success' });
      return;
    }
    dispatch({ type: 'TOGGLE_REPEAT_MODE' });
  };

  const exitMistakes = React.useCallback(() => {
    setMistakeOnly(false);
    setDrillMode(drillBeforeMistakesRef.current);
    dispatch({ type: 'SET_REPEAT_MODE', payload: repeatBeforeMistakesRef.current });
  }, [dispatch]);

  const toggleMistakes = () => {
    if (mistakeOnly) {
      exitMistakes();
      return;
    }
    if (wrongIndices.length === 0) return;
    repeatBeforeMistakesRef.current = repeatMode;
    drillBeforeMistakesRef.current = drillMode;
    dispatch({ type: 'SET_REPEAT_MODE', payload: 'sentence' });
    // "알았음" only exists on the blanks, so review always shows them.
    setDrillMode(true);
    setMistakeOnly(true);
    if (!wrongIndices.includes(currentSentenceIndex)) {
      const nearest = currentSentenceIndex < 0
        ? wrongIndices[0]
        : wrongIndices.reduce((best, w) => (Math.abs(w - currentSentenceIndex) < Math.abs(best - currentSentenceIndex) ? w : best), wrongIndices[0]);
      goToLine(nearest);
    }
  };

  const markAnswer = (idx: number, known: boolean) => {
    markLine(idx, known);
    if (!known || !mistakeOnly) return;
    // Worked out from the list without this line: it is about to leave, so it must not be the next stop.
    const remaining = wrongIndices.filter(w => w !== idx);
    if (remaining.length > 0) goToLine(remaining.find(w => w > idx) ?? remaining[0]);
    else if (isPlaying) togglePlay();
  };

  // ScriptViewer is memoized, so it receives a handler that never changes identity.
  const markAnswerRef = useRef(markAnswer);
  useEffect(() => { markAnswerRef.current = markAnswer; });
  const handleMarkAnswer = React.useCallback((idx: number, known: boolean) => markAnswerRef.current(idx, known), []);

  const pickDrillLevel = (level: ClozeLevel) => {
    setDrillLevel(level);
    writeLocal('roleplay_cloze_level', level);
  };

  const startNewRound = () => {
    const next = drillRound + 1;
    setDrillRound(next);
    writeLocal('roleplay_cloze_round', String(next));
    clearProgress(sessionId);
    if (mistakeOnly) exitMistakes();
  };

  // Hidden: translation and notes off. Folded: translation and word meanings. Open: word notes too.
  const cycleAnalysis = () => {
    if (!showAnalysis) {
      setShowAnalysis(true);
      setShowBreakdown(false);
    } else if (!showBreakdown) {
      setShowBreakdown(true);
    } else {
      setShowAnalysis(false);
      setShowBreakdown(false);
    }
  };

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts({ togglePlay, handlePrev, handleNext, toggleRepeat, setShowAnalysis });

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
    const storedKey = readLocal('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
    // A stored model that is no longer offered (e.g. the retired gemini-2.0-flash) falls back to the default.
    const storedModel = readLocal('gemini_model_type');
    if (storedModel) {
      const valid = resolveModel(storedModel);
      setModelType(valid);
      if (valid !== storedModel) writeLocal('gemini_model_type', valid);
    }
    loadHistory();
    registerOfflineShell();
    requestPersistentStorage();
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    writeLocal('gemini_api_key', key);
  };

  const loadHistory = async () => {
    const sessions = await getSessions();
    setHistory(sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  // --- Generation ---
  const generateAudioForSegments = async (segments: any[], audioMode: 'north' | 'south', updateMap: React.Dispatch<React.SetStateAction<AudioMap>>) => {
    if (segments.length === 0) return;
    setProgress('음성 만드는 중…');

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
      setError('음성을 만들지 못했어요. 대본은 그대로 볼 수 있어요.');
    }
  };

  // --- Word Analysis (stage 2) ---
  const patchScriptLines = (setId: string, patch: (line: ScriptItem) => ScriptItem) => {
    setGeneratedSets(prev => prev.map(set =>
      set.id === setId ? { ...set, script: set.script.map(patch) } : set
    ));
  };

  /**
   * Fetches word analysis for `targets` (segment indices) of one set, a few lines per request,
   * several requests at a time. Each batch is written into the script as soon as it arrives.
   * Lines the model skipped are asked for once more; whatever is still missing is marked failed.
   */
  const runAnalysis = async (setId: string, script: ScriptItem[], targets: number[], lang: string) => {
    if (targets.length === 0) return;
    const isStale = () => activeSetIdRef.current !== setId;
    const lines = script.map((l, i) => ({
      index: l.segmentIndex ?? i,
      speaker: l.speaker,
      text: l.text,
      translation: l.translation,
    }));

    const requestBatch = async (batch: number[]): Promise<number[]> => {
      try {
        const data = await postJsonWithRetry<AnalysisResponse>(
          '/api/generate-analysis',
          { language: lang, apiKey, model: modelType, lines, targets: batch },
          {
            isCancelled: isStale,
            onRetry: (info: RetryInfo) => {
              if (!isStale()) setAnalysisNote(`풀이 다시 요청 중 (${FAIL_REASON_LABEL[info.reason]})…`);
            },
          }
        );
        if (isStale()) return [];
        const byIndex = new Map((data.items || []).map(item => [item.index, item.word_analysis]));
        patchScriptLines(setId, line => {
          const analysis = line.segmentIndex != null ? byIndex.get(line.segmentIndex) : undefined;
          return analysis ? { ...line, word_analysis: analysis, analysisStatus: undefined } : line;
        });
        return batch.filter(idx => !byIndex.has(idx));
      } catch (e) {
        console.error('[Analysis] batch failed:', batch, e);
        // Errors that a retry cannot fix (bad key, bad request) are worth showing right away.
        if (!isStale() && e instanceof ApiError && !e.retryable) setError(userMessage(e));
        return batch;
      }
    };

    const runRound = async (indices: number[]): Promise<number[]> => {
      const size = analysisBatchSize(script.length);
      const queue: number[][] = [];
      for (let i = 0; i < indices.length; i += size) queue.push(indices.slice(i, i + size));
      const missing: number[] = [];
      const worker = async () => {
        while (queue.length > 0 && !isStale()) {
          const batch = queue.shift()!;
          missing.push(...await requestBatch(batch));
        }
      };
      await Promise.all(Array.from({ length: Math.min(ANALYSIS_CONCURRENCY, queue.length) }, worker));
      return missing;
    };

    let missing = await runRound(targets);
    if (missing.length > 0 && !isStale()) {
      setAnalysisNote('빠진 문장 풀이 다시 요청 중…');
      missing = await runRound(missing);
    }
    if (isStale()) return;

    setAnalysisNote('');
    if (missing.length > 0) {
      const failed = new Set(missing);
      patchScriptLines(setId, line =>
        line.segmentIndex != null && failed.has(line.segmentIndex) && !line.word_analysis
          ? { ...line, analysisStatus: 'failed' }
          : line
      );
    }
  };

  const retryFailedAnalysis = () => {
    if (isOffline()) {
      setToast({ message: OFFLINE_MESSAGE, type: 'error' });
      return;
    }
    const set = generatedSetsRef.current.find(s => s.script.some(l => l.analysisStatus === 'failed'));
    if (!set) return;
    const targets = set.script
      .filter(l => l.analysisStatus === 'failed' && l.segmentIndex != null)
      .map(l => l.segmentIndex as number);
    activeSetIdRef.current = set.id;
    setError(null);
    patchScriptLines(set.id, l => (l.analysisStatus === 'failed' ? { ...l, analysisStatus: 'pending' } : l));
    runAnalysis(set.id, set.script, targets, languageRef.current);
  };

  // ScriptViewer is memoized and this page re-renders several times a second during playback,
  // so the retry handler is handed down with a stable identity.
  const retryFailedAnalysisRef = useRef(retryFailedAnalysis);
  useEffect(() => { retryFailedAnalysisRef.current = retryFailedAnalysis; });
  const handleRetryAnalysis = React.useCallback(() => retryFailedAnalysisRef.current(), []);

  const handleGenerate = async () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Checked before anything is cleared, so the current script survives a tap without internet.
    if (isOffline()) {
      setToast({ message: OFFLINE_MESSAGE, type: 'error' });
      return;
    }
    const lang = draftLanguage;
    setLanguage(lang);
    languageRef.current = lang;
    if (mistakeOnly) exitMistakes();
    setComposeOpen(false);
    setLoading(true);
    setAudioLoading(true);
    setProgress('준비 중…');
    cleanupAudio();
    setGeneratedSets([]);
    dispatch({ type: 'SET_CURRENT_INDEX', payload: -1 });
    dispatch({ type: 'SET_TOTAL_SENTENCES', payload: 0 });
    setError(null);
    setAnalysisNote('');
    activeSetIdRef.current = null;
    isGeneratingRef.current = true;

    try {
      const newSets: GeneratedSet[] = [];
      const allSegmentData: any[] = [];
      let globalSegIdx = 0;

      setProgress('대본 쓰는 중…');

      // Stage 1: lines + translation only, so the script can be shown and voiced right away.
      const data = await postJsonWithRetry<{ script: ScriptItem[]; speakers: any }>(
        '/api/generate-script',
        {
          input, language: lang,
          count: mode === 'analysis' ? 0 : turnCount,
          mode, apiKey,
          model: modelType,
          accentMode
        },
        {
          onRetry: (info: RetryInfo) => setProgress(`다시 시도 중 (${FAIL_REASON_LABEL[info.reason]})…`),
        }
      );
      const { script, speakers } = data;

      const scriptWithIndices: ScriptItem[] = script.map((item: ScriptItem) => {
        const idx = globalSegIdx++;
        allSegmentData.push({ idx, text: item.text, speaker: item.speaker, speakers });
        return { ...item, segmentIndex: idx, analysisStatus: 'pending' as const };
      });

      const setId = crypto.randomUUID();
      newSets.push({
        id: setId,
        script: scriptWithIndices,
        timestamp: new Date(),
        input: input || "Random Topic",
      });

      activeSetIdRef.current = setId;
      setGeneratedSets(newSets);
      dispatch({ type: 'SET_TOTAL_SENTENCES', payload: globalSegIdx });

      // Stage 2: word analysis runs alongside audio generation and fills in as it arrives (not awaited).
      runAnalysis(setId, scriptWithIndices, scriptWithIndices.map(l => l.segmentIndex as number), lang);

      setProgress('음성 만드는 중…');

      if (lang === 'Vietnamese') {
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
      setError(userMessage(error));
    } finally {
      setLoading(false);
      setAudioLoading(false);
    }
  };

  // --- Auto-save & Auto-play ---
  useEffect(() => {
    const hasAudio = Object.keys(audioUrls).length > 0 || Object.keys(audioUrlsSouth).length > 0;
    if (!loading && !audioLoading && generatedSets.length > 0 && hasAudio) {
      const savingId = generatedSets[0].id;
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
          id: savingId,
          timestamp: new Date(),
          // From the script itself: the compose box may already hold the next topic.
          input: generatedSets[0].input || "Random",
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
      // Analysis batches update the script several times in a row; save the snapshots in order.
      saveChainRef.current = saveChainRef.current.then(autoSave).catch(e => {
        console.error('Auto-save failed:', e);
        // After switching scripts the old audio links are gone on purpose; that is not a failure to report.
        if (generatedSetsRef.current[0]?.id === savingId) {
          setToast({ message: '대본을 저장하지 못했어요. 저장 공간을 확인해 주세요.', type: 'error' });
        }
      });

      if (isGeneratingRef.current) {
        playSentence(0);
        isGeneratingRef.current = false;
      }
    }
  }, [loading, audioLoading, generatedSets]);

  // --- Session Management ---
  const loadSession = (session: SavedSession) => {
    // A session saved while analysis was still arriving: nothing is fetching those lines any more,
    // so show them as "not received" with the retry button instead of a spinner.
    const sets = session.sets.map(set => ({
      ...set,
      script: set.script.map(l => (l.analysisStatus === 'pending' ? { ...l, analysisStatus: 'failed' as const } : l)),
    }));
    if (mistakeOnly) exitMistakes();
    activeSetIdRef.current = sets[0]?.id ?? null;
    setAnalysisNote('');
    setError(null);
    setComposeOpen(false);
    setGeneratedSets(sets);
    setLanguage(session.language as any);
    setDraftLanguage(session.language as any);
    setInput(session.input === 'Random' || session.input === 'Random Topic' ? '' : session.input || '');
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
      dispatch({ type: 'SET_TOTAL_SENTENCES', payload: 0 });
      dispatch({ type: 'SET_CURRENT_INDEX', payload: -1 });
      setToast({ message: '이 대본에는 저장된 음성이 없어요', type: 'error' });
    }
    setShowHistory(false);
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmState({
      message: '이 대본을 삭제할까요?',
      onConfirm: async () => {
        await deleteSession(id);
        clearProgress(id);
        loadHistory();
      },
    });
  };

  const clearHistoryAll = () => {
    setConfirmState({
      message: '저장된 대본을 모두 삭제할까요? 되돌릴 수 없어요.',
      confirmText: '전체 삭제',
      onConfirm: async () => {
        await clearSessions();
        clearAllProgress();
        setHistory([]);
      },
    });
  };

  const handleModelChange = (model: string) => {
    setModelType(model);
    writeLocal('gemini_model_type', model);
  };

  const hasScript = generatedSets.length > 0;
  const showCompose = composeOpen || (!hasScript && !loading);
  const headerTitle = loading
    ? progress || '만드는 중…'
    : hasScript ? sessionTitle(generatedSets[0].input) : 'RealTalk';

  return (
    <main className="flex flex-col h-dvh bg-[#F8FAFC] dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden font-sans relative">
      <HeaderBar
        title={headerTitle}
        busy={loading}
        isMerging={isMerging}
        backgroundReady={isMergedMode && !!mergedAudioUrl}
        toolbarAvailable={hasScript && !showCompose}
        toolbarOpen={toolbarOpen}
        toolbarModesOn={drillMode || mistakeOnly}
        onHome={() => setComposeOpen(true)}
        onShowHistory={() => setShowHistory(true)}
        onOpenSettings={() => setShowAdvanced(true)}
        onToggleToolbar={() => setToolbarOpen(open => !open)}
      />

      {updateAvailable && (
        <div className="flex-none flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm">
          <RotateCcw size={14} className="shrink-0" />
          <span className="flex-1 min-w-0 font-medium leading-tight">새 버전이 나왔어요. 새로고침하면 최신 기능이 적용됩니다.</span>
          <button onClick={() => window.location.reload()} className="shrink-0 px-2.5 py-1 rounded-lg bg-white text-indigo-700 font-bold hover:bg-indigo-50 transition-colors">
            새로고침
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex-none flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs sm:text-sm">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 min-w-0 font-medium leading-tight">{error}</span>
          {error === API_KEY_MESSAGE && (
            <button onClick={() => setShowAdvanced(true)} className="shrink-0 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors">
              설정 열기
            </button>
          )}
          <button onClick={() => setError(null)} aria-label="오류 알림 닫기" className="shrink-0 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {toolbarOpen && hasScript && !showCompose && (
        <StudyToolbar
          drillMode={drillMode}
          drillLevel={drillLevel}
          wrongCount={wrongIndices.length}
          mistakeOnly={mistakeOnly}
          onToggleDrill={() => setDrillMode(on => !on)}
          onPickLevel={pickDrillLevel}
          onNewRound={startNewRound}
          onToggleMistakes={toggleMistakes}
        />
      )}

      <div key={showCompose ? 'compose' : 'script'} className="flex-1 min-h-0 overflow-y-auto">
        {showCompose ? (
          <ComposePanel
            input={input}
            mode={mode}
            language={draftLanguage}
            turnCount={turnCount}
            loading={loading}
            hasScript={hasScript}
            onInputChange={setInput}
            onModeChange={setMode}
            onLanguageChange={setDraftLanguage}
            onTurnCountChange={setTurnCount}
            onGenerate={handleGenerate}
            onShowHistory={() => setShowHistory(true)}
            onBackToScript={() => setComposeOpen(false)}
          />
        ) : hasScript ? (
          <ScriptViewer
            generatedSets={generatedSets}
            currentSentenceIndex={currentSentenceIndex}
            showAnalysis={showAnalysis}
            showBreakdown={showBreakdown}
            scrollRefs={scrollRefs}
            onPlaySentence={playSentence}
            analysisNote={analysisNote}
            onRetryAnalysis={handleRetryAnalysis}
            drillMode={drillMode}
            drillLevel={drillLevel}
            drillRound={drillRound}
            wrongIndices={wrongIndices}
            mistakeOnly={mistakeOnly}
            onMarkAnswer={handleMarkAnswer}
            onExitMistakes={exitMistakes}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
            <RefreshCw size={24} className="animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-bold">{progress || '만드는 중…'}</p>
          </div>
        )}
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
          showBreakdown={showBreakdown}
          showSpeedPopup={showSpeedPopup}
          onTogglePlay={togglePlay}
          onPrev={handlePrev}
          onNext={handleNext}
          onSpeedChange={(speed) => { dispatch({ type: 'SET_SPEED', payload: speed }); setShowSpeedPopup(false); }}
          onRepeatModeToggle={toggleRepeat}
          onCycleAnalysis={cycleAnalysis}
          onToggleSpeedPopup={() => setShowSpeedPopup(!showSpeedPopup)}
        />
      )}

      {showAdvanced && (
        <AdvancedSettings
          apiKey={apiKey}
          modelType={modelType}
          theme={theme}
          onApiKeyChange={handleApiKeyChange}
          onModelChange={handleModelChange}
          onThemeChange={setTheme}
          onClose={() => setShowAdvanced(false)}
        />
      )}

      {showHistory && (
        <HistorySidebar
          history={history}
          activeId={sessionId}
          onLoadSession={loadSession}
          onDeleteItem={deleteHistoryItem}
          onClearAll={clearHistoryAll}
          onClose={() => setShowHistory(false)}
        />
      )}

      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null); }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </main>
  );
}
