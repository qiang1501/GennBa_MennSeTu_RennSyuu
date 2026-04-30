# 日本語発声カラオケ採点システム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React + Vite + TypeScript を用いて、ブラウザ上で完結する「日本語カラオケ形式発声・採点アプリ（完全一致ルール）」のMVPを構築する。

**Architecture:** 
- kuromoji.js をクライアントで動かしテキストと音声認識結果を単語分割する。
- Web Speech API のインターフェースは Custom Hook で分離。
- 確定結果は再度形態素解析して文字配列完全一致比較。暫定結果はライブ表示のみ。

**Tech Stack:** React 18, TypeScript, Vite, kuromoji, Web Speech API

---

### Task 1: プロジェクト基盤のセットアップ

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts` etc.

- [ ] **Step 1: Vite プロジェクトの初期化**
Run: `npm create vite@latest . -- --template react-ts`
※ディレクトリが空ではないエラーが出た場合、一度別の名前で作成してから中身を移動するか、強制的に作成する。もしくは空の`package.json`を生成してパッケージを追加する形でもよい。

- [ ] **Step 2: 依存関係のインストール**
Run: `npm install kuromoji`
Run: `npm install -D @types/kuromoji` (型定義)

- [ ] **Step 3: Kuromoji 辞書データの配置**
kuromoji の辞書 (`node_modules/kuromoji/dict/*`) を `public/dict/` にコピーして、ブラウザから直接読み込めるようにする。
Run (Powershell): `mkdir public/dict; Copy-Item -Path .\node_modules\kuromoji\dict\* -Destination .\public\dict\`

---

### Task 2: 型定義の作成

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 基本データ構造の定義**
```typescript
// src/types/index.ts
export type WordStatus = 'pending' | 'correct' | 'incorrect';

export interface KaraokeWord {
  id: string;
  surface: string;
  reading: string;
  status: WordStatus;
  lineIndex: number;
  wordIndex: number;
}

export interface KaraokeLineData {
  lineIndex: number;
  words: KaraokeWord[];
}
```

---

### Task 3: カタカナ正規化ユーティリティの実装

**Files:**
- Create: `src/utils/katakana.ts`

- [ ] **Step 1: 文字列の正規化ロジックの実装**
```typescript
// src/utils/katakana.ts
export function normalizeToKatakana(text: string): string {
  if (!text) return '';
  // ひらがなをカタカナに変換する
  let res = text.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
  // 記号（句読点、かぎ括弧など）と空白を除去
  res = res.replace(/[、。！？「」『』（）\s]/g, '');
  return res;
}
```

---

### Task 4: 形態素解析（kuromoji）ユーティリティの実装

**Files:**
- Create: `src/utils/textParser.ts`

- [ ] **Step 1: パースロジックの実装**
```typescript
// src/utils/textParser.ts
import kuromoji from 'kuromoji';
import { KaraokeWord, KaraokeLineData } from '../types';
import { normalizeToKatakana } from './katakana';

let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

export const buildTokenizer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (tokenizer) return resolve();
    kuromoji.builder({ dicPath: '/dict' }).build((err, t) => {
      if (err) return reject(err);
      tokenizer = t;
      resolve();
    });
  });
};

export const parseTextToLines = (text: string): KaraokeLineData[] => {
  if (!tokenizer) throw new Error('Tokenizer not initialized');
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const result: KaraokeLineData[] = [];

  let globalWordId = 0;
  lines.forEach((lineText, lineIndex) => {
    const tokens = tokenizer!.tokenize(lineText);
    const words: KaraokeWord[] = tokens.map((token, wordIndex) => {
      const reading = token.reading ? normalizeToKatakana(token.reading) : normalizeToKatakana(token.surface_form);
      return {
        id: `word_${globalWordId++}`,
        surface: token.surface_form,
        reading,
        status: 'pending',
        lineIndex,
        wordIndex
      };
    });
    result.push({ lineIndex, words });
  });
  return result;
};

// 確定音声結果もパースして読み順の配列を返す
export const parseSpeechResultToReadings = (speechText: string): string[] => {
  if (!tokenizer) return [];
  const tokens = tokenizer.tokenize(speechText);
  return tokens.map(t => t.reading ? normalizeToKatakana(t.reading) : normalizeToKatakana(t.surface_form));
};
```

---

### Task 5: 音声認識 Hook の実装

**Files:**
- Create: `src/hooks/useSpeechRecognition.ts`

- [ ] **Step 1: フックの実装**
```typescript
// src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onFinalResult: (transcript: string) => void;
}

export function useSpeechRecognition({ onFinalResult }: UseSpeechRecognitionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('お使いのブラウザは音声認識に対応していません。');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'ja-JP';

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          onFinalResult(event.results[i][0].transcript);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (e: any) => {
      console.error(e);
      // NotAllowedError などのハンドリング
      if (e.error === 'not-allowed') {
        setError('マイクへのアクセスが拒否されました。');
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = rec;
  }, [onFinalResult]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setInterimTranscript('');
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch(e) {
      console.error(e);
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, interimTranscript, error, start, stop };
}
```

---

### Task 6: UIコンポーネントの実装

**Files:**
- Create: `src/components/TextInputPanel.tsx`
- Create: `src/components/LivePreview.tsx`
- Create: `src/components/ScorePanel.tsx`
- Create: `src/components/KaraokeLine.tsx`

- [ ] **Step 1: TextInputPanel実装**
```tsx
// src/components/TextInputPanel.tsx
import React, { useState } from 'react';

export const TextInputPanel: React.FC<{ onAnalyze: (text: string) => void, isLoading: boolean }> = ({ onAnalyze, isLoading }) => {
  const [text, setText] = useState('');
  return (
    <div className="panel">
      <h2>1. 練習したい文章を入力してください</h2>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="例：今日はとても暑いです。" />
      <button disabled={isLoading || !text.trim()} onClick={() => onAnalyze(text.trim())}>
        {isLoading ? '準備中...' : '分析開始'}
      </button>
    </div>
  );
};
```

- [ ] **Step 2: LivePreviewの実装**
```tsx
// src/components/LivePreview.tsx
import React from 'react';

export const LivePreview: React.FC<{ transcript: string }> = ({ transcript }) => {
  if (!transcript) return null;
  return (
    <div className="live-preview panel">
      <h3>ライブ認識状況 (採点には不使用)</h3>
      <p>{transcript}</p>
    </div>
  );
};
```

- [ ] **Step 3: ScorePanelの実装**
```tsx
// src/components/ScorePanel.tsx
import React from 'react';

interface ScoreProps {
  total: number;
  correctCount: number;
  incorrectCount: number;
}

export const ScorePanel: React.FC<ScoreProps> = ({ total, correctCount, incorrectCount }) => {
  const rate = total === 0 ? 0 : (correctCount / total) * 100;
  return (
    <div className="score-panel panel">
      <h2>結果発表</h2>
      <p>総単語数: {total}</p>
      <p>正解数: <span className="correct-text">{correctCount}</span></p>
      <p>不正解数: <span className="incorrect-text">{incorrectCount}</span></p>
      <p>正答率: {rate.toFixed(1)}%</p>
      <h3>スコア: {Math.round(rate)} 点</h3>
    </div>
  );
};
```

- [ ] **Step 4: KaraokeLine 実装**
```tsx
// src/components/KaraokeLine.tsx
import React from 'react';
import { KaraokeLineData } from '../types';

export const KaraokeLine: React.FC<{ line: KaraokeLineData, currentWordId: string | null }> = ({ line, currentWordId }) => {
  return (
    <div className="karaoke-line">
      {line.words.map(w => {
        let className = `word-box status-${w.status}`;
        if (w.id === currentWordId) className += ' current-target';
        return <span key={w.id} className={className}>{w.surface}</span>;
      })}
    </div>
  );
};
```

---

### Task 7: メインのApp実装（採点アルゴリズム組み込み）

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css` または `src/index.css`（スタイル追加）

- [ ] **Step 1: メインロジック実装**
`App.tsx` の内部に `parseSpeechResultToReadings` を用いた「完全一致の配列チェックロジック」を組み込み、状態（現在の行、現在の単語）を更新する処理を実装。
※コード量が多いため実行時に適切に作成する。

- [ ] **Step 2: スタイルの適用**
`.word-box` (inline-block, margin, border, padding) や、`.status-correct` (color/bg: blue系), `.status-incorrect` (color/bg: red系), `.current-target` (highlight) を `App.css` に定義する。

---

### Task 8: アプリケーション立ち上げの確認とREADME

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 実行して動作確認**
Run: `npm run dev`
ブラウザ上で正常にアクセスでき、kuromojiのロード、録音許可、単語単位でのハイライト前進と終了時のスコアが表示されることを確認。

- [ ] **Step 2: READMEの記述**
技術スタック、起動方法、採点ルールの詳細を記載。
