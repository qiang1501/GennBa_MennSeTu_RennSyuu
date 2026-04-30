# Free Line Selection Design

## Goal

任意の行をユーザーが選んで、その行だけ録音と再判定をできるようにする。
読み上げ順を固定せず、どの行でもいつでも選択できることを優先する。

## Current Problem

現状の実装は `currentLineIndex` を中心に状態を持っており、選択中の行と録音中の行が同じ意味で扱われている。
そのため、UI 上は各行に `REC` ボタンがあっても、内部設計は順番進行を前提にした作りになっている。
録音中に別の行を選ぶ操作や、判定済み行の再録音を安全に扱いづらい。

## Chosen Approach

`selectedLineIndex` と `recordingLineIndex` を分離する。

- `selectedLineIndex`: 画面上で現在選択されている行
- `recordingLineIndex`: 実際に録音中の行

この分離により、行の選択と録音状態の責務を明確にする。
UI は既存の行ごとの `REC` ボタンを維持し、挙動だけを「順番固定」から「任意選択」に変える。

## Rejected Alternatives

### Keep `currentLineIndex` and reinterpret it

`currentLineIndex` の意味だけを広げて対応する案は、短期的には変更量が少ない。
ただし、選択中と録音中の意味が混ざったままになり、分岐が増えるほど不具合を埋め込みやすい。

### Introduce per-line session objects

行ごとに録音セッションや下書き状態を持つ案は拡張性が高い。
ただし、今回の要件は「任意の行を選んで録音・再判定できること」であり、現時点では過剰設計になる。

## State Design

`App.tsx` の状態を次のように整理する。

- `selectedLineIndex: number | null`
- `recordingLineIndex: number | null`
- `currentLineTranscript: string`
- `lineResults: LineCompareResult[]`

`currentLineTranscript` は「現在録音している行の transcript」としてのみ扱う。
録音対象が切り替わるときは必ずリセットする。

`stateRef` に保持する最新状態も上記の分離に合わせて更新する。
音声認識コールバックから参照する状態は、録音中の行を明示的に参照できる形にする。

## Interaction Rules

### When no line is recording

任意の行の `REC` ボタンを押したら、その行を選択して録音を開始する。
開始前にその行の transcript を空にし、必要なら既存結果を消して再判定の準備をする。

### When the same line is recording

録音中の行の `STOP` を押したら録音を停止し、その行に対して判定を行う。
判定には `currentLineTranscript` と最新の interim transcript を結合した文字列を使う。

### When another line is recording

別の行の `REC` を押したら、現在録音中の行を停止してその時点の内容で判定する。
その後、新しく押された行を選択し、その行の transcript を初期化して録音を開始する。

この挙動により、録音中の乗り換え時も入力の取りこぼしを減らす。

## Component Changes

### `App.tsx`

- `currentLineIndex` ベースの分岐を廃止する
- `selectedLineIndex` と `recordingLineIndex` に置き換える
- `toggleRecording` を次の 3 分岐に整理する
  - 未録音状態から開始
  - 同じ行の停止
  - 別の行への乗り換え
- `handleFinalResult` は録音中の行があるときだけ transcript を追記する
- `handleAnalyze`, `handleReset`, `handleRetry` は新しい状態構造に合わせて初期化する

### `LineCompare.tsx`

- `isActive` は「選択中の行」として使う
- `isRecording` は「その行を現在録音しているか」として使う
- 他の行のボタンも常に押せる前提は維持する

見た目の大きな変更は避け、既存 UI に沿って状態の意味だけを明確化する。

## Data Flow

1. ユーザーが任意の行の `REC` を押す
2. `App.tsx` が現在の録音状態を見て、開始・停止・乗り換えのいずれかを決定する
3. 音声認識の確定結果は「現在録音中の行」の transcript にだけ蓄積する
4. 停止時に transcript と interim transcript をまとめて `judgeLine(lineIndex, text)` に渡す
5. `lineResults` の該当行だけ更新し、他の行の結果は保持する

## Error Handling

- 録音中の行がないときは transcript 更新を無視する
- `lineIdx` が存在しない場合は判定を行わない
- 空文字の判定は既存方針を維持し、その行の結果を消すだけにする
- 音声認識 API 未対応や tokenizer 初期化失敗の表示は既存挙動を維持する

## Testing Strategy

変更前に次の失敗テストを追加する。

1. 任意の行を選んで録音開始できる
2. 録音中に別の行を選ぶと、前の行が判定されて新しい行の録音が始まる
3. 同じ行を再録音すると、その行の結果だけが上書きされる
4. 録音中の行がないとき、確定 transcript が誤って他の行に追加されない

テストは順番進行ではなく、行単位の独立操作を中心に組み立てる。

## Scope Boundaries

今回の変更では以下は行わない。

- 複数行の同時録音
- 行ごとの録音履歴保存
- 判定ロジックそのものの変更
- UI テーマやレイアウトの全面改修

## Success Criteria

- ユーザーが行の順序に関係なく任意の行を録音できる
- 録音中に別の行を押しても、前の行の判定が失われない
- 判定済みの行を再録音しても、その行だけ安全に上書きできる
- 既存 UI を大きく崩さずに挙動だけを改善できる
