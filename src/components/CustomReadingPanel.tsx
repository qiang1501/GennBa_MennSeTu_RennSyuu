import { useState } from 'react';

interface CustomReadingPanelProps {
  onSave: (word: string, reading: string) => Promise<void>;
}

export function CustomReadingPanel({ onSave }: CustomReadingPanelProps) {
  const [word, setWord] = useState('');
  const [reading, setReading] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedWord = word.trim();
    const trimmedReading = reading.trim();
    if (!trimmedWord || !trimmedReading) return;

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await onSave(trimmedWord, trimmedReading);
      setMessage(`保存しました: ${trimmedWord} -> ${trimmedReading}`);
      setWord('');
      setReading('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel custom-reading-panel">
      <h2>読み方を追加</h2>
      <p className="custom-reading-help">
        例: AWS - エーダブリューエス を登録できます。
      </p>
      <div className="custom-reading-grid">
        <input
          className="custom-reading-input"
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="単語 (AWS)"
        />
        <input
          className="custom-reading-input"
          type="text"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          placeholder="読み方 (エーダブリューエス)"
        />
        <button
          className="btn-primary custom-reading-save"
          onClick={handleSubmit}
          disabled={isSaving || !word.trim() || !reading.trim()}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
      {message && <p className="custom-reading-message">{message}</p>}
      {error && <p className="custom-reading-error">{error}</p>}
    </section>
  );
}
