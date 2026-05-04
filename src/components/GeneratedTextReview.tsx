import React, { useState } from 'react';
import { buildPracticeScript, parseInterviewMaterial } from '../utils/interviewMaterial';

interface GeneratedTextReviewProps {
  text: string;
  onAnalyze: (text: string, context?: { title: string; point?: string }) => void | Promise<void>;
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
  const material = parseInterviewMaterial(editedText);

  const introScript = material.introduction || editedText.trim();
  const answerScripts = material.questions.map((item) => item.answer);
  const allScript = buildPracticeScript([introScript, ...answerScripts]);
  const canAnalyze = !isLoading && allScript.length > 0;

  const handleAnalyze = (script: string, context?: { title: string; point?: string }) => {
    const text = script.trim();
    if (!text) return;
    void onAnalyze(text, context);
  };

  return (
    <section className="panel generated-review-panel">
      <div className="generated-review-header">
        <button type="button" className="btn-secondary back-btn" onClick={onBack}>
          ← 戻る
        </button>
        <div className="generated-review-title">
          <span>面談練習メニュー</span>
          <strong>自己紹介 + 想定問答10個</strong>
        </div>
        <button
          type="button"
          className={isEditing ? 'btn-secondary' : 'btn-primary edit-toggle-btn'}
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? '完了' : '編集'}
        </button>
      </div>

      <p className="generated-review-help">
        Difyの長い回答から、練習に使う部分だけを抜き出しました。練習したい項目を選んでください。
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
        <div className="interview-practice-layout">
          <article className="practice-card intro-practice-card">
            <div className="practice-card-header">
              <div>
                <p className="practice-kicker">Practice 01</p>
                <h3>自己紹介</h3>
              </div>
              <button
                type="button"
                className="btn-primary compact-action"
                disabled={isLoading || !introScript.trim()}
                onClick={() => handleAnalyze(introScript, { title: '自己紹介' })}
              >
                練習する
              </button>
            </div>
            <p className="practice-answer">{introScript || '自己紹介が見つかりません。編集から文章を確認してください。'}</p>
          </article>

          <div className="practice-summary-row">
            <div>
              <span className="practice-count">{material.questions.length}</span>
              <span>個の想定問答を検出</span>
            </div>
            <button
              type="button"
              className="btn-primary compact-action"
              disabled={!canAnalyze}
              onClick={() => handleAnalyze(allScript, { title: '自己紹介 + 想定問答10個' })}
            >
              全部まとめて練習
            </button>
          </div>

          <div className="qa-practice-list">
            {material.questions.map((item) => (
              <article className="practice-card qa-practice-card" key={item.number}>
                <div className="qa-number">{item.number}</div>
                <div className="qa-body">
                  <h3>{item.question}</h3>
                  <p className="practice-answer">{item.answer}</p>
                  {item.point && <p className="practice-point">{item.point}</p>}
                </div>
                <button
                  type="button"
                  className="btn-secondary compact-action"
                  disabled={isLoading}
                  onClick={() => handleAnalyze(item.answer, {
                    title: `${item.number}. ${item.question}`,
                    point: item.point,
                  })}
                >
                  回答を練習
                </button>
              </article>
            ))}
          </div>

          {material.questions.length === 0 && (
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

          {material.extraSections.length > 0 && (
            <section className="extra-material-section">
              <div className="extra-material-heading">
                <span>Reference</span>
                <h3>その他の面談対策メモ</h3>
              </div>
              <div className="extra-material-list">
                {material.extraSections.map((section) => (
                  <article className="extra-material-card" key={section.title}>
                    <h4>{section.title}</h4>
                    <div className="extra-material-body">
                      {section.body.split('\n').map((line, index) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        return <p key={`${section.title}-${index}`}>{trimmed}</p>;
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="action-row generated-review-action">
        <button
          type="button"
          className="btn-primary"
          disabled={!canAnalyze}
          onClick={() => handleAnalyze(allScript, { title: '自己紹介 + 想定問答10個' })}
        >
          {isEditing ? '分析開始' : '自己紹介と10問を練習開始'}
        </button>
      </div>
    </section>
  );
};
