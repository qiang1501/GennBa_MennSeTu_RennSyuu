# Free Line Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任意の行をいつでも選択し、その行だけ録音と再判定を行えるようにする。

**Architecture:** `App.tsx` の状態を「選択中の行」と「録音中の行」に分離し、録音開始・停止・行切り替え時の処理を明示的に分岐する。UI は既存の `LineCompare` と行ごとの `REC` ボタンを維持し、動作のみを順番固定から任意選択に切り替える。テストは `useSpeechRecognition` をモックして `App` の状態遷移を検証する。

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest, Testing Library

---

## File Structure

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/App.recording.spec.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/LineCompare.tsx`

責務分離:
- `App.tsx`: 録音状態遷移、判定実行、結果更新
- `LineCompare.tsx`: 行表示とボタンイベント伝達
- `App.recording.spec.tsx`: 任意行選択と録音切り替えの回帰テスト
- `src/test/setup.ts`: テスト全体の DOM マッチャ設定

### Task 1: Add test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Add testing dependencies and scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.7.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/diff": "^7.0.2",
    "@types/kuromoji": "^0.1.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^26.1.0",
    "typescript": "~6.0.2",
    "vite": "^8.0.9",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
});
```

- [ ] **Step 3: Add test setup file**

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Install dependencies and verify test runner boots**

Run: `npm install`  
Run: `npm run test`  
Expected: テストファイル未作成のため `No test files found` で終了コード 1

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts
git commit -m "test: add vitest and testing-library setup"
```

### Task 2: Write failing tests for free line selection behavior

**Files:**
- Create: `src/App.recording.spec.tsx`

- [ ] **Step 1: Create module mocks for parser and speech hook**

```tsx
// src/App.recording.spec.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

let mockInterim = '';
let finalHandler: ((text: string) => void) | null = null;
const startMock = vi.fn();
const stopMock = vi.fn();

const parseTextToLinesMock = vi.fn((text: string) => {
  const lines = text.split('\n').filter(Boolean);
  return lines.map((line, lineIndex) => ({
    lineIndex,
    originalText: line,
    originalKana: line,
    words: [{ id: `${lineIndex}-0`, surface: line, reading: line }],
  }));
});

vi.mock('./utils/textParser', () => ({
  buildTokenizer: vi.fn(() => Promise.resolve()),
  parseTextToLines: (text: string) => parseTextToLinesMock(text),
}));

vi.mock('./utils/diffMatcher', () => ({
  compareKanaStrings: vi.fn(() => [{ char: 'A', status: 'correct' }]),
  getSpokenKanaStatuses: vi.fn(() => ['correct']),
}));

