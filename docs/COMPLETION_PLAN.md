# Cultivation Tibia Mobile: completion plan

## Goal
Deliver a real Android APK for an original cultivation MMORPG-style game, built on a reusable Open Tibia client/server stack, with a small and fully testable first world. Never report a build or runtime test as passed unless it was run.

## Architecture decision
- **Client:** OpenTibiaBR/OTClient Redemption. The upstream README identifies it as a modular C++20/Lua client and lists TFS 1.6 protocol 13.10 among supported combinations. The repository has an Android Docker build recipe.
- **Server:** The Forgotten Server (TFS) v1.6, protocol 13.10. This is the conservative, documented protocol match for the chosen client.
- **World/data:** a small original map and item/creature data, with assets created by us or used under licences explicitly permitting the intended use. Do not assume server/client software licences also grant rights to game data or sprites.
- **Gameplay source of truth:** on the OT version, authoritative currency, cultivation stats, combat actions, quest progress and progression must be server-side. Client UI may show predictions/animations but must not award rewards itself.
- **Current prototype:** the browser/WebView vertical slice is a playable design reference and a potential offline Android prototype. It is not yet connected to TFS and will not magically become an OTClient client; its rules and art must be deliberately ported/adapted.

## Milestones and gates

### M0. Protect and reproducibly test current work
**Current status: mostly done.**
- Keep the web prototype runnable and its 17 automated tests green.
- Keep the server script, client overlay, build notes and legal asset rules in source control.
- Record third-party repository URLs, versions/commit hashes and licences at actual checkout time.
- Do not treat static tests as a substitute for a real OT runtime.

**Acceptance:** clean extraction can run `npm test` and `npm run check`; documentation clearly separates verified from unverified results.

### M1. Prove the stock stack before customization
**Blocked by lack of upstream source/networked build environment in the current workspace.**
1. Clone OTClient Redemption and TFS v1.6 from their upstream repositories on a machine with Git and working internet. Record the exact commit IDs.
2. Build and launch the stock OTClient Android APK using its upstream `Dockerfile.android`; verify that an APK file is actually emitted.
3. Build TFS 1.6 and start a private local server using its matching data directory and database configuration.
4. Verify an unmodified desktop client first if available, then verify Android client login.

**Acceptance:** the unmodified client reaches a running local TFS server, creates/logs in a test character, walks, fights a default monster, logs out and retains character state. No custom cultivation code is added until this passes.

### M2. Make the first Android installation boring
1. Install the APK on a physical Android device.
2. Check first launch, landscape layout, touch input, keyboard/back handling, app suspend/resume, connection timeout, reconnect and memory/performance.
3. Keep a build/version label and capture logcat plus OTClient logs for failures.

**Acceptance:** installs without parse/signature errors and reaches the test world reliably across a cold start and reconnect.

### M3. Load a lawful, minimal world
1. Select one matching protocol-13.10 map/data pack only if its map, sprites, sounds, item data and monsters have clear licences compatible with the project; otherwise create a small original tile/creature/item pack.
2. Use compatible map/item tooling to create a starting village, safe zone, forest path, herb node, a few monsters, and one cave/boss room.
3. Avoid mixing asset IDs or map data from unrelated protocol releases.

**Acceptance:** every visible tile/item/creature is valid; the whole path is walkable where intended; the cave entrance and boss area are reachable; no missing appearance assets on client startup.

### M4. Port the first cultivation loop to the real server/client
Implement and test in this order:
1. Character chooses a permanent spiritual root.
2. Server stores root, realm, qi, spirit stones, attributes and cooldowns in persistent player storage or a versioned database schema.
3. Server handles meditation, skill costs, combat, kill rewards and healing.
4. Quest giver starts a gather/kill task, server tracks progress, and server awards exactly one reward.
5. Breakthrough has documented prerequisites, resource costs, success probability, failure setback and realm unlock.
6. Mobile overlay exposes only actions the server understands; show status and errors returned from authoritative game state.

**Acceptance:** relogging does not reset progress; invalid commands and rapid repeat calls cannot mint rewards or bypass costs; two clients see consistent combat/world changes if multiplayer is enabled.

### M5. Produce the first real playable slice
- One village and nearby wilderness
- Character creation/root choice
- Three or more enemy types plus one cave boss
- Basic melee and at least two techniques
- Gatherable herbs/materials, drops, inventory/equipment and healing
- One quest and one breakthrough
- Death/recovery rules, saving and reconnect
- Mobile joystick or tap-to-move, target selection, hotbar, bag and readable combat log

**Acceptance:** a fresh player can start, finish the loop, exit/reopen, reconnect and continue without developer intervention. The test is performed on the APK and against the actual server.

### M6. Expand into the cultivation world
Only after M5 passes:
- technique/manual progression and affinity/root trade-offs
- NPC schedules, relationships and reputation
- sect joining, rank, disciples and facilities
- resource scarcity, crafting/alchemy, markets and item sinks
- rival factions and contested areas
- deeper dungeons/secret realms and longer questlines
- balance, telemetry/logging, backup and server admin tools

**Acceptance:** each major system has data-driven definitions, server-side validation, migration/save tests and a clear gameplay purpose. Avoid an enormous map until the first region is fun and stable.

## Build environment boundary
This workspace currently has Node and Java but no Android SDK, Android platform `android.jar`, Gradle, ADB, Docker or working DNS resolution for GitHub. It therefore cannot presently compile the Android app or the OTClient/TFS source. The project includes scripts to build/prepare the local WebView prototype on Windows and to bootstrap the selected upstream repositories, but those scripts must be run on a properly provisioned connected machine and their output verified.

The most useful first external action is not to design another system: it is to get **M1** green using the vanilla OTClient/TFS combination. If the vanilla client/server pair does not build and connect, fix that before adding more game features.

## Upstream references
- OTClient Redemption: https://github.com/opentibiabr/otclient
- Android build recipe: https://github.com/opentibiabr/otclient/blob/main/Dockerfile.android
- TFS: https://github.com/otland/forgottenserver
- TFS stable releases: https://github.com/otland/forgottenserver/releases
