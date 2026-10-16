# Open Tibia integration layer

This is an integration overlay, not a vendored copy of either upstream project. It keeps their licences, histories, build files, and dependencies intact.

## Chosen stack

- **Client:** [OpenTibiaBR/OTClient Redemption](https://github.com/opentibiabr/otclient), MIT-licensed, C++/Lua, with an Android project and mobile UI work.
- **Server:** [otland/forgottenserver](https://github.com/otland/forgottenserver), stable **TFS 1.6**, tagged `v1.6`, protocol **13.10**, GPL-2.0.
- **Protocol pairing:** OTClient Redemption documents TFS 1.6 / 13.10 compatibility. Pin the actual OTClient commit once cloned and keep that commit in the project notes.
- **Art:** this repository's current isometric prototype graphics are original Canvas shapes. They are not yet compiled into OTClient's native thing/appearance asset format. Do not bundle Tibia `.spr`/`.dat`/appearance assets, maps, sounds, or third-party game data without a documented right to redistribute them.

## What this overlay implements

### TFS server script

` tfs-1.6/cultivation_system.lua ` is a RevScriptSys script that uses Player storage for persistent cultivation state. It adds these commands:

- `!root wood`, `!root flame`, or `!root water`: select a permanent root once.
- `!cultivate`: meditate for qi, with a server-side 15-second cooldown.
- `!realm` / `!qi`: inspect realm, qi, currency, root, and sect.
- `!breakthrough`: pay qi and spirit stones for a realm attempt; failure costs extra qi, health, and triggers a short lockout.
- `!sect jade`, `!sect ember`, or `!sect stillwater`: choose one original faction path.
- `!quest start`, `!quest`, and `!quest claim`: a small 5-monster trial with a server-granted spirit-stone reward.
- `!spiritbolt`: damage the selected monster using a server-side Combat object and spend qi.
- `!heal`: spend qi on a server-calculated heal.
- `!culthelp`: list commands.

Monster kills grant a small amount of qi and one spirit stone, and advance the active trial. The commands are deliberately a minimal integration slice, not the final economy, AI, sect management or anti-cheat system.

Install it at `<TFS source>/data/scripts/cultivation_system.lua`. TFS Revscriptsys must be enabled, which is the standard TFS 1.6 scripts system. Review logs on startup and test it in a private server before any public use.

### OTClient mobile controls

The `otclient-redemption/mods/` files add an Android/iOS-oriented overlay with directional movement, nearest-monster targeting, Spirit Bolt, meditation, healing, breakthrough, status, quest, and command-help buttons. The buttons send ordinary OTClient movement/attack operations or the server talk-actions listed above. The client does not authoritatively grant currency, qi, damage, quest credit, or realms.

Copy the three files from `otclient-redemption/mods/` to the root of `<OTClient source>/mods/`. This is a best-effort UI mod prepared against documented OTClient conventions; it has not yet been loaded in a compiled OTClient binary in this environment. Check the client log for UI syntax/API mismatches on the first real build.

## Important missing ingredients before there is a complete game

Neither upstream repository can be assumed to grant redistribution rights to every map and game asset a server expects. To run a visually complete world while honouring the project's asset rule, we still need:

1. A map/asset package expressly licensed for redistribution with the target protocol, **or** our own tile/creature/item assets imported into the OTClient/TFS asset pipeline.
2. A matching map and item definitions from the same data pack. Mixing IDs from unrelated versions can corrupt map appearance or item behavior.
3. A successful TFS 1.6 server build and OTClient Android build, followed by a real login/movement/combat/save smoke test.

The included Canvas world remains the playable local prototype while this protocol/asset integration is being finished. It is not a substitute for the OT client or server.

## Build the Android client from upstream

The upstream repository currently includes `Dockerfile.android`, which builds the Android client and its `data.zip`. On a computer with current Docker Buildx and internet access, from this project's root:

```powershell
.\scripts\setup-open-tibia.ps1
.\scripts\install-open-tibia-integration.ps1 -OTClientPath .\third_party\otclient -TFSPath .\third_party\forgottenserver
```

Then build the upstream Android image/export from the OTClient source root (not this prototype root):

```powershell
Set-Location .\third_party\otclient
docker buildx build --file Dockerfile.android --target apk-artifacts --output type=local,dest=..\..\dist-otclient .
```

The expected output is the APK(s) exported by that Dockerfile under `dist-otclient`. Inspect the files before renaming or installing. These commands have not been run from this isolated environment.

Server build instructions and dependencies are maintained upstream: [TFS Wiki](https://github.com/otland/forgottenserver/wiki). The local integration overlay intentionally does not invent a map or bundle proprietary game data.
