'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6 animate-in zoom-in-95 duration-500">
      <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center shadow-inner border border-gray-200">
        <MessageSquare className="w-10 h-10 opacity-30 text-gray-400" />
      </div>
      <div className="text-center max-w-md">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to Roleplay?</h3>
        <p className="text-gray-500">Enter a word or topic on the left to generate native-level conversations tailored to your needs.</p>
      </div>
    </div>
  );
}
