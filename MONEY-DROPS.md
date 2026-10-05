お金のドロップ（v1.24）

item: asset_key=money、effect_type=moneyを有効にする。value=0はそのままでよい。金額はdrop.quantityで指定し、moneyのvalueは獲得金額の計算に使わない。
assets: asset_key=money、asset_type=items、sprite_file=coin_hourglass.png。画像はdesign/itemsに格納する。
drop: 対象敵の行にasset_key=money、quantity=獲得金額、drop_weight=抽選の重みを指定する。例：quantity=25なら接触時に25金を獲得する。

敵撃破位置にコインが落ち、プレイヤーが接触すると全額を所持金に加算する。ビンのストック枠を使用せず、満杯でも取得可能。所持金は画面右上に表示し、そのプレイ内で保持する。再スタート時に0へ戻る。購入、装備、プレイを越える保存は未対応。

お金は単一のmoney効果、ビンは正のheal効果に対応。moneyとhealを同じitemに混在させたdropは検証時に拒否する。
