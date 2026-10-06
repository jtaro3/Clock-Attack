param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$animationRoot = Join-Path $ProjectRoot 'design\enemies'
$distRoot = Join-Path $ProjectRoot 'dist'
$enemies = [ordered]@{}

foreach ($enemy in @(Get-ChildItem -LiteralPath $animationRoot -Directory | Sort-Object Name)) {
 $enemyFrames = [ordered]@{ move = @(); attack = @(); special = @() }
 foreach ($action in @('move', 'attack', 'special')) {
  $sourceFolder = Join-Path $enemy.FullName $action
  $destinationFolder = Join-Path $distRoot "design\enemies\$($enemy.Name)\$action"
  if (-not (Test-Path -LiteralPath $sourceFolder)) { continue }

  New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
  $files = @(Get-ChildItem -LiteralPath $sourceFolder -File |
    Where-Object { $_.Name -match '\d+\.png$' } |
    Sort-Object @{Expression={ [int]([regex]::Match($_.Name, '(\d+)\.png$', 'IgnoreCase').Groups[1].Value) }}, Name)

  foreach ($file in $files) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destinationFolder $file.Name) -Force
    $enemyFrames[$action] += "design/enemies/$($enemy.Name)/$action/$($file.Name)"
  }
 }
 if ($enemyFrames.move.Count -or $enemyFrames.attack.Count -or $enemyFrames.special.Count) { $enemies[$enemy.Name] = $enemyFrames }
}

$manifest = [ordered]@{ enemies = $enemies }
$json = (ConvertTo-Json -InputObject $manifest -Depth 10) + "`n"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $ProjectRoot 'animation-manifest.json'), $json, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $distRoot 'animation-manifest.json'), $json, $utf8NoBom)

Write-Host "Generated animation-manifest.json ($($enemies.Count) enemies)."
