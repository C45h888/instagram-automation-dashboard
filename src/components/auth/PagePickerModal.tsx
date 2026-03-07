import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface PageOption {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igBusinessAccountId: string;
}

interface PagePickerModalProps {
  pages: PageOption[];
  onSelect: (page: PageOption) => void;
}

export const PagePickerModal: React.FC<PagePickerModalProps> = ({ pages, onSelect }) => {
  const [selected, setSelected] = useState<PageOption | null>(null);

  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">Choose Your Instagram Page</h2>
      <p className="text-gray-400 mb-6">
        Multiple Instagram Business accounts found. Select which one to connect.
      </p>
      <div className="space-y-3 mb-6">
        {pages.map((page) => (
          <button
            key={page.pageId}
            onClick={() => setSelected(page)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              selected?.pageId === page.pageId
                ? 'border-yellow-500 bg-yellow-500/10 text-white'
                : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'
            }`}
          >
            <span className="font-medium">{page.pageName}</span>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>
        ))}
      </div>
      <button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold rounded-lg transition-colors"
      >
        Connect Selected Page
      </button>
    </div>
  );
};
