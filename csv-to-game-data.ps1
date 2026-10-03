param(
    [Parameter(Mandatory = $true)][string]$CsvFolder,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$ErrorReportPath,
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$errors = [Collections.Generic.List[string]]::new()

function Add-DataError([string]$File, [int]$Line, [string]$Column, [string]$Message) {
    $errors.Add("${File}:${Line} [${Column}] ${Message}")
}
function Read-Table([string]$Name, [string[]]$RequiredColumns) {
    $path = Join-Path $CsvFolder "sheet-${Name}.csv"
    if (-not (Test-Path -LiteralPath $path)) {
        Add-DataError "sheet-${Name}.csv" 0 'file' '必須ファイルがありません。'
        return @()
    }
    $header = (Get-Content -LiteralPath $path -Encoding utf8 -TotalCount 1).TrimStart([char]0xFEFF)
    $columns = @($header -split ',' | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ })
    foreach ($required in $RequiredColumns) {
        if ($required -notin $columns) { Add-DataError "sheet-${Name}.csv" 1 $required '必須列がありません。' }
    }
    return @(Import-Csv -LiteralPath $path -Encoding utf8)
}
function Test-Enabled($Row, [string]$File, [int]$Line) {
    if ($Row.enabled -notin @('0','1')) { Add-DataError $File $Line 'enabled' '0または1を指定してください。'; return $false }
    return $true
}
function Convert-TypedValue($Row, [string]$File, [int]$Line) {
    if ($Row.type -notin @('integer','number')) { Add-DataError $File $Line 'type' 'integerまたはnumberを指定してください。'; return $null }
    $value = 0.0; $minimum = 0.0; $maximum = 0.0
    if (-not [double]::TryParse($Row.value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value)) { Add-DataError $File $Line 'value' '数値を指定してください。'; return $null }
    if (-not [double]::TryParse($Row.min, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$minimum)) { Add-DataError $File $Line 'min' '数値を指定してください。'; return $null }
    if (-not [double]::TryParse($Row.max, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$maximum)) { Add-DataError $File $Line 'max' '数値を指定してください。'; return $null }
    if ($minimum -gt $maximum) { Add-DataError $File $Line 'min/max' 'minがmaxを超えています。' }
    if ($value -lt $minimum -or $value -gt $maximum) { Add-DataError $File $Line 'value' "値${value}が範囲${minimum}～${maximum}の外です。" }
    if ($Row.type -eq 'integer' -and $value -ne [math]::Truncate($value)) { Add-DataError $File $Line 'value' 'integerには整数を指定してください。' }
    if ($Row.type -eq 'integer') { return [int]$value }
    return [double]$value
}
function Test-UniqueKeys($Rows, [string]$Key, [string]$File) {
    $seen = @{}
    for ($i=0; $i -lt $Rows.Count; $i++) {
        $value = [string]$Rows[$i].$Key
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        $trimmed = $value.Trim()
        if ($value -ne $trimmed) { Add-DataError $File ($i+2) $Key 'キーの前後に空白があります。' }
        if ($seen.ContainsKey($trimmed)) { Add-DataError $File ($i+2) $Key "キー${trimmed}が重複しています。" } else { $seen[$trimmed] = $true }
    }
}
function To-Number($Value, [string]$File, [int]$Line, [string]$Column, [double]$Minimum = 0) {
    $number = 0.0
    if (-not [double]::TryParse([string]$Value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { Add-DataError $File $Line $Column '数値を指定してください。'; return 0 }
    if ($number -lt $Minimum) { Add-DataError $File $Line $Column "${Minimum}以上を指定してください。" }
    return $number
}

$generalRows = @(Read-Table 'general' @('key','description','value','type','min','max','unit','notes')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.key) }
$playerRows = @(Read-Table 'player' @('key','description','value','type','min','max','unit','notes')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.key) }
$enemyRows = @(Read-Table 'enemy' @('enabled','enemy_key','description','family','variant','hp','attack','super_armor','ai_type','sand_type','death_hit_stop_seconds')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$animationRows = @(Read-Table 'animation' @('enabled','enemy_key','action','frame_index','frame_seconds','move_speed_px_per_second')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$roundRows = @(Read-Table 'round' @('enabled','round','kill_target','enemy_hp_multiplier','enemy_attack_multiplier','enemy_speed_multiplier','spawn_interval_seconds')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.round) }
$spawnRows = @(Read-Table 'round_spawn' @('enabled','round','enemy_key','spawn_weight','max_alive','max_per_round','start_elapsed_seconds','guaranteed_once')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$assetRows = @(Read-Table 'assets' @('enabled','asset_key','asset_type','owner_key','description','direction','sprite_scale','sprite_file')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.asset_key) }
$difficultyRows = @(Read-Table 'difficulty' @('difficulty_key','description','max_round')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.difficulty_key) }
$mapTileRows = @()
if(Test-Path -LiteralPath (Join-Path $CsvFolder 'sheet-map_tiles.csv')){
    $mapTileRows = @(Read-Table 'map_tiles' @('enabled','asset_key','category','palette_color','walkable','collision_length','collision_width','destructible','hp'))
}

