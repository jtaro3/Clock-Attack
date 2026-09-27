param(
    [string]$WorkbookPath = 'C:\Users\hikar\OneDrive\ドキュメント\GitHub\Clock-Attack\main.xlsm',
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'

function Convert-ToCsvField {
    param([AllowNull()]$Value)
    if ($null -eq $Value) { return '' }
    $text = [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
    if ($text.Contains('"')) { $text = $text.Replace('"', '""') }
    if ($text.Contains(',') -or $text.Contains('"') -or $text.Contains("`r") -or $text.Contains("`n")) {
        return '"' + $text + '"'
    }
    return $text
}

function Convert-ToSafeFileName {
    param([string]$Name)
    foreach ($character in [IO.Path]::GetInvalidFileNameChars()) {
        $Name = $Name.Replace([string]$character, '_')
    }
    return $Name
}

function Show-Result {
    param([string]$Message, [string]$Title, [int]$Icon)
    if ($Silent) { return }
    $popup = New-Object -ComObject WScript.Shell
    try { $popup.Popup($Message, 0, $Title, $Icon) | Out-Null }
    finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($popup) }
}

$resolvedWorkbookPath = (Resolve-Path -LiteralPath $WorkbookPath).Path
$projectFolder = Split-Path -Parent $resolvedWorkbookPath
$outputFolder = Join-Path $projectFolder 'CSV'
$validatorPath = Join-Path $projectFolder 'csv-to-game-data.ps1'
$jsonPath = Join-Path $projectFolder 'game-data.json'
$tempRoot = Join-Path $env:TEMP ('clock-attack-export-' + [guid]::NewGuid().ToString('N'))
$tempCsvFolder = Join-Path $tempRoot 'CSV'
$tempJsonPath = Join-Path $tempRoot 'game-data.json'
$utf8Bom = New-Object Text.UTF8Encoding($true)

$excel = $null
$workbook = $null

try {
    if (-not (Test-Path -LiteralPath $validatorPath)) {
        throw "検証プログラムが見つかりません: $validatorPath"
    }
    [IO.Directory]::CreateDirectory($tempCsvFolder) | Out-Null

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $workbook = $excel.Workbooks.Open($resolvedWorkbookPath, 0, $true)

    $exported = 0
    foreach ($worksheet in @($workbook.Worksheets)) {
        $lastRowCell = $worksheet.Cells.Find('*', $worksheet.Cells.Item(1, 1), -4123, 2, 1, 2, $false)
        $lastColumnCell = $worksheet.Cells.Find('*', $worksheet.Cells.Item(1, 1), -4123, 2, 2, 2, $false)
        $lines = New-Object Collections.Generic.List[string]

        if ($null -ne $lastRowCell -and $null -ne $lastColumnCell) {
            $lastRow = [int]$lastRowCell.Row
            $lastColumn = [int]$lastColumnCell.Column
            while ($lastColumn -gt 1 -and [string]::IsNullOrWhiteSpace([string]$worksheet.Cells.Item(1, $lastColumn).Value2)) {
                $lastColumn--
            }
            for ($row = 1; $row -le $lastRow; $row++) {
                $fields = New-Object Collections.Generic.List[string]
                $hasValue = $false
                for ($column = 1; $column -le $lastColumn; $column++) {
                    $value = $worksheet.Cells.Item($row, $column).Value2
                    if (-not [string]::IsNullOrWhiteSpace([string]$value)) { $hasValue = $true }
                    $fields.Add((Convert-ToCsvField $value))
                }
                if ($hasValue) { $lines.Add(($fields -join ',')) }
            }
        }

        $safeSheetName = Convert-ToSafeFileName $worksheet.Name
        $csvPath = Join-Path $tempCsvFolder ("sheet-{0}.csv" -f $safeSheetName)
        $body = ($lines -join "`r`n") + $(if ($lines.Count -gt 0) { "`r`n" } else { '' })
        [IO.File]::WriteAllText($csvPath, $body, $utf8Bom)
        $exported++
    }

    $validatorOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validatorPath -CsvFolder $tempCsvFolder -OutputPath $tempJsonPath -Silent 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw (($validatorOutput | ForEach-Object { $_.ToString() }) -join "`n")
    }

    [IO.Directory]::CreateDirectory($outputFolder) | Out-Null
    Get-ChildItem -LiteralPath $tempCsvFolder -Filter 'sheet-*.csv' | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $outputFolder $_.Name) -Force
    }
    Copy-Item -LiteralPath $tempJsonPath -Destination $jsonPath -Force

    $successMessage = "${exported}シートをCSVへ出力し、検証済みJSONを生成しました。`n${outputFolder}`n${jsonPath}"
    if ($Silent) {
        [pscustomobject]@{ ExportedSheets = $exported; OutputFolder = $outputFolder; JsonPath = $jsonPath } | ConvertTo-Json
    }
    else { Show-Result $successMessage 'CSV・JSON出力完了' 64 }
}
catch {
    $message = "データに問題があるため、CSVとJSONを更新しませんでした。`n`n$($_.Exception.Message)"
    if ($Silent) { Write-Error $message }
    else { Show-Result $message 'CSV・JSON出力エラー' 16 }
    exit 1
}
finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    foreach ($item in @($workbook, $excel)) {
        if ($null -ne $item) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($item) }
    }
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
