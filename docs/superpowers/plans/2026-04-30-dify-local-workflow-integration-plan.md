# Dify Local Workflow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ローカル Dify API で案件情報と Excel から練習文章を生成し、確認・編集後に既存の発音練習フローへ進める。

**Architecture:** Dify API 呼び出しは `src/utils/difyClient.ts` に集約する。画面は `src/components/DifyInputPanel.tsx` に閉じ込め、`App.tsx` は既存の `handleAnalyze(text)` 境界を保ったまま初期入力パネルだけ差し替える。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Dify local API (`/files/upload`, `/workflows/run`)

---

## File Structure

- Create: `src/utils/difyClient.ts`
  - Dify API 設定読み込み、Excel アップロード、Workflow 実行、`data.outputs.text` 抽出を担当する。
- Create: `src/utils/difyClient.spec.ts`
  - Dify クライアントのリクエスト形、レスポンス抽出、エラー変換をテストする。
- Create: `src/components/DifyInputPanel.tsx`
  - 案件情報、Excel ファイル、生成文章、ローディング、エラー表示を管理する日本語 UI。
- Create: `src/components/DifyInputPanel.spec.tsx`
  - 画面入力、ボタン有効化、生成文章表示、編集後の分析開始をテストする。
- Modify: `src/App.tsx`
  - `TextInputPanel` の初期表示を `DifyInputPanel` に差し替える。
- Modify: `src/App.recording.spec.tsx`
  - App の初期入力が Dify パネルになっても、生成済み文章から既存フローに進むテストへ更新する。
- Modify: `src/App.css`
  - Dify パネル用の入力、ファイル選択、確認 textarea、エラー表示のスタイルを追加する。
- Modify: `.env.example`
  - ローカル用 Dify 設定例を追加する。
- Modify: `README.md`
  - ローカル Dify 連携の起動・設定方法を日本語で追加する。

---

### Task 1: Dify クライアント

**Files:**
- Create: `src/utils/difyClient.ts`
- Create: `src/utils/difyClient.spec.ts`

- [ ] **Step 1: Dify クライアントの失敗テストを書く**

Create `src/utils/difyClient.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePracticeText } from './difyClient';

const originalEnv = { ...import.meta.env };

function setDifyEnv() {
  vi.stubEnv('VITE_DIFY_BASE_URL', 'http://localhost/v1');
  vi.stubEnv('VITE_DIFY_API_KEY', 'test-api-key');
}

describe('difyClient', () => {
  beforeEach(() => {
    setDifyEnv();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Object.assign(import.meta.env, originalEnv);
  });

  it('uploads an Excel file, runs the workflow, and returns outputs.text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: {
              text: '自己紹介の練習文章です。',
            },
          },
        }),
      } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await expect(generatePracticeText({
      meet: 'Java と React の面談練習',
      file,
      user: 'test-user',
    })).resolves.toBe('自己紹介の練習文章です。');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost/v1/files/upload',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
        },
        body: expect.any(FormData),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost/v1/workflows/run',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {
            Meet: 'Java と React の面談練習',
            excel_file: {
              type: 'document',
              transfer_method: 'local_file',
              upload_file_id: 'file-123',
            },
          },
          response_mode: 'blocking',
          user: 'test-user',
        }),
      }),
    );
  });

  it('shows a Japanese config error when Dify env values are missing', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DIFY_BASE_URL', '');
    vi.stubEnv('VITE_DIFY_API_KEY', '');

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('.env の Dify 設定を確認してください。');
  });

  it('shows a Japanese upload error when file upload fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'upload failed' }),
    } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('Excelアップロードに失敗しました。');
  });

  it('shows a Japanese empty output error when outputs.text is blank', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            status: 'succeeded',
            outputs: {
              text: '   ',
            },
          },
        }),
      } as Response);

    const file = new File(['excel'], 'skill-sheet.xlsx');

    await expect(generatePracticeText({
      meet: '案件情報',
      file,
    })).rejects.toThrow('Difyの生成文章が空です。');
  });
});
```

