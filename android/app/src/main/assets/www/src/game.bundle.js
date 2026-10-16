const { WORLD, HERB_NODES, ELDER, PORTAL, ITEMS, createInitialState, sanitizeState, realmLabel, hash2, tileAt, isBlocked, findPath, distance, addLog, startElderQuest, collectHerb, meditate, breakthrough, spendQi, useHealingPill, } = window.GameCore;

const $ = (id) => document.getElementById(id);
const canvas = $('worldCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const mapCanvas = $('miniMap');
const mapCtx = mapCanvas.getContext('2d');
const TILE_W = 48, TILE_H = 25;
const SAVE_KEY = 'immortal-frontier-save-v1';
let state = loadState();
let monsters = [];
let path = [];
let movementGoal = null;
let selectedMonsterId = null;
let selectedHerbId = null;
let pendingAction = null;
let activePanel = 'journey';
let lastMoveAt = 0, lastMonsterAt = 0, lastSaveAt = 0, lastPanelAt = 0, lastUiAt = 0;
let lastFrame = 0, lastToastAt = 0, lastMeditateAt = 0;
let heldDirection = null, heldMoveAt = 0;
let toastTimer = 0;
let showGrid = false;
let soundEnabled = false;
let panelWasOpenedForMobile = false;

function loadState() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) return sanitizeState(JSON.parse(saved));
  } catch (error) {
    console.warn('Save could not be loaded; starting a new journey.', error);
  }
  return createInitialState();
}

function saveGame(silent = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!silent) toast('Journey saved on this device.');
    return true;
  } catch (error) {
    toast('Save failed. Browser storage may be unavailable.');
    console.error(error);
    return false;
  }
}

function toast(message, duration = 2300) {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  lastToastAt = performance.now();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), duration);
}

function setLocationText() {
  $('locationName').textContent = state.area === 'cave' ? 'Hollow Vein Cave' : 'Verdant Reach';
  $('weatherLabel').textContent = state.area === 'cave' ? 'Underground · Thin ambient qi' : 'Clear skies · Late afternoon';
}

function valleyMonsterDefinitions() {
  return [
    { id: 'wolf-a', name: 'Ashen Wolf', type: 'wolf', x: 24, y: 20, maxHp: 34, hp: 34, damage: 5, reward: 7, drop: 'spirit_core', aggro: 6 },
    { id: 'wolf-b', name: 'Ashen Wolf', type: 'wolf', x: 27, y: 22, maxHp: 34, hp: 34, damage: 5, reward: 7, drop: 'spirit_core', aggro: 6 },
    { id: 'boar-c', name: 'Ironhide Boar', type: 'boar', x: 30, y: 17, maxHp: 48, hp: 48, damage: 7, reward: 10, drop: 'spirit_core', aggro: 5 },
    { id: 'wolf-d', name: 'Ashen Wolf', type: 'wolf', x: 33, y: 23, maxHp: 34, hp: 34, damage: 5, reward: 8, drop: 'spirit_core', aggro: 6 },
    { id: 'boar-e', name: 'Ironhide Boar', type: 'boar', x: 35, y: 26, maxHp: 48, hp: 48, damage: 7, reward: 11, drop: 'spirit_core', aggro: 5 },
  ];
}

function caveMonsterDefinitions() {
  return [
    { id: 'wight-a', name: 'Vein Wight', type: 'wight', x: 8, y: 8, maxHp: 40, hp: 40, damage: 6, reward: 12, drop: 'cave_crystal', aggro: 6 },
    { id: 'wight-b', name: 'Vein Wight', type: 'wight', x: 14, y: 8, maxHp: 40, hp: 40, damage: 6, reward: 12, drop: 'cave_crystal', aggro: 6 },
    { id: 'cave-guardian', name: 'Hollow Guardian', type: 'boss', x: 19, y: 8, maxHp: 125, hp: 125, damage: 10, reward: 40, drop: 'sect_token', aggro: 7 },
  ];
}

function spawnMonsters() {
  const defs = state.area === 'cave' ? caveMonsterDefinitions() : valleyMonsterDefinitions();
  monsters = defs.filter(m => !state.deadMonsters.includes(m.id));
  if (state.area === 'cave' && state.flags.caveCleared) monsters = monsters.filter(m => m.id !== 'cave-guardian');
  selectedMonsterId = null;
  updateTargetCard();
}

function currentMonster() { return monsters.find(m => m.id === selectedMonsterId) || null; }
function playerPoint() { return { x: state.player.x, y: state.player.y }; }

function safeZone(point = playerPoint()) {
  return state.area === 'valley' && point.x >= 10 && point.x <= 23 && point.y >= 12 && point.y <= 23;
}

function showModal({ icon = '☯', eyebrow = 'FIELD ENCOUNTER', title = '', body = '', actions = [] }) {
  $('modalScrim').dataset.requiredCreation = 'false';
  $('modalIcon').textContent = icon;
  $('modalEyebrow').textContent = eyebrow;
  $('modalTitle').textContent = title;
  $('modalBody').textContent = body;
  const holder = $('modalActions');
  holder.innerHTML = '';
  const finalActions = actions.length ? actions : [{ label: 'Understood', style: 'primary-button', run: closeModal }];
  for (const action of finalActions) {
    const button = document.createElement('button');
    button.className = action.style || 'primary-button';
    button.textContent = action.label;
    button.addEventListener('click', () => action.run?.());
    holder.append(button);
  }
  $('modalScrim').hidden = false;
}
function closeModal() {
  if ($('modalScrim').dataset.requiredCreation === 'true' && !state.flags.characterCreated) return;
  $('modalScrim').hidden = true;
}
$('modalOkay').addEventListener('click', closeModal);
$('modalScrim').addEventListener('click', (event) => { if (event.target === $('modalScrim') && state.flags.characterCreated) closeModal(); });