Test-UniqueKeys $generalRows 'key' 'sheet-general.csv'; Test-UniqueKeys $playerRows 'key' 'sheet-player.csv'; Test-UniqueKeys $enemyRows 'enemy_key' 'sheet-enemy.csv'; Test-UniqueKeys $roundRows 'round' 'sheet-round.csv'; Test-UniqueKeys $assetRows 'asset_key' 'sheet-assets.csv'; Test-UniqueKeys $difficultyRows 'difficulty_key' 'sheet-difficulty.csv'

$general = [ordered]@{}; for($i=0;$i-lt$generalRows.Count;$i++){ $row=$generalRows[$i]; $general[$row.key.Trim()] = Convert-TypedValue $row 'sheet-general.csv' ($i+2) }
$player = [ordered]@{}; for($i=0;$i-lt$playerRows.Count;$i++){ $row=$playerRows[$i]; $player[$row.key.Trim()] = Convert-TypedValue $row 'sheet-player.csv' ($i+2) }

if($player.Contains('damage_knockback_distance_px') -and $player['damage_knockback_distance_px'] -lt 0){Add-DataError 'sheet-player.csv' 0 'damage_knockback_distance_px' '0以上を指定してください。'}
$enemies = [ordered]@{}; $enabledEnemyKeys=@{}; for($i=0;$i-lt$enemyRows.Count;$i++){
    $row=$enemyRows[$i]; $line=$i+2; if(-not(Test-Enabled $row 'sheet-enemy.csv' $line)){continue}; if($row.enabled-ne'1'){continue}
    if($row.super_armor-notin@('0','1')){Add-DataError 'sheet-enemy.csv' $line 'super_armor' '0または1を指定してください。'}
    $hp=To-Number $row.hp 'sheet-enemy.csv' $line 'hp' 1; $attack=To-Number $row.attack 'sheet-enemy.csv' $line 'attack' 0; $stop=To-Number $row.death_hit_stop_seconds 'sheet-enemy.csv' $line 'death_hit_stop_seconds' 0
    $key=$row.enemy_key.Trim(); $enabledEnemyKeys[$key]=$true; $enemyData=[ordered]@{description=$row.description;family=$row.family;variant=$row.variant;hp=[int]$hp;attack=[double]$attack;super_armor=($row.super_armor-eq'1');ai_type=$row.ai_type;sand_type=$row.sand_type;death_hit_stop_seconds=[double]$stop}
    $knockback=18.75
    if(-not [string]::IsNullOrWhiteSpace([string]$row.knockback_distance_px)){$knockback=To-Number $row.knockback_distance_px 'sheet-enemy.csv' $line 'knockback_distance_px' 0}
    $enemyData['knockback_distance_px']=[double]$knockback
    $enemies[$key]=$enemyData
}

