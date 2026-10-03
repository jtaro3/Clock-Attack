param(
    [Parameter(Mandatory=$true)][string]$SourceCsvFolder,
    [Parameter(Mandatory=$true)][string]$ProjectFolder,
    [string]$ResultFile,
    [string]$SheetName,
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
$errorReport=Join-Path $env:TEMP ('clock-attack-errors-'+[guid]::NewGuid().ToString('N')+'.txt')
$validationFolder=$null
$pendingFolder=Join-Path $ProjectFolder 'CSV.__pending'
$isPendingSource=[IO.Path]::GetFullPath($SourceCsvFolder).TrimEnd('\') -ieq [IO.Path]::GetFullPath($pendingFolder).TrimEnd('\')
try{
    if(-not(Test-Path -LiteralPath $validator)){throw "検証プログラムが見つかりません: $validator"}
    if([IO.Path]::GetFullPath($SourceCsvFolder).TrimEnd('\') -ieq [IO.Path]::GetFullPath($destination).TrimEnd('\')){throw '本番CSVフォルダーを入力には指定できません。'}
    $csvFiles=@(Get-ChildItem -LiteralPath $SourceCsvFolder -Filter 'sheet-*.csv' -File)
    if($SheetName){
        if($SheetName.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0){throw 'シート名に使用できない文字があります。'}
        $selectedFile="sheet-${SheetName}.csv"
        if($csvFiles.Count -ne 1 -or $csvFiles[0].Name -cne $selectedFile){throw "選択したシートのCSVだけが必要です: $selectedFile"}
        $validationFolder=Join-Path $env:TEMP ('clock-attack-csv-check-'+[guid]::NewGuid().ToString('N'))
        [IO.Directory]::CreateDirectory($validationFolder)|Out-Null
        if(Test-Path -LiteralPath $destination){Get-ChildItem -LiteralPath $destination -Filter 'sheet-*.csv' -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $validationFolder -ErrorAction Stop }}
        Copy-Item -LiteralPath $csvFiles[0].FullName -Destination (Join-Path $validationFolder $selectedFile) -Force
    }
    $inputFolder=if($validationFolder){$validationFolder}else{$SourceCsvFolder}
    try{
        $validation=& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validator -CsvFolder $inputFolder -OutputPath $tempJson -ErrorReportPath $errorReport -Silent 2>&1
    }catch{
        if(Test-Path -LiteralPath $errorReport){throw [IO.File]::ReadAllText($errorReport,[Text.Encoding]::UTF8)}
        throw
    }
    if($LASTEXITCODE-ne0){
        if(Test-Path -LiteralPath $errorReport){throw [IO.File]::ReadAllText($errorReport,[Text.Encoding]::UTF8)}
        throw (($validation|ForEach-Object{$_.ToString()})-join"`n")
    }
    [IO.Directory]::CreateDirectory($destination)|Out-Null
    $csvFiles|ForEach-Object{Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destination $_.Name) -Force}
    Copy-Item -LiteralPath $tempJson -Destination $json -Force
    $count=$csvFiles.Count
    $successMessage=if($SheetName){"OK: ${SheetName}のCSVとJSONを更新しました。"}else{"OK: ${count}シートのCSVとJSONを更新しました。"}
    if($ResultFile){[IO.File]::WriteAllText($ResultFile,$successMessage,[Text.UTF8Encoding]::new($false))}
    if($Silent){[pscustomobject]@{status='ok';sheets=$count;json=$json}|ConvertTo-Json -Compress}else{Show-Result "${count}シートをCSVへ出力し、検証済みJSONを生成しました。`n$destination`n$json" 'CSV・JSON出力完了' 64}
}
catch{
    $message="データに問題があるため、CSVとJSONを更新しませんでした。`n`n$($_.Exception.Message)"
    if($ResultFile){
        # The currently installed Calc macro reads one line from this file.
        $popupMessage="ERROR: " + (($message -replace "[`r`n]+",' / ').Trim())
        [IO.File]::WriteAllText($ResultFile,$popupMessage,[Text.UTF8Encoding]::new($false))
    }
    if($Silent){Write-Error $message}else{Show-Result $message 'CSV・JSON出力エラー' 16}
    exit 1
}
finally{
    Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $errorReport -Force -ErrorAction SilentlyContinue
    if($validationFolder){Remove-Item -LiteralPath $validationFolder -Recurse -Force -ErrorAction SilentlyContinue}
    if($isPendingSource){Remove-Item -LiteralPath $SourceCsvFolder -Recurse -Force -ErrorAction SilentlyContinue}
}
