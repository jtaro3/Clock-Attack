# 青いドラゴンの歩行画像

元画像：design/enemies/dragon/candidates/dragon_03_frost.png。94×94pxの透明PNGを10枚。数字順にループします。

生成した歩行構成を参考に元画像の形を保ち、腰を固定した脚の変形で10等分の周期へ調整しました。左右の脚は180度ずらして交互に動きます。足先の前後幅は6px、持ち上げは最大4px。頭・翼・胴体の揺れを抑えています。

確認GIFは1コマ0.14秒、1周1.4秒。preview/walk_94.gifは原寸、preview/walk_3x.gifは3倍表示、preview/frames.pngは2倍表示の10枚一覧です。

採用時はanimationシートでdragon_frostの移動frame_indexを1～10に設定し、build-animation-manifest.cmdを実行します。
