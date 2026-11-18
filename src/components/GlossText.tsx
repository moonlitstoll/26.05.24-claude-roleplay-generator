'use client';

import React from 'react';
import { glossLines, splitGlossLine } from '../utils/analysis';

const WORD = 'text-sky-700 dark:text-sky-300';
const MARK = 'text-slate-400 dark:text-slate-500';

/** Word notes: the foreign word in sky blue, separators dimmed. Size and base colour come from the parent. */
export default function GlossText({ text }: { text: string }) {
  return (
    <>
      {glossLines(text).map((line, i) => (
        <span key={i} className="block">
          {splitGlossLine(line).map((part, j) => {
            if (part.type === 'word') return <span key={j} className={WORD}>{part.text}</span>;
            if (part.type === 'mark') return <span key={j} className={MARK}>{part.text}</span>;
            return <React.Fragment key={j}>{part.text}</React.Fragment>;
          })}
        </span>
      ))}
    </>
  );
}
