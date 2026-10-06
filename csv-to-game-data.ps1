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
    return @(Import-Csv -LiteralPath $path -Encoding utf8 | ForEach-Object {
        $clean=[ordered]@{}; foreach($property in $_.PSObject.Properties){$clean[$property.Name.Trim()]=$property.Value}; [pscustomobject]$clean
    })
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
$attackRangeRows = @(Read-Table 'attack_range' @('enabled','owner_type','owner_key','action','range_px','angle_degrees')) | Where-Object { $_.owner_type -or $_.owner_key -or $_.action }
$enemyRows = @(Read-Table 'enemy' @('enabled','enemy_key','description','family','variant','hp','attack','super_armor','ai_type','death_hit_stop_seconds')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$animationRows = @(Read-Table 'animation' @('enabled','enemy_key','action','frame_index','frame_seconds','move_speed_px_per_second')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$roundRows = @(Read-Table 'round' @('enabled','round','kill_target','enemy_hp_multiplier','enemy_attack_multiplier','enemy_speed_multiplier','spawn_interval_seconds')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.round) }
$spawnRows = @(Read-Table 'round_spawn' @('enabled','round','enemy_key','spawn_weight','max_alive','max_per_round','start_elapsed_seconds','guaranteed_once')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.enemy_key) }
$assetRows = @(Read-Table 'assets' @('enabled','asset_key','asset_type','owner_key','description','direction','sprite_scale','sprite_file')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.asset_key) }
$difficultyRows = @(Read-Table 'difficulty' @('difficulty_key','description','max_round')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.difficulty_key) }
$mapTileRows = @()
if(Test-Path -LiteralPath (Join-Path $CsvFolder 'sheet-map_tiles.csv')){
    $mapTileRows = @(Read-Table 'map_tiles' @('enabled','asset_key','category','palette_color','walkable','collision_length','collision_width','destructible','hp'))
}

Test-UniqueKeys $generalRows 'key' 'sheet-general.csv'; Test-UniqueKeys $playerRows 'key' 'sheet-player.csv'; Test-UniqueKeys $enemyRows 'enemy_key' 'sheet-enemy.csv'; Test-UniqueKeys $assetRows 'asset_key' 'sheet-assets.csv'; Test-UniqueKeys $difficultyRows 'difficulty_key' 'sheet-difficulty.csv'

$general = [ordered]@{}; for($i=0;$i-lt$generalRows.Count;$i++){ $row=$generalRows[$i]; $general[$row.key.Trim()] = Convert-TypedValue $row 'sheet-general.csv' ($i+2) }
$player = [ordered]@{}; for($i=0;$i-lt$playerRows.Count;$i++){ $row=$playerRows[$i]; $player[$row.key.Trim()] = Convert-TypedValue $row 'sheet-player.csv' ($i+2) }

