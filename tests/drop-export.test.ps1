$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $env:TEMP ('clock-drop-test-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($folder)|Out-Null
Copy-Item (Join-Path $project 'CSV/*.csv') $folder
$output=Join-Path $folder 'result.json'
function Run-Export { $ErrorActionPreference='Continue'; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $project 'csv-to-game-data.ps1') -CsvFolder $folder -OutputPath $output -Silent 2>&1 | Out-Null; return $LASTEXITCODE }
if((Run-Export)-ne0){throw 'Valid drop export failed'}
$data=Get-Content $output -Raw -Encoding utf8|ConvertFrom-Json
if($data.items.sand_blue.effects[0].value-ne20 -or $data.drops.slime_blue.Count-ne3 -or $data.drops.slime_blue[1].quantity-ne3){throw 'Item/drop serialization mismatch'}
$original=[IO.File]::ReadAllText($output)
$source=@(Import-Csv (Join-Path $folder 'sheet-drop.csv'))
foreach($case in @('missing_item','fractional_quantity','negative_weight','duplicate_index','zero_total','no_drop_quantity','unknown_enemy','unsupported_effect')){
 $rows=@($source|ForEach-Object {$_.PSObject.Copy()})
 switch($case){
  'missing_item' {$rows[0].asset_key='unknown'}
  'fractional_quantity' {$rows[0].quantity='1.5'}
  'negative_weight' {$rows[0].drop_weight='-1'}
  'duplicate_index' {$rows[1].index=$rows[0].index}
  'zero_total' {$rows|ForEach-Object {$_.drop_weight='0'}}
  'no_drop_quantity' {$rows[2].quantity='1'}
  'unknown_enemy' {$rows[0].enemy_key='unknown'}
  'unsupported_effect' { $items=@(Import-Csv (Join-Path $folder 'sheet-item.csv'));$items[0].effect_type='attack_up';$items|Export-Csv (Join-Path $folder 'sheet-item.csv') -NoTypeInformation -Encoding utf8 }
 }
 $rows|Export-Csv (Join-Path $folder 'sheet-drop.csv') -NoTypeInformation -Encoding utf8
 if((Run-Export)-ne2){throw "Invalid case accepted: $case"}
 if([IO.File]::ReadAllText($output)-cne$original){throw 'Invalid export overwrote JSON'}
}
Write-Output 'Item/drop exporter: valid data, 8 invalid cases, preservation of output passed'
