'use client';

import { useRef, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { GameConfig } from '@/types';

interface GameConfigSelectorProps {
  gameConfigs: GameConfig[];
  selectedConfigId: string;
  showDropdown: boolean;
  onSelectConfig: (configId: string) => void;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
}

export default function GameConfigSelector({
  gameConfigs,
  selectedConfigId,
  showDropdown,
  onSelectConfig,
  onToggleDropdown,
  onCloseDropdown,
}: GameConfigSelectorProps) {
  const configDropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configDropdownRef.current && !configDropdownRef.current.contains(event.target as Node)) {
        onCloseDropdown();
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, onCloseDropdown]);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
      <label className="block text-sm font-medium text-zinc-300 mb-2.5 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Configuration de jeu
      </label>
      <div className="relative" ref={configDropdownRef}>
        <button
          onClick={onToggleDropdown}
          className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all cursor-pointer text-left flex items-center justify-between"
        >
          <span className={selectedConfigId ? 'text-zinc-200' : 'text-zinc-400'}>
            {selectedConfigId
              ? gameConfigs.find(c => c.id === selectedConfigId)?.file_name
              : 'Aucune configuration sélectionnée'}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 12 8"
          >
            <path d="M1 1L6 6L11 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
            <div
              onClick={() => {
                onSelectConfig('');
                onCloseDropdown();
              }}
              className="px-3 py-2.5 text-sm text-zinc-400 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
            >
              Aucune configuration sélectionnée
            </div>
            {gameConfigs.map((config) => (
              <div
                key={config.id}
                onClick={() => {
                  onSelectConfig(config.id);
                  onCloseDropdown();
                }}
                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  selectedConfigId === config.id
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-200 hover:bg-purple-600 hover:text-white'
                }`}
              >
                {config.file_name}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 mt-2">
        Choisissez une configuration pour lancer le jeu
      </p>
    </div>
  );
}