if($player.Contains('damage_knockback_distance_px') -and $player['damage_knockback_distance_px'] -lt 0){Add-DataError 'sheet-player.csv' 0 'damage_knockback_distance_px' '0以上を指定してください。'}
$enemies = [ordered]@{}; $enabledEnemyKeys=@{}; for($i=0;$i-lt$enemyRows.Count;$i++){
    $row=$enemyRows[$i]; $line=$i+2; if(-not(Test-Enabled $row 'sheet-enemy.csv' $line)){continue}; if($row.enabled-ne'1'){continue}
    if($row.super_armor-notin@('0','1')){Add-DataError 'sheet-enemy.csv' $line 'super_armor' '0または1を指定してください。'}
    $hp=To-Number $row.hp 'sheet-enemy.csv' $line 'hp' 1; $attack=To-Number $row.attack 'sheet-enemy.csv' $line 'attack' 0; $stop=To-Number $row.death_hit_stop_seconds 'sheet-enemy.csv' $line 'death_hit_stop_seconds' 0
    $key=$row.enemy_key.Trim(); $enabledEnemyKeys[$key]=$true; $enemyData=[ordered]@{description=$row.description;family=$row.family;variant=$row.variant;hp=[int]$hp;attack=[double]$attack;super_armor=($row.super_armor-eq'1');ai_type=$row.ai_type;death_hit_stop_seconds=[double]$stop}
    $knockback=18.75
    if(-not [string]::IsNullOrWhiteSpace([string]$row.knockback_distance_px)){$knockback=To-Number $row.knockback_distance_px 'sheet-enemy.csv' $line 'knockback_distance_px' 0}
    $enemyData['knockback_distance_px']=[double]$knockback
    $facing=([string]$row.sprite_facing).Trim().ToLowerInvariant()
    if(-not$facing){$facing='right'}
    if($facing-notin@('left','right')){Add-DataError 'sheet-enemy.csv' $line 'sprite_facing' 'leftまたはrightを指定してください。'}
    $enemyData['sprite_facing']=$facing
    if(-not [string]::IsNullOrWhiteSpace([string]$row.sprite_size_px)){
        $size=To-Number $row.sprite_size_px 'sheet-enemy.csv' $line 'sprite_size_px' 0
        if($size -le 0){Add-DataError 'sheet-enemy.csv' $line 'sprite_size_px' '0より大きい表示サイズ(px)を指定してください。'}
        $enemyData['sprite_size_px']=[double]$size
    }
    if(-not [string]::IsNullOrWhiteSpace([string]$row.collision_radius_px)){
        $radius=To-Number $row.collision_radius_px 'sheet-enemy.csv' $line 'collision_radius_px' 0
        if($radius -le 0){Add-DataError 'sheet-enemy.csv' $line 'collision_radius_px' '0より大きい半径(px)を指定してください。'}
        $enemyData['collision_radius_px']=[double]$radius
    }
    $enemies[$key]=$enemyData
}