function showCharacterCreator(firstTime = false) {
  $('modalScrim').dataset.requiredCreation = String(firstTime);
  $('modalIcon').textContent = '☯';
  $('modalEyebrow').textContent = firstTime ? 'YOUR FIRST BREATH' : 'DISCIPLE RECORD';
  $('modalTitle').textContent = firstTime ? 'Create your disciple' : 'Identity & spirit root';
  $('modalBody').innerHTML = `<div class="creation-copy">${firstTime ? 'A cultivator is shaped by choice as much as fate. Choose a name and the spirit root that will influence your path.' : 'Your name and spirit root shape this character’s identity and strengths. Changing the root is allowed in this early prototype.'}</div><div class="character-form"><label for="characterNameInput">DISCIPLE NAME<input id="characterNameInput" maxlength="28" minlength="3" value="${escapeHtml(state.player.name)}" autocomplete="nickname" /></label><label for="rootSelect">SPIRIT ROOT<select id="rootSelect"><option value="Wood Spirit Root" ${state.player.aptitude.includes('Wood')?'selected':''}>Wood Spirit Root · steady meridians</option><option value="Flame Spirit Root" ${state.player.aptitude.includes('Flame')?'selected':''}>Flame Spirit Root · stronger techniques</option><option value="Water Spirit Root" ${state.player.aptitude.includes('Water')?'selected':''}>Water Spirit Root · better recovery</option></select></label><div id="rootDescription" class="root-descriptions"></div><div id="creationValidation" class="creation-validation"></div></div>`;
  const holder = $('modalActions'); holder.innerHTML = '';
  if (!firstTime) {
    const cancel = document.createElement('button'); cancel.className = 'secondary-button'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', closeModal); holder.append(cancel);
  }
  const save = document.createElement('button'); save.className = 'primary-button'; save.textContent = firstTime ? 'Begin journey' : 'Save disciple';
  save.addEventListener('click', () => {
    const input = $('characterNameInput');
    const name = input.value.trim();
    if (name.length < 3) { $('creationValidation').textContent = 'Use at least 3 characters for the disciple name.'; input.focus(); return; }
    state.player.name = name.slice(0,28);
    state.player.aptitude = $('rootSelect').value;
    state.flags.characterCreated = true;
    addLog(state, `${state.player.name} begins the path with a ${state.player.aptitude}.`);
    saveGame(true); closeModal(); updateAllUI(); toast(`Disciple created: ${state.player.name}.`);
  });
  holder.append(save);
  const updateDescription = () => {
    const root = $('rootSelect').value;
    $('rootDescription').textContent = root.includes('Wood') ? 'Passive: +8% breakthrough success chance. Patience and stable meridians.' : root.includes('Flame') ? 'Passive: +4 damage with melee strikes and Spirit Bolt. Fierce, direct cultivation.' : 'Passive: breakthrough chance improves by 4%; Healing Pills restore 60 health instead of 45.';
  };
  $('rootSelect').addEventListener('change', updateDescription); updateDescription();
  $('modalScrim').hidden = false;
  setTimeout(() => $('characterNameInput')?.focus(), 50);
}

function setPanel(panel, openOnMobile = false) {
  activePanel = panel;
  for (const tab of document.querySelectorAll('.panel-tab')) {
    const selected = tab.dataset.panel === panel;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  }
  renderPanel();
  if (window.innerWidth <= 760 && openOnMobile) {
    $('rightPanel').classList.add('mobile-open');
    panelWasOpenedForMobile = true;
  }
}

function initMobilePanelClose() {
  const tabs = document.querySelector('.panel-tabs');
  const close = document.createElement('button');
  close.className = 'mobile-panel-close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close panel');
  close.addEventListener('click', () => $('rightPanel').classList.remove('mobile-open'));
  tabs.append(close);
}

function showSettings() {
  showModal({
    icon: '⚙', eyebrow: 'JOURNEY SETTINGS', title: 'Keep your footing',
    body: 'This prototype saves locally on the current device. Your character, quest, gathered herbs and defeated creatures are recorded in browser storage.',
    actions: [
      { label: soundEnabled ? 'Sound: On' : 'Sound: Off', style: 'secondary-button', run: () => { soundEnabled = !soundEnabled; showSettings(); } },
      { label: 'Export Save', style: 'secondary-button', run: exportSave },
      { label: 'Continue', style: 'primary-button', run: closeModal },
    ],
  });
}
function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'immortal-frontier-save.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Save export started.');
}
function askReset() {
  showModal({ icon: '⚠', eyebrow: 'IRREVERSIBLE', title: 'Begin a new life?', body: 'This erases the local character save and begins again at the Verdant Reach. Export your save first if you want to keep it.', actions: [
    { label: 'Keep Journey', style: 'secondary-button', run: closeModal },
    { label: 'Reset Save', style: 'primary-button', run: () => { localStorage.removeItem(SAVE_KEY); state = createInitialState(); path = []; movementGoal=null; pendingAction = null; spawnMonsters(); saveGame(true); closeModal(); updateAllUI(); toast('A new journey begins.'); } },
  ] });
}

function renderPanel() {
  const p = state.player;
  const node = $('panelContent');
  if (activePanel === 'bag') {
    const rows = Object.entries(ITEMS).map(([id, item]) => {
      const count = state.inventory[id] || 0;
      if (count <= 0) return '';
      const usable = id === 'healing_pill';
      return `<div class="inventory-item"><div class="item-icon">${item.icon}</div><div class="item-info"><strong>${item.name}</strong><small>${item.description}</small></div><span class="item-count">×${count}</span>${usable ? '<button class="toggle-button use-pill">Use</button>' : ''}</div>`;
    }).join('');
    node.innerHTML = `<div class="content-overline">PERSONAL STORES</div><h2>Inventory</h2><p class="panel-intro">Supplies are scarce this far from a sect. Keep a pill in reserve before entering a ruin.</p><div class="stat-grid"><div class="stat-box"><small>Spirit stones</small><strong>◇ ${p.stones}</strong></div><div class="stat-box"><small>Carried items</small><strong>${Object.values(state.inventory).reduce((a,b)=>a+b,0)}</strong></div></div><div class="section-caption">CARRIED ITEMS</div><div class="inventory-list">${rows || '<div class="empty-state">Your bag is quiet. Hunt beasts or gather herbs to find useful materials.</div>'}</div><button class="secondary-button full-button" id="exportSaveButton">Export local save</button>`;
    node.querySelectorAll('.use-pill').forEach(b => b.addEventListener('click', () => { const r = useHealingPill(state); toast(r.reason); saveGame(true); updateAllUI(); }));
    $('exportSaveButton')?.addEventListener('click', exportSave);
  } else if (activePanel === 'cultivation') {
    const chance = (0.74 + (p.aptitude.includes('Wood') ? 0.08 : 0)) * 100;
    const qiPercent = Math.round(p.qi / p.maxQi * 100);
    node.innerHTML = `<div class="content-overline">INNER WORLD</div><h2>Refine the breath</h2><p class="panel-intro">Qi is gathered in stillness and spent through techniques. A breakthrough requires 80 qi and 5 spirit stones. Failure is costly.</p><div class="cultivation-card"><div class="qi-orb">☯</div><h3>${realmLabel(p)}</h3><p>${p.aptitude} · ${qiPercent}% qi capacity filled</p><div class="bar-track"><div class="bar-fill qi-fill" style="width:${qiPercent}%"></div></div><button class="secondary-button full-button" id="panelMeditate">Meditate · +14 qi</button><div class="breakthrough-chance">Breakthrough success chance: ${chance.toFixed(0)}%</div><button class="primary-button full-button" id="panelBreakthrough" ${p.qi < 80 || p.stones < 5 ? 'disabled' : ''}>Attempt breakthrough</button></div><div class="section-caption">CULTIVATION NOTES</div><div class="check-row"><span class="check-box ${state.flags.firstBreakthrough ? 'done' : ''}">${state.flags.firstBreakthrough ? '✓' : ''}</span><div><strong>First meridian expansion</strong><small>${state.flags.firstBreakthrough ? 'Completed. Max health and qi capacity increased.' : 'Strengthen your foundation before attempting it.'}</small></div></div><div class="check-row"><span class="check-box ${state.inventory.spirit_core ? 'done' : ''}">${state.inventory.spirit_core ? '✓' : ''}</span><div><strong>Beast essence</strong><small>Spirit cores hold a trace of the creature that formed them.</small></div></div>`;
    $('panelMeditate')?.addEventListener('click', performMeditation);
    $('panelBreakthrough')?.addEventListener('click', performBreakthrough);
  } else {
    const q = state.quest;
    const started = q.status !== 'not_started';
    const complete = q.status === 'complete';
    const herbs = state.inventory.moonjade_herb;
    node.innerHTML = `<div class="content-overline">CURRENT CHAPTER</div><h2>${complete ? 'A debt repaid' : 'The elder’s request'}</h2><p class="panel-intro">The Verdant Reach is a remote frontier where local families trade protection for supplies. The village elder is quietly rebuilding his stores.</p><div class="stat-grid"><div class="stat-box"><small>Quest status</small><strong>${complete ? 'Complete' : started ? 'In progress' : 'Available'}</strong></div><div class="stat-box"><small>Herbs gathered</small><strong>${Math.min(3, herbs)} / 3</strong></div></div><div class="section-caption">FIELD OBJECTIVES</div><div class="check-row"><span class="check-box ${started ? 'done' : ''}">${started ? '✓' : ''}</span><div><strong>Speak with Elder Shen</strong><small>${started ? 'He explained why the herb stores are running low.' : 'Find the pavilion just north of the village square.'}</small></div></div><div class="check-row"><span class="check-box ${herbs >= 3 ? 'done' : ''}">${herbs >= 3 ? '✓' : ''}</span><div><strong>Gather Moonjade Herbs</strong><small>${herbs} of 3 in your bag. Pale green plants grow along the eastern trail.</small></div></div><div class="check-row"><span class="check-box ${complete ? 'done' : ''}">${complete ? '✓' : ''}</span><div><strong>Return to the elder</strong><small>${complete ? 'Reward received: 60 spirit stones and 2 Healing Pills.' : 'Return to Elder Shen when you have all three herbs.'}</small></div></div><button class="primary-button full-button" id="trackQuestButton">${complete ? 'Read field notes' : herbs >= 3 ? 'Find Elder Shen' : 'Track herb gathering'}</button><div class="section-caption">BIGGER PICTURE</div><div class="check-row"><span class="check-box"></span><div><strong>Hollow Vein Cave</strong><small>A small dungeon east of the village. The deepest chamber holds something that does not belong to the local beasts.</small></div></div><div class="check-row"><span class="check-box"></span><div><strong>Sect influence</strong><small>Regional factions and sect management are planned after the first playable loop is proven.</small></div></div>`;
    $('trackQuestButton')?.addEventListener('click', () => {
      closeMobilePanel();
      if (state.quest.status === 'not_started' || distance(playerPoint(), ELDER) <= 2) talkToElder();
      else if (herbs >= 3) { pathToNear(ELDER.x, ELDER.y); pendingAction = { type: 'elder' }; toast('Return to Elder Shen in the village.'); }
      else { const node = HERB_NODES.find(n => !state.gatheredHerbs.includes(n.id)); if (node) { selectedHerbId = node.id; pathTo(node.x, node.y); pendingAction = { type: 'herb', id: node.id }; toast('The next Moonjade Herb is marked on the field.'); } }
    });
  }
}

