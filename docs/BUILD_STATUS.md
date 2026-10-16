# Build and test status

Checkpoint date: 2026-10-10

| Check | Result | Evidence |
|---|---|---|
| Game-core and integration tests | PASS, 17/17 | `npm test` |
| Source JavaScript syntax | PASS | `npm run check` |
| Android-bundled JavaScript syntax | Previously passed; regenerate before each Android build | `python scripts/build-android-assets.py` followed by `node --check` on bundled files |
| Browser runtime smoke test | PASS for tested interactions | Chromium desktop, 390x844 portrait, and 844x390 landscape checks previously passed for character creation/root choice, movement, Elder Shen's quest, herb gathering/pathfinding, meditation, and mobile controls |
| Local-storage persistence across a real browser reload | NOT VERIFIED | Must be tested on browser and Android WebView |
| Android WebView APK build | NOT RUN | No Android SDK, `android.jar`, Gradle executable/wrapper, or Docker was found in this environment |
| APK installation / device gameplay | NOT RUN | No `adb` or attached Android device |
| OTClient Redemption upstream source checkout | BLOCKED IN THIS WORKSPACE | `git ls-remote https://github.com/opentibiabr/otclient.git HEAD` failed because this environment could not resolve `github.com` |
| TFS server compile/startup | NOT RUN | No upstream checkout or compatible build environment available here |
| Cultivation TFS Lua runtime | Static-tested only | Actual Lua/TFS load and login/kill persistence need verification in a running TFS 1.6 server |
| OTClient mod runtime | Static-tested only | Actual OTClient UI load and button calls need verification in compiled client |
| Real Android client-to-server connection | NOT IMPLEMENTED / NOT TESTED | The current browser/WebView prototype is single-player and not protocol-connected |

**Important:** the browser/WebView prototype, TFS integration script, and OTClient mobile overlay are separate pieces today. Tests confirm the prototype's local rules and basic code wiring; they do not prove that a production-style client/server game or Android APK is working.
