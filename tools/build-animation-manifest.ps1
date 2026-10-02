param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$animationRoot = Join-Path $ProjectRoot 'design\Animation\enemies'
$distRoot = Join-Path $ProjectRoot 'dist'
$enemyFrames = [ordered]@{ move = @(); attack = @() }

foreach ($action in @('move', 'attack')) {
  $sourceFolder = Join-Path $animationRoot $action
  $destinationFolder = Join-Path $distRoot "design\Animation\enemies\$action"
  if (-not (Test-Path -LiteralPath $sourceFolder)) { continue }

  New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
  $files = Get-ChildItem -LiteralPath $sourceFolder -File |
    Where-Object { $_.Name -match '^slime_blue_(\d+)\.png$' } |
    Sort-Object { [int]([regex]::Match($_.Name, '^slime_blue_(\d+)\.png$').Groups[1].Value) }

  foreach ($file in $files) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destinationFolder $file.Name) -Force
    $enemyFrames[$action] += "design/Animation/enemies/$action/$($file.Name)"
  }
}

$manifest = [ordered]@{ enemies = [ordered]@{ slime_blue = $enemyFrames } }
$json = ConvertTo-Json -InputObject $manifest -Depth 10
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $ProjectRoot 'animation-manifest.json'), $json, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $distRoot 'animation-manifest.json'), $json, $utf8NoBom)

Write-Host "Generated animation-manifest.json ($($enemyFrames.move.Count) move, $($enemyFrames.attack.Count) attack frames)."
