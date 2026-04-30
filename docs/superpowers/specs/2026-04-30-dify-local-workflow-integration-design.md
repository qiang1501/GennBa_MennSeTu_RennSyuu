# Dify ローカルワークフロー連携 設計書

## 目的

既存の日本語発音練習アプリの前段に、Dify ワークフローで面談練習文を生成するステップを追加する。

ユーザは最初に案件情報を入力し、応募者のスキルシート Excel ファイルをアップロードする。アプリはローカル Dify API を呼び出し、Dify が生成した練習文章を画面に表示する。ユーザは生成文章を確認し、必要であれば編集してから「分析開始」を押す。その後は、現在の発音練習・録音・採点フローに進む。

## 対象範囲

今回はローカル開発で完成させることを優先する。

- React からローカル Dify API を直接呼び出す。
- Dify API のベース URL は `http://localhost/v1` とする。
- Dify API キーはローカルの `.env` のみに保存する。
- Dify が返した文章は、そのまま練習文章として使う。
- 既存の発音練習、録音、採点、再練習の流れは変更しない。
- 画面文言はできるだけ日本語にする。

今回は対象外にすること:

- 本番公開向けの安全なバックエンドプロキシ。
- Supabase Function 経由での Dify 呼び出し。
- GitHub Pages 上での Dify 連携動作。
- 生成文章の保存機能。
- Dify DSL の編集やインポート機能。

## 既存アプリとの接続点

現在のアプリは、最初に `TextInputPanel` で練習文章を直接入力し、`App.tsx` の `handleAnalyze(text)` を呼び出して発音練習画面に進む。

新しい Dify 連携でも、既存の `handleAnalyze(text)` を発音練習フローへの入口として使う。Dify 生成文章をユーザが確認した後、その文章を `handleAnalyze(text)` に渡す。

## Dify API

使用するローカル Dify API は次の2つ。

```text
POST http://localhost/v1/files/upload
POST http://localhost/v1/workflows/run
```

Dify ワークフローの入力変数は次の2つ。

```text
Meet
excel_file
```

動作確認済みの Workflow 実行リクエスト形式:

```json
{
  "inputs": {
    "Meet": "案件情報...",
    "excel_file": {
      "type": "document",
      "transfer_method": "local_file",
      "upload_file_id": "..."
    }
  },
  "response_mode": "blocking",
  "user": "local-browser-user"
}
```

成功時、Dify が生成した文章は次の場所に入る。

```text
data.outputs.text
```

## 環境変数

ローカルの `.env` に次の値を追加する。

```text
VITE_DIFY_BASE_URL=http://localhost/v1
VITE_DIFY_API_KEY=...
```

`VITE_*` の環境変数はブラウザ側から見えるため、この方式はローカル専用とする。`.env` は Git に含めない。

## 画面フロー

練習文章がまだ解析されていない状態では、既存の直接入力パネルの代わりに Dify 用の入力パネルを表示する。

### Step 1: 案件情報と Excel を入力する

表示する項目:

- 案件情報入力欄
- スキルシート Excel ファイル選択欄
- 「Difyで生成」ボタン

動作:

- 案件情報と Excel ファイルの両方が入るまで「Difyで生成」は押せない。
- Excel は主に `.xlsx` と `.xls` を受け付ける。

### Step 2: Dify で練習文章を生成する

「Difyで生成」を押したら、次の順で処理する。

1. Excel ファイルを `/files/upload` に送る。
2. 返ってきた `upload_file_id` を保持する。
3. `Meet` と `excel_file` を `/workflows/run` に送る。
4. `data.outputs.text` を取得する。
5. 生成文章を確認用 textarea に表示する。

処理中はローディング状態を表示する。

### Step 3: 生成文章を確認して分析開始する

表示する項目:

- Dify 生成文章の確認・編集 textarea
- 「分析開始」ボタン

動作:

- ユーザは Dify の生成文章をそのまま使ってもよい。
- 必要であれば、画面上で文章を編集できる。
- 文章が空の場合は「分析開始」を押せない。
- 「分析開始」を押すと、編集後の文章を `handleAnalyze(text)` に渡す。
- その後は既存の発音練習画面に進む。

## 追加するファイル

### `src/utils/difyClient.ts`

役割:

- `VITE_DIFY_BASE_URL` と `VITE_DIFY_API_KEY` を読む。
- `/files/upload` で Excel ファイルをアップロードする。
- `/workflows/run` で Dify ワークフローを実行する。
- `data.outputs.text` を取り出す。
- 設定不足、アップロード失敗、Workflow 失敗、空レスポンスを分かりやすいエラーに変換する。

想定 API:

```ts
uploadDifyFile(file: File, user: string): Promise<string>
runDifyWorkflow(args: {
  meet: string;
  uploadFileId: string;
  user: string;
}): Promise<string>
generatePracticeText(args: {
  meet: string;
  file: File;
  user?: string;
}): Promise<string>
```

### `src/components/DifyInputPanel.tsx`

役割:

- 案件情報、選択ファイル、生成文章、ローディング状態、エラーを管理する。
- `generatePracticeText` を呼び出す。
- Dify 生成文章を編集可能な textarea に表示する。
- ユーザが「分析開始」を押したら `onAnalyze(generatedText.trim())` を呼ぶ。

Props:

```ts
interface DifyInputPanelProps {
  onAnalyze: (text: string) => void | Promise<void>;
  isLoading: boolean;
}
```

## 変更するファイル

### `src/App.tsx`

初期表示の入力パネルを `DifyInputPanel` に差し替える。

現在:

```tsx
{!parsedLines && <TextInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

変更後:

```tsx
{!parsedLines && <DifyInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

## エラー表示

エラーは Dify 入力パネル内に表示する。

- API URL または API キー未設定: `.env の Dify 設定を確認してください。`
- 案件情報未入力: ボタンを無効化する。
- Excel 未選択: ボタンを無効化する。
- Excel アップロード失敗: `Excelアップロードに失敗しました。`
- Workflow 実行失敗: Dify のエラーメッセージがあれば表示する。
- `data.outputs.text` が空: `Difyの生成文章が空です。`
- Dify に接続できない: `Dify APIに接続できません。Difyが起動しているか確認してください。`

## UI 文言

画面文言は日本語を基本にする。

主な文言:

- `案件情報`
- `案件内容や面談で確認したいポイントを入力してください`
- `スキルシート Excel`
- `Difyで生成`
- `生成中...`
- `生成文章の確認`
- `必要であれば文章を編集してから分析を開始してください`
- `分析開始`

英語の技術用語は、必要な場合のみそのまま使う。

## 確認方法

自動確認:

```text
npm run build
```

ローカル手動確認:

1. Dify をローカルで起動する。
2. React 開発サーバーを起動する。
3. 案件情報を入力する。
4. `TOMATO技術者経歴書_HQ.xlsx` をアップロードする。
5. 「Difyで生成」を押す。
6. 生成文章が確認 textarea に表示されることを確認する。
7. 文章を少し編集する。
8. 「分析開始」を押す。
9. 既存の発音練習画面に進むことを確認する。

## 将来の本番対応

GitHub Pages などで公開する場合は、ブラウザから Dify API を直接呼ばない。Supabase Function または小さなバックエンドサーバーを用意し、Dify API キーはサーバー側だけに保存する。
