# 砂のビン画像

敵を倒したときに獲得するビン。game.js の合体演出のSVGと game.html の色・輪郭設定を素材ファイルとして書き出しています。

青 blue、緑 green、赤 red、紫 purple、黒 black、金属 metal の6色です。bottle_<色>.png は56×56px、背景透明。対応するSVGは編集用です。

画像はdesign/items/へ移動しました。assetsシートでasset_type=items、asset_keyをitem/dropと同じキー、sprite_fileをbottle_blue.svgなどのファイル名に設定すると、対応するビンのストック表示と合体演出に使用します。未登録のビンはコード内のSVGを使います。アイテムのドロップ処理は別途実装が必要です。
