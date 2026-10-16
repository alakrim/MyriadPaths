$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Apk = Join-Path $ProjectRoot 'dist\ImmortalFrontier-debug.apk'
if (-not (Test-Path $Apk)) { throw "APK not found at $Apk. Run .\scripts\build-apk.ps1 first." }
$Adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $Adb) {
    $SdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) | Where-Object { $_ -and (Test-Path $_) }
    $AdbPath = $SdkCandidates | ForEach-Object { Join-Path $_ 'platform-tools\adb.exe' } | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($AdbPath) { $Adb = @{ Source = $AdbPath } }
}
if (-not $Adb) { throw 'Android Debug Bridge (adb) was not found. Install Android SDK Platform Tools and ensure USB debugging is enabled.' }
$AdbExe = if ($Adb.Source) { $Adb.Source } else { $Adb }
& $AdbExe devices
if ($LASTEXITCODE -ne 0) { throw 'adb could not enumerate devices.' }
Write-Host 'Installing debug APK on the connected device...' -ForegroundColor Cyan
& $AdbExe install -r $Apk
if ($LASTEXITCODE -ne 0) { throw 'Installation failed. Check that a device is authorized in adb and inspect the install error.' }
Write-Host 'APK install command succeeded. Launch and test the app manually on the phone.' -ForegroundColor Green
