# Generates the app icons and splash images of the native projects from the owner's icon files
# (kept outside the repository, docs/11a-device-build.md). Windows PowerShell 5.1, no extra tools:
#   powershell -ExecutionPolicy Bypass -File scripts/native/make-icons.ps1 [-Source <folder>]
# The results are committed; run it again only when the icon files change.
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\..\..\tippy-treats-store-assets')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$iosIcon = Join-Path $Source 'tippy-icon-ios-1024.png'
$fgFile = Join-Path $Source 'tippy-icon-android-foreground-1024.png'
$bgFile = Join-Path $Source 'tippy-icon-android-background-1024.png'
foreach ($file in @($iosIcon, $fgFile, $bgFile)) {
  if (-not (Test-Path $file)) { throw "Missing icon file: $file" }
}

# The splash and launch background: the page background of the game (src/style.css).
$splashColor = [System.Drawing.Color]::FromArgb(255, 0x2b, 0x1d, 0x16)

function New-Canvas([int]$size, [System.Drawing.Imaging.PixelFormat]$format) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, $format)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @($bitmap, $graphics)
}

# Draws `image` (or its centred square part `cropShare` wide) scaled into the whole canvas.
function Draw-Scaled($graphics, $image, [int]$size, [double]$cropShare = 1.0) {
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $side = $image.Width * $cropShare
  $offset = ($image.Width - $side) / 2
  $dest = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $graphics.DrawImage($image, $dest, [single]$offset, [single]$offset, [single]$side, [single]$side, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
}

function Save-Png($bitmap, [string]$path) {
  New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# iOS: one 1024 px icon without transparency (Xcode makes the other sizes).
$ios = [System.Drawing.Image]::FromFile($iosIcon)
$canvas = New-Canvas 1024 ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
Draw-Scaled $canvas[1] $ios 1024
Save-Png $canvas[0] (Join-Path $root 'ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png')
$canvas[1].Dispose(); $canvas[0].Dispose(); $ios.Dispose()

# iOS: launch screen and splash image, one plain colour (the plugin shows it until the game is ready).
foreach ($name in @('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png')) {
  $canvas = New-Canvas 2732 ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $canvas[1].Clear($splashColor)
  Save-Png $canvas[0] (Join-Path $root "ios\App\App\Assets.xcassets\Splash.imageset\$name")
  $canvas[1].Dispose(); $canvas[0].Dispose()
}

# Android: adaptive icon layers (108 dp) and the legacy icons (48 dp) for Android 7.
$fg = [System.Drawing.Image]::FromFile($fgFile)
$bg = [System.Drawing.Image]::FromFile($bgFile)
$densities = [ordered]@{ mdpi = 1.0; hdpi = 1.5; xhdpi = 2.0; xxhdpi = 3.0; xxxhdpi = 4.0 }
$argb = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
foreach ($density in $densities.Keys) {
  $scale = $densities[$density]
  $res = Join-Path $root "android\app\src\main\res\mipmap-$density"
  $layer = [int](108 * $scale)
  foreach ($pair in @(@('ic_launcher_foreground.png', $fg), @('ic_launcher_background.png', $bg))) {
    $canvas = New-Canvas $layer $argb
    Draw-Scaled $canvas[1] $pair[1] $layer
    Save-Png $canvas[0] (Join-Path $res $pair[0])
    $canvas[1].Dispose(); $canvas[0].Dispose()
  }
  # A legacy icon shows the part of the layers a launcher mask shows: the middle 72 of 108 dp.
  $legacy = [int](48 * $scale)
  $canvas = New-Canvas $legacy $argb
  Draw-Scaled $canvas[1] $bg $legacy (72 / 108)
  Draw-Scaled $canvas[1] $fg $legacy (72 / 108)
  Save-Png $canvas[0] (Join-Path $res 'ic_launcher.png')
  $square = $canvas[0]
  $round = New-Canvas $legacy $argb
  $round[1].Clear([System.Drawing.Color]::Transparent)
  $brush = New-Object System.Drawing.TextureBrush($square)
  $round[1].FillEllipse($brush, 0, 0, $legacy, $legacy)
  Save-Png $round[0] (Join-Path $res 'ic_launcher_round.png')
  $brush.Dispose(); $round[1].Dispose(); $round[0].Dispose(); $canvas[1].Dispose(); $square.Dispose()
}
$fg.Dispose(); $bg.Dispose()
Write-Output 'icons: ok'
