import React from 'react';

interface ScoreProps {
  totalChars: number;
  correctChars: number;
  onReset: () => void;
  onRetry: () => void;
  onBack?: () => void;
  onPracticeMistakes?: () => void;
  mistakeWordCount?: number;
}

export const ScorePanel: React.FC<ScoreProps> = ({
  totalChars,
  correctChars,
  onBack,
  onReset,
  onRetry,
  onPracticeMistakes,
  mistakeWordCount = 0,
}) => {
  const rate = totalChars === 0 ? 0 : (correctChars / totalChars) * 100;
  
  return (
    <div className="score-panel panel">
      {onBack && (
        <div className="page-back-row">
          <button type="button" className="btn-secondary back-btn" onClick={onBack}>
            ← 前のページへ
          </button>
        </div>
      )}
      <h2>🎉 結果発表 🎉</h2>
      <div className="score-details">
        <p>総判定文字数: <strong>{totalChars}</strong></p>
        <p>正しく発声できた文字数: <span className="correct-text"><strong>{correctChars}</strong></span></p>
        <p>正答率: <strong>{rate.toFixed(1)}%</strong></p>
      </div>
      <div className="final-score">
        <h3>スコア: <span>{Math.round(rate)}</span> 点</h3>
      </div>
      {onPracticeMistakes && mistakeWordCount > 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button className="btn-primary" onClick={onPracticeMistakes}>
            間違えた単語をもう一度練習する
          </button>
          <p className="custom-reading-help">対象: {mistakeWordCount}単語</p>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
        <button className="btn-primary" onClick={onRetry}>もう一度同じ文章でやり直す</button>
        <button className="btn-secondary" onClick={onReset}>テキストを入力し直す</button>
      </div>
    </div>
  );
};
