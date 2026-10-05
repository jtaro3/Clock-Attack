$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $env:TEMP ('clock-difficulty-test-'+[guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($folder)|Out-Null
Copy-Item (Join-Path $project 'CSV/*.csv') $folder
$rounds=@();$spawns=@();$i=0
foreach($d in @('easy','normal','hard')){
 $i++
 $rounds+=[pscustomobject]@{enabled=1;difficulty_key=$d;round=1;kill_target=(10*$i);enemy_hp_multiplier=1;enemy_attack_multiplier=$i;enemy_speed_multiplier=1;spawn_interval_seconds=1}
 $spawns+=[pscustomobject]@{enabled=1;difficulty_key=$d;round=1;enemy_key='slime_blue';spawn_weight=(10*$i);max_alive=0;max_per_round=0;start_elapsed_seconds=0;guaranteed_once=0}
}
$output=Join-Path $folder 'result.json'
function Export-Fixture {
 param($R,$S)
 $R|Export-Csv (Join-Path $folder 'sheet-round.csv') -NoTypeInformation -Encoding utf8
 $S|Export-Csv (Join-Path $folder 'sheet-round_spawn.csv') -NoTypeInformation -Encoding utf8
 $ErrorActionPreference='Continue'
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $project 'csv-to-game-data.ps1') -CsvFolder $folder -OutputPath $output -Silent 2>&1|Out-Null
 return $LASTEXITCODE
}
if((Export-Fixture $rounds $spawns)-ne0){throw 'Cross-difficulty same numbers rejected'}
$data=Get-Content $output -Raw -Encoding utf8|ConvertFrom-Json
foreach($i in 1..3){$d=@('easy','normal','hard')[$i-1];$entry=$data.rounds."$d|1";if($entry.kill_target-ne(10*$i)-or$entry.spawns.Count-ne1-or$entry.spawns[0].spawn_weight-ne(10*$i)){throw 'Difficulty settings mixed'}}
$original=[IO.File]::ReadAllText($output)
if((Export-Fixture (@($rounds)+@($rounds[0])) $spawns)-ne2){throw 'Duplicate within same difficulty accepted'}
if((Export-Fixture $rounds (@($spawns)+@($spawns[0])))-ne2){throw 'Duplicate spawn within same difficulty accepted'}
if((Export-Fixture $rounds @($spawns[0],$spawns[2]))-ne2){throw 'Missing normal spawn accepted'}
$bad=@($rounds|ForEach-Object {$_.PSObject.Copy()});$bad[0].difficulty_key='unknown'
if((Export-Fixture $bad $spawns)-ne2){throw 'Unknown difficulty accepted'}
if([IO.File]::ReadAllText($output)-cne$original){throw 'Invalid export changed existing JSON'}
Write-Output 'Difficulty export: separation, duplicate round/spawn, missing spawn, invalid key and output preservation passed'
