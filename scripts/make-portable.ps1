param(
  [switch]$UseSystem7Zip
)

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Write-Host "Project root: $projectRoot"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Warning: not running as Administrator. Some operations (like creating symlinks) may fail. Consider running PowerShell as Administrator." -ForegroundColor Yellow
}

Write-Host "Stopping potential running processes related to the app..."
try {
  Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and ($_.Path -like "*$($projectRoot)*" -or $_.Name -in @("Lovecraft","lovecraft"))
  } | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Host "Stopped process $($_.Name) ($($_.Id))" } catch {}
  }
} catch {}

$cache = Join-Path $env:LOCALAPPDATA "electron-builder\Cache"
if (Test-Path $cache) {
  Write-Host "Removing electron-builder cache: $cache"
  try { Remove-Item -Recurse -Force $cache -ErrorAction SilentlyContinue; Write-Host "Cache removed." } catch { Write-Host "Failed to remove cache: $_" -ForegroundColor Red }
} else { Write-Host "No electron-builder cache found at $cache" }

if ($UseSystem7Zip) {
  Write-Host "Using system 7z for extraction in this session." -ForegroundColor Cyan
  $env:USE_SYSTEM_7ZIP = "1"
} else {
  Write-Host "To force use of system 7z, re-run with -UseSystem7Zip." -ForegroundColor Gray
}

Write-Host "Running 'npm run pack' to produce an unpacked folder..." -ForegroundColor Green
Write-Host "Running 'npm run pack' to produce an unpacked folder..."

# Use cmd.exe /c to invoke npm on Windows to avoid Start-Process trying to execute a non-exe shim
$cmdPath = (Get-Command cmd.exe -ErrorAction SilentlyContinue).Source
if (-not $cmdPath) {
  Write-Host "cmd.exe not found; attempting to run npm directly." -ForegroundColor Yellow
  try {
    & npm run pack
    $exitCode = $LASTEXITCODE
  } catch {
    Write-Host "Failed to run npm: $_" -ForegroundColor Red
    exit 1
  }
} else {
  $proc = Start-Process -FilePath $cmdPath -ArgumentList '/c','npm run pack' -NoNewWindow -Wait -PassThru
  $exitCode = $proc.ExitCode
}

if ($exitCode -ne 0) { Write-Host "npm run pack failed with exit code $exitCode" -ForegroundColor Red; exit $exitCode }

$distDir = Join-Path $projectRoot "dist"
$unpacked = Get-ChildItem -Path $distDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*unpacked*" -or $_.Name -eq "win-unpacked" } | Select-Object -First 1
if (-not $unpacked) {
  Write-Host "Could not find unpacked build folder under $distDir" -ForegroundColor Red
  exit 1
}
Write-Host "Found unpacked folder: $($unpacked.FullName)"

$targetResources = Join-Path $unpacked.FullName "resources\app"
if (-not (Test-Path $targetResources)) {
  Write-Host "Resources folder not found at $targetResources; creating..."
  New-Item -ItemType Directory -Path $targetResources -Force | Out-Null
}

$videoSrc = Join-Path $projectRoot "Video.mp4"
if (Test-Path $videoSrc) {
  Write-Host "Copying Video.mp4 to $targetResources"
  try { Copy-Item -Path $videoSrc -Destination $targetResources -Force; Write-Host "Video copied." } catch { Write-Host "Failed to copy video: $_" -ForegroundColor Red }
} else {
  Write-Host "No Video.mp4 in project root; skipping copy. Place your Video.mp4 at project root to include it in the portable folder." -ForegroundColor Yellow
}

$zipPath = Join-Path $projectRoot "dist\Lovecraft-portable.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Write-Host "Creating ZIP $zipPath ..."
try {
  Compress-Archive -Path (Join-Path $unpacked.FullName "*") -DestinationPath $zipPath -Force
  Write-Host "Portable ZIP created at: $zipPath" -ForegroundColor Green
} catch { Write-Host "Failed to create ZIP: $_" -ForegroundColor Red }

Write-Host "Done. If you need symlink creation or signing, run this script in an elevated session (Administrator)." -ForegroundColor Cyan
