import { useReducer } from 'react';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  repeatMode: 'sentence' | 'session';
  currentSentenceIndex: number;
  totalSentences: number;
  isGapActive: boolean;
}

export type PlaybackAction =
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_SPEED'; payload: number }
  | { type: 'TOGGLE_REPEAT_MODE' }
  | { type: 'SET_REPEAT_MODE'; payload: 'sentence' | 'session' }
  | { type: 'SET_CURRENT_INDEX'; payload: number }
  | { type: 'SET_TOTAL_SENTENCES'; payload: number }
  | { type: 'SET_GAP_ACTIVE'; payload: boolean }
  | { type: 'PLAY_SENTENCE'; payload: { index: number } }
  | { type: 'RESET' };

const initialState: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackSpeed: 1.0,
  repeatMode: 'session',
  currentSentenceIndex: -1,
  totalSentences: 0,
  isGapActive: false,
};

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_SPEED':
      return { ...state, playbackSpeed: action.payload };
    case 'TOGGLE_REPEAT_MODE':
      return { ...state, repeatMode: state.repeatMode === 'sentence' ? 'session' : 'sentence' };
    case 'SET_REPEAT_MODE':
      return { ...state, repeatMode: action.payload };
    case 'SET_CURRENT_INDEX':
      return { ...state, currentSentenceIndex: action.payload };
    case 'SET_TOTAL_SENTENCES':
      return { ...state, totalSentences: action.payload };
    case 'SET_GAP_ACTIVE':
      return { ...state, isGapActive: action.payload };
    case 'PLAY_SENTENCE':
      return {
        ...state,
        isPlaying: true,
        currentSentenceIndex: action.payload.index,
        isGapActive: false,
      };
    case 'RESET':
      return { ...initialState, playbackSpeed: state.playbackSpeed };
    default:
      return state;
  }
}

export function usePlaybackReducer() {
  return useReducer(playbackReducer, initialState);
}