$animationFrames=@{}; $animationSpeedKeys=@{}
$attackRanges=[ordered]@{player=[ordered]@{};enemy=[ordered]@{}}
$rangeKeys=@{}
for($i=0;$i-lt$attackRangeRows.Count;$i++){
    $row=$attackRangeRows[$i];$line=$i+2;$file='sheet-attack_range.csv'
    if(-not(Test-Enabled $row $file $line)){continue};if($row.enabled-ne'1'){continue}
    $ownerType=([string]$row.owner_type).Trim();$ownerKey=([string]$row.owner_key).Trim();$action=([string]$row.action).Trim()
    if($ownerType-notin@('player','enemy')){Add-DataError $file $line 'owner_type' 'playerまたはenemyを指定してください。';continue}
    if($ownerType-eq'player' -and ($ownerKey-ne'player' -or $action-notin@('normal','spin','object'))){Add-DataError $file $line 'owner_key/action' 'playerのnormal、spin、objectを指定してください。';continue}
    if($ownerType-eq'enemy' -and (-not$enabledEnemyKeys.ContainsKey($ownerKey) -or $action-notin@('contact','normal','special'))){Add-DataError $file $line 'owner_key/action' '有効なenemy_keyとcontact、normal、specialが必要です。';continue}
    $pair="${ownerType}|${ownerKey}|${action}"
    if($rangeKeys.ContainsKey($pair)){Add-DataError $file $line 'owner_type/owner_key/action' "${pair}が重複しています。"};$rangeKeys[$pair]=$true
    $range=To-Number $row.range_px $file $line 'range_px' 0
    $angle=To-Number $row.angle_degrees $file $line 'angle_degrees' 0
    if([double]::IsNaN($range) -or [double]::IsInfinity($range)){Add-DataError $file $line 'range_px' '有限の数値を指定してください。'}
    if([double]::IsNaN($angle) -or [double]::IsInfinity($angle)){Add-DataError $file $line 'angle_degrees' '有限の数値を指定してください。'}
    if($angle-gt360){Add-DataError $file $line 'angle_degrees' '360以下を指定してください。'}
    if(-not$attackRanges[$ownerType].Contains($ownerKey)){$attackRanges[$ownerType][$ownerKey]=[ordered]@{}}
    $settings=[ordered]@{range_px=[double]$range;angle_degrees=[double]$angle}
    $effectKey=([string]$row.ground_effect_key).Trim()
    if($effectKey){
        if($action-eq'contact' -or $action-eq'object'){Add-DataError $file $line 'ground_effect_key' '地面演出はnormal、specialまたはspinに設定してください。'}
        $settings['ground_effect_key']=$effectKey
        foreach($column in @('ground_effect_duration_seconds','ground_effect_frame_seconds','ground_effect_delay_seconds')){
            $raw=[string]$row.$column
            if([string]::IsNullOrWhiteSpace($raw) -and $column-eq'ground_effect_delay_seconds'){$raw='0'}
            $value=To-Number $raw $file $line $column 0
            if([double]::IsNaN($value) -or [double]::IsInfinity($value) -or ($column-ne'ground_effect_delay_seconds' -and $value-le0)){Add-DataError $file $line $column '持続時間と画像時間は0より大きい有限の秒数、待ち時間は0以上を指定してください。'}
            $settings[$column]=[double]$value
        }
    }
    $attackRanges[$ownerType][$ownerKey][$action]=$settings
}
foreach($action in @('normal','spin','object')){if(-not$rangeKeys.ContainsKey("player|player|${action}")){Add-DataError 'sheet-attack_range.csv' 0 'action' "playerの${action}にenabled=1の行が必要です。"}}
foreach($key in @('normal_attack_range_px','normal_attack_angle_degrees','spin_attack_range_px','object_attack_range_px')){if($player.Contains($key)){Add-DataError 'sheet-player.csv' 0 'key' "${key}はattack_rangeへ移してください。"}}
$groundStartFrames=@{}
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
    if($action-notin@('move','attack','special')){Add-DataError $file $line 'action' 'move_speed、move、attack、specialを指定してください。';continue}
    $frame=To-Number $row.frame_index $file $line 'frame_index' 1
    if($frame -ne [Math]::Truncate($frame)){Add-DataError $file $line 'frame_index' '整数を指定してください。';continue}
    $duration=To-Number $row.frame_seconds $file $line 'frame_seconds' 0.04
    if($duration-gt1.2){Add-DataError $file $line 'frame_seconds' '1.2以下を指定してください。'}
    $group="${key}|${action}"
    $start=([string]$row.ground_effect_start).Trim()
    if($start -and $start -notin @('0','1')){Add-DataError $file $line 'ground_effect_start' '空欄、0、1を指定してください。'}
    if($start -eq '1'){
        if($action -eq 'move'){Add-DataError $file $line 'ground_effect_start' 'attackまたはspecialに指定してください。'}
        if($groundStartFrames.ContainsKey($group)){Add-DataError $file $line 'ground_effect_start' '同じ敵・動作では1行だけ指定してください。'}
        $groundStartFrames[$group]=[int]$frame
    }
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
    if($groundStartFrames.ContainsKey($group)){$enemies[$parts[0]]["animation_$($parts[1])_ground_effect_start_frame"]=$groundStartFrames[$group]}
}

