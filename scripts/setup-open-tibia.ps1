$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ThirdParty = Join-Path $ProjectRoot 'third_party'
$OtClientPath = Join-Path $ThirdParty 'otclient'
$TfsPath = Join-Path $ThirdParty 'forgottenserver'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git was not found. Install Git for Windows, reopen PowerShell, then rerun this script.'
}
New-Item -ItemType Directory -Path $ThirdParty -Force | Out-Null

if (-not (Test-Path (Join-Path $OtClientPath '.git'))) {
    if (Test-Path $OtClientPath) { throw "$OtClientPath exists but is not a Git checkout. Move it aside or choose another path." }
    Write-Host 'Cloning OTClient Redemption (main branch). Internet access is required.' -ForegroundColor Cyan
    & git clone --depth 1 https://github.com/opentibiabr/otclient.git $OtClientPath
    if ($LASTEXITCODE -ne 0) { throw 'OTClient clone failed. No project files have been modified.' }
} else {
    Write-Host 'OTClient checkout already exists; leaving it unchanged.'
}

if (-not (Test-Path (Join-Path $TfsPath '.git'))) {
    if (Test-Path $TfsPath) { throw "$TfsPath exists but is not a Git checkout. Move it aside or choose another path." }
    Write-Host 'Cloning The Forgotten Server stable v1.6 (protocol 13.10). Internet access is required.' -ForegroundColor Cyan
    & git clone --depth 1 --branch v1.6 https://github.com/otland/forgottenserver.git $TfsPath
    if ($LASTEXITCODE -ne 0) { throw 'TFS v1.6 clone failed. Check the upstream tag and network connectivity.' }
} else {
    Write-Host 'TFS checkout already exists; leaving it unchanged.'
}

$OtClientSha = (& git -C $OtClientPath rev-parse HEAD).Trim()
$TfsSha = (& git -C $TfsPath rev-parse HEAD).Trim()
$LockPath = Join-Path (Join-Path $ProjectRoot 'docs') 'third-party-lock.txt'
@(
    "OTClient Redemption: https://github.com/opentibiabr/otclient.git"
    "OTClient commit: $OtClientSha"
    "TFS: https://github.com/otland/forgottenserver.git"
    "TFS tag: v1.6"
    "TFS commit: $TfsSha"
    "Protocol target: 13.10"
    "Captured: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK')"
) | Set-Content -Path $LockPath -Encoding UTF8

Write-Host "Upstream sources are ready under $ThirdParty" -ForegroundColor Green
Write-Host "Recorded exact checkout IDs in $LockPath" -ForegroundColor Green
Write-Host 'Next: run scripts\install-open-tibia-integration.ps1, obtain properly licensed matching map/assets, and build/test.' -ForegroundColor Yellow