- [ ] **Step 2: 失敗テストを実行する**

Run:

```bash
npm test -- src/utils/difyClient.spec.ts
```

Expected: FAIL with module not found for `./difyClient`.

- [ ] **Step 3: Dify クライアントを実装する**

Create `src/utils/difyClient.ts`:

```ts
type DifyUploadResponse = {
  id?: string;
  message?: string;
};

type DifyWorkflowResponse = {
  data?: {
    status?: string;
    outputs?: {
      text?: unknown;
    };
    error?: string;
  };
  message?: string;
  error?: string;
};

type GeneratePracticeTextArgs = {
  meet: string;
  file: File;
  user?: string;
};

type RunDifyWorkflowArgs = {
  meet: string;
  uploadFileId: string;
  user: string;
};

const DEFAULT_USER = 'local-browser-user';

function getDifyConfig() {
  const baseUrl = import.meta.env.VITE_DIFY_BASE_URL?.replace(/\/$/, '');
  const apiKey = import.meta.env.VITE_DIFY_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error('.env の Dify 設定を確認してください。');
  }

  return { baseUrl, apiKey };
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: string; error?: string };
    return body.message || body.error || '';
  } catch {
    return '';
  }
}

function toConnectionError(error: unknown) {
  if (error instanceof TypeError) {
    return new Error('Dify APIに接続できません。Difyが起動しているか確認してください。');
  }
  return error;
}

export async function uploadDifyFile(file: File, user: string): Promise<string> {
  const { baseUrl, apiKey } = getDifyConfig();
  const formData = new FormData();
  formData.append('user', user);
  formData.append('file', file);

  try {
    const response = await fetch(`${baseUrl}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message ? `Excelアップロードに失敗しました。${message}` : 'Excelアップロードに失敗しました。');
    }

    const body = await response.json() as DifyUploadResponse;
    if (!body.id) {
      throw new Error('Excelアップロードに失敗しました。');
    }

    return body.id;
  } catch (error) {
    throw toConnectionError(error);
  }
}

export async function runDifyWorkflow({
  meet,
  uploadFileId,
  user,
}: RunDifyWorkflowArgs): Promise<string> {
  const { baseUrl, apiKey } = getDifyConfig();

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          Meet: meet,
          excel_file: {
            type: 'document',
            transfer_method: 'local_file',
            upload_file_id: uploadFileId,
          },
        },
        response_mode: 'blocking',
        user,
      }),
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new Error(message ? `Dify Workflowの実行に失敗しました。${message}` : 'Dify Workflowの実行に失敗しました。');
    }

    const body = await response.json() as DifyWorkflowResponse;
    if (body.data?.status && body.data.status !== 'succeeded') {
      throw new Error(body.data.error || body.message || body.error || 'Dify Workflowの実行に失敗しました。');
    }

    const text = body.data?.outputs?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Difyの生成文章が空です。');
    }

    return text;
  } catch (error) {
    throw toConnectionError(error);
  }
}

export async function generatePracticeText({
  meet,
  file,
  user = DEFAULT_USER,
}: GeneratePracticeTextArgs): Promise<string> {
  const uploadFileId = await uploadDifyFile(file, user);
  return runDifyWorkflow({
    meet,
    uploadFileId,
    user,
  });
}
```

- [ ] **Step 4: Dify クライアントテストを通す**

Run:

```bash
npm test -- src/utils/difyClient.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/difyClient.ts src/utils/difyClient.spec.ts
git commit -m "Add local Dify workflow client"
```

---

### Task 2: Dify 入力パネル

**Files:**
- Create: `src/components/DifyInputPanel.tsx`
- Create: `src/components/DifyInputPanel.spec.tsx`

- [ ] **Step 1: Dify 入力パネルの失敗テストを書く**

Create `src/components/DifyInputPanel.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DifyInputPanel } from './DifyInputPanel';
import { generatePracticeText } from '../utils/difyClient';

vi.mock('../utils/difyClient', () => ({
  generatePracticeText: vi.fn(),
}));

