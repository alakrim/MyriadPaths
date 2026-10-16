export const WORLD = Object.freeze({ width: 48, height: 38, caveWidth: 24, caveHeight: 18 });
export const HERB_NODES = Object.freeze([
  { id: 'herb-a', x: 24, y: 18 },
  { id: 'herb-b', x: 26, y: 22 },
  { id: 'herb-c', x: 29, y: 17 },
  { id: 'herb-d', x: 32, y: 23 },
  { id: 'herb-e', x: 35, y: 25 },
]);
export const ELDER = Object.freeze({ x: 17, y: 16, name: 'Elder Shen' });
export const PORTAL = Object.freeze({ x: 37, y: 26 });
export const ITEMS = Object.freeze({
  moonjade_herb: { name: 'Moonjade Herb', icon: '✿', description: 'A cool herb that carries a trace of lunar qi.' },
  healing_pill: { name: 'Healing Pill', icon: '◉', description: 'Restores 45 health.' },
  spirit_core: { name: 'Feral Spirit Core', icon: '◆', description: 'A warm core condensed by a defeated beast.' },
  cave_crystal: { name: 'Vein Crystal', icon: '✧', description: 'A crystal humming with subterranean qi.' },
  sect_token: { name: 'Unmarked Token', icon: '▣', description: 'An old token. Someone may recognize its seal.' },
});
export const REALMS = Object.freeze(['Body Tempering', 'Qi Condensation', 'Foundation Establishment', 'Golden Core', 'Nascent Soul']);

export function createInitialState() {
  return {
    version: 1,
    area: 'valley',
    player: {
      name: 'Wandering Disciple', x: 17, y: 19, hp: 100, maxHp: 100,
      qi: 24, maxQi: 100, stones: 12, realmIndex: 0, stage: 2,
      aptitude: 'Wood Spirit Root', renown: 0,
    },
    inventory: { moonjade_herb: 0, healing_pill: 2, spirit_core: 0, cave_crystal: 0, sect_token: 0 },
    quest: { status: 'not_started', delivered: false },
    gatheredHerbs: [],
    deadMonsters: [],
    flags: { caveCleared: false, firstBreakthrough: false, characterCreated: false },
    returnPoint: { x: 37, y: 27 },
    log: [
      'You arrive at the edge of the Verdant Reach.',
      'The mountain paths are quiet, but not safe.',
      'Speak with Elder Shen in the village for a task.'
    ],
    playSeconds: 0,
  };
}

export function sanitizeState(candidate) {
  const fresh = createInitialState();
  if (!candidate || candidate.version !== 1 || !candidate.player) return fresh;
  const p = candidate.player;
  const int = (n, fallback, min, max) => Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
  fresh.area = candidate.area === 'cave' ? 'cave' : 'valley';
  fresh.player = {
    ...fresh.player,
    name: typeof p.name === 'string' ? p.name.slice(0, 28) : fresh.player.name,
    x: int(p.x, fresh.player.x, 1, WORLD.width - 2),
    y: int(p.y, fresh.player.y, 1, WORLD.height - 2),
    hp: int(p.hp, 100, 1, 1000), maxHp: int(p.maxHp, 100, 1, 1000),
    qi: int(p.qi, 24, 0, 1000), maxQi: int(p.maxQi, 100, 1, 1000),
    stones: int(p.stones, 12, 0, 999999), realmIndex: int(p.realmIndex, 0, 0, REALMS.length - 1),
    stage: int(p.stage, 2, 1, 9), aptitude: typeof p.aptitude === 'string' ? p.aptitude.slice(0, 40) : 'Wood Spirit Root',
    renown: int(p.renown, 0, 0, 999999),
  };
  for (const key of Object.keys(fresh.inventory)) fresh.inventory[key] = int(candidate.inventory?.[key], fresh.inventory[key], 0, 9999);
  if (candidate.quest && ['not_started', 'active', 'complete'].includes(candidate.quest.status)) fresh.quest = { status: candidate.quest.status, delivered: !!candidate.quest.delivered };
  fresh.gatheredHerbs = Array.isArray(candidate.gatheredHerbs) ? candidate.gatheredHerbs.filter(id => HERB_NODES.some(n => n.id === id)) : [];
  fresh.deadMonsters = Array.isArray(candidate.deadMonsters) ? candidate.deadMonsters.filter(id => typeof id === 'string').slice(-100) : [];
  fresh.flags = { caveCleared: !!candidate.flags?.caveCleared, firstBreakthrough: !!candidate.flags?.firstBreakthrough, characterCreated: !!candidate.flags?.characterCreated };
  fresh.returnPoint = { x: int(candidate.returnPoint?.x, 37, 1, WORLD.width - 2), y: int(candidate.returnPoint?.y, 27, 1, WORLD.height - 2) };
  fresh.log = Array.isArray(candidate.log) ? candidate.log.filter(x => typeof x === 'string').slice(-12) : fresh.log;
  fresh.playSeconds = int(candidate.playSeconds, 0, 0, 99999999);
  return fresh;
}

