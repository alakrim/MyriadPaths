#!/usr/bin/env python3
"""Prepare the source game as classic scripts for the Android local WebView shell.

The browser version uses ES modules. Android's asset:// file origin has stricter module
CORS behaviour, so this tiny, deterministic build step joins the first-party core and
client scripts without downloading any dependencies.
"""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "android" / "app" / "src" / "main" / "assets" / "www"
SRC = ROOT / "src"
WEB.mkdir(parents=True, exist_ok=True)

core = (SRC / "game-core.js").read_text(encoding="utf-8")
core = re.sub(r"\bexport\s+(?=(?:const|function)\b)", "", core)
exports = [
    "WORLD", "HERB_NODES", "ELDER", "PORTAL", "ITEMS", "REALMS",
    "createInitialState", "sanitizeState", "realmLabel", "hash2", "tileAt",
    "isTreeAt", "isBlocked", "findPath", "distance", "addLog", "startElderQuest",
    "collectHerb", "meditate", "breakthrough", "spendQi", "useHealingPill",
]
core = "(function () {\n" + core + "\n;window.GameCore = { " + ", ".join(exports) + " };\n})();\n"
(WEB / "src").mkdir(parents=True, exist_ok=True)
(WEB / "src" / "game-core.bundle.js").write_text(core, encoding="utf-8")

game = (SRC / "game.js").read_text(encoding="utf-8")
pattern = re.compile(r"import\s*\{(.*?)\}\s*from\s*['\"]\./game-core\.js['\"];", re.S)
match = pattern.search(game)
if not match:
    raise SystemExit("Could not locate the expected game-core import in src/game.js")
imports = re.sub(r"\s+", " ", match.group(1)).strip()
game = game[:match.start()] + f"const {{ {imports} }} = window.GameCore;" + game[match.end():]
(WEB / "src" / "game.bundle.js").write_text(game, encoding="utf-8")

html = (ROOT / "index.html").read_text(encoding="utf-8")
html = html.replace('<script type="module" src="src/game.js"></script>',
                    '<script src="src/game-core.bundle.js"></script>\n  <script src="src/game.bundle.js"></script>')
if "type=\"module\"" in html:
    raise SystemExit("Unconverted module script remains in Android index.html")
(WEB / "index.html").write_text(html, encoding="utf-8")
shutil.copy2(ROOT / "styles.css", WEB / "styles.css")
shutil.copy2(ROOT / "manifest.webmanifest", WEB / "manifest.webmanifest")
print(f"Prepared offline WebView assets: {WEB}")
print("No external JavaScript packages or remote assets were downloaded.")
