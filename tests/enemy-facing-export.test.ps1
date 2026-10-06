$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $env:TEMP ('clock-enemy-facing-test-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($folder)|Out-Null
Get-ChildItem -LiteralPath (Join-Path $project 'CSV') -Filter '*.csv' -File | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $folder}
$path=Join-Path $folder 'sheet-enemy.csv'
$rows=@(Import-Csv -LiteralPath $path -Encoding utf8 | ForEach-Object {$clean=[ordered]@{};foreach($p in $_.PSObject.Properties){$clean[$p.Name.Trim()]=$p.Value};[pscustomobject]$clean})
$active=@($rows|Where-Object {$_.enabled-eq'1'})[0]
$output=Join-Path $folder 'result.json'
foreach($value in @('left ','right ','','up')){
    $active.sprite_facing=$value
    $rows|Export-Csv -LiteralPath $path -NoTypeInformation -Encoding utf8
    [IO.File]::WriteAllText($output,'unchanged')
    $ErrorActionPreference='Continue'
    $validationOutput=& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $project 'csv-to-game-data.ps1') -CsvFolder $folder -OutputPath $output -Silent 2>&1
    $validationExit=$LASTEXITCODE
    $ErrorActionPreference='Stop'
    if($value-eq'up'){
        if($validationExit-ne2){throw 'Invalid facing must fail validation'}
        if((Get-Content -LiteralPath $output -Raw)-ne'unchanged'){throw 'Invalid input overwrote JSON'}
    }else{
        if($validationExit-ne0){throw 'Valid facing failed validation'}
        $data=Get-Content -LiteralPath $output -Raw -Encoding utf8|ConvertFrom-Json
        $expected=if($value.Trim()){$value.Trim()}else{'right'}
        if($data.enemies.($active.enemy_key).sprite_facing-ne$expected){throw 'Facing trim/default failed'}
    }
}
Write-Output 'Enemy facing export: trims spaces, defaults blank to right, rejects invalid values without overwriting JSON'