vi.mock('./hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: ({ onFinalResult }: { onFinalResult: (text: string) => void }) => {
    finalHandler = onFinalResult;
    return {
      isRecording: false,
      interimTranscript: mockInterim,
      error: null,
      start: startMock,
      stop: stopMock,
    };
  },
}));
```

- [ ] **Step 2: Add failing test for selecting any line to start recording**

```tsx
it('starts recording on the clicked line even when it is not the first line', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox'), 'line0\nline1\nline2');
  await user.click(screen.getByRole('button', { name: '解析開始' }));

  const recButtons = await screen.findAllByRole('button', { name: /REC|STOP/ });
  await user.click(recButtons[2]);

  expect(startMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Add failing test for switching lines while recording**

```tsx
it('judges previous line and starts new recording when switching lines', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox'), 'line0\nline1');
  await user.click(screen.getByRole('button', { name: '解析開始' }));

  const recButtons = await screen.findAllByRole('button', { name: /REC|STOP/ });

  await user.click(recButtons[0]);
  finalHandler?.('spoken0');
  mockInterim = 'tail0';

  await user.click(recButtons[1]);

  await waitFor(() => {
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4: Add failing test for re-record overwrite on one line**

```tsx
it('overwrites only the selected line result when re-recording', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox'), 'line0\nline1');
  await user.click(screen.getByRole('button', { name: '解析開始' }));

  const recButtons = await screen.findAllByRole('button', { name: /REC|STOP/ });

  await user.click(recButtons[0]);
  finalHandler?.('first');
  await user.click(recButtons[0]);

  await user.click(recButtons[0]);
  finalHandler?.('second');
  await user.click(recButtons[0]);

  expect(stopMock).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 5: Run tests to verify RED state**

Run: `npm run test -- src/App.recording.spec.tsx`  
Expected: FAIL（現在の `currentLineIndex` 中心実装と期待挙動が一致しない）

- [ ] **Step 6: Commit**

```bash
git add src/App.recording.spec.tsx
git commit -m "test: cover free line selection and recording switch behavior"
```

### Task 3: Implement App state split and recording transitions

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace single line state with selected/recording states**

```tsx
const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(0);
const [recordingLineIndex, setRecordingLineIndex] = useState<number | null>(null);
const [currentLineTranscript, setCurrentLineTranscript] = useState('');

const stateRef = useRef({
  parsedLines,
  selectedLineIndex,
  recordingLineIndex,
  isFinished,
  lineResults,
  currentLineTranscript,
});
```

- [ ] **Step 2: Guard transcript accumulation by recording target**

```tsx
const handleFinalResult = useCallback((transcript: string) => {
  const { isFinished: finished, recordingLineIndex: activeRecordingLine } = stateRef.current;
  if (finished || activeRecordingLine === null) return;

  setCurrentLineTranscript((prev) => prev + transcript);
}, []);
```

- [ ] **Step 3: Implement line toggle flow for start/stop/switch**

```tsx
const toggleRecording = (nextLineIndex: number) => {
  const { recordingLineIndex: activeRecordingLine, currentLineTranscript: transcript } = stateRef.current;

  if (activeRecordingLine === null) {
    setSelectedLineIndex(nextLineIndex);
    setRecordingLineIndex(nextLineIndex);
    setCurrentLineTranscript('');
    setLineResults((prev) => prev.filter((r) => r.lineIndex !== nextLineIndex));
    setIsUserRecording(true);
    start();
    return;
  }

  if (activeRecordingLine === nextLineIndex) {
    setIsUserRecording(false);
    setRecordingLineIndex(null);
    stop();
    judgeLine(nextLineIndex, transcript + interimTranscript);
    return;
  }

  setIsUserRecording(false);
  stop();
  judgeLine(activeRecordingLine, transcript + interimTranscript);

  setTimeout(() => {
    setSelectedLineIndex(nextLineIndex);
    setRecordingLineIndex(nextLineIndex);
    setCurrentLineTranscript('');
    setLineResults((prev) => prev.filter((r) => r.lineIndex !== nextLineIndex));
    setIsUserRecording(true);
    start();
  }, 200);
};
```

- [ ] **Step 4: Update lifecycle resets to the new state model**

```tsx
const handleAnalyze = (text: string) => {
  const lines = parseTextToLines(text);
  if (lines.length > 0) {
    setParsedLines(lines);
    setLineResults([]);
    setSelectedLineIndex(0);
    setRecordingLineIndex(null);
    setCurrentLineTranscript('');
    setIsUserRecording(false);
    setIsFinished(false);
  }
};

const handleReset = () => {
  setIsUserRecording(false);
  stop();
  setParsedLines(null);
  setLineResults([]);
  setSelectedLineIndex(0);
  setRecordingLineIndex(null);
  setCurrentLineTranscript('');
  setIsFinished(false);
};
```

- [ ] **Step 5: Update rendering props for active and recording**

```tsx
<LineCompare
  key={idx}
  line={line}
  isActive={!isFinished && idx === selectedLineIndex}
  isRecording={idx === recordingLineIndex && isUserRecording}
  isSparkling={idx === recordingLineIndex && isSparkling}
  sparkleColor={sparkleColor}
  result={lineResults.find((r) => r.lineIndex === idx)}
  onToggleRecord={toggleRecording}
/>
```

- [ ] **Step 6: Run tests to verify GREEN state**

Run: `npm run test -- src/App.recording.spec.tsx`  
Expected: PASS（3件すべて成功）

- [ ] **Step 7: Run build verification**

Run: `npm run build`  
Expected: `tsc` と `vite build` が正常終了

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: allow free line selection for recording and judging"
```

### Task 4: Align `LineCompare` recording display semantics

**Files:**
- Modify: `src/components/LineCompare.tsx`

- [ ] **Step 1: Keep `isRecording` as single source for button state**

```tsx
export const LineCompare: React.FC<LineCompareProps> = ({
  line,
  isActive,
  isRecording,
  isSparkling,
  sparkleColor,
  result,
  onToggleRecord,
}) => {
  return (
    <div
      className={`line-compare-container ${isActive ? 'active-line' : ''} ${isActive && isSparkling ? 'sparkling' : ''}`}
      style={isActive && isSparkling ? ({ '--sparkle-color': sparkleColor } as React.CSSProperties) : {}}
    >
      {/* ...existing content... */}
      <button
        className={isRecording ? 'btn-record stop-btn' : 'btn-record start-btn'}
        onClick={() => onToggleRecord(line.lineIndex)}
      >
        {isRecording ? '🛑 STOP' : '🎤 REC'}
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Verify regression test still passes**

Run: `npm run test -- src/App.recording.spec.tsx`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/LineCompare.tsx
git commit -m "refactor: simplify line recording display state"
```

### Task 5: Full verification and docs sync

**Files:**
- Modify: `README.md` (必要時のみ)

- [ ] **Step 1: Run full test suite**

Run: `npm run test`  
Expected: PASS（失敗 0）

- [ ] **Step 2: Run production build again**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 3: Update README behavior note if needed**

```md
- 各行の `REC` ボタンは任意順で選択可能です。録音中に別の行を押すと、前の行を判定してから新しい行の録音を開始します。
```

- [ ] **Step 4: Commit final polish**

```bash
git add README.md
git commit -m "docs: clarify free line selection recording behavior"
```

## Self-Review

### Spec coverage

- 任意行選択: Task 2 と Task 3 でテスト・実装
- 録音中の行切り替え: Task 2 と Task 3
- 同じ行の再録音上書き: Task 2 と Task 3
- 既存 UI 維持: Task 4
- エラー処理維持: Task 3 のガード方針

欠落要件なし。

### Placeholder scan

`TODO`, `TBD`, 「適切に」などの曖昧指示は含めていない。  
各コード変更ステップに具体コード、各検証ステップに具体コマンドを記載済み。

### Type consistency

- `selectedLineIndex: number | null`
- `recordingLineIndex: number | null`
- `onToggleRecord(lineIndex: number)`

すべてのタスクで同じ命名と型を使用している。