describe('DifyInputPanel', () => {
  beforeEach(() => {
    vi.mocked(generatePracticeText).mockReset();
  });

  it('generates practice text and starts analysis with edited text', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    vi.mocked(generatePracticeText).mockResolvedValue('Difyが生成した練習文章です。');

    render(<DifyInputPanel onAnalyze={onAnalyze} isLoading={false} />);

    const generateButton = screen.getByRole('button', { name: 'Difyで生成' });
    expect(generateButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('案件情報'),
      'Java と React の面談練習をしたいです。',
    );
    await user.upload(
      screen.getByLabelText('スキルシート Excel'),
      new File(['excel'], 'skill-sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );

    await waitFor(() => expect(generateButton).toBeEnabled());
    await user.click(generateButton);

    const generatedText = await screen.findByLabelText('生成文章の確認');
    expect(generatedText).toHaveValue('Difyが生成した練習文章です。');

    await user.clear(generatedText);
    await user.type(generatedText, '編集後の練習文章です。');
    await user.click(screen.getByRole('button', { name: '分析開始' }));

    expect(onAnalyze).toHaveBeenCalledWith('編集後の練習文章です。');
  });

  it('shows a Japanese error message when Dify generation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(generatePracticeText).mockRejectedValue(new Error('Dify APIに接続できません。Difyが起動しているか確認してください。'));

    render(<DifyInputPanel onAnalyze={vi.fn()} isLoading={false} />);

    await user.type(screen.getByLabelText('案件情報'), '案件情報');
    await user.upload(
      screen.getByLabelText('スキルシート Excel'),
      new File(['excel'], 'skill-sheet.xlsx'),
    );
    await user.click(screen.getByRole('button', { name: 'Difyで生成' }));

    expect(await screen.findByText('Dify APIに接続できません。Difyが起動しているか確認してください。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗テストを実行する**

Run:

```bash
npm test -- src/components/DifyInputPanel.spec.tsx
```

Expected: FAIL with module not found for `./DifyInputPanel`.

- [ ] **Step 3: Dify 入力パネルを実装する**

Create `src/components/DifyInputPanel.tsx`:

```tsx
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

      {generatedText && (
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
```

- [ ] **Step 4: Dify 入力パネルテストを通す**

Run:

```bash
npm test -- src/components/DifyInputPanel.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DifyInputPanel.tsx src/components/DifyInputPanel.spec.tsx
git commit -m "Add Dify input panel"
```

---

### Task 3: App に Dify パネルを接続する

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.recording.spec.tsx`

- [ ] **Step 1: App テストを Dify パネル前提に更新する**

Modify `src/App.recording.spec.tsx`.

Add this mock near the existing mocks:

```ts
vi.mock('./utils/difyClient', () => ({
  generatePracticeText: vi.fn(async () => 'N1\nJava'),
}));
```

Replace `renderAnalyzedApp` with:

```ts
const renderAnalyzedApp = async (_text: string) => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(
    await screen.findByLabelText('案件情報'),
    'Java と React の面談練習をしたいです。',
  );
  await user.upload(
    screen.getByLabelText('スキルシート Excel'),
    new File(['excel'], 'skill-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Difyで生成' }));

  const generatedText = await screen.findByLabelText('生成文章の確認');
  await user.clear(generatedText);
  await user.type(generatedText, _text);
  await user.click(screen.getByRole('button', { name: '分析開始' }));

  await waitFor(() => {
    expect(document.querySelector('.line-compare-container')).not.toBeNull();
  });

  return user;
};
```

- [ ] **Step 2: 失敗テストを実行する**

Run:

```bash
npm test -- src/App.recording.spec.tsx
```

Expected: FAIL because `App.tsx` still renders `TextInputPanel`, so `案件情報` label is not found.

- [ ] **Step 3: App に DifyInputPanel を接続する**

Modify `src/App.tsx`.

Replace this import:

```ts
import { TextInputPanel } from './components/TextInputPanel';
```

with:

```ts
import { DifyInputPanel } from './components/DifyInputPanel';
```

Replace this render branch:

```tsx
{!parsedLines && <TextInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

with:

```tsx
{!parsedLines && <DifyInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

- [ ] **Step 4: App テストを通す**

Run:

```bash
npm test -- src/App.recording.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.recording.spec.tsx
git commit -m "Use Dify panel as practice text entry"
```

---

### Task 4: 日本語 UI スタイルとローカル設定ドキュメント

**Files:**
- Modify: `src/App.css`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: CSS とドキュメントの差分を作る**

Append to `src/App.css` near the input/panel styles:

```css
.form-field {
  width: 100%;
  margin-bottom: 1.5rem;
  text-align: left;
}

.form-field label {
  display: block;
  margin-bottom: 0.7rem;
  color: #fff;
  font-size: 1.15rem;
  text-shadow: 0 0 8px var(--neon-blue);
}

.form-field textarea,
.form-field input[type="file"] {
  width: 100%;
  box-sizing: border-box;
}

.form-field input[type="file"] {
  padding: 1rem;
  border: 2px dashed rgba(0, 255, 255, 0.55);
  color: var(--neon-blue);
  background: rgba(0, 0, 0, 0.45);
}

.input-help,
.file-name {
  margin: 0.4rem 0 0;
  color: #b8ffff;
  font-size: 0.95rem;
  line-height: 1.6;
}

.generated-field {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px dashed rgba(0, 255, 255, 0.3);
}

.dify-error {
  margin-bottom: 1.2rem;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}
```

Append to `.env.example`:

```text
VITE_DIFY_BASE_URL=http://localhost/v1
VITE_DIFY_API_KEY=
```

Add this section to `README.md` after the existing environment variable section:

```md
## ローカル Dify 連携

最初の画面では、案件情報とスキルシート Excel を Dify に送り、面談練習用の文章を生成します。

`.env` に以下を設定してください。

```bash
VITE_DIFY_BASE_URL=http://localhost/v1
VITE_DIFY_API_KEY=your-local-dify-api-key
```

Dify 側の Workflow 入力変数は以下です。

- `Meet`
- `excel_file`

この連携はローカル開発用です。`VITE_DIFY_API_KEY` はブラウザ側から見えるため、GitHub Pages などの公開環境では使わないでください。
```

- [ ] **Step 2: ビルドを実行する**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: 関連テストをまとめて実行する**

Run:

```bash
npm test -- src/utils/difyClient.spec.ts src/components/DifyInputPanel.spec.tsx src/App.recording.spec.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.css .env.example README.md
git commit -m "Document local Dify setup"
```

---

### Task 5: ローカル手動確認

**Files:**
- No code changes expected.

- [ ] **Step 1: `.env` をローカルだけで設定する**

Ensure `C:\Users\user\Desktop\WorkWork\StayCompanyStudy\WorkMeetTalk\.env` contains:

```text
VITE_DIFY_BASE_URL=http://localhost/v1
VITE_DIFY_API_KEY=<local Dify API key>
```

Do not commit `.env`.

- [ ] **Step 2: React 開発サーバーを起動する**

Run:

```bash
npm run dev
```

Expected: Vite local URL is printed, usually `http://localhost:5173/`.

- [ ] **Step 3: ブラウザでローカル確認する**

Manual steps:

1. Dify がローカルで起動していることを確認する。
2. React アプリを開く。
3. 案件情報に `Java、Spring Boot、React、SQL の面談練習をしたいです。` と入力する。
4. `C:\Users\user\Desktop\WorkWork\StayCompanyStudy\WorkMeet\Knows\TOMATO技術者経歴書_HQ.xlsx` を選ぶ。
5. 「Difyで生成」を押す。
6. 「生成文章の確認」に文章が表示されることを確認する。
7. 文章を少し編集する。
8. 「分析開始」を押す。
9. 発音練習画面に進むことを確認する。

- [ ] **Step 4: 最終状態を確認する**

Run:

```bash
git status -sb
```

Expected: no unexpected tracked changes. `.env` remains untracked or ignored.

