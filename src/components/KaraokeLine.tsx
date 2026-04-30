import React from 'react';
import { KaraokeLineData } from '../types';

interface KaraokeLineProps {
  line: KaraokeLineData;
  currentWordId: string | null;
}

export const KaraokeLine: React.FC<KaraokeLineProps> = ({ line, currentWordId }) => {
  return (
    <div className="karaoke-line">
      {line.words.map(w => {
        let className = `word-box status-${w.status}`;
        if (w.id === currentWordId) {
          className += ' current-target';
        }
        return (
          <span key={w.id} className={className}>
            {w.surface}
          </span>
        );
      })}
    </div>
  );
};
