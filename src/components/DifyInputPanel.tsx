import React, { useState } from 'react';
import { generatePracticeText } from '../utils/difyClient';

interface DifyInputPanelProps {
  onAnalyze: (text: string) => void | Promise<void>;
  isLoading: boolean;
}

export const DifyInputPanel: React.FC<DifyInputPanelProps> = ({ onAnalyze, isLoading }) => {
  const [meet, setMeet] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [generatedText, setGeneratedText] = useState('');
  const [hasGeneratedText, setHasGeneratedText] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !isLoading && !isGenerating && meet.trim().length > 0 && excelFile !== null;
  const canAnalyze = !isLoading && !isGenerating && generatedText.trim().length > 0;

  const handleGenerate = async () => {
    if (!excelFile || !meet.trim()) return;

    setIsGenerating(true);
    setError(null);
    try {
      const text = await generatePracticeText({
        meet: meet.trim(),
        file: excelFile,
      });
      setGeneratedText(text);
      setHasGeneratedText(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Difyでの生成に失敗しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = () => {
    const text = generatedText.trim();
    if (!text) return;
    void onAnalyze(text);
  };

  return (
    <section className="panel input-panel dify-input-panel">
      <h2>1. 面談練習文を作成します</h2>

      <div className="form-field">
        <label htmlFor="meet-input">案件情報</label>
        <textarea
          id="meet-input"
          value={meet}
          onChange={(event) => setMeet(event.target.value)}
          rows={6}
          placeholder="案件内容や面談で確認したいポイントを入力してください。"
        />
      </div>

      <div className="form-field">
        <label htmlFor="excel-file">スキルシート Excel</label>
        <input
          id="excel-file"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(event) => {
            setExcelFile(event.target.files?.[0] ?? null);
            setGeneratedText('');
            setHasGeneratedText(false);
            setError(null);
          }}
        />
        {excelFile && <p className="file-name">選択中: {excelFile.name}</p>}
      </div>

      {error && <div className="error-message dify-error">{error}</div>}

      <div className="action-row">
        <button
          type="button"
          className="btn-primary"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? '生成中...' : 'Difyで生成'}
        </button>
      </div>

      {hasGeneratedText && (
        <div className="form-field generated-field">
          <label htmlFor="generated-text">生成文章の確認</label>
          <p className="input-help">必要であれば文章を編集してから分析を開始してください。</p>
          <textarea
            id="generated-text"
            value={generatedText}
            onChange={(event) => setGeneratedText(event.target.value)}
            rows={12}
          />
          <div className="action-row">
            <button
              type="button"
              className="btn-primary"
              disabled={!canAnalyze}
              onClick={handleAnalyze}
            >
              分析開始
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