export function realmLabel(player) {
  const realm = REALMS[player.realmIndex] || REALMS[0];
  return `${realm} · Stage ${player.stage}`;
}

export function hash2(x, y, salt = 0) {
  let n = (Math.imul(x + salt * 17, 374761393) + Math.imul(y - salt * 31, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function tileAt(area, x, y) {
  if (area === 'cave') {
    if (x < 1 || y < 1 || x >= WORLD.caveWidth - 1 || y >= WORLD.caveHeight - 1) return 'wall';
    const central = x >= 3 && x <= 20 && y >= 4 && y <= 13;
    if ((x === 9 && y === 6) || (x === 12 && y === 11) || (x === 19 && y === 9)) return 'crystal';
    const westRoom = x >= 2 && x <= 7 && y >= 6 && y <= 11;
    const eastRoom = x >= 15 && x <= 21 && y >= 5 && y <= 12;
    const northPassage = x >= 7 && x <= 17 && y >= 7 && y <= 9;
    const entry = x >= 2 && x <= 5 && y >= 7 && y <= 10;
    if (westRoom || eastRoom || northPassage || entry || (central && (y === 8 || x === 10 || x === 11))) {
      if ((x === 9 && y === 6) || (x === 12 && y === 11) || (x === 19 && y === 9)) return 'crystal';
      return 'cave';
    }
    return hash2(x, y, 5) > 0.93 ? 'crystal' : 'wall';
  }

  if (x < 1 || y < 1 || x >= WORLD.width - 1 || y >= WORLD.height - 1) return 'water';
  const lake = ((x - 33) ** 2) / 17 + ((y - 10) ** 2) / 11 < 1;
  if (lake) return 'water';
  if ((x < 4 && y < 14) || (x > 43 && y < 6) || (x < 5 && y > 28) || (x > 43 && y > 31)) return 'cliff';
  const village = x >= 10 && x <= 23 && y >= 12 && y <= 23;
  const plaza = x >= 14 && x <= 21 && y >= 17 && y <= 21;
  const mainRoad = x >= 10 && x <= 24 && Math.abs(y - 19) <= 1;
  const elderRoad = x >= 15 && x <= 19 && y >= 14 && y <= 19;
  const pathY = 19 + Math.round((x - 24) * 0.31);
  const eastRoad = x >= 24 && x <= 38 && Math.abs(y - pathY) <= 1;
  if (plaza) return 'stone';
  if (mainRoad || elderRoad || eastRoad) return 'road';
  if (village && ((x + y) % 5 === 0)) return 'grass-flower';
  if (isTreeAt(x, y)) return 'tree';
  if (hash2(x, y, 11) > 0.88) return 'grass-flower';
  return 'grass';
}

export function isTreeAt(x, y) {
  const safeVillage = x >= 9 && x <= 24 && y >= 11 && y <= 24;
  const nearPath = (x >= 9 && x <= 24 && Math.abs(y - 19) <= 2) || (x >= 15 && x <= 19 && y >= 13 && y <= 21);
  const nearLake = ((x - 33) ** 2) / 22 + ((y - 10) ** 2) / 15 < 1.35;
  const herbZone = HERB_NODES.some(n => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1);
  if (safeVillage || nearPath || nearLake || herbZone || x >= 36 && y >= 23) return false;
  return hash2(x, y, 3) > 0.89;
}

export function isBlocked(state, x, y) {
  const area = state.area;
  const tile = tileAt(area, x, y);
  if (['water', 'cliff', 'wall'].includes(tile)) return true;
  if (area === 'cave') return false;
  const footprints = [
    { x1: 10, y1: 12, x2: 13, y2: 15 }, // inn
    { x1: 16, y1: 12, x2: 18, y2: 14 }, // elder pavilion
    { x1: 20, y1: 15, x2: 22, y2: 17 }, // apothecary
  ];
  if (footprints.some(b => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2)) return true;
  if (tile === 'tree') return true;
  if (area === 'valley' && x === ELDER.x && y === ELDER.y) return true;
  return false;
}

export function findPath(state, start, goal, maxNodes = 1600, extraBlocked = []) {
  const blocked = (x, y) => isBlocked(state, x, y) || extraBlocked.some(p => p.x === x && p.y === y);
  const target = { x: goal.x, y: goal.y };
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const key = (x, y) => `${x},${y}`;
  const queue = [{ x: start.x, y: start.y }];
  const visited = new Map([[key(start.x, start.y), null]]);
  let found = null;
  for (let head = 0; head < queue.length && queue.length < maxNodes; head++) {
    const cur = queue[head];
    if (cur.x === target.x && cur.y === target.y) { found = cur; break; }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy, k = key(nx, ny);
      if (visited.has(k) || blocked(nx, ny)) continue;
      if (dx && dy && (blocked(cur.x + dx, cur.y) || blocked(cur.x, cur.y + dy))) continue;
      visited.set(k, key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return [];
  const path = [];
  let cursor = key(found.x, found.y);
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.push({ x, y });
    cursor = visited.get(cursor);
  }
  path.reverse();
  return path.slice(1);
}

export function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function addLog(state, message) {
  state.log.push(message);
  if (state.log.length > 12) state.log.splice(0, state.log.length - 12);
}

export function startElderQuest(state) {
  if (state.quest.status === 'not_started') {
    state.quest.status = 'active';
    addLog(state, 'Quest accepted: gather 3 Moonjade Herbs from the eastern wilds.');
    return 'The eastern path has grown dangerous. Bring me three Moonjade Herbs, and I will reward you with spirit stones and healing pills.';
  }
  if (state.quest.status === 'active') {
    const count = state.inventory.moonjade_herb;
    if (count >= 3) {
      state.inventory.moonjade_herb -= 3;
      state.player.stones += 60;
      state.inventory.healing_pill += 2;
      state.player.renown += 15;
      state.quest.status = 'complete';
      addLog(state, 'Quest complete: Elder Shen rewards you with 60 spirit stones and 2 Healing Pills.');
      return 'Well gathered. Keep these spirit stones and pills. The path of cultivation rewards patience, preparation, and knowing when to retreat.';
    }
    return `You have ${count}/3 Moonjade Herbs. Search the grass east of the village, but watch for hungry beasts.`;
  }
  return 'The herbs were useful. Rest, cultivate, and do not mistake early progress for mastery.';
}

export function collectHerb(state, nodeId) {
  if (state.area !== 'valley' || state.gatheredHerbs.includes(nodeId)) return false;
  const node = HERB_NODES.find(n => n.id === nodeId);
  if (!node) return false;
  state.gatheredHerbs.push(nodeId);
  state.inventory.moonjade_herb += 1;
  addLog(state, `Gathered a Moonjade Herb (${state.inventory.moonjade_herb}/3).`);
  return true;
}

export function meditate(state, amount = 14) {
  const before = state.player.qi;
  state.player.qi = Math.min(state.player.maxQi, state.player.qi + amount);
  const gained = state.player.qi - before;
  if (gained > 0) addLog(state, `Quiet breathing gathers ${gained} qi.`);
  return gained;
}

export function breakthrough(state, roll = Math.random) {
  if (state.player.qi < 80) return { ok: false, reason: 'Need at least 80 qi to attempt a breakthrough.' };
  if (state.player.stones < 5) return { ok: false, reason: 'A breakthrough attempt requires 5 spirit stones.' };
  state.player.qi -= 80;
  state.player.stones -= 5;
  const bonus = state.player.aptitude.includes('Wood') ? 0.08 : 0;
  const chance = Math.min(0.92, 0.74 + bonus + (state.player.aptitude.includes('Water') ? 0.04 : 0));
  if (roll() < chance) {
    if (state.player.stage >= 9) {
      state.player.stage = 1;
      state.player.realmIndex = Math.min(REALMS.length - 1, state.player.realmIndex + 1);
    } else state.player.stage += 1;
    state.player.maxHp += 8;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 24);
    state.player.maxQi += 5;
    state.player.qi = Math.min(state.player.maxQi, state.player.qi + 18);
    state.flags.firstBreakthrough = true;
    addLog(state, `Breakthrough succeeded. You reached ${realmLabel(state.player)}.`);
    return { ok: true, reason: `Your meridians settle into a stronger rhythm. New realm: ${realmLabel(state.player)}.`, chance };
  }
  state.player.hp = Math.max(1, state.player.hp - 12);
  addLog(state, 'Breakthrough failed. Your qi recoils through your meridians.');
  return { ok: false, reason: 'The breakthrough failed. You lose 12 health to qi backlash, but the path remains open.', chance };
}

export function spendQi(state, amount) {
  if (state.player.qi < amount) return false;
  state.player.qi -= amount;
  return true;
}

export function useHealingPill(state) {
  if (state.inventory.healing_pill <= 0) return { ok: false, reason: 'No Healing Pills remain.' };
  if (state.player.hp >= state.player.maxHp) return { ok: false, reason: 'Health is already full.' };
  state.inventory.healing_pill -= 1;
  const healAmount = state.player.aptitude.includes('Water') ? 60 : 45;
  const healed = Math.min(healAmount, state.player.maxHp - state.player.hp);
  state.player.hp += healed;
  addLog(state, `A Healing Pill restores ${healed} health.`);
  return { ok: true, reason: `Restored ${healed} health.` };
}
