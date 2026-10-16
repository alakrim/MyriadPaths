$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$AndroidRoot = Join-Path $ProjectRoot 'android'
$Dist = Join-Path $ProjectRoot 'dist'

function Find-CommandPath([string]$Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$Python = Find-CommandPath 'python'
if (-not $Python) { $Python = Find-CommandPath 'py' }
if (-not $Python) { throw 'Python 3 is required to bundle the Android assets. Install Python and reopen PowerShell.' }
if ((Split-Path -Leaf $Python) -eq 'py.exe') {
    & $Python -3 (Join-Path $ProjectRoot 'scripts\build-android-assets.py')
} else {
    & $Python (Join-Path $ProjectRoot 'scripts\build-android-assets.py')
}
if ($LASTEXITCODE -ne 0) { throw 'Android asset bundling failed. Do not attempt to build a stale APK.' }

$SdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'), (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk')) | Where-Object { $_ -and (Test-Path $_) }
$Sdk = $SdkCandidates | Select-Object -First 1
if (-not $Sdk -or -not (Test-Path (Join-Path $Sdk 'platforms\android-35\android.jar'))) {
    throw 'Android SDK Platform 35 was not found. Install Android Studio and Android SDK Platform 35 from SDK Manager, then rerun this script.'
}
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk

$Java = Find-CommandPath 'java'
if (-not $Java) {
    $JavaCandidates = @(
        'C:\Program Files\Android\Android Studio\jbr\bin\java.exe',
        'C:\Program Files\Android Studio\jbr\bin\java.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr\bin\java.exe')
    )
    $Java = $JavaCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($Java) { $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $Java); $env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path }
}
if (-not $Java) { throw 'Java 17+ was not found. Install Android Studio (bundled JBR) or a Java 17 JDK, then retry.' }

$Gradle = Find-CommandPath 'gradle'
if (-not $Gradle) {
    $Version = '8.9'
    $CacheRoot = Join-Path $env:LOCALAPPDATA 'ImmortalFrontier\gradle'
    $GradleHome = Join-Path $CacheRoot "gradle-$Version"
    $GradleExe = Join-Path $GradleHome 'bin\gradle.bat'
    if (-not (Test-Path $GradleExe)) {
        New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null
        $Zip = Join-Path $CacheRoot "gradle-$Version-bin.zip"
        $Url = "https://services.gradle.org/distributions/gradle-$Version-bin.zip"
        Write-Host "Downloading Gradle $Version. Internet access is required for this and Android dependencies." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $Url -OutFile $Zip
        Expand-Archive -Path $Zip -DestinationPath $CacheRoot -Force
        Remove-Item $Zip -Force
    }
    if (-not (Test-Path $GradleExe)) { throw "Gradle download/extraction failed: $GradleExe was not found." }
    $Gradle = $GradleExe
}

New-Item -ItemType Directory -Path $Dist -Force | Out-Null
Push-Location $AndroidRoot
try {
    Write-Host 'Building Immortal Frontier debug APK...' -ForegroundColor Cyan
    & $Gradle --no-daemon --stacktrace :app:assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Gradle failed. Keep the first meaningful Gradle error and fix it before changing unrelated dependencies.' }
} finally {
    Pop-Location
}

$BuiltApk = Join-Path $AndroidRoot 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $BuiltApk)) { throw 'Gradle returned success but app-debug.apk was not found; inspect the output path before claiming success.' }
$OutputApk = Join-Path $Dist 'ImmortalFrontier-debug.apk'
Copy-Item $BuiltApk $OutputApk -Force
Write-Host "APK built: $OutputApk" -ForegroundColor Green
Write-Host 'This build has not been installed on a device by this script. Use install-apk.ps1 or manually test it on Android.' -ForegroundColor Yellow
