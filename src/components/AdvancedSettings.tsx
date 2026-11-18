'use client';

import React from 'react';
import { MODELS } from '../constants/models';

interface AdvancedSettingsProps {
  apiKey: string;
  modelType: string;
  onApiKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}

export default function AdvancedSettings({ apiKey, modelType, onApiKeyChange, onModelChange }: AdvancedSettingsProps) {
  return (
    <div className="glass p-4 rounded-xl bg-white border border-gray-200 mb-4 text-sm text-gray-700 space-y-4 animate-in slide-in-from-top-2">
      <div className="flex flex-col gap-2">
        <label className="font-bold text-xs uppercase text-gray-400">Gemini API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="Enter your Gemini API Key..."
          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <p className="text-[10px] text-gray-400">Leave empty to use server default (if configured).</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-bold text-xs uppercase text-gray-400">Model</label>
        <select
          value={modelType}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none font-bold text-black"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
