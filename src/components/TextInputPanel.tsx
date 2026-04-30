import React, { useState } from 'react';

interface TextInputPanelProps {
  onAnalyze: (text: string) => void;
  isLoading: boolean;
}

export const TextInputPanel: React.FC<TextInputPanelProps> = ({ onAnalyze, isLoading }) => {
  const [text, setText] = useState('');

  return (
    <div className="panel input-panel">
      <h2>1. 練習したい文章を入力してください</h2>
      <textarea 
        value={text} 
        onChange={e => setText(e.target.value)} 
        rows={5} 
        placeholder="例：今日はとても暑いです。" 
      />
      <div className="action-row">
        <button 
          className="btn-primary"
          disabled={isLoading || !text.trim()} 
          onClick={() => onAnalyze(text.trim())}
        >
          {isLoading ? '準備中...' : '分析開始'}
        </button>
      </div>
    </div>
  );
};