$animationFrames=@{}; $animationSpeedKeys=@{}
for($i=0;$i-lt$animationRows.Count;$i++){
    $row=$animationRows[$i];$line=$i+2;$file='sheet-animation.csv'
    if(-not(Test-Enabled $row $file $line)){continue};if($row.enabled-ne'1'){continue}
    $key=([string]$row.enemy_key).Trim();$action=([string]$row.action).Trim()
    if(-not$enabledEnemyKeys.ContainsKey($key)){Add-DataError $file $line 'enemy_key' "有効なenemy ${key}が存在しません。";continue}
    if($action -eq 'move_speed'){
        if($animationSpeedKeys.ContainsKey($key)){Add-DataError $file $line 'move_speed_px_per_second' "${key}の移動速度が重複しています。"}
        $animationSpeedKeys[$key]=$true
        $speed=To-Number $row.move_speed_px_per_second $file $line 'move_speed_px_per_second' 0
        if($speed-gt80){Add-DataError $file $line 'move_speed_px_per_second' '80以下を指定してください。'}
        $enemies[$key]['move_speed_px_per_second']=[double]$speed
        continue
    }
    if($action-notin@('move','attack')){Add-DataError $file $line 'action' 'move_speed、move、attackを指定してください。';continue}
    $frame=To-Number $row.frame_index $file $line 'frame_index' 1
    if($frame -ne [Math]::Truncate($frame)){Add-DataError $file $line 'frame_index' '整数を指定してください。';continue}
    $duration=To-Number $row.frame_seconds $file $line 'frame_seconds' 0.04
    if($duration-gt1.2){Add-DataError $file $line 'frame_seconds' '1.2以下を指定してください。'}
    $group="${key}|${action}"
    if(-not$animationFrames.ContainsKey($group)){$animationFrames[$group]=@{}}
    if($animationFrames[$group].ContainsKey([int]$frame)){Add-DataError $file $line 'frame_index' "${group}の${frame}枚目が重複しています。"}
    $animationFrames[$group][[int]$frame]=[double]$duration
}
foreach($group in $animationFrames.Keys){
    $parts=$group.Split('|');$frames=$animationFrames[$group];$count=$frames.Count
    $durations=@();for($frame=1;$frame-le$count;$frame++){
        if(-not$frames.ContainsKey($frame)){Add-DataError 'sheet-animation.csv' 0 'frame_index' "${group}は1から連番にしてください。";break}
        $durations += [double]$frames[$frame]
    }
    $enemies[$parts[0]]["animation_$($parts[1])_frame_seconds"]=$durations
}

$rounds=[ordered]@{}; $enabledRoundKeys=@{}; $enabledRoundLines=@{}; for($i=0;$i-lt$roundRows.Count;$i++){
    $row=$roundRows[$i];$line=$i+2;if(-not(Test-Enabled $row 'sheet-round.csv' $line)){continue};if($row.enabled-ne'1'){continue}
    $roundNumber=[int](To-Number $row.round 'sheet-round.csv' $line 'round' 1);$key=[string]$roundNumber;$enabledRoundKeys[$key]=$true;$enabledRoundLines[$key]=$line
    $rounds[$key]=[ordered]@{kill_target=[int](To-Number $row.kill_target 'sheet-round.csv' $line 'kill_target' 1);enemy_hp_multiplier=[double](To-Number $row.enemy_hp_multiplier 'sheet-round.csv' $line 'enemy_hp_multiplier' 0);enemy_attack_multiplier=[double](To-Number $row.enemy_attack_multiplier 'sheet-round.csv' $line 'enemy_attack_multiplier' 0);enemy_speed_multiplier=[double](To-Number $row.enemy_speed_multiplier 'sheet-round.csv' $line 'enemy_speed_multiplier' 0);spawn_interval_seconds=[double](To-Number $row.spawn_interval_seconds 'sheet-round.csv' $line 'spawn_interval_seconds' 0.01);spawns=@()}
}

