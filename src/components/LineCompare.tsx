import React from 'react';
import { KaraokeLineData, LineCompareResult } from '../types';
import { RubyWord } from './RubyWord';

interface LineCompareProps {
  line: KaraokeLineData;
  isActive: boolean;
  isRecording: boolean;
  isSparkling?: boolean;
  sparkleColor?: string;
  result?: LineCompareResult;
  onToggleRecord: (lineIndex: number) => void;
  onSpeakLine: (line: KaraokeLineData) => void;
  onHoverLine: (lineIndex: number) => void;
}

export const LineCompare: React.FC<LineCompareProps> = ({
  line,
  isActive,
  isRecording,
  isSparkling,
  sparkleColor,
  result,
  onToggleRecord,
  onSpeakLine,
  onHoverLine
}) => {
  return (
    <div 
      className={`line-compare-container ${isActive ? 'active-line' : ''} ${isActive && isSparkling ? 'sparkling' : ''}`}
      style={isActive && isSparkling ? { '--sparkle-color': sparkleColor } as any : {}}
      onMouseEnter={() => onHoverLine(line.lineIndex)}
    >
      <div className="original-text">
        {line.words.map((w) => (
          <React.Fragment key={w.id}>
            <RubyWord word={w} isSpoken={false} />
          </React.Fragment>
        ))}
      </div>
      
      {result && (
        <div className="spoken-result">
          <span className="result-label">あなたの声: </span>
          {result.spokenWords.map((w) => (
            <React.Fragment key={w.id}>
              <RubyWord word={w} isSpoken={true} />
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="line-action-row">
        <button
          className="btn-record speak-btn"
          onClick={() => onSpeakLine(line)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
          aria-label="Read line aloud"
        >
          🔊 PLAY
        </button>
        <button 
          className={isRecording ? "btn-record stop-btn" : "btn-record start-btn"} 
          onClick={() => onToggleRecord(line.lineIndex)}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
        >
          {isRecording ? '🔴 STOP' : '🎤 REC'}
        </button>
      </div>
    </div>
  );
};
