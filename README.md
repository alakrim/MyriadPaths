# Immortal Frontier: Cultivation Tibia Mobile

A playable, original cultivation-RPG vertical slice with an isometric tile world, designed first for phone touchscreens and packaged with a minimal Android WebView shell. It is a gameplay prototype, not yet a client connected to an Open Tibia server.

## What is implemented

- Isometric 2.5D tile rendering with original Canvas-drawn terrain, trees, village buildings, props and creatures. No remote fonts, sprites or other assets are required.
- Grid movement via tap-to-move, pathfinding, keyboard controls and mobile directional pad.
- Real-time creature pursuit and retaliation, melee attacks, a qi-consuming ranged technique, healing items, drops and an elite cave encounter.
- Persistent character attributes, inventory, gathered nodes, completed quest, dead-creature state and cave-cleared flag.
- Elder Shen's original Moonjade Herb quest, reward delivery, spirit-stone currency, cultivation meditation, a risk-bearing breakthrough and realm/stat progression.
- Responsive journey, inventory and cultivation panels, a local region chart, combat log, save export and touch-friendly landscape/portrait UI.
- Android WebView project and a deterministic offline asset bundler, so Android does not rely on ES-module imports over `file://`.

## Run the playable browser version

The game uses no npm runtime dependencies. From this folder run:

```bash
npm test
npm run check
npm run start
```

Open `http://localhost:8080` in a browser. The server is needed because the browser version uses ES modules. Save data is stored in that browser's local storage.

### Controls

- Tap/click a tile to walk to it. Tap a monster to select and approach it, or tap a herb to gather it.
- **Interact** near Elder Shen, a herb, or the cave entrance.
- **Strike** deals melee damage to a nearby target; **Spirit Bolt** consumes 8 qi; **Healing Pill** restores health.
- **Meditate** gains qi when you're safe; **Breakthrough** consumes 80 qi and 5 spirit stones and can fail with a setback.
- Keyboard: WASD/arrows to move, `E` interact, `1` strike, `2` spirit bolt, `3` healing pill, `Q` meditate.
- On phones, use the lower movement pad and the action/navigation buttons. The interface adapts to portrait and landscape.

## Build an Android APK on a machine with Android tooling

The development environment used for this pass does not have Android SDK/Gradle installed and cannot resolve GitHub. Therefore an APK has **not** been compiled or device-tested here. The Android wrapper and build path are included and can be built on a machine with Internet access and Android SDK Platform 35.

Requirements: Python 3, Java 17, and Android SDK Platform 35. The build script can download Gradle 8.9 when needed; Google/Maven and Gradle distribution downloads must be available.

In PowerShell from this project folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\build-apk.ps1
```

The build script first regenerates Android's bundled scripts, then runs `:app:assembleDebug` and copies the APK into `dist\ImmortalFrontier-debug.apk`. If the Android SDK is not found, install it using Android Studio's SDK Manager, then rerun the command. For a physical device with USB debugging enabled and `adb` installed, use:

```powershell
.\scripts\install-apk.ps1
```

The PowerShell build script is the supported build path for this prototype. A raw Android Studio import may require setting its Gradle distribution to the Gradle 8.9 installation downloaded by the script.

## Architecture decision and Open Tibia integration

**Selected reusable stack:**

- **Client:** [OTClient Redemption](https://github.com/opentibiabr/otclient), an MIT-licensed C++/Lua client. Its upstream repository includes Android build assets and mobile-input work.
- **Server:** [The Forgotten Server (TFS) 1.6](https://github.com/otland/forgottenserver), stable protocol **13.10**, GPL-2.0.
- **Compatibility reason:** OTClient Redemption lists TFS 1.6 / 13.10 as supported. This is a more conservative starting point than matching the very latest protocol version.

I continued implementation by adding `integrations/`: a TFS server-authoritative cultivation script and an OTClient mobile control mod. The server script manages spiritual roots, qi, realms, breakthrough risks, sect paths, a monster trial quest, Spirit Bolt, healing, and player storage. The Android-oriented client overlay provides directional controls and buttons that call these server commands. A PowerShell bootstrap and installer are included under `scripts/`.

**Source checkout and build status:** The actual upstream source is not vendored into this ZIP. GitHub DNS resolution failed from this workspace (`Could not resolve host: github.com`), and this environment does not have Docker, Android SDK, Gradle, or ADB. `scripts/setup-open-tibia.ps1` downloads OTClient Redemption and the `v1.6` TFS source on a computer with Git and internet access, then records their exact commits in `docs/third-party-lock.txt`. `scripts/install-open-tibia-integration.ps1` installs the local overlay into those source trees. The client mod has not yet been loaded in an upstream binary and the Android APK has not been compiled here; treat the mod as integration code pending first-launch verification.

**Art and map compatibility:** The current isometric Canvas art in this prototype is original and properly bundled with this code, but it is not yet converted into OTClient's native asset format. The upstream client and server code licences do not automatically license unrelated maps, sprites, sounds, or item appearance packages. Before running a visually complete OT world, use a map/asset data pack with explicit redistribution rights for protocol 13.10 or build an original compatible asset pack and map. Do not include extracted official Tibia assets without the applicable rights. The overlay documentation explains this blocker and the upstream Docker Android build path.

The local browser/WebView prototype remains a playable single-player vertical slice while this source-level integration is being validated. It is not yet protocol-connected or server-authoritative; the new TFS script is the starting point for moving character progression and combat to the real server.

## Automated tests

`npm test` covers 13 core gameplay-rule tests plus static integration checks for the TFS script and OTClient mobile overlay (17 tests total at the current checkpoint). The integration checks verify that the expected server commands and controls are wired together; they do not substitute for loading the script in a running TFS server or testing the mod in a compiled OTClient binary.

## Licence

Original prototype code in this folder is MIT-licensed (see `LICENSE`). OTClient and The Forgotten Server are not bundled in this prototype.

### Android shell notes

The native entry point is `android/app/src/main/java/com/immortalfrontier/game/MainActivity.java`. It hosts the locally bundled game in an offline WebView and enables DOM storage for the local save. Android compilation and installation still require Android SDK Platform 35, Gradle 8.9 or compatible configured tooling, and a JDK 17+; this workspace did not have the SDK/Gradle or working download DNS, so no APK has been produced or device-tested here.
