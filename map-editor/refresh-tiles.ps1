param([switch]$OpenEditor)
$ErrorActionPreference = 'Stop'
try {
    $tileFolder = Join-Path $PSScriptRoot 'maps\tiles'
    $pngFiles = @(Get-ChildItem -LiteralPath $tileFolder -File -Filter '*.png' | Sort-Object Name)
    if ($pngFiles.Count -eq 0) { throw 'No PNG tiles found in maps/tiles.' }
    $orderedFiles = [Collections.Generic.List[object]]::new()
    foreach ($legacyName in @('grass.png','grass-dark.png','flowers.png','soil.png')) {
        $match = $pngFiles | Where-Object Name -eq $legacyName
        if ($match) { $orderedFiles.Add($match) }
    }
    foreach ($pngFile in $pngFiles) {
        if ($pngFile.Name -notin @('grass.png','grass-dark.png','flowers.png','soil.png')) { $orderedFiles.Add($pngFile) }
    }
    $catalog = @()
    foreach ($pngFile in $orderedFiles) {
        $pngBytes = [IO.File]::ReadAllBytes($pngFile.FullName)
        if ($pngBytes.Length -lt 24 -or [BitConverter]::ToString($pngBytes,0,8) -ne '89-50-4E-47-0D-0A-1A-0A') { throw ('Invalid PNG: '+$pngFile.Name) }
        $width = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($pngBytes,16))
        $height = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($pngBytes,20))
        if ($width -lt 32 -or $height -lt 32 -or $width % 32 -ne 0 -or $height % 32 -ne 0) { throw ('PNG size must be a multiple of 32: '+$pngFile.Name+' ('+$width+'x'+$height+')') }
        $catalog += [ordered]@{ file=$pngFile.Name; width_tiles=($width/32); height_tiles=($height/32); image=('data:image/png;base64,'+[Convert]::ToBase64String($pngBytes)) }
    }
    $json = ConvertTo-Json -InputObject $catalog -Depth 4 -Compress
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'tile-catalog.js'),('window.ClockAttackTileCatalog='+$json+';'),[Text.UTF8Encoding]::new($false))
    Write-Host ('OK: '+$catalog.Count+' tiles registered.')
    if ($OpenEditor) { Start-Process -FilePath (Join-Path $PSScriptRoot 'index.html') -WindowStyle Hidden }
} catch {
    Write-Host ('ERROR: '+$_.Exception.Message) -ForegroundColor Red
    exit 1
}