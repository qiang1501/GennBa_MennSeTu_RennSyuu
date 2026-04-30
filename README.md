# 日本語発音チェッカー (Japanese Karaoke Pronunciation Checker)

React + Vite + TypeScript で作成した、日本語の音読練習アプリです。

- 入力した文章を行ごとに分割して表示
- `REC` で行単位の発話を録音して採点
- 発話結果と正解を比較して可視化
- 英単語のカタカナ変換（Supabase Function + ローカルフォールバック）
- カスタム読み方登録（Supabase 保存）
- `PLAY` ボタンで読み上げ（Azure TTS優先 / ブラウザTTSフォールバック）

公開URL:
- https://qiang1501.github.io/talkGeminiPro/

## 必要環境

- Node.js (LTS 推奨)
- npm

## ローカル起動

1. 依存関係をインストール

```bash
npm install
```

2. kuromoji 辞書を `public/dict` にコピー

Windows (PowerShell):

```powershell
mkdir public/dict
Copy-Item -Path .\node_modules\kuromoji\dict\* -Destination .\public\dict\
```

Mac / Linux (Bash):

```bash
mkdir -p public/dict && cp node_modules/kuromoji/dict/* public/dict/
```

3. 開発サーバー起動

```bash
npm run dev
```

## 環境変数

`.env.example` をコピーして `.env` を作成してください。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_TRANSLITERATE_URL`
- `VITE_SUPABASE_SAVE_READING_URL`
- `VITE_SUPABASE_AZURE_TTS_URL`
- `VITE_SUPABASE_ANON_KEY`

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

## Supabase Functions

### 1) Transliterate

英単語をカタカナへ変換します。

- パス: `supabase/functions/transliterate/index.ts`
- 例: `supabase functions deploy transliterate`

### 2) Save Reading

カスタム読み方を保存します。

- パス: `supabase/functions/save-reading/index.ts`
- 例: `supabase functions deploy save-reading`

### 3) Azure TTS

`PLAY` ボタンの読み上げ用 API です。

- パス: `supabase/functions/azure-tts/index.ts`
- 例: `supabase functions deploy azure-tts`

必要な Supabase Secret:

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION` (例: `westus`)
- `AZURE_SPEECH_VOICE` (任意、既定: `ja-JP-NanamiNeural`)

## セキュリティ注意

- `AZURE_SPEECH_KEY` をフロントエンドに置かないでください。
- Azureキーは Supabase Function Secrets のみで管理してください。
- キーを公開場所に貼った場合はローテーションしてください。

## デプロイ

GitHub Actions (`.github/workflows/deploy.yml`) で GitHub Pages へデプロイします。

```bash
git push origin main
```

push 後に Actions が走り、公開サイトが更新されます。
