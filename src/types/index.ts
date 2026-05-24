export interface ScriptItem {
  speaker: string;
  text: string;
  translation: string;
  word_analysis?: string | WordAnalysisObj[];
  segmentIndex?: number;
}

export interface WordAnalysisObj {
  word: string;
  meaning: string;
  grammar: string;
}

export interface GeneratedSet {
  id: string;
  script: ScriptItem[];
  timestamp: Date;
  input: string;
}

// Map of segmentIndex -> Blob URL
export type AudioMap = { [key: number]: string };

export interface TimelineSegment {
  start: number;
  end: number;
  index: number;
}
