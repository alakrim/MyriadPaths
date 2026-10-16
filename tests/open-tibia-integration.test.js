import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const serverScript = readFileSync(resolve(root, 'integrations/tfs-1.6/cultivation_system.lua'), 'utf8');
const mobileLua = readFileSync(resolve(root, 'integrations/otclient-redemption/mods/cultivation_mobile.lua'), 'utf8');
const mobileUi = readFileSync(resolve(root, 'integrations/otclient-redemption/mods/cultivation_mobile.otui'), 'utf8');
const mobileMod = readFileSync(resolve(root, 'integrations/otclient-redemption/mods/cultivation_mobile.otmod'), 'utf8');
const bootstrapScript = readFileSync(resolve(root, 'scripts/setup-open-tibia.ps1'), 'utf8');

test('server rules register the expected cultivation commands', () => {
  for (const command of ['!root', '!cultivate', '!realm', '!qi', '!sect', '!quest', '!breakthrough', '!heal', '!spiritbolt', '!culthelp']) {
    assert.ok(serverScript.includes(`registerTalkAction("${command}"`), `missing server talk-action ${command}`);
  }
});

test('server script persists cultivation state and handles login and monster kills', () => {
  for (const marker of ['CreatureEvent("CultivationLogin")', 'function(player)', 'player:registerEvent("CultivationKill")', 'CreatureEvent("CultivationKill")', 'player:setStorageValue', 'player:getStorageValue']) {
    assert.ok(serverScript.includes(marker), `missing server persistence/event marker ${marker}`);
  }
  assert.ok(serverScript.includes('spiritBoltCombat:execute(player, Variant(target:getId()))'));
});

test('mobile overlay calls server-authoritative cultivation actions', () => {
  for (const command of ['!spiritbolt', '!cultivate', '!heal', '!breakthrough', '!realm', '!quest', '!culthelp']) {
    assert.ok(mobileLua.includes(`g_game.talk(command)`), 'mobile mod should send talk-actions only through the single command bridge');
    assert.ok(mobileUi.includes(`CultivationMobile.say("${command}")`), `missing mobile button for ${command}`);
  }
  assert.ok(mobileUi.includes('CultivationMobile.move(North)'));
  assert.ok(mobileUi.includes('CultivationMobile.attackNearestMonster()'));
  assert.ok(mobileMod.includes('@onLoad: init()'));
});


test('upstream bootstrap records pinned checkouts at a valid project-relative path', () => {
  assert.ok(bootstrapScript.includes("Join-Path (Join-Path $ProjectRoot 'docs') 'third-party-lock.txt'"));
  assert.ok(!bootstrapScript.split('\n').some(line => line.includes('docs\t')));
  assert.ok(bootstrapScript.includes("--branch v1.6 https://github.com/otland/forgottenserver.git"));
});
