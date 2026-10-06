$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $env:TEMP ('clock-ground-effect-test-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($folder)|Out-Null
Copy-Item -LiteralPath (Get-ChildItem -LiteralPath (Join-Path $project 'CSV') -Filter '*.csv' -File).FullName -Destination $folder
$output=Join-Path $folder 'result.json'
function Run-Export { $ErrorActionPreference='Continue'; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $project 'csv-to-game-data.ps1') -CsvFolder $folder -OutputPath $output -Silent 2>&1 | Out-Null; return $LASTEXITCODE }
if((Run-Export)-ne0){throw 'Valid flame settings rejected'}
$data=Get-Content -LiteralPath $output -Raw -Encoding utf8|ConvertFrom-Json
$settings=$data.attack_range.enemy.dragon_frost.normal
if($settings.ground_effect_key-ne'fire_ground' -or $settings.ground_effect_duration_seconds-ne3 -or $settings.ground_effect_frame_seconds-ne.12 -or $settings.ground_effect_delay_seconds-ne0){throw 'Flame settings were not serialized'}
$original=[IO.File]::ReadAllText($output)
$rows=@(Import-Csv -LiteralPath (Join-Path $folder 'sheet-attack_range.csv'))
foreach($case in @('unknown_effect','zero_duration','zero_frame','negative_delay','nonfinite','contact')){
    $testRows=@($rows|ForEach-Object {$_.PSObject.Copy()});$target=$testRows|Where-Object {$_.owner_key-eq'dragon_frost' -and $_.action-eq'normal'}
    switch($case){
        'unknown_effect' {$target.ground_effect_key='missing'}
        'zero_duration' {$target.ground_effect_duration_seconds='0'}
        'zero_frame' {$target.ground_effect_frame_seconds='0'}
        'negative_delay' {$target.ground_effect_delay_seconds='-1'}
        'nonfinite' {$target.ground_effect_duration_seconds='NaN'}
        'contact' {$target=$testRows|Where-Object {$_.owner_key-eq'dragon_frost' -and $_.action-eq'contact'};$target.ground_effect_key='fire_ground';$target.ground_effect_duration_seconds='3';$target.ground_effect_frame_seconds='.12';$target.ground_effect_delay_seconds='0'}
    }
    $testRows|Export-Csv -LiteralPath (Join-Path $folder 'sheet-attack_range.csv') -NoTypeInformation -Encoding utf8
    if((Run-Export)-ne2){throw "Invalid case accepted: $case"}
    if([IO.File]::ReadAllText($output)-ne$original){throw "Invalid case overwrote valid output: $case"}
}
$rows|Select-Object enabled,owner_type,owner_key,action,range_px,angle_degrees,notes2|Export-Csv -LiteralPath (Join-Path $folder 'sheet-attack_range.csv') -NoTypeInformation -Encoding utf8
if((Run-Export)-ne0){throw 'Legacy attack_range without ground-effect columns rejected'}
Write-Host 'Ground-effect export: valid settings, references, timings, action restrictions, unchanged output on failure, and legacy compatibility passed'
