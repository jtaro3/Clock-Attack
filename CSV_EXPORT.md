# CSV出力の管理

2026-09-28時点のブック、CSV、Calc用マクロをGit管理に追加しました。
過去の各操作を再現する履歴ではなく、現在の状態を記録したものです。

- `main.ods`: Calc用。全シートCSV出力ボタンは、このPCの「マイマクロ」の `Standard.Module1.ExportAllSheetsToCSV` を呼び出します。
- `main.xlsm`: Excel形式のブック。`main.ods` とは自動同期しません。Calcでの通常の編集先は `main.ods` に統一してください。
- `macros/ExportAllSheetsToCSV_Calc.bas`: Calc用マクロのソース。別PCでは「マイマクロ → Standard → Module1」へ登録が必要です。
- `CSV/`: 出力済みCSVの現在の状態。ブックとの一致をこのコミットで再検証したものではありません。

マクロはブックと同じフォルダー内の `CSV` に全シートをUTF-8（BOM付き）で出力し、同名ファイルを上書きします。削除・改名したシートの古いCSVは自動削除しません。
ボタンからの実行には、Calcのマクロセキュリティ設定で実行が許可されている必要があります。

GitHub Desktopでは、保存後の変更はChangesに表示され、コミットするとHistoryに残ります。ブックはバイナリのためセル単位の差分は表示できませんが、CSVと.basはテキスト差分を確認できます。

バックアップの `main.before-*.xlsm` と旧Excel起動方式の `export-all-csv.cmd` / `export-all-csv.ps1` は、この記録には含めていません。
