param([switch]$OpenEditor)
$ErrorActionPreference = 'Stop'
try {
    $masterPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'game-data.json'
    $paletteSettings = @{}
    $previewScale = 1
    if (Test-Path -LiteralPath $masterPath -PathType Leaf) {
        $master = Get-Content -LiteralPath $masterPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($master.player.player_scale -gt 0) { $previewScale = $master.player.player_scale }
        foreach ($setting in $master.map_tiles) {
            if ($setting.palette_color -and $setting.palette_color -notmatch '^#[0-9a-fA-F]{6}$') { throw ('Invalid palette_color: '+$setting.sprite_file) }
            $paletteSettings[$setting.sprite_file] = $setting
        }
    }
    $tileFolder = Join-Path $PSScriptRoot 'maps\tiles'
    $objectFolder = Join-Path $PSScriptRoot 'maps\object'
    $tileFiles = @(Get-ChildItem -LiteralPath $tileFolder -File -Filter '*.png' | Sort-Object Name)
    $objectFiles = @()
    if (Test-Path -LiteralPath $objectFolder -PathType Container) {
        $objectFiles = @(Get-ChildItem -LiteralPath $objectFolder -File -Filter '*.png' | Sort-Object Name)
    }
    if ($tileFiles.Count + $objectFiles.Count -eq 0) { throw 'No PNG tiles or objects found in maps/tiles or maps/object.' }
    $orderedFiles = [Collections.Generic.List[object]]::new()
    foreach ($legacyName in @('grass.png','grass-dark.png','flowers.png','soil.png')) {
        $match = $tileFiles | Where-Object Name -eq $legacyName
        if ($match) { $orderedFiles.Add($match) }
    }
    foreach ($pngFile in $tileFiles) {
        if ($pngFile.Name -notin @('grass.png','grass-dark.png','flowers.png','soil.png')) { $orderedFiles.Add($pngFile) }
    }
    foreach ($pngFile in $objectFiles) { $orderedFiles.Add($pngFile) }
    $duplicateNames = @($orderedFiles | Group-Object Name | Where-Object Count -gt 1)
    if ($duplicateNames.Count -gt 0) { throw ('Duplicate PNG filenames across maps/tiles and maps/object: '+(($duplicateNames | ForEach-Object Name) -join ', ')) }
    $catalog = @()
    foreach ($pngFile in $orderedFiles) {
        $pngBytes = [IO.File]::ReadAllBytes($pngFile.FullName)
        if ($pngBytes.Length -lt 24 -or [BitConverter]::ToString($pngBytes,0,8) -ne '89-50-4E-47-0D-0A-1A-0A') { throw ('Invalid PNG: '+$pngFile.Name) }
        $width = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($pngBytes,16))
        $height = [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($pngBytes,20))
        if ($width -lt 32 -or $height -lt 32 -or $width % 32 -ne 0 -or $height % 32 -ne 0) { throw ('PNG size must be a multiple of 32: '+$pngFile.Name+' ('+$width+'x'+$height+')') }
        $category = if ($pngFile.DirectoryName -eq $objectFolder) { 'object' } else { 'ground' }
        $setting = $paletteSettings[$pngFile.Name]
        $catalog += [ordered]@{ file=$pngFile.Name; category=$category; palette_category=if($setting){[string]$setting.category}else{''}; palette_color=if($setting){[string]$setting.palette_color}else{''}; walkable=if($setting -and $null -ne $setting.walkable){[bool]$setting.walkable}else{$true}; collision_length=if($setting){[double]$setting.collision_length}else{0}; collision_width=if($setting){[double]$setting.collision_width}else{0}; width_tiles=($width/32); height_tiles=($height/32); image=('data:image/png;base64,'+[Convert]::ToBase64String($pngBytes)) }
    }
    $json = ConvertTo-Json -InputObject $catalog -Depth 4 -Compress
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'tile-catalog.js'),('window.ClockAttackTileCatalog='+$json+';window.ClockAttackPreviewScale='+$previewScale.ToString([Globalization.CultureInfo]::InvariantCulture)+';'),[Text.UTF8Encoding]::new($false))
    $groundCount = @($catalog | Where-Object category -eq 'ground').Count
    $objectCount = @($catalog | Where-Object category -eq 'object').Count
    Write-Host ('OK: '+$groundCount+' ground tiles and '+$objectCount+' objects registered.')
    if ($OpenEditor) { Start-Process -FilePath (Join-Path $PSScriptRoot 'index.html') -WindowStyle Hidden }
} catch {
    Write-Host ('ERROR: '+$_.Exception.Message) -ForegroundColor Red
    exit 1
}
