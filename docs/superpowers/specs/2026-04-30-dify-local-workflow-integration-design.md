# Dify Local Workflow Integration Design

## Goal

Add a local-only Dify workflow preparation step before the existing pronunciation practice flow.

The user will enter project/interview information, upload an applicant skill sheet Excel file, run the local Dify workflow, review the generated practice text, optionally edit it, then start the existing analysis/pronunciation practice flow.

## Scope

This phase is local development only.

- React calls the local Dify API directly.
- Dify API base URL is `http://localhost/v1`.
- The API key is stored only in the local `.env` file.
- The generated Dify output is used directly as the practice text.
- The existing pronunciation practice, recording, scoring, and retry flows remain unchanged.

Out of scope for this phase:

- Production-safe backend proxy.
- Supabase Function proxy for Dify.
- GitHub Pages compatibility for the Dify workflow call.
- Storing generated practice text.
- Importing or editing the Dify DSL itself.

## Existing Context

The current React app starts with `TextInputPanel`, which accepts raw practice text and calls `handleAnalyze(text)` in `App.tsx`.

The new flow should preserve `handleAnalyze(text)` as the boundary into the existing app. After the user confirms the Dify-generated text, the app should call the same function used by the current direct text input path.

## Dify API Details

The app uses these local Dify endpoints:

```text
POST http://localhost/v1/files/upload
POST http://localhost/v1/workflows/run
```

The Dify workflow input variables are:

```text
Meet
excel_file
```

The verified workflow request shape is:

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

The verified successful response contains the generated practice text at:

```text
data.outputs.text
```

## Environment Variables

Add these local-only Vite environment variables:

```text
VITE_DIFY_BASE_URL=http://localhost/v1
VITE_DIFY_API_KEY=...
```

Because `VITE_*` variables are visible in browser bundles, this is intentionally local-only. The `.env` file must remain ignored by Git.

## UI Flow

When no practice text has been analyzed yet, show a Dify preparation panel instead of the existing direct text input panel.

Step 1: collect input.

- Show a textarea for `Meet`.
- Show a file input for `excel_file`.
- Accept Excel files, primarily `.xlsx` and `.xls`.
- Disable the generate button until both `Meet` and a file are present.

Step 2: generate text.

- On `Difyで生成`, upload the selected Excel file to Dify.
- Use the returned file id in `workflows/run`.
- Show a loading state while the request is running.
- Show any connection, upload, workflow, or empty-output errors in the panel.

Step 3: review and start analysis.

- Show Dify's `data.outputs.text` in an editable textarea.
- Allow the user to modify the text before starting.
- Disable `分析開始` if the textarea is empty.
- On `分析開始`, call the existing `handleAnalyze(text)`.

## Components

### `src/utils/difyClient.ts`

Responsibilities:

- Read `VITE_DIFY_BASE_URL` and `VITE_DIFY_API_KEY`.
- Upload a file via `/files/upload`.
- Run the workflow via `/workflows/run`.
- Extract `data.outputs.text`.
- Throw user-meaningful errors for missing config, failed upload, failed workflow, or empty output.

Suggested API:

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

Responsibilities:

- Manage `Meet`, selected Excel file, generated text, loading state, and local errors.
- Call `generatePracticeText`.
- Present generated text in an editable textarea.
- Call `onAnalyze(generatedText.trim())` when the user clicks `分析開始`.

Props:

```ts
interface DifyInputPanelProps {
  onAnalyze: (text: string) => void | Promise<void>;
  isLoading: boolean;
}
```

### `src/App.tsx`

Replace the initial direct input panel with `DifyInputPanel` while preserving the existing downstream flow.

Current boundary:

```tsx
{!parsedLines && <TextInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

New boundary:

```tsx
{!parsedLines && <DifyInputPanel onAnalyze={handleAnalyze} isLoading={isInitializing} />}
```

## Error Handling

Display errors inside the Dify input panel.

- Missing API base URL or API key: tell the user to check `.env`.
- Missing `Meet`: keep the generate button disabled.
- Missing Excel file: keep the generate button disabled.
- File upload failure: `Excelアップロードに失敗しました。`
- Workflow failure: include Dify's error message if available.
- Empty `data.outputs.text`: `Difyの生成文章が空です。`
- Network failure: `Dify APIに接続できません。Difyが起動しているか確認してください。`

## Testing And Verification

Automated:

- Run `npm run build`.

Manual local verification:

1. Start Dify locally.
2. Start the React dev server.
3. Enter sample `Meet` text.
4. Upload `TOMATO技術者経歴書_HQ.xlsx`.
5. Click `Difyで生成`.
6. Confirm generated text appears in the editable textarea.
7. Edit the text slightly.
8. Click `分析開始`.
9. Confirm the existing pronunciation practice screen opens.

## Future Production Path

For GitHub Pages or any public deployment, replace direct browser-to-Dify calls with a backend proxy such as a Supabase Function or local server. That proxy should hold the Dify API key server-side and expose a safe application-specific endpoint to the React app.
