param(
    [Parameter(Mandatory = $true)][string]$OTClientPath,
    [Parameter(Mandatory = $true)][string]$TFSPath
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ModSource = Join-Path $ProjectRoot 'integrations\otclient-redemption\mods'
$ServerSource = Join-Path $ProjectRoot 'integrations\tfs-1.6\cultivation_system.lua'
$ResolvedOTC = (Resolve-Path $OTClientPath).Path
$ResolvedTFS = (Resolve-Path $TFSPath).Path

if (-not (Test-Path (Join-Path $ResolvedOTC 'mods'))) { throw "No mods folder found in OTClient checkout: $ResolvedOTC" }
if (-not (Test-Path (Join-Path $ResolvedTFS 'data\scripts'))) { throw "No data\scripts folder found in TFS checkout: $ResolvedTFS" }

foreach ($file in @('cultivation_mobile.otmod', 'cultivation_mobile.lua', 'cultivation_mobile.otui')) {
    $destination = Join-Path (Join-Path $ResolvedOTC 'mods') $file
    if (Test-Path $destination) {
        $backup = "$destination.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $destination $backup
        Write-Host "Backed up existing $file to $backup" -ForegroundColor Yellow
    }
    Copy-Item (Join-Path $ModSource $file) $destination -Force
}

$serverDestination = Join-Path $ResolvedTFS 'data\scripts\cultivation_system.lua'
if (Test-Path $serverDestination) {
    $backup = "$serverDestination.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $serverDestination $backup
    Write-Host "Backed up existing cultivation server script to $backup" -ForegroundColor Yellow
}
Copy-Item $ServerSource $serverDestination -Force

Write-Host 'Installed the Cultivation Mobile OTClient mod and TFS server script.' -ForegroundColor Green
Write-Host 'This does not create or install a map or game assets. Obtain matching, licensed protocol 13.10 content before launching a world.' -ForegroundColor Yellow
Write-Host 'Review the upstream logs after the first launch; this integration has not yet been verified against built upstream binaries in this environment.' -ForegroundColor Yellow
