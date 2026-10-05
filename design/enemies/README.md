# 敵の画像

敵ごとに、enemyシートのenemy_keyと同じ名前のフォルダーを作成します。

```text
design/enemies/
  slime_blue/
    move/slime_blue_1.png ... slime_blue_4.png
    attack/slime_blue_0.png ... slime_blue_4.png
  slime_green/
    move/slime_green_1.png ...
    attack/slime_green_1.png ...
```

透過PNGを推奨します。表示サイズは現在56×56です。ファイル名は末尾を数字にしてください（1.png、slime_green_1.pngなど）。数字の小さい順に再生します。animationシートのframe_indexは1から始まり、一覧の1枚目・2枚目に対応します。画像名の数字が0から始まっても、最初の画像のframe_indexは1です。

画像を追加・移動・改名したら、プロジェクト直下のbuild-animation-manifest.cmdを実行してください。画像一覧のanimation-manifest.jsonと公開用distの画像を更新します。

enemyシートで敵の能力を、animationシートでenemy_keyごとの移動速度と各コマの表示時間を、round_spawnシートで出現を設定し、CSVとJSONを出力します。

緑スライムなど既存の敵は画像を追加するとゲームで再生されます。画像未配置の敵は従来の図形表示で動作します。移動・攻撃の片方だけを配置した場合は、未配置の動作を図形で表示します。演出確認画面の「エネミー」で、画像一覧に登録された敵を選び、移動・攻撃を確認できます。調整値は敵ごとにブラウザー内へ保存されます。

slime_blue/legacyには以前の画像を保管しています。move・attack以外のフォルダー内の画像は一覧に含めません。以前のdesign/Animation/enemiesは参照しません。
