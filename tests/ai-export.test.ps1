$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$testFolder=Join-Path $env:TEMP ('clock-ai-export-test-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testFolder)|Out-Null
Copy-Item -Path (Join-Path $project 'CSV\*.csv') -Destination $testFolder
$source=@(Import-Csv (Join-Path $project 'CSV\sheet-AI.csv') | Where-Object {$_.enabled -eq '1'})[0]
foreach($count in @(1,2,0)){
    $rows=@();foreach($i in 1..([Math]::Max(1,$count))){
        $row=$source.PSObject.Copy();$row.enabled=if($count -eq 0){'0'}else{'1'};$row.ai_type='test'+$i;$row.ai_wait_seconds='0.3';$rows+=$row
    }
    $rows|Export-Csv (Join-Path $testFolder 'sheet-AI.csv') -NoTypeInformation -Encoding utf8
    $output=Join-Path $testFolder ('result-'+$count+'.json')
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $project 'csv-to-game-data.ps1') -CsvFolder $testFolder -OutputPath $output -Silent
    if($LASTEXITCODE -ne 0){throw 'Export failed'}
    $data=Get-Content $output -Raw -Encoding utf8|ConvertFrom-Json
    $actual=@($data.ai.PSObject.Properties).Count
    if($actual -ne $count){throw "Expected $count AI rows; got $actual"}
    if($count -gt 0 -and $data.ai.test1.ai_wait_seconds -ne 0.3){throw 'AI value mismatch'}
}
Write-Output 'Windows PowerShell AI export: 0, 1, 2 active rows passed'
