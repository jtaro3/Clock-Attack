$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonPath = Join-Path $env:USERPROFILE 'AppData\Local\Python\bin\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { $pythonPath = $python.Source }
}
if (-not (Test-Path -LiteralPath $pythonPath)) {
    Write-Host 'Python was not found. Install Python or start a local HTTP server in this folder.'
    exit 1
}
Write-Host 'Open http://127.0.0.1:8000/ in your browser.'
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
& $pythonPath -m http.server 8000 --bind 127.0.0.1
exit $LASTEXITCODE