function Get-RoundKey($Row, [string]$File, [int]$Line) {
 $number=To-Number $Row.round $File $Line 'round' 1
 if($number-ne[Math]::Floor($number)){Add-DataError $File $Line 'round' '整数を指定してください。'}
 if($Row.PSObject.Properties['difficulty_key']){
  $difficulty=([string]$Row.difficulty_key).Trim()
  if($difficulty-notin@('easy','normal','hard') -or $difficulty-notin@($difficultyRows|ForEach-Object {$_.difficulty_key.Trim()})){Add-DataError $File $Line 'difficulty_key' 'difficultyシートに登録したeasy・normal・hardを指定してください。'}
  return "${difficulty}|$([int]$number)"
 }
 return ([int]$number).ToString()
}
$roundSeen=@{}
for($i=0;$i-lt$roundRows.Count;$i++){
 $key=Get-RoundKey $roundRows[$i] 'sheet-round.csv' ($i+2)
 if($roundSeen.ContainsKey($key)){Add-DataError 'sheet-round.csv' ($i+2) 'difficulty_key/round' "組み合わせ${key}が重複しています。"};$roundSeen[$key]=$true
}
$roundHasDifficulty=@($roundRows|Where-Object {$_.PSObject.Properties['difficulty_key']}).Count-gt0
$spawnHasDifficulty=@($spawnRows|Where-Object {$_.PSObject.Properties['difficulty_key']}).Count-gt0
if($roundHasDifficulty-ne$spawnHasDifficulty){Add-DataError 'sheet-round_spawn.csv' 1 'difficulty_key' 'roundとround_spawnの両方にdifficulty_key列が必要です。'}
$rounds=[ordered]@{}; $enabledRoundKeys=@{}; $enabledRoundLines=@{}; for($i=0;$i-lt$roundRows.Count;$i++){
    $row=$roundRows[$i];$line=$i+2;if(-not(Test-Enabled $row 'sheet-round.csv' $line)){continue};if($row.enabled-ne'1'){continue}
    $key=Get-RoundKey $row 'sheet-round.csv' $line;$enabledRoundKeys[$key]=$true;$enabledRoundLines[$key]=$line
    $rounds[$key]=[ordered]@{kill_target=[int](To-Number $row.kill_target 'sheet-round.csv' $line 'kill_target' 1);enemy_hp_multiplier=[double](To-Number $row.enemy_hp_multiplier 'sheet-round.csv' $line 'enemy_hp_multiplier' 0);enemy_attack_multiplier=[double](To-Number $row.enemy_attack_multiplier 'sheet-round.csv' $line 'enemy_attack_multiplier' 0);enemy_speed_multiplier=[double](To-Number $row.enemy_speed_multiplier 'sheet-round.csv' $line 'enemy_speed_multiplier' 0);spawn_interval_seconds=[double](To-Number $row.spawn_interval_seconds 'sheet-round.csv' $line 'spawn_interval_seconds' 0.01);spawns=@()}
}