function closeMobilePanel() { $('rightPanel').classList.remove('mobile-open'); }
function updateLog() {
  $('combatLog').innerHTML = state.log.slice(-5).reverse().map(message => `<div>${escapeHtml(message)}</div>`).join('');
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function updateHud() {
  const p = state.player;
  $('heroName').textContent = p.name;
  $('realmLabel').textContent = realmLabel(p);
  $('hpBar').style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`;
  $('qiBar').style.width = `${Math.max(0, p.qi / p.maxQi * 100)}%`;
  $('hpText').textContent = `${p.hp} / ${p.maxHp}`;
  $('qiText').textContent = `${p.qi} / ${p.maxQi} qi`;
  $('stoneCount').textContent = p.stones.toLocaleString();
  $('aptitudeLabel').textContent = p.aptitude.replace(' Spirit Root','') + ' · Grade II';
  $('coordsLabel').textContent = `${p.x}, ${p.y}`;
  $('miniQuest').innerHTML = miniQuestHtml();
  $('selectedLabel').textContent = currentMonster()?.name || (selectedHerbId ? 'Moonjade Herb' : 'No target');
  setLocationText();
}

function miniQuestHtml() {
  const q = state.quest.status, herbs = state.inventory.moonjade_herb;
  const title = q === 'complete' ? 'A debt repaid' : q === 'not_started' ? 'A quiet request' : 'Gather moonjade';
  const status = q === 'complete' ? 'COMPLETED' : q === 'not_started' ? 'AVAILABLE' : 'ACTIVE QUEST';
  const desc = q === 'complete' ? 'The elder’s stores are replenished.' : q === 'not_started' ? 'Elder Shen may have work for a new arrival.' : herbs >= 3 ? 'Return to Elder Shen with the herbs.' : 'Collect three Moonjade Herbs along the eastern path.';
  return `<div class="quest-status">${status}</div><h3>${title}</h3><p>${desc}</p><div class="quest-progress"><span style="width:${q === 'complete' ? 100 : Math.min(100, herbs / 3 * 100)}%"></span></div><div class="quest-progress-label"><span>Herbs</span><span>${Math.min(3, herbs)} / 3</span></div>`;
}

function updateTargetCard() {
  const card = $('targetCard');
  const m = currentMonster();
  if (!m) { card.hidden = true; return; }
  card.hidden = false;
  card.innerHTML = `<strong>${escapeHtml(m.name)}</strong><small>${m.type === 'boss' ? 'ELITE · CAVE GUARDIAN' : state.area === 'cave' ? 'CAVE CREATURE' : 'WILDERNESS BEAST'} · ${Math.max(0,m.hp)} / ${m.maxHp} HP</small><div class="target-hp"><span style="width:${Math.max(0,m.hp/m.maxHp*100)}%"></span></div>`;
}

function updateAllUI() {
  updateHud(); updateLog(); renderPanel(); updateTargetCard();
  updateMiniMap();
  $('attackButton').disabled = false;
  $('spellButton').disabled = state.player.qi < 8;
  $('healButton').disabled = state.inventory.healing_pill <= 0 || state.player.hp >= state.player.maxHp;
  $('breakthroughButton').disabled = state.player.qi < 80 || state.player.stones < 5;
}

function updateMiniMap() {
  const w = mapCanvas.width, h = mapCanvas.height;
  mapCtx.clearRect(0,0,w,h); mapCtx.fillStyle = '#111c1a'; mapCtx.fillRect(0,0,w,h);
  const worldW = state.area === 'cave' ? WORLD.caveWidth : WORLD.width;
  const worldH = state.area === 'cave' ? WORLD.caveHeight : WORLD.height;
  const cell = Math.min((w-8)/worldW,(h-8)/worldH);
  const ox=(w-worldW*cell)/2, oy=(h-worldH*cell)/2;
  for(let y=0;y<worldH;y++) for(let x=0;x<worldW;x++){
    const t=tileAt(state.area,x,y); let color='#344f3c';
    if(t==='water') color='#284d54'; else if(t==='cliff'||t==='wall') color='#1c2625'; else if(t==='road'||t==='stone') color='#7a765f'; else if(t==='cave') color='#414a45'; else if(t==='crystal') color='#79c8c8'; else if(t==='tree') color='#243d31'; else if(t==='grass-flower') color='#496944';
    mapCtx.fillStyle=color; mapCtx.fillRect(ox+x*cell,oy+y*cell,Math.ceil(cell),Math.ceil(cell));
  }
  if(state.area==='valley'){
    for(const n of HERB_NODES) if(!state.gatheredHerbs.includes(n.id)){mapCtx.fillStyle='#92d6a2';mapCtx.fillRect(ox+n.x*cell,oy+n.y*cell,Math.max(2,cell),Math.max(2,cell));}
    mapCtx.fillStyle='#d4bd85'; mapCtx.fillRect(ox+ELDER.x*cell,oy+ELDER.y*cell,Math.max(2,cell*1.5),Math.max(2,cell*1.5));
  }
  for(const m of monsters){mapCtx.fillStyle=m.type==='boss'?'#f28f7a':'#d77770';mapCtx.fillRect(ox+m.x*cell,oy+m.y*cell,Math.max(2,cell*1.5),Math.max(2,cell*1.5));}
  mapCtx.fillStyle='#ffdd93'; mapCtx.beginPath();mapCtx.arc(ox+(state.player.x+.5)*cell,oy+(state.player.y+.5)*cell,Math.max(2.5,cell*1.7),0,Math.PI*2);mapCtx.fill();
}

function canvasResize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(1, Math.round(rect.width*dpr)), ch = Math.max(1, Math.round(rect.height*dpr));
  if(canvas.width!==cw || canvas.height!==ch){canvas.width=cw; canvas.height=ch;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = false;
}

function project(x,y) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  return { x: width/2 + ((x-y)-(state.player.x-state.player.y))*TILE_W/2,
    y: height/2 + ((x+y)-(state.player.x+state.player.y))*TILE_H/2 };
}
function unproject(screenX,screenY) {
  const u=(screenX-canvas.clientWidth/2)*2/TILE_W + state.player.x-state.player.y;
  const v=(screenY-canvas.clientHeight/2)*2/TILE_H + state.player.x+state.player.y;
  return {x:Math.round((u+v)/2),y:Math.round((v-u)/2)};
}

function polygon(points, fill, stroke = null) {
  ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}
}
function drawTile(x,y,type) {
  const s=project(x,y), hw=TILE_W/2, hh=TILE_H/2;
  const top=[s.x,s.y-hh], right=[s.x+hw,s.y], bottom=[s.x,s.y+hh], left=[s.x-hw,s.y];
  const colors = {
    grass: ['#345842','#2a4a39'], 'grass-flower':['#3b6245','#304f3b'], road:['#796f55','#665e4b'], stone:['#777b6b','#666c60'],
    water:['#28525b','#20464f'], cliff:['#3c4540','#2b3430'], tree:['#284633','#20382b'], cave:['#48514b','#38413c'], crystal:['#3e6966','#315451'], wall:['#252e2b','#1a2220']
  };
  const c=colors[type]||colors.grass;
  polygon([top,right,bottom,left],c[0],'#0d1b1730');
  polygon([left,[s.x,s.y],[s.x,s.y+hh],bottom],c[1]);
  if(type==='grass-flower'){
    ctx.fillStyle=hash2(x,y,28)>.5?'#d3d49a':'#e2be83';ctx.globalAlpha=.8;ctx.fillRect(s.x+(hash2(x,y,14)-.5)*20,s.y+(hash2(x,y,15)-.5)*7,2,2);ctx.globalAlpha=1;
  } else if(type==='road'||type==='stone'){
    ctx.strokeStyle='#b0a48030';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(s.x-6,s.y-1);ctx.lineTo(s.x,s.y-4);ctx.lineTo(s.x+5,s.y-1);ctx.stroke();
  } else if(type==='water'){
    ctx.strokeStyle='#8cc5bc38';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(s.x-8,s.y);ctx.lineTo(s.x-2,s.y-2);ctx.lineTo(s.x+5,s.y);ctx.stroke();
  } else if(type==='crystal'){
    polygon([[s.x-4,s.y-2],[s.x-1,s.y-10],[s.x+3,s.y-3],[s.x+1,s.y+1]],'#76d4cd','#a9fff0');
  } else if(type==='cave'){
    if(hash2(x,y,44)>.80){ctx.fillStyle='#78857a';ctx.fillRect(s.x-4,s.y-2,2,2);ctx.fillRect(s.x+4,s.y+2,2,2);}
  }
  if(showGrid){ctx.strokeStyle='#e6dfb722';ctx.beginPath();ctx.moveTo(top[0],top[1]);ctx.lineTo(right[0],right[1]);ctx.lineTo(bottom[0],bottom[1]);ctx.lineTo(left[0],left[1]);ctx.closePath();ctx.stroke();}
}

function drawTree(x,y) {
  const s=project(x,y);
  // The foliage is intentionally layered and angular for an illustrated isometric look.
  ctx.fillStyle='#101c1785';ctx.beginPath();ctx.ellipse(s.x+3,s.y+4,13,5,0,0,Math.PI*2);ctx.fill();
  polygon([[s.x-3,s.y+3],[s.x+3,s.y+3],[s.x+2,s.y-13],[s.x-2,s.y-13]],'#6f4f34','#3e3628');
  polygon([[s.x,s.y-42],[s.x+14,s.y-26],[s.x+11,s.y-14],[s.x-12,s.y-13],[s.x-15,s.y-26]],'#386e49','#244b37');
  polygon([[s.x,s.y-48],[s.x+12,s.y-33],[s.x+4,s.y-25],[s.x-10,s.y-28],[s.x-13,s.y-36]],'#4e8753');
  polygon([[s.x-2,s.y-41],[s.x+4,s.y-31],[s.x-7,s.y-32]],'#76a764');
}
function drawHouse(x,y,w,h,kind) {
  const s=project(x+w/2,y+h/2), width=(w+h)*TILE_W/2-4, depth=(w+h)*TILE_H/2-3, wallH=25;
  const top=[s.x,s.y-depth/2-wallH], right=[s.x+width/2,s.y-wallH], front=[s.x,s.y+depth/2-wallH], left=[s.x-width/2,s.y-wallH];
  // Side and front walls.
  polygon([left,front,[s.x,s.y+depth/2],[s.x-width/2,s.y]],kind==='inn'?'#8e6848':'#816d51','#493c31');
  polygon([front,right,[s.x+width/2,s.y],[s.x,s.y+depth/2]],kind==='apothecary'?'#876b4e':'#ad8052','#493c31');
  polygon([top,right,front,left],kind==='elder'?'#4d7b64':kind==='apothecary'?'#786346':'#6d5947','#28362c');
  polygon([[s.x-width*.42,s.y-wallH+1],[s.x,s.y-depth/2-wallH-12],[s.x+width*.42,s.y-wallH+1],[s.x,s.y+depth*.18-wallH+1]],kind==='elder'?'#4e9676':kind==='apothecary'?'#b48d58':'#a75e49','#d2b27755');
  // Ridge line and doorway add scale.
  ctx.strokeStyle='#dbc99a88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(s.x,s.y-depth/2-wallH-12);ctx.lineTo(s.x,s.y+depth*.18-wallH+1);ctx.stroke();
  if(kind==='elder'){
    polygon([[s.x-5,s.y+4],[s.x+5,s.y+4],[s.x+5,s.y-13],[s.x-5,s.y-13]],'#392d24','#d0b27a');
    ctx.fillStyle='#e5d7ae';ctx.fillRect(s.x-1,s.y-6,2,2);
  } else {
    polygon([[s.x-5,s.y+depth*.11],[s.x+4,s.y+depth*.11],[s.x+4,s.y-6],[s.x-5,s.y-6]],'#4b3728','#d0ac73');
    if(kind==='apothecary'){ctx.fillStyle='#8fd1a1';ctx.fillRect(s.x+width*.25,s.y-14,4,5);}
  }
}
function drawHerb(x,y) {
  const s=project(x,y); const pulse=.7+.3*Math.sin(performance.now()/420+x*2);
  ctx.globalAlpha=.22*pulse;ctx.fillStyle='#9be0a7';ctx.beginPath();ctx.ellipse(s.x,s.y-2,13,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  polygon([[s.x,s.y+2],[s.x-6,s.y-7],[s.x-1,s.y-6],[s.x+1,s.y-14],[s.x+5,s.y-5],[s.x+9,s.y-7],[s.x+3,s.y+2]],'#74bb7a','#c4efac');
  ctx.fillStyle='#d8e9a3';ctx.fillRect(s.x-1,s.y-7,2,2);
}
function drawPortal(x,y) {
  const s=project(x,y), pulse=.8+.2*Math.sin(performance.now()/300);
  ctx.globalAlpha=.14*pulse;ctx.fillStyle='#75d6d1';ctx.beginPath();ctx.ellipse(s.x,s.y,18,8,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  polygon([[s.x,s.y-22],[s.x+9,s.y-9],[s.x+7,s.y+3],[s.x-7,s.y+3],[s.x-9,s.y-9]],'#365b59','#a9e9d6');
  polygon([[s.x,s.y-16],[s.x+4,s.y-8],[s.x+3,s.y],[s.x-3,s.y]],'#9ee0c8');
}
function drawCharacter(x,y,kind,name,selected=false) {
  const s=project(x,y), isElder=kind==='elder', isPlayer=kind==='player';
  ctx.fillStyle='#0b1511a0';ctx.beginPath();ctx.ellipse(s.x,s.y+4,isPlayer?9:8,4,0,0,Math.PI*2);ctx.fill();
  if(selected){ctx.strokeStyle='#e7d58f';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(s.x,s.y+2,13,6,0,0,Math.PI*2);ctx.stroke();}
  const robe=isPlayer?'#bb9861':isElder?'#83a98b':'#785c91';
  polygon([[s.x-7,s.y-1],[s.x+7,s.y-1],[s.x+5,s.y+7],[s.x-5,s.y+7]],robe,'#26362e');
  polygon([[s.x-5,s.y-10],[s.x+5,s.y-10],[s.x+6,s.y+1],[s.x,s.y+4],[s.x-6,s.y+1]],isPlayer?'#d6bd86':isElder?'#abc7a9':'#9875af','#26362e');
  ctx.fillStyle=isElder?'#b4b29a':isPlayer?'#d8b18c':'#b6a1ba';ctx.beginPath();ctx.arc(s.x,s.y-13,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=isElder?'#5d5344':isPlayer?'#3a2e26':'#362c3d';ctx.fillRect(s.x-5,s.y-16,10,4);
  if(isPlayer){ctx.strokeStyle='#d6e2bf';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(s.x+7,s.y-5);ctx.lineTo(s.x+11,s.y-17);ctx.stroke();ctx.fillStyle='#d4e4c9';ctx.fillRect(s.x+10,s.y-19,2,4);}
  const label=name || (isPlayer?'You':isElder?'Elder Shen':'');
  if(label){
    ctx.font='600 9px system-ui';const m=ctx.measureText(label).width;
    ctx.fillStyle='#10201aD9';ctx.fillRect(s.x-m/2-4,s.y-31,m+8,13);
    ctx.fillStyle=isPlayer?'#f2dca6':isElder?'#cfdfbf':'#e3c8c3';ctx.textAlign='center';ctx.fillText(label,s.x,s.y-22);
  }
}
function drawMonster(m) {
  const s=project(m.x,m.y); const chosen=m.id===selectedMonsterId;
  ctx.fillStyle='#0b1512a0';ctx.beginPath();ctx.ellipse(s.x,s.y+4,m.type==='boss'?13:10,4,0,0,Math.PI*2);ctx.fill();
  if(chosen){ctx.strokeStyle='#ffce9b';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(s.x,s.y+2,15,7,0,0,Math.PI*2);ctx.stroke();}
  if(m.type==='wolf'){
    polygon([[s.x-10,s.y-5],[s.x-7,s.y-12],[s.x-2,s.y-9],[s.x+5,s.y-9],[s.x+11,s.y-3],[s.x+6,s.y+3],[s.x-5,s.y+4]],'#8b8880','#3a3d37');
    polygon([[s.x-5,s.y-9],[s.x-8,s.y-16],[s.x-1,s.y-12]],'#a6a198');
    polygon([[s.x+2,s.y-9],[s.x+6,s.y-15],[s.x+8,s.y-8]],'#a6a198');
    ctx.fillStyle='#d78c6e';ctx.fillRect(s.x+3,s.y-7,2,2);
  }else if(m.type==='boar'){
    ctx.fillStyle='#80624a';ctx.beginPath();ctx.ellipse(s.x,s.y-4,11,8,0,0,Math.PI*2);ctx.fill();
    polygon([[s.x+5,s.y-7],[s.x+13,s.y-4],[s.x+6,s.y]],'#997357');
    polygon([[s.x-6,s.y-9],[s.x-8,s.y-14],[s.x-2,s.y-10]],'#8f6e54');
    ctx.fillStyle='#e6ceb0';ctx.fillRect(s.x+7,s.y-1,3,2);ctx.fillStyle='#e9a58b';ctx.fillRect(s.x+7,s.y-7,2,2);
  }else if(m.type==='wight'){
    polygon([[s.x-8,s.y-1],[s.x-8,s.y-12],[s.x-3,s.y-18],[s.x+4,s.y-17],[s.x+9,s.y-9],[s.x+7,s.y+3],[s.x-6,s.y+3]],'#536b64','#94c0ab');
    ctx.fillStyle='#8ee3c5';ctx.fillRect(s.x-4,s.y-11,3,2);ctx.fillRect(s.x+3,s.y-11,3,2);
  }else{
    polygon([[s.x-13,s.y+3],[s.x-10,s.y-12],[s.x-4,s.y-19],[s.x+5,s.y-19],[s.x+13,s.y-7],[s.x+10,s.y+4]],'#5b6461','#94d0b2');
    polygon([[s.x-8,s.y-12],[s.x-6,s.y-24],[s.x,s.y-17]],'#637e6d','#a1cbb0');
    polygon([[s.x+3,s.y-17],[s.x+9,s.y-25],[s.x+10,s.y-11]],'#637e6d','#a1cbb0');
    ctx.fillStyle='#c7fee0';ctx.fillRect(s.x-5,s.y-12,3,3);ctx.fillRect(s.x+4,s.y-12,3,3);
  }
  ctx.fillStyle='#101816';ctx.fillRect(s.x-10,s.y-28,20,3);ctx.fillStyle=m.type==='boss'?'#e78a77':'#d97f75';ctx.fillRect(s.x-10,s.y-28,20*Math.max(0,m.hp/m.maxHp),3);
  if(chosen){ctx.font='600 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#f3d3b6';ctx.fillText(m.name,s.x,s.y-34);}
}
function drawCaveProps(x,y) {
  const s=project(x,y);
  if(x===2&&y===8) drawPortal(x,y);
  if(tileAt('cave',x,y)==='crystal'){
    polygon([[s.x-4,s.y-2],[s.x-1,s.y-12],[s.x+4,s.y-4],[s.x+2,s.y+2]],'#75c3bd','#bcfff0');
    ctx.globalAlpha=.2;ctx.fillStyle='#85f2e2';ctx.beginPath();ctx.arc(s.x,s.y-4,10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
}

function renderWorld() {
  canvasResize();
  const width=canvas.clientWidth,height=canvas.clientHeight;
  ctx.fillStyle=state.area==='cave'?'#1a2421':'#263c31';ctx.fillRect(0,0,width,height);
  const worldW=state.area==='cave'?WORLD.caveWidth:WORLD.width, worldH=state.area==='cave'?WORLD.caveHeight:WORLD.height;
  const maxSum=worldW+worldH;
  for(let sum=0;sum<maxSum;sum++){
    const startX=Math.max(0,sum-(worldH-1)),endX=Math.min(worldW-1,sum);
    for(let x=startX;x<=endX;x++){
      const y=sum-x; if(y<0||y>=worldH)continue;
      const type=tileAt(state.area,x,y);drawTile(x,y,type);
      if(state.area==='valley'){
        if(type==='tree')drawTree(x,y);
        if(x===13&&y===15)drawHouse(11,12,3,3,'inn');
        if(x===18&&y===14)drawHouse(16,12,3,3,'elder');
        if(x===22&&y===17)drawHouse(20,15,3,3,'apothecary');
        const herb=HERB_NODES.find(n=>n.x===x&&n.y===y&&!state.gatheredHerbs.includes(n.id));if(herb)drawHerb(x,y);
        if(x===PORTAL.x&&y===PORTAL.y)drawPortal(x,y);
        if(x===ELDER.x&&y===ELDER.y)drawCharacter(x,y,'elder','Elder Shen');
      }else drawCaveProps(x,y);
      for(const m of monsters)if(m.x===x&&m.y===y)drawMonster(m);
      if(state.player.x===x&&state.player.y===y)drawCharacter(x,y,'player','');
    }
  }
  // Subtle haze gives the map a sense of depth without obscuring tile readability.
  const gradient=ctx.createRadialGradient(width*.50,height*.42,30,width*.50,height*.45,Math.max(width,height)*.72);
  gradient.addColorStop(0,'#c6e6c800');gradient.addColorStop(1,state.area==='cave'?'#07100e9e':'#0918129b');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  if(state.area==='valley'){
    // Distant mountain silhouettes are painted behind the playable tile field's upper rim.
    const haze=ctx.createLinearGradient(0,0,0,height*.28);haze.addColorStop(0,'#101e1e40');haze.addColorStop(1,'#101e1e00');ctx.fillStyle=haze;ctx.fillRect(0,0,width,height*.28);
  }
}

function pathTo(x,y) {
  const maxX=(state.area==='cave'?WORLD.caveWidth:WORLD.width)-2;
  const maxY=(state.area==='cave'?WORLD.caveHeight:WORLD.height)-2;
  x=Math.max(1,Math.min(maxX,x));y=Math.max(1,Math.min(maxY,y));
  if(isBlocked(state,x,y)){
    // Find the closest reachable tile around an obstacle instead of silently doing nothing.
    const options=[];
    for(let r=1;r<=3;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)if(Math.max(Math.abs(dx),Math.abs(dy))===r&&!isBlocked(state,x+dx,y+dy))options.push({x:x+dx,y:y+dy});
    options.sort((a,b)=>distance(a,playerPoint())-distance(b,playerPoint()));
    if(!options.length){toast('That path is blocked.');return false;}
    ({x,y}=options[0]);
  }
  const next=findPath(state,playerPoint(),{x,y},1600,monsters.map(m=>({x:m.x,y:m.y})));
  if(!next.length&&distance(playerPoint(),{x,y})>0){toast('No safe path to that tile.');return false;}
  path=next;movementGoal={x,y};
  if(path.length>0)toast('Moving…',650);
  else setTimeout(completePendingAction,0);
  return true;
}

function pathToNear(x,y) {
  const candidates=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    if(!dx&&!dy)continue;
    const px=x+dx,py=y+dy;
    if(isBlocked(state,px,py))continue;
    if(monsters.some(m=>m.x===px&&m.y===py))continue;
    const p=findPath(state,playerPoint(),{x:px,y:py},1600,monsters.map(m=>({x:m.x,y:m.y})));
    if(p.length||distance(playerPoint(),{x:px,y:py})===0)candidates.push({x:px,y:py,path:p});
  }
  candidates.sort((a,b)=>a.path.length-b.path.length);
  if(!candidates.length){toast('No way to approach that target.');return false;}
  path=candidates[0].path;movementGoal={x:candidates[0].x,y:candidates[0].y};
  if(path.length===0)setTimeout(completePendingAction,0);
  return true;
}

function canvasClick(event) {
  const rect=canvas.getBoundingClientRect();
  const point=unproject(event.clientX-rect.left,event.clientY-rect.top);
  const x=point.x,y=point.y;
  if(state.area==='valley'){
    const herb=HERB_NODES.find(n=>n.x===x&&n.y===y&&!state.gatheredHerbs.includes(n.id));
    if(herb){selectedHerbId=herb.id;selectedMonsterId=null;pathTo(herb.x,herb.y);pendingAction={type:'herb',id:herb.id};updateHud();return;}
    if(Math.abs(x-ELDER.x)<=1&&Math.abs(y-ELDER.y)<=1){selectedHerbId=null;selectedMonsterId=null;if(distance(playerPoint(),ELDER)<=2)talkToElder();else{pathToNear(ELDER.x,ELDER.y);pendingAction={type:'elder'};}return;}
    if(distance({x,y},PORTAL)<=1){pathTo(x,y);pendingAction={type:'portal'};return;}
  }else if(x===2&&y===8){pathTo(x,y);pendingAction={type:'exit'};return;}
  const monster=monsters.find(m=>m.x===x&&m.y===y);
  if(monster){selectedMonsterId=monster.id;selectedHerbId=null;updateTargetCard();updateHud();pathToNear(monster.x,monster.y);pendingAction={type:'attack',id:monster.id};return;}
  selectedMonsterId=null;selectedHerbId=null;pendingAction=null;pathTo(x,y);updateHud();updateTargetCard();
}
canvas.addEventListener('pointerdown',canvasClick);

function tickMovement(now) {
  if(heldDirection && now-heldMoveAt>170){stepDirection(heldDirection);heldMoveAt=now;}
  if(path.length && now-lastMoveAt>160){
    lastMoveAt=now;
    const next=path[0];
    if(isBlocked(state,next.x,next.y)){path=[];return;}
    if(monsters.some(m=>m.x===next.x&&m.y===next.y)) {
      if(movementGoal && pendingAction) {
        const reroute=findPath(state,playerPoint(),movementGoal,1600,monsters.map(m=>({x:m.x,y:m.y})));
        if(reroute.length){path=reroute;return;}
      }
      path=[];return;
    }
    state.player.x=next.x;state.player.y=next.y;path.shift();
    if(path.length===0){movementGoal=null;completePendingAction();}
    updateHud();
  }
}
function stepDirection(dir) {
  const deltas={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const [dx,dy]=deltas[dir]||[0,0];const x=state.player.x+dx,y=state.player.y+dy;
  if(!isBlocked(state,x,y)&&!monsters.some(m=>m.x===x&&m.y===y)){state.player.x=x;state.player.y=y;path=[];movementGoal=null;pendingAction=null;updateHud();}
}
function movementButtonSetup() {
  for(const button of document.querySelectorAll('[data-dir]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();heldDirection=button.dataset.dir;heldMoveAt=performance.now();stepDirection(heldDirection);try{button.setPointerCapture(e.pointerId);}catch{}});
    const clear=()=>{heldDirection=null;};button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('lostpointercapture',clear);
  }
  window.addEventListener('pointerup',()=>heldDirection=null);
}

function completePendingAction() {
  if(!pendingAction)return;
  const a=pendingAction;
  if(a.type==='herb'){
    const node=HERB_NODES.find(n=>n.id===a.id);
    if(node&&distance(playerPoint(),node)<=1){collectHerb(state,a.id);selectedHerbId=null;saveGame(true);updateAllUI();toast('Moonjade Herb gathered.');}
    pendingAction=null;
  }else if(a.type==='elder'){
    if(distance(playerPoint(),ELDER)<=2)talkToElder();pendingAction=null;
  }else if(a.type==='portal'){
    if(distance(playerPoint(),PORTAL)<=1)enterCave();pendingAction=null;
  }else if(a.type==='exit'){
    if(state.area==='cave'&&distance(playerPoint(),{x:2,y:8})<=1)exitCave();pendingAction=null;
  }else if(a.type==='attack'){
    const m=monsters.find(m=>m.id===a.id);
    if(m&&distance(playerPoint(),m)<=1){attackMonster(m);pendingAction=null;}
    else if(m){pathToNear(m.x,m.y);pendingAction={type:'attack',id:m.id};}
    else pendingAction=null;
  }
}

function talkToElder() {
  if(state.area!=='valley')return;
  const response=startElderQuest(state);saveGame(true);updateAllUI();
  showModal({icon:'♧',eyebrow:'VILLAGE PAVILION',title:'Elder Shen',body:response,actions:[{label:'Continue',style:'primary-button',run:closeModal},{label:'View quest',style:'secondary-button',run:()=>{closeModal();setPanel('journey',true);}}]});
}
function interact() {
  if(state.area==='valley'){
    if(distance(playerPoint(),ELDER)<=2){talkToElder();return;}
    const herb=HERB_NODES.find(n=>!state.gatheredHerbs.includes(n.id)&&distance(playerPoint(),n)<=1);
    if(herb){collectHerb(state,herb.id);saveGame(true);updateAllUI();toast('Moonjade Herb gathered.');return;}
    if(distance(playerPoint(),PORTAL)<=1){enterCave();return;}
    const nextHerb=HERB_NODES.find(n=>!state.gatheredHerbs.includes(n.id));
    toast(nextHerb?'Nothing nearby. The next herb is marked in your Field Notes.':'Nothing nearby to interact with.');
  }else{
    if(distance(playerPoint(),{x:2,y:8})<=1)exitCave();else toast('The cave walls are old and cold. Search deeper, or return to the entrance.');
  }
}
function enterCave() {
  if(state.area!=='valley')return;
  state.returnPoint={x:state.player.x,y:state.player.y};state.area='cave';state.player.x=3;state.player.y=8;path=[];movementGoal=null;pendingAction=null;spawnMonsters();saveGame(true);updateAllUI();
  showModal({icon:'✧',eyebrow:'HOLLOW VEIN CAVE',title:'A vein beneath the mountain',body:'The air turns cold. Faint crystals cling to the walls, and something heavy moves deeper in the passage. Keep a Healing Pill ready. The entrance remains behind you to the west.',actions:[{label:'Enter carefully',style:'primary-button',run:closeModal},{label:'Retreat',style:'secondary-button',run:()=>{closeModal();exitCave();}}]});
}
function exitCave() {
  if(state.area!=='cave')return;
  state.area='valley';state.player.x=state.returnPoint.x;state.player.y=state.returnPoint.y;path=[];movementGoal=null;pendingAction=null;spawnMonsters();saveGame(true);updateAllUI();toast('You emerge into the Verdant Reach.');
}

function nearestMonster(maxRange=99) {
  const candidates=monsters.filter(m=>distance(playerPoint(),m)<=maxRange).sort((a,b)=>distance(playerPoint(),a)-distance(playerPoint(),b));
  return candidates[0]||null;
}
function selectMonster(m) { if(!m){toast('No beast is close enough.');return null;}selectedMonsterId=m.id;selectedHerbId=null;updateTargetCard();updateHud();return m; }
function performAttack() {
  let m=currentMonster(); if(!m)m=selectMonster(nearestMonster(6));
  if(!m){toast('Select a beast first, or move closer.');return;}
  if(distance(playerPoint(),m)>1){pathToNear(m.x,m.y);pendingAction={type:'attack',id:m.id};toast(`${m.name} selected. Closing distance.`);return;}
  attackMonster(m);
}
function attackMonster(m) {
  if(!m||!monsters.some(x=>x.id===m.id))return;
  if(distance(playerPoint(),m)>1){toast('Move closer to strike.');return;}
  const p=state.player;
  const damage=12+p.stage*2+(p.realmIndex*3)+(p.aptitude.includes('Flame')?4:0);
  m.hp-=damage;
  addLog(state,`You strike ${m.name} for ${damage} damage.`);
  if(m.hp<=0){defeatMonster(m);return;}
  monsterRetaliation(m,Math.max(1,Math.floor(m.damage*.65)));
  updateAllUI();saveGame(true);
}
function castSpiritBolt() {
  let m=currentMonster(); if(!m)m=selectMonster(nearestMonster(5));
  if(!m){toast('No target in sight.');return;}
  if(distance(playerPoint(),m)>5){toast(`${m.name} is beyond spirit-bolt range.`);return;}
  if(!spendQi(state,8)){toast('Not enough qi. Meditate before using a technique.');return;}
  const damage=21+state.player.stage*3+state.player.realmIndex*5+(state.player.aptitude.includes('Flame')?4:0);
  m.hp-=damage;addLog(state,`Spirit Bolt hits ${m.name} for ${damage} damage.`);
  if(m.hp<=0)defeatMonster(m);else if(distance(playerPoint(),m)<=m.aggro)monsterRetaliation(m,Math.max(1,Math.floor(m.damage*.45)));
  saveGame(true);updateAllUI();
}
function monsterRetaliation(m,damage) {
  if(state.area==='valley'&&safeZone())return;
  if(distance(playerPoint(),m)<=1){state.player.hp=Math.max(0,state.player.hp-damage);addLog(state,`${m.name} hits you for ${damage} damage.`);}
  if(state.player.hp<=0)playerDefeated();
}
function defeatMonster(m) {
  monsters=monsters.filter(x=>x.id!==m.id);
  if(!state.deadMonsters.includes(m.id))state.deadMonsters.push(m.id);
  state.player.stones+=m.reward;state.player.renown+=m.reward;
  if(m.drop==='spirit_core')state.inventory.spirit_core+=1;
  else if(m.drop==='cave_crystal')state.inventory.cave_crystal+=1;
  else if(m.drop==='sect_token')state.inventory.sect_token+=1;
  addLog(state,`${m.name} defeated. +${m.reward} spirit stones${m.drop?`, ${ITEMS[m.drop]?.name||'item'} found`:''}.`);
  toast(`${m.name} defeated. Loot collected.`);
  if(m.id==='cave-guardian'){
    state.flags.caveCleared=true;
    showModal({icon:'✧',eyebrow:'RUIN DISCOVERED',title:'The sealed vein',body:'The Hollow Guardian breaks apart, revealing a token stamped with an unfamiliar sect seal. This cave is now clear. Whatever order used this place left more behind than mineral wealth.',actions:[{label:'Take the token',style:'primary-button',run:closeModal}]});
  }
  if(selectedMonsterId===m.id)selectedMonsterId=null;
  updateAllUI();saveGame(true);
}
function playerDefeated() {
  const loss=Math.floor(state.player.stones*.1);state.player.stones-=loss;state.player.hp=state.player.maxHp;state.player.qi=Math.floor(state.player.qi*.7);
  if(state.area==='cave'){
    state.area='valley';state.player.x=state.returnPoint.x;state.player.y=state.returnPoint.y;
  }else{state.player.x=17;state.player.y=19;}
  path=[];movementGoal=null;pendingAction=null;spawnMonsters();addLog(state,`You were carried back to the village. ${loss} spirit stones were lost; qi is unsettled.`);saveGame(true);updateAllUI();
  showModal({icon:'☯',eyebrow:'QI RECOIL',title:'A narrow escape',body:`Your consciousness returns at the village shrine. The village healer restores your health, but ${loss} spirit stones were lost and some qi dispersed. Prepare better before returning.`,actions:[{label:'Recover',style:'primary-button',run:closeModal}]});
}

function performMeditation() {
  const now=performance.now();
  if(now-lastMeditateAt<1100){toast('Breathe slowly. Let the qi settle.');return;}
  lastMeditateAt=now;
  if(state.player.qi>=state.player.maxQi){toast('Your qi is already at its natural limit.');return;}
  if(!safeZone()&&state.area==='valley'&&monsters.some(m=>distance(playerPoint(),m)<=3)){toast('Too much danger to meditate here. Retreat to a quiet place.');return;}
  const gained=meditate(state,14);if(gained===0){toast('No qi gained.');return;}
  saveGame(true);updateAllUI();toast(`Meditation gathered ${gained} qi.`);
}
function performBreakthrough() {
  const result=breakthrough(state,Math.random);
  toast(result.reason,3200);
  if(result.ok){showModal({icon:'✧',eyebrow:'REALM ADVANCEMENT',title:'Meridians renewed',body:result.reason,actions:[{label:'Continue',style:'primary-button',run:closeModal}]});}
  saveGame(true);updateAllUI();
}
function usePill() {
  const result=useHealingPill(state);toast(result.reason);saveGame(true);updateAllUI();
}

function tickMonsters(now) {
  if(now-lastMonsterAt<950)return;lastMonsterAt=now;
  if(state.player.hp<=0)return;
  for(const m of [...monsters]){
    const d=distance(playerPoint(),m);
    if(d>m.aggro)continue;
    if(state.area==='valley'&&safeZone())continue;
    if(d<=1){monsterRetaliation(m,m.damage);if(state.player.hp<=0)break;continue;}
    // Monsters advance deliberately one tile at a time, never diagonally through an obstacle.
    const dx=Math.sign(state.player.x-m.x),dy=Math.sign(state.player.y-m.y);
    const moves=[[dx,dy],[dx,0],[0,dy],[dy,dx]];
    for(const [mx,my] of moves){
      if(!mx&&!my)continue;const nx=m.x+mx,ny=m.y+my;
      if(nx===state.player.x&&ny===state.player.y)continue;
      if(isBlocked(state,nx,ny)||monsters.some(other=>other.id!==m.id&&other.x===nx&&other.y===ny))continue;
      if(mx&&my&&(isBlocked(state,m.x+mx,m.y)||isBlocked(state,m.x,m.y+my)))continue;
      m.x=nx;m.y=ny;break;
    }
  }
  updateTargetCard();updateMiniMap();
}

function gameLoop(now) {
  const delta=lastFrame?Math.min(100,now-lastFrame):0;lastFrame=now;
  state.playSeconds+=delta/1000;
  tickMovement(now);tickMonsters(now);renderWorld();
  if(now-lastUiAt>450){updateHud();updateTargetCard();lastUiAt=now;}
  if(now-lastSaveAt>8000){saveGame(true);lastSaveAt=now;}
  requestAnimationFrame(gameLoop);
}

function setupButtons() {
  $('saveButton').addEventListener('click',()=>saveGame(false));
  $('characterButton').addEventListener('click',()=>showCharacterCreator(false));
  $('characterButton').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showCharacterCreator(false);}});
  $('settingsButton').addEventListener('click',showSettings);
  $('interactButton').addEventListener('click',interact);
  $('attackButton').addEventListener('click',performAttack);
  $('spellButton').addEventListener('click',castSpiritBolt);
  $('healButton').addEventListener('click',usePill);
  $('meditateButton').addEventListener('click',performMeditation);
  $('breakthroughButton').addEventListener('click',performBreakthrough);
  $('questButton').addEventListener('click',()=>setPanel('journey',true));
  $('bagButton').addEventListener('click',()=>setPanel('bag',true));
  $('qiButton').addEventListener('click',()=>setPanel('cultivation',true));
  document.querySelectorAll('.panel-tab').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel,false)));
  window.addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(e.key==='Escape'){if(!state.flags.characterCreated)return;closeModal();closeMobilePanel();return;}
    if($('modalScrim').hidden===false)return;
    const key=e.key.toLowerCase();
    if(key==='e')interact();else if(key==='1')performAttack();else if(key==='2')castSpiritBolt();else if(key==='3')usePill();else if(key==='q')performMeditation();
    else if(['arrowup','w'].includes(key))stepDirection('up');else if(['arrowdown','s'].includes(key))stepDirection('down');else if(['arrowleft','a'].includes(key))stepDirection('left');else if(['arrowright','d'].includes(key))stepDirection('right');
  });
  movementButtonSetup();
}

initMobilePanelClose();spawnMonsters();setupButtons();setPanel('journey');updateAllUI();
if(!state.flags.characterCreated)showCharacterCreator(true);
if(state.area==='cave'&&(state.player.x>=WORLD.caveWidth-1||tileAt('cave',state.player.x,state.player.y)==='wall')){state.player.x=3;state.player.y=8;}
window.addEventListener('resize',()=>{canvasResize();updateMiniMap();});
window.addEventListener('pagehide',()=>saveGame(true));
window.addEventListener('beforeunload',()=>saveGame(true));
requestAnimationFrame(gameLoop);
