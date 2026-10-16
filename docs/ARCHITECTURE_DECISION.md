# Architecture decision record: Open Tibia integration

## Chosen baseline

- **Client:** OpenTibiaBR/OTClient Redemption, MIT licence, C++20/Lua with Android build files and mobile input/UI work.
- **Server:** The Forgotten Server, stable tag `v1.6`, protocol **13.10**, GPL-2.0.
- **Target pairing:** Redemption explicitly lists TFS 1.6 (13.10) support. This combination has a clear compatibility claim in upstream docs and a known stable TFS release. It is preferable for the first integration milestone to choosing an unknown server or chasing the newest protocol.

## Why TFS 1.6 first

TFS is a well-established emulator with an exposed Lua scripting system and Revscriptsys, which supports combining talk actions and creature events in one script file under `data/scripts`. That is sufficient to move the first cultivation rules into server-owned player storage without editing the C++ core. TFS and its scripts are GPL-2.0; retain licence notices and follow GPL obligations if distributing modified server binaries/source.

## Implemented integration overlay

- `integrations/tfs-1.6/cultivation_system.lua`: roots, qi, realm, qi meditation cooldown, server-authoritative Spirit Bolt/healing, breakthrough costs/risk/lockout, sect path selection, kill-driven trial quest and server-held currency.
- `integrations/otclient-redemption/mods/`: touch D-pad and buttons for nearest-monster targeting plus server talk actions.
- `scripts/setup-open-tibia.ps1`: clone sources on a networked development machine and record resolved Git commits.
- `scripts/install-open-tibia-integration.ps1`: install overlay files into source trees with backups.

The integration uses original terminology and factions. No novel text, characters, plot, or external game artwork is bundled.

## Assets/data still required

The browser prototype uses locally generated Canvas drawings; these aren't yet exported as OTClient-native `things` assets. The client/server software licences don't grant rights to unrelated client sprites, sounds, maps, or item definitions. We need a compatible protocol-13.10 map and data pack with an explicit suitable licence, or we need to create and import our own assets through the compatible asset pipeline. Never mix item IDs/map data from different versions blindly.

## Environment limitations / honest status

The available workspace has Git, Java, Node and Chromium, but GitHub host resolution failed and there is no Docker, Android SDK/Gradle executable, or ADB. Upstream code couldn't be checked out, so integration files could not be compiled or exercised inside actual TFS/OTClient binaries. The included Node tests check gameplay rules and integration wiring, not successful Lua execution by TFS. No Android APK or real client-server smoke test is claimed.

## Acceptance milestones

1. Clone OTClient Redemption and TFS v1.6 on a networked machine; save exact commit IDs.
2. Install the overlay; verify no Lua/UI errors on startup and first login.
3. Build TFS 1.6 with a compatible licensed map/data pack and run locally.
4. Build the OTClient Redemption Android APK using upstream `Dockerfile.android`.
5. Connect from Android; verify login, movement, targeting, combat, reconnect and storage persistence.
6. Import original/licensed art and create a small original village, wilderness map and cave.
7. Extend the server-owned scripts to NPC dialogues, actual gatherable items, technique/realm progression and persistent sect structures.
