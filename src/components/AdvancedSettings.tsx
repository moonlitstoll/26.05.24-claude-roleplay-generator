'use client';

import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Settings, X } from 'lucide-react';
import { MODELS } from '../constants/models';
import { ThemePref, THEME_OPTIONS } from '../utils/theme';
import { isOfflineReady, offlineSupported } from '../utils/offline';

interface AdvancedSettingsProps {
  apiKey: string;
  modelType: string;
  theme: ThemePref;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
  onThemeChange: (theme: ThemePref) => void;
  onClose: () => void;
}

const THEME_LABEL: Record<ThemePref, string> = { system: '시스템', light: '라이트', dark: '다크' };
const LABEL = 'text-sm font-bold text-slate-700 dark:text-slate-300';
const HINT = 'text-[11px] text-slate-500 dark:text-slate-400';

export default function AdvancedSettings({
  apiKey, modelType, theme, onApiKeyChange, onModelChange, onThemeChange, onClose,
}: AdvancedSettingsProps) {
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    let active = true;
    isOfflineReady().then(ready => { if (active) setOfflineReady(ready); });
    return () => { active = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="설정" className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-xl">
              <Settings size={20} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">설정</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">키 · 화면 · 모델</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="설정 닫기" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[70dvh] overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="settings-key" className={LABEL}>Gemini API Key</label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                키 발급 <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <input
                id="settings-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="API 키 붙여넣기"
                className="w-full pl-4 pr-11 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-mono text-sm text-slate-900 dark:text-slate-100"
              />
              <Check size={18} className={`absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-400 transition-all ${apiKey.length > 20 ? 'opacity-100' : 'opacity-0'}`} />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <span className={LABEL}>화면 테마</span>
            <div className="flex w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {THEME_OPTIONS.map(option => (
                <button
                  key={option}
                  onClick={() => onThemeChange(option)}
                  aria-pressed={theme === option}
                  className={`flex-1 py-2 text-sm font-bold transition-colors ${theme === option
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {THEME_LABEL[option]}
                </button>
              ))}
            </div>
            <p className={HINT}>시스템은 휴대폰·PC의 다크 모드 설정을 따라갑니다.</p>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <label htmlFor="settings-model" className={LABEL}>모델</label>
            <select
              id="settings-model"
              value={modelType}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold text-slate-900 dark:text-slate-100"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {offlineSupported() && (
            <p className={`pt-4 border-t border-slate-100 dark:border-slate-700 ${HINT}`}>
              {offlineReady ? '인터넷 없이도 열림 ✓ 저장된 대본과 음성을 볼 수 있어요.' : '인터넷 없이 열 준비 중이에요.'}
            </p>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900">
          <button onClick={onClose} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