$spawnPairs=@{}; for($i=0;$i-lt$spawnRows.Count;$i++){
    $row=$spawnRows[$i];$line=$i+2;if(-not(Test-Enabled $row 'sheet-round_spawn.csv' $line)){continue};if($row.enabled-ne'1'){continue}
    $roundKey=([int](To-Number $row.round 'sheet-round_spawn.csv' $line 'round' 1)).ToString();$enemyKey=$row.enemy_key.Trim();$pair="${roundKey}|${enemyKey}"
    if($spawnPairs.ContainsKey($pair)){Add-DataError 'sheet-round_spawn.csv' $line 'round/enemy_key' "組み合わせ${pair}が重複しています。"}else{$spawnPairs[$pair]=$true}
    # A spawn row for a disabled round is kept as future data and is omitted from JSON.
    if(-not$enabledRoundKeys.ContainsKey($roundKey)){continue}
    if(-not$enabledEnemyKeys.ContainsKey($enemyKey)){Add-DataError 'sheet-round_spawn.csv' $line 'enemy_key' "有効なenemy ${enemyKey}が存在しません。";continue}
    if($row.guaranteed_once-notin@('0','1')){Add-DataError 'sheet-round_spawn.csv' $line 'guaranteed_once' '0または1を指定してください。'}
    $rounds[$roundKey].spawns += [ordered]@{enemy_key=$enemyKey;spawn_weight=[double](To-Number $row.spawn_weight 'sheet-round_spawn.csv' $line 'spawn_weight' 0.01);max_alive=[int](To-Number $row.max_alive 'sheet-round_spawn.csv' $line 'max_alive' 0);max_per_round=[int](To-Number $row.max_per_round 'sheet-round_spawn.csv' $line 'max_per_round' 0);start_elapsed_seconds=[double](To-Number $row.start_elapsed_seconds 'sheet-round_spawn.csv' $line 'start_elapsed_seconds' 0);guaranteed_once=($row.guaranteed_once-eq'1')}
}
foreach($roundKey in $enabledRoundKeys.Keys){if($rounds[$roundKey].spawns.Count-eq0){Add-DataError 'sheet-round.csv' $enabledRoundLines[$roundKey] 'round' "有効なround ${roundKey}に出現設定がありません。round_spawnシートで該当行のenabledを1にするか、このroundを無効にしてください。"}}

$assets=@(); for($i=0;$i-lt$assetRows.Count;$i++){$row=$assetRows[$i];$line=$i+2;if(-not(Test-Enabled $row 'sheet-assets.csv' $line)){continue};if($row.enabled-ne'1'){continue};foreach($column in @('asset_key','asset_type','owner_key','sprite_file')){if([string]::IsNullOrWhiteSpace($row.$column)){Add-DataError 'sheet-assets.csv' $line $column '有効なアセットでは必須です。'}};$assets += [ordered]@{asset_key=$row.asset_key.Trim();asset_type=$row.asset_type;owner_key=$row.owner_key.Trim();description=$row.description;direction=$row.direction;sprite_scale=if($row.sprite_scale){[double](To-Number $row.sprite_scale 'sheet-assets.csv' $line 'sprite_scale' 0.01)}else{1};sprite_file=$row.sprite_file}}
$difficulties=[ordered]@{}; for($i=0;$i-lt$difficultyRows.Count;$i++){$row=$difficultyRows[$i];$difficulties[$row.difficulty_key.Trim()]=[ordered]@{description=$row.description;max_round=[int](To-Number $row.max_round 'sheet-difficulty.csv' ($i+2) 'max_round' 1)}}

