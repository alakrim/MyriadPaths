import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, sanitizeState, realmLabel, tileAt, isBlocked, findPath,
  startElderQuest, collectHerb, meditate, breakthrough, useHealingPill,
  HERB_NODES, WORLD,
} from '../src/game-core.js';

test('fresh character starts with valid stats and a cultivation realm', () => {
  const s = createInitialState();
  assert.equal(s.player.hp, 100);
  assert.equal(s.player.qi, 24);
  assert.match(realmLabel(s.player), /Body Tempering/);
  assert.equal(s.quest.status, 'not_started');
});

test('terrain exposes map boundaries and a connected cave corridor', () => {
  assert.equal(tileAt('valley', 0, 0), 'water');
  assert.equal(tileAt('cave', 0, 8), 'wall');
  assert.equal(tileAt('cave', 9, 8), 'cave');
  assert.equal(tileAt('cave', 19, 8), 'cave');
  const s = createInitialState();
  s.area = 'cave';
  const route = findPath(s, {x:3,y:8}, {x:19,y:8});
  assert.ok(route.length > 0, 'should have a walkable route to the cave guardian');
  assert.deepEqual(route.at(-1), {x:19,y:8});
});

test('pathfinding returns adjacent tiles and avoids static obstacles', () => {
  const s = createInitialState();
  const route = findPath(s, {x:17,y:19}, {x:24,y:18});
  assert.ok(route.length > 0);
  let prev = {x:17,y:19};
  for (const p of route) {
    assert.ok(Math.max(Math.abs(prev.x-p.x), Math.abs(prev.y-p.y)) === 1, 'each step should be one tile');
    assert.equal(isBlocked(s,p.x,p.y), false, `path should not enter blocked tile ${p.x},${p.y}`);
    prev = p;
  }
  assert.deepEqual(route.at(-1), {x:24,y:18});
});

test('Elder quest rewards a complete delivery exactly once', () => {
  const s = createInitialState();
  assert.match(startElderQuest(s), /three Moonjade Herbs/i);
  assert.equal(s.quest.status, 'active');
  for (const node of HERB_NODES.slice(0,3)) assert.equal(collectHerb(s,node.id), true);
  assert.equal(s.inventory.moonjade_herb, 3);
  assert.match(startElderQuest(s), /spirit stones/i);
  assert.equal(s.quest.status, 'complete');
  assert.equal(s.player.stones, 72);
  assert.equal(s.inventory.healing_pill, 4);
  assert.equal(s.inventory.moonjade_herb, 0);
  startElderQuest(s);
  assert.equal(s.player.stones, 72, 'the same quest must not pay twice');
});

test('a gathered herb node cannot be gathered twice', () => {
  const s = createInitialState();
  assert.equal(collectHerb(s, 'herb-a'), true);
  assert.equal(collectHerb(s, 'herb-a'), false);
  assert.equal(s.inventory.moonjade_herb, 1);
});

test('meditation respects qi capacity', () => {
  const s = createInitialState();
  s.player.qi = 95;
  assert.equal(meditate(s,14),5);
  assert.equal(s.player.qi,100);
  assert.equal(meditate(s,14),0);
});

test('breakthrough success consumes resources and raises capability', () => {
  const s = createInitialState();
  s.player.qi = 80;
  const oldHp = s.player.maxHp;
  const result = breakthrough(s, () => 0.01);
  assert.equal(result.ok,true);
  assert.equal(s.player.qi,18);
  assert.equal(s.player.stones,7);
  assert.equal(s.player.stage,3);
  assert.equal(s.player.maxHp,oldHp+8);
  assert.equal(s.flags.firstBreakthrough,true);
});

test('failed breakthrough applies a real setback, not a silent no-op', () => {
  const s = createInitialState();
  s.player.qi = 80;
  const oldHp = s.player.hp;
  const result = breakthrough(s, () => 0.99);
  assert.equal(result.ok,false);
  assert.equal(s.player.qi,0);
  assert.equal(s.player.stones,7);
  assert.equal(s.player.hp,oldHp-12);
});

test('breakthrough prerequisites are enforced', () => {
  const s = createInitialState();
  assert.match(breakthrough(s).reason, /80 qi/);
  s.player.qi=100;s.player.stones=4;
  assert.match(breakthrough(s).reason, /5 spirit stones/);
  assert.equal(s.player.qi,100);
});

test('Healing Pills restore health and consume one item', () => {
  const s = createInitialState();
  s.player.hp=70;
  const result=useHealingPill(s);
  assert.equal(result.ok,true);
  assert.equal(s.player.hp,100);
  assert.equal(s.inventory.healing_pill,1);
  assert.equal(useHealingPill(s).ok,false);
});

test('saved state is sanitized against invalid coordinates and counts', () => {
  const s = createInitialState();
  const restored=sanitizeState({...s,player:{...s.player,x:999,y:-20,hp:5000,stones:-5,stage:99},inventory:{healing_pill:-7}});
  assert.equal(restored.player.x,WORLD.width-2);
  assert.equal(restored.player.y,1);
  assert.equal(restored.player.hp,1000);
  assert.equal(restored.player.stones,0);
  assert.equal(restored.player.stage,9);
  assert.equal(restored.inventory.healing_pill,0);
});

test('spirit roots have meaningfully different breakthrough odds', () => {
  const wood = createInitialState();
  wood.player.qi = 80;
  const woodResult = breakthrough(wood, () => 0.76);
  assert.equal(woodResult.ok, true, 'Wood root gets an 8 percentage-point bonus');

  const flame = createInitialState();
  flame.player.aptitude = 'Flame Spirit Root';
  flame.player.qi = 80;
  const flameResult = breakthrough(flame, () => 0.76);
  assert.equal(flameResult.ok, false, 'Flame root does not inherit Wood root luck');
});

test('Water Spirit Root makes a Healing Pill restore 60 health', () => {
  const s = createInitialState();
  s.player.aptitude = 'Water Spirit Root';
  s.player.hp = 30;
  const result = useHealingPill(s);
  assert.equal(result.ok, true);
  assert.equal(s.player.hp, 90);
  assert.equal(s.inventory.healing_pill, 1);
});
