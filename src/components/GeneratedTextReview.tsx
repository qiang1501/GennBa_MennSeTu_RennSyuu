import React, { useState } from 'react';

interface GeneratedTextReviewProps {
  text: string;
  onAnalyze: (text: string) => void | Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export const GeneratedTextReview: React.FC<GeneratedTextReviewProps> = ({
  text: initialText,
  onAnalyze,
  onBack,
  isLoading,
}) => {
  const [editedText, setEditedText] = useState(initialText);
  const [isEditing, setIsEditing] = useState(false);

  const canAnalyze = !isLoading && editedText.trim().length > 0;

  const handleAnalyze = () => {
    const text = editedText.trim();
    if (!text) return;
    void onAnalyze(text);
  };

  return (
    <section className="panel generated-review-panel">
      <div className="generated-review-header">
        <button type="button" className="btn-secondary back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <h2>生成文章の確認</h2>
        <button
          type="button"
          className={isEditing ? 'btn-secondary' : 'btn-primary edit-toggle-btn'}
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? '完了' : '編集'}
        </button>
      </div>

      <p className="generated-review-help">
        必要であれば文章を編集してから分析を開始してください。
      </p>

      {isEditing ? (
        <textarea
          aria-label="生成文章の編集"
          className="generated-review-textarea"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={20}
        />
      ) : (
        <div className="generated-review-text">
          {editedText.split('\n').map((line, idx) =>
            line.trim() === '' ? (
              <br key={idx} />
            ) : (
              <p key={idx}>{line}</p>
            )
          )}
        </div>
      )}

      <div className="action-row generated-review-action">
        <button
          type="button"
          className="btn-primary"
          disabled={!canAnalyze}
          onClick={handleAnalyze}
        >
          分析開始
        </button>
      </div>
    </section>
  );
};
