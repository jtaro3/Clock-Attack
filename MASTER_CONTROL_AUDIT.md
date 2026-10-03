# 内蔵設定の調査とマスター管理への移行
## 今回接続した既存マスター
- round.enabled: 有効なラウンドを番号順に進行。difficulty.easy.max_round以内の最後の有効ラウンドでクリア。
- round.kill_target: 内蔵討伐目標を廃止。
- round_spawn: 候補なしの場合の青・緑・赤の代替出現を廃止。
- 紫スライムの60秒強制出現を廃止。必要ならround_spawnに記載。
- guaranteed_once: 出現開始時間と同時・総数上限を満たす未出現の敵を、通常抽選より優先して1体出す。複数対象はシート順に出現間隔ごとに処理。
- JSON読み込み失敗時は内蔵バランスで起動せず、エラーを表示。
## 追加項目が必要な固定値
|対象|現在の値・動作|管理先案|
|---|---|---|
|プレイヤー移動速度|124 px/s|player.move_speed_px_per_second|
|通常攻撃の行動力消費|1|player.attack_energy_cost|
|通常攻撃時間|0.27秒|player.attack_duration_seconds|
|回転斬り時間|0.55秒|player.spin_duration_seconds|
|攻撃範囲|半径に51px加算、方向判定も固定|playerの攻撃範囲・角度|
|被弾後無敵時間|1.15秒|player.damage_invincible_seconds|
|灰色状態の被弾上限|3回|player.gray_hit_limit|
|敵の出現距離|プレイヤーから320px周辺|general.spawn_distance_px|
|青以外の移動速度|21〜33 px/sに総討伐数×0.3を加算|animationの各敵move_speed、必要ならenemyの速度乱数幅・討伐数係数|
|敵の当たり判定半径|青14、緑16、赤18、紫22、黒24、金属26px|enemy.collision_radius_px|
|敵の瓶の回復量|出現時の最大HP×10|enemy.sand_recovery_per_hp、または固定回復量|
|青以外の攻撃アニメ時間|0.42秒|animation.attackの各画像表示時間|
|回復ゲージ時間|1/1.3秒|general.recovery_gauge_seconds|
|回復・合体・クリア演出|JSのタイマーとHTML/CSSの時間指定|演出用シートを作り両方で共有|
## その他の内蔵動作と制約
- 青スライムのブラウザ保存値による本番マスター上書きを廃止。ブラウザ保存値は演出確認のプレビューのみで使用。
- enemy.enabledでJSONから外れても、6種類のスライムの描画・種類定義はコードに残る。種類の拡張には描画対応も必要。
- enemy.ai_typeとsand_typeはJSONにあるが、追従AIと瓶色はコードの種類定義を使用。
- assetsのプレイヤー画像、剣、スライム色などは固定参照が残る。
- マップはmaps/clock-attack-grassland.json固定。読めない場合の標準マップがある。
- general/player/animationの未設定値には既存の初期値が残る。必須項目の検証を追加してから廃止する。
- round_spawn.max_per_roundの合計がkill_targetに届かない設定ではクリア不能。遅延出現のguaranteed_onceも総出現数が目標に達した後には出せない。出力時の実現可能性検証が必要。
- export-all-csvはルートJSONのみ更新し、distには同期しない。
- main.odsがexport-all-csvの入力。main.xlsmの変更は自動では取り込まれない。
## コードで維持する項目
画像の切り出し座標、透明色処理、グリッドの32px、カメラの座標計算、画面配置などは実装仕様。ゲームバランスと分けて管理する。