$spawnPairs=@{}; for($i=0;$i-lt$spawnRows.Count;$i++){
    $row=$spawnRows[$i];$line=$i+2;if(-not(Test-Enabled $row 'sheet-round_spawn.csv' $line)){continue};if($row.enabled-ne'1'){continue}
    $roundKey=Get-RoundKey $row 'sheet-round_spawn.csv' $line;$enemyKey=$row.enemy_key.Trim();$pair="${roundKey}|${enemyKey}"
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

$aiSettings=[ordered]@{}
if(Test-Path -LiteralPath (Join-Path $CsvFolder 'sheet-AI.csv')){
    $aiRows=@(Read-Table 'AI' @('enabled','ai_type','ai_detection_range_px','ai_stop_distance_px','ai_lose_target_range_px','ai_wait_seconds') | Where-Object {$_.enabled -eq '1'})
    for($i=0;$i-lt$aiRows.Count;$i++){
        $row=$aiRows[$i];$file='sheet-AI.csv';$line=$i+2;$key=([string]$row.ai_type).Trim()
        if(-not$key){Add-DataError $file $line 'ai_type' '有効なAIには種類を指定してください。';continue}
        if($aiSettings.Contains($key)){Add-DataError $file $line 'ai_type' 'AIの種類が重複しています。'}
        $item=[ordered]@{}
        foreach($field in @('ai_detection_range_px','ai_stop_distance_px','ai_lose_target_range_px','ai_wait_seconds')){$item[$field]=To-Number $row.$field $file $line $field 0}
        foreach($field in @('ai_attack_preparation_seconds','ai_attack_recovery_seconds')){
            $item[$field]=if($row.PSObject.Properties[$field]){To-Number $row.$field $file $line $field 0}else{0}
        }
        foreach($field in @('ai_obstacle_handling','ai_contact_damage_enabled','ai_move_during_attack','ai_flinch_normal','ai_flinch_during_attack','ai_knockback_normal','ai_knockback_during_attack')){
            $value=if($row.PSObject.Properties[$field]){([string]$row.$field).Trim()}elseif($field -in @('ai_knockback_normal','ai_knockback_during_attack')){'1'}else{'0'}
            if($value -notin @('0','1')){Add-DataError $file $line $field '0または1を指定してください。'}
            $item[$field]=if($value -eq '1'){1}else{0}
        }
        if($item.ai_lose_target_range_px -lt $item.ai_detection_range_px){Add-DataError $file $line 'ai_lose_target_range_px' '発見距離以上にしてください。'}
        if($item.ai_stop_distance_px -gt $item.ai_detection_range_px){Add-DataError $file $line 'ai_stop_distance_px' '発見距離以下にしてください。'}
        $aiSettings[$key]=$item
    }
}

$items=[ordered]@{};$drops=[ordered]@{}
if(Test-Path -LiteralPath (Join-Path $CsvFolder 'sheet-item.csv')){
 $rows=@(Read-Table 'item' @('enabled','asset_key','effect_index','effect_type','value','type','min','max')) | Where-Object {$_.asset_key}
 $seen=@{}
 for($i=0;$i-lt$rows.Count;$i++){
  $row=$rows[$i];$file='sheet-item.csv';$line=$i+2
  if(-not(Test-Enabled $row $file $line)-or$row.enabled-ne'1'){continue}
  $key=$row.asset_key.Trim();$index=To-Number $row.effect_index $file $line 'effect_index' 1
  if($index-ne[Math]::Floor($index)){Add-DataError $file $line 'effect_index' '整数を指定してください。'}
  $id="${key}|${index}";if($seen.ContainsKey($id)){Add-DataError $file $line 'effect_index' '同じアイテムの効果番号が重複しています。'};$seen[$id]=$true
  $value=Convert-TypedValue $row $file $line
  if([string]::IsNullOrWhiteSpace($row.effect_type)){Add-DataError $file $line 'effect_type' '効果の種類が必要です。'}
  if(-not$items.Contains($key)){$items[$key]=[ordered]@{description=$row.description;effects=@()}}
  $items[$key].effects+=@([ordered]@{effect_index=[int]$index;effect_type=$row.effect_type;value=$value})
 }
}
if(Test-Path -LiteralPath (Join-Path $CsvFolder 'sheet-drop.csv')){
 $rows=@(Read-Table 'drop' @('enabled','enemy_key','index','asset_key','drop_weight','quantity')) | Where-Object {$_.enemy_key -or $_.asset_key -or $_.drop_weight}
 $seen=@{}
 for($i=0;$i-lt$rows.Count;$i++){
  $row=$rows[$i];$file='sheet-drop.csv';$line=$i+2
  if(-not(Test-Enabled $row $file $line)-or$row.enabled-ne'1'){continue}
  $key=([string]$row.enemy_key).Trim();$asset=([string]$row.asset_key).Trim()
  if(-not$enemies.Contains($key)){Add-DataError $file $line 'enemy_key' '有効なenemyに存在しません。'}
  $index=To-Number $row.index $file $line 'index' 1;$quantity=To-Number $row.quantity $file $line 'quantity' 0;$weight=To-Number $row.drop_weight $file $line 'drop_weight' 0
  foreach($entry in @(@('index',$index),@('quantity',$quantity))){if($entry[1]-ne[Math]::Floor($entry[1])){Add-DataError $file $line $entry[0] '整数を指定してください。'}}
  $id="${key}|${index}";if($seen.ContainsKey($id)){Add-DataError $file $line 'index' '同じ敵の抽選番号が重複しています。'};$seen[$id]=$true
  if($asset){
   if($quantity-lt1){Add-DataError $file $line 'quantity' 'アイテムを落とす行では1以上にしてください。'}
   if(-not$items.Contains($asset)){Add-DataError $file $line 'asset_key' '有効なitemに存在しません。'}
   else{
    $effects=@($items[$asset].effects)
    $isMoney=$effects.Count-eq1 -and $effects[0].effect_type-eq'money' -and $effects[0].value-ge0
    $isHeal=$effects.Count-gt0 -and @($effects|Where-Object {$_.effect_type-ne'heal' -or $_.value-le0}).Count-eq0
    if(-not$isMoney -and -not$isHeal){Add-DataError $file $line 'asset_key' '正のheal効果のビン、または単一のmoney効果に対応しています。moneyの金額はdrop.quantityで指定します。'}
   }
   if(-not@($assets|Where-Object {$_.asset_key-eq$asset -and $_.asset_type-eq'items'}).Count){Add-DataError $file $line 'asset_key' '有効なitemsアセットが必要です。'}
  }elseif($quantity-ne0){Add-DataError $file $line 'quantity' 'ドロップなしの行では0にしてください。'}
  if(-not$drops.Contains($key)){$drops[$key]=@()}
  $drops[$key]+=@([ordered]@{index=[int]$index;asset_key=$asset;drop_weight=[double]$weight;quantity=[int]$quantity})
 }
 foreach($key in $drops.Keys){if(($drops[$key]|ForEach-Object { $_.drop_weight }|Measure-Object -Sum).Sum-le0){Add-DataError 'sheet-drop.csv' 0 'drop_weight' "${key}の重みの合計は0より大きくしてください。"}}
}

foreach($ownerType in $attackRanges.Keys){foreach($ownerKey in $attackRanges[$ownerType].Keys){foreach($action in $attackRanges[$ownerType][$ownerKey].Keys){
    $settings=$attackRanges[$ownerType][$ownerKey][$action]
    if($settings.ground_effect_key -and -not @($assets|Where-Object {$_.asset_type-eq'effect' -and $_.owner_key-eq$settings.ground_effect_key}).Count){Add-DataError 'sheet-attack_range.csv' 0 'ground_effect_key' "${ownerType}/${ownerKey}/${action}に対応する有効なeffectアセットがありません。"}
}}}

if($errors.Count-gt0){$message="データ検証で$($errors.Count)件のエラーが見つかりました。`n"+($errors-join"`n");if($ErrorReportPath){[IO.File]::WriteAllText($ErrorReportPath,$message,[Text.UTF8Encoding]::new($false))};if(-not$Silent){Write-Host $message -ForegroundColor Red};[Console]::Error.WriteLine($message);exit 2}

$data=[ordered]@{schema_version=1;items=$items;drops=$drops;generated_at=(Get-Date).ToString('o');general=$general;player=$player;attack_range=$attackRanges;enemies=$enemies;ai=$aiSettings;rounds=$rounds;assets=$assets;difficulties=$difficulties;map_tiles=$mapTiles}
$parent=Split-Path -Parent $OutputPath;if($parent){[IO.Directory]::CreateDirectory($parent)|Out-Null}
[IO.File]::WriteAllText($OutputPath,($data|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
$result=[ordered]@{status='ok';output=$OutputPath;general=$general.Count;player=$player.Count;enemies=$enemies.Count;rounds=$rounds.Count;assets=$assets.Count;difficulties=$difficulties.Count}
if($Silent){$result|ConvertTo-Json -Compress}else{Write-Host "game-data.jsonを生成しました: $OutputPath" -ForegroundColor Green}
