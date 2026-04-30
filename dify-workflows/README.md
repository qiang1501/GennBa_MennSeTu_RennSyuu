# Dify Workflows

このフォルダには、Dify からエクスポートした workflow/app DSL ファイルを保存します。

## Export from Dify

1. Dify Studio で対象アプリを開く
2. アプリメニュー、またはオーケストレーション画面のメニューから `Export DSL` を選ぶ
3. ダウンロードされた YAML ファイルをこのフォルダへ置く
4. 例: `interview-practice-workflow.yml`

## Import to Dify

1. Dify Studio で `Create App` を選ぶ
2. `Import DSL` を選ぶ
3. このフォルダ内の YAML ファイルをアップロードする

## Notes

- API keys and tool credentials are not included in normal DSL exports.
- Secret environment variables may be offered as an export option by Dify. Do not commit secrets.
- Knowledge base connections can be included, but the actual knowledge base data is not included.
