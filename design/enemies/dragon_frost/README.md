# 青いドラゴンの歩行画像

元画像：design/enemies/dragon/candidates/dragon_03_frost.png。内蔵image_genで5コマの歩行シートを生成し、頭の位置と縮小率をそろえて94×94pxの透明PNGに分割しています。

move/dragon_frost_1.png～dragon_frost_5.pngを1→2→3→4→5→1の順に繰り返します。確認GIFは各コマ0.16秒、1周0.8秒です。

preview/walk_94.gifは原寸の透明GIF、preview/walk_3x.gifは3倍表示、preview/frames.pngは2倍表示のコマ一覧です。PNGがゲーム用の素材です。

ゲームへの組み込み・マスターの変更は行っていません。採用時はenemy_keyにdragon_frostを使い、animationシートの移動frame_indexに1～5を設定して、build-animation-manifest.cmdを実行します。