$mapTiles=@();$mapTileKeys=@{};$mapTileFiles=@{}
for($i=0;$i-lt$mapTileRows.Count;$i++){
    $row=$mapTileRows[$i];$line=$i+2;$file='sheet-map_tiles.csv'
    if(-not(Test-Enabled $row $file $line)){continue}
    if($row.enabled-ne'1'){continue}
    $key=([string]$row.asset_key).Trim()
    if(-not$key){Add-DataError $file $line 'asset_key' '有効な行では必須です。';continue}
    if($mapTileKeys.ContainsKey($key)){Add-DataError $file $line 'asset_key' "キー${key}が重複しています。"};$mapTileKeys[$key]=$true
    $asset=@($assets|Where-Object { $_.asset_key -eq $key -and $_.asset_type -eq 'map_tiles' })
    if($asset.Count-ne1){Add-DataError $file $line 'asset_key' 'assetsに同じキーの有効なmap_tilesアセットが必要です。';continue}
    $sprite=[string]$asset[0].sprite_file
    if($mapTileFiles.ContainsKey($sprite)){Add-DataError $file $line 'asset_key' "画像${sprite}に複数の設定があります。"};$mapTileFiles[$sprite]=$true
    $color=([string]$row.palette_color).Trim()
    if($color -and $color -notmatch '^#[0-9a-fA-F]{6}$'){Add-DataError $file $line 'palette_color' '#と6桁の16進数で指定してください。例: #C6D6BC'}
    if($row.walkable -notin @('0','1')){Add-DataError $file $line 'walkable' '0または1を指定してください。'}
    $length=To-Number $row.collision_length $file $line 'collision_length' 0
    $width=To-Number $row.collision_width $file $line 'collision_width' 0
    if($row.walkable -eq '0' -and ($length -le 0 -or $width -le 0)){Add-DataError $file $line 'collision_length/collision_width' '通行不可では縦・横とも0より大きいマス数が必要です。'}
    if($row.destructible -notin @('0','1')){Add-DataError $file $line 'destructible' '0または1を指定してください。'}
    $objectHp=To-Number $row.hp $file $line 'hp' 0
    if($objectHp -ne [Math]::Floor($objectHp)){Add-DataError $file $line 'hp' '整数を指定してください。'}
    if($row.destructible -eq '1' -and $objectHp -le 0){Add-DataError $file $line 'hp' '破壊可能なオブジェクトには1以上の耐久力が必要です。'}
    $mapTiles += [ordered]@{destructible=($row.destructible -eq '1');hp=[int]$objectHp;asset_key=$key;sprite_file=$sprite;category=([string]$row.category).Trim();palette_color=$color;walkable=($row.walkable -eq '1');collision_length=[double]$length;collision_width=[double]$width}
}

if($errors.Count-gt0){$message="データ検証で$($errors.Count)件のエラーが見つかりました。`n"+($errors-join"`n");if($ErrorReportPath){[IO.File]::WriteAllText($ErrorReportPath,$message,[Text.UTF8Encoding]::new($false))};if(-not$Silent){Write-Host $message -ForegroundColor Red};[Console]::Error.WriteLine($message);exit 2}

$data=[ordered]@{schema_version=1;generated_at=(Get-Date).ToString('o');general=$general;player=$player;enemies=$enemies;rounds=$rounds;assets=$assets;difficulties=$difficulties;map_tiles=$mapTiles}
$parent=Split-Path -Parent $OutputPath;if($parent){[IO.Directory]::CreateDirectory($parent)|Out-Null}
[IO.File]::WriteAllText($OutputPath,($data|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
$result=[ordered]@{status='ok';output=$OutputPath;general=$general.Count;player=$player.Count;enemies=$enemies.Count;rounds=$rounds.Count;assets=$assets.Count;difficulties=$difficulties.Count}
if($Silent){$result|ConvertTo-Json -Compress}else{Write-Host "game-data.jsonを生成しました: $OutputPath" -ForegroundColor Green}
