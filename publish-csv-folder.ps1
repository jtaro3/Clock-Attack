param(
    [Parameter(Mandatory=$true)][string]$SourceCsvFolder,
    [Parameter(Mandatory=$true)][string]$ProjectFolder,
    [string]$ResultFile,
    [switch]$Silent
)
$ErrorActionPreference='Stop'
function Show-Result([string]$Message,[string]$Title,[int]$Icon){
    if($Silent){return}
    Add-Type -AssemblyName System.Windows.Forms
    $owner=New-Object System.Windows.Forms.Form
    $owner.TopMost=$true
    $owner.ShowInTaskbar=$false
    try{
        $buttons=[System.Windows.Forms.MessageBoxButtons]::OK
        $icon=if($Icon -eq 16){[System.Windows.Forms.MessageBoxIcon]::Error}else{[System.Windows.Forms.MessageBoxIcon]::Information}
        [System.Windows.Forms.MessageBox]::Show($owner,$Message,$Title,$buttons,$icon)|Out-Null
    }finally{$owner.Dispose()}
}
$validator=Join-Path $ProjectFolder 'csv-to-game-data.ps1'
$destination=Join-Path $ProjectFolder 'CSV'
$json=Join-Path $ProjectFolder 'game-data.json'
$tempJson=Join-Path $env:TEMP ('clock-attack-data-'+[guid]::NewGuid().ToString('N')+'.json')
$pendingFolder=Join-Path $ProjectFolder 'CSV.__pending'
$isPendingSource=[IO.Path]::GetFullPath($SourceCsvFolder).TrimEnd('\') -ieq [IO.Path]::GetFullPath($pendingFolder).TrimEnd('\')
try{
    if(-not(Test-Path -LiteralPath $validator)){throw "検証プログラムが見つかりません: $validator"}
    if([IO.Path]::GetFullPath($SourceCsvFolder).TrimEnd('\') -ieq [IO.Path]::GetFullPath($destination).TrimEnd('\')){throw '本番CSVフォルダーを入力には指定できません。'}
    $validation=& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validator -CsvFolder $SourceCsvFolder -OutputPath $tempJson -Silent 2>&1
    if($LASTEXITCODE-ne0){throw (($validation|ForEach-Object{$_.ToString()})-join"`n")}
    [IO.Directory]::CreateDirectory($destination)|Out-Null
    Get-ChildItem -LiteralPath $SourceCsvFolder -Filter 'sheet-*.csv'|ForEach-Object{Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destination $_.Name) -Force}
    Copy-Item -LiteralPath $tempJson -Destination $json -Force
    $count=(Get-ChildItem -LiteralPath $SourceCsvFolder -Filter 'sheet-*.csv').Count
    if($ResultFile){[IO.File]::WriteAllText($ResultFile,"OK: ${count}シートのCSVとJSONを更新しました。",[Text.UTF8Encoding]::new($false))}
    if($Silent){[pscustomobject]@{status='ok';sheets=$count;json=$json}|ConvertTo-Json -Compress}else{Show-Result "${count}シートをCSVへ出力し、検証済みJSONを生成しました。`n$destination`n$json" 'CSV・JSON出力完了' 64}
}
catch{
    $message="データに問題があるため、CSVとJSONを更新しませんでした。`n`n$($_.Exception.Message)"
    if($ResultFile){[IO.File]::WriteAllText($ResultFile,"ERROR: " + ($message -replace "[`r`n]+",' '),[Text.UTF8Encoding]::new($false))}
    if($Silent){Write-Error $message}else{Show-Result $message 'CSV・JSON出力エラー' 16}
    exit 1
}
finally{
    Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue
    if($isPendingSource){Remove-Item -LiteralPath $SourceCsvFolder -Recurse -Force -ErrorAction SilentlyContinue}
}
