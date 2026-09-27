$ErrorActionPreference = 'Stop'
$projectFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $projectFolder 'macros\ExportAllSheetsToCSV_Calc.bas'
$target = Join-Path $env:APPDATA 'LibreOffice\4\user\basic\Standard\Module1.xba'
if (Get-Process -Name soffice.bin -ErrorAction SilentlyContinue) {
    throw 'Save the workbook and close every LibreOffice window before installing the macro.'
}
if (-not (Test-Path -LiteralPath $source)) { throw "Macro source not found: $source" }
if (-not (Test-Path -LiteralPath $target)) { throw "LibreOffice macro target not found: $target" }
$backup = $target + '.before-clock-attack-' + (Get-Date -Format 'yyyyMMddHHmmss')
Copy-Item -LiteralPath $target -Destination $backup
$code = [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8)
$encoded = [System.Security.SecurityElement]::Escape($code)
$xml = '<?xml version="1.0" encoding="UTF-8"?>' + "`n" +
    '<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">' + "`n" +
    '<script:module xmlns:script="http://openoffice.org/2000/script" script:name="Module1" script:language="StarBasic">' + $encoded + '</script:module>'
[IO.File]::WriteAllText($target, $xml, [Text.UTF8Encoding]::new($false))
Write-Host "Installed Calc CSV macro. Backup: $backup"
