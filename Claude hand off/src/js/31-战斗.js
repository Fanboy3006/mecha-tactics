/* ---------- 战斗 ---------- */
const THEMES = [
  {name:'光束对抗', units:['beamcoat','mirror','phase']},
  {name:'看不见的敌人', units:['stealth','swarm','jammer']},
  {name:'重甲', units:['beetle','regen','venom']},
  {name:'指挥系统', units:['captain','berserker','funnel','sniper','bomber']},
  {name:'机动部队', units:['fighter','hound','raider','drone']},
];
const AFFIXES = [
  /* v0.34.2 护盾词缀：只给精锐 / 头目 / Boss，量 = 1000 × 层数，打掉就没了（不再每回合回满）；杂兵不带 */
  {name:'护盾', desc:'精锐、头目、Boss 获得一次性护盾（1000 × 层数，打掉不再恢复）', fn:e => { const k = Object.keys(ENEMY_T).find(id => ENEMY_T[id].mech === e.mech); if (tierOfEnemy(k) === '杂兵') return; const n = 1000 * ((RUN && RUN.layer) || 1); if (!e.shield) e.shieldNoRegen = true; e.shield = (e.shield || 0) + n; e.shieldHp = e.shield;   /* 自带护盾的（空中要塞等）照旧回满 */ e.shieldName = e.shieldName || '护盾'; }},
  {name:'强化', desc:'所有敌人 HP +30%', fn:e => { e.maxHp = Math.round(e.maxHp * 1.3); e.hp = e.maxHp; }},
  {name:'光束抗性', desc:'所有敌人光束抗性 −40%', fn:e => { e.weak = {...(e.weak || {}), 光束:(e.weak && e.weak.光束 || 0) - 40}; }},
  {name:'物理抗性', desc:'所有敌人物理抗性 −40%', fn:e => { e.weak = {...(e.weak || {}), 物理:(e.weak && e.weak.物理 || 0) - 40}; }},
  {name:'疾行', desc:'所有敌人移动 +2', fn:e => { e.mov += 2; }},
  {name:'再生', desc:'所有敌人获得「自修复」', fn:e => { if (!e.abilities.includes('regen')) e.abilities.push('regen'); }},
];
function genArena(sd, W, H){
  const r = mulberry32(sd), g = [...Array(H)].map(() => Array(W).fill('.'));
  const set = (x,y,c) => { if (x>=0 && y>=0 && x<W && y<H) g[y][x] = c; };
  for (let i=0; i<7; i++){ const cx = ri(r,3,W-3), cy = ri(r,0,H-1), rad = ri(r,1,2); for (let y=cy-rad; y<=cy+rad; y++) for (let x=cx-rad; x<=cx+rad; x++) if (r() < .75) set(x,y,'f'); }
  for (let i=0; i<2; i++){ const x = ri(r,8,W-9), y0 = ri(r,0,H-6), len = ri(r,3,6); for (let y=y0; y<y0+len; y++) set(x + (r() < .3 ? 1 : 0), y, 'm'); }
  if (r() < .5){ const cx = ri(r,9,W-10), cy = ri(r,2,H-3); for (let y=cy-1; y<=cy+1; y++) for (let x=cx-2; x<=cx+2; x++) set(x,y,'w'); }
  if (r() < .35){ const cx = ri(r,10,W-11), cy = ri(r,3,H-4); for (let y=cy-1; y<=cy+1; y++) for (let x=cx; x<=cx+1; x++) set(x,y,'c'); }
  /* v0.33 战线：用不可进入的地形把中段切成 1–3 条战线（25% / 45% / 30%）。
     分隔带横贯 x = 6 … W-5，全是裂谷（地面不可通行，飞行可越过，不挡视线），旁边零星山地（挡直射）；
     每条分隔带留 1–2 个缺口当交叉通道；两端（出击区、敌方集结区）保持开阔。 */
  const lr = r(), lanes = lr < .25 ? 1 : lr < .7 ? 2 : 3, x0 = 6, x1 = W - 5;
  const wall = (y, gaps) => { for (let x = x0; x <= x1; x++){ if (gaps.some(gx => Math.abs(x - gx) <= 1)) { set(x, y, '.'); continue; } set(x, y, 'c'); if (r() < .15) set(x, y + (r() < .5 ? -1 : 2), 'm'); } };   // 墙本身全是裂谷（不可进入），旁边零星山地挡直射
  const gapsFor = () => { const n = r() < .7 ? 1 : 2, out = []; for (let i = 0; i < n; i++) out.push(ri(r, x0 + 3, x1 - 3)); return out; };
  if (lanes === 1){
    const top = ri(r, 3, 4), bot = H - 1 - ri(r, 3, 4);   // 中间一条宽走廊，上下两侧是裂谷 / 山地
    for (let x = x0; x <= x1; x++){ for (let y = 0; y < top; y++) set(x, y, 'c'); for (let y = bot + 1; y < H; y++) set(x, y, 'c'); if (r() < .12) set(x, top, 'm'); if (r() < .12) set(x, bot, 'm'); }
  } else {
    /* v0.34.1 战线收窄（作者：两边的路太宽）：上下外缘也封上（2 条战线封 2 行、3 条封 1 行），分隔墙固定 2 行厚。
       16 行高的地图：2 条战线各 5 行；3 条战线 3 / 4 / 3 行 */
    const ob = lanes === 2 ? 2 : 1;
    for (let x = x0; x <= x1; x++){ for (let y = 0; y < ob; y++) set(x, y, 'c'); for (let y = H - ob; y < H; y++) set(x, y, 'c'); }
    const inner = H - 2 * ob - 2 * (lanes - 1), base = Math.floor(inner / lanes), extra = inner - base * lanes, cuts = [];
    let y = ob; for (let i = 0; i < lanes - 1; i++){ y += base + (i === Math.floor(lanes / 2) - (lanes === 3 ? 0 : 1) && extra ? extra : 0); cuts.push(y); y += 2; }
    for (const cy of cuts){ const gs = gapsFor(); wall(cy, gs); wall(cy + 1, gs); }
  }
  /* v0.34 战线墙里混一段飞行也过不去的地形：50% 有一段 3 格绝壁（挡视线），30% 有一段 3 格重力深渊（不挡视线） */
  const seg = (ch, y) => { const sx = ri(r, x0 + 1, x1 - 3); for (let x = sx; x < sx + 3; x++) if (g[y] && g[y][x] === 'c') set(x, y, ch); };
  const wallRows = []; for (let y = 0; y < H; y++) if (g[y].slice(x0, x1 + 1).filter(c => c === 'c').length > (x1 - x0) / 2) wallRows.push(y);
  for (const y of wallRows.filter(y => !wallRows.includes(y - 1) || !wallRows.includes(y + 1))){ if (r() < .5) seg('x', y); if (r() < .3) seg('v', y); }   // 只改墙的边缘行
  g.lanes = lanes;
  return g;
}
/* v0.32 难度曲线：一层里随场次上升（第 1 层 Lv1→3、第 2 层 4→7、第 3 层 8→12、第 4 层 13→18），不再层间断崖 */
function runEnemyLv(kind, layer = RUN.layer){
  const base = [0, 1, 4, 8, 13][layer], span = [0, 2, 3, 4, 5][layer], n = RUN && RUN.layer === layer ? (RUN.layerBattles || 0) : 0;
  return base + Math.min(span, n) + (kind === 'elite' || kind === 'guard' || kind === 'source' ? (layer === 1 ? 1 : 2) : 0) + (kind === 'chase' ? 1 : 0);   // v0.33 第 1 层精英类只 +1
}

/* ---------- 肉鸽关卡编号 ----------
   编号格式：ISW-<层>-<类型>-<序号>，例如 ISW-1-N-3 = 第 1 层可能出现的第 3 个普通作战。
   类型：N 作战 / E 精英作战 / G 出口守军 / S 侵蚀源 / C 追击战 / F 终点。
   每个编号的地形、敌人、词缀都由编号决定（同一编号每次都一样），方便逐关精细设计。
   想手工设计某一关时，在 STAGE_OVERRIDES 里按编号覆盖：
     name, w, h, rows（地形字符串数组：. 平原 f 森林 m 山地 w 水域 c 裂谷）,
     enemies（[{t:'grunt', x, y, lv?}]，lv 不写就按层数）, affix（词缀名或 null）, spots（我方出击点 [[x,y],...]）, desc（关卡说明） */
const ELITE_UNITS = ['captain','venom','beetle','regen','funnel','berserker'];
const STAGE_KIND = {N:'battle', E:'elite', G:'guard', S:'source', C:'chase', F:'final'};
const KIND_CODE = {battle:'N', elite:'E', guard:'G', source:'S', chase:'C', final:'F'};
const KIND_NAME = {battle:'作战', elite:'精英作战', guard:'出口守军', source:'侵蚀源', chase:'追击战', final:'终点'};
const STAGE_POOL = {N:8, E:3, G:2, S:2, C:2};
/* 作者用关卡编辑器导出的改动，Claude 粘贴到这里（格式见编辑器「导出」）。肉鸽关并入 STAGE_OVERRIDES，原型关在编辑器模块末尾生效。 */
const LEVEL_EDITS = {};
const STAGE_OVERRIDES = {
  // 例：'ISW-1-N-1': {name:'起始回廊', enemies:[{t:'grunt', x:20, y:7}, {t:'grunt', x:21, y:9}], desc:'教学用的第一战'},
  'ISW-1-N-7': {why:'作者反馈太简单（反馈表第 20 条）：第 1 波加指挥官机，第 2 波提前到第 2 回合，新增第 3 波',
    enemies:[{t:'berserker', x:17, y:8, facing:'left', lv:1}, {t:'drone', x:23, y:2, facing:'left', lv:1}, {t:'funnel', x:18, y:7, facing:'left', lv:1}, {t:'bomber', x:18, y:6, facing:'left', lv:1}, {t:'captain', x:25, y:8, facing:'left', lv:3}],
    waves:[{at:2, enemies:[{t:'bomber', x:23, y:9, facing:'left', lv:1}, {t:'bomber', x:21, y:12, facing:'left', lv:1}, {t:'artillery', x:23, y:8, facing:'left', lv:1}, {t:'venom', x:23, y:14, facing:'left', lv:3}]},
           {at:4, enemies:[{t:'berserker', x:25, y:12, facing:'left', lv:1}, {t:'berserker', x:25, y:14, facing:'left', lv:1}, {t:'tank', x:23, y:0, facing:'left', lv:1}]}]},
};
Object.assign(STAGE_OVERRIDES, BOSS_STAGES);   // 关底 Boss（30c，关卡对话）
for (const [k, o] of Object.entries(LEVEL_EDITS)) if (k.startsWith('ISW-')) STAGE_OVERRIDES[k] = {...(STAGE_OVERRIDES[k] || {}), ...o};
const NAME_A = ['破碎','扭曲','沉没','回响','锈蚀','坠落','双生','裂隙','倒悬','静默','燃烧','冰封','错位','遗忘','镜像','漂流'];
const NAME_B = ['回廊','广场','船坞','花园','站台','矿坑','神殿','街区','格纳库','长桥','港湾','穹顶','荒原','塔楼','隧洞','庭院'];
const strHash = str => [...str].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
/* 关卡搬家：整关（地形、敌人构成、词缀、名字都不变）挪到别的层，换新编号；旧编号作废、不再复用。
   原来那一层同类关卡少了一个，会自动补一个新生成的（序号接着往后排）。敌人等级和数量按新的层数算；
   词缀原本也跟着层数随机，要保留的写进 keep。 */
const STAGE_MOVES = {
  'ISW-1-G-2': {to:'ISW-3-G-3', keep:{affix:'护盾'}, why:'作者试玩：第 1 层出口守军「锈蚀矿坑」太难（护盾词缀让 17 台敌人每回合回满 3000 护盾，还有 λ 试作机），挪到第 3 层'},
};
const STAGES = {};
(() => {
  const parse = code => { const [, L, K, i] = code.match(/^ISW-(\d+)-([A-Z])-(\d+)$/); return {layer:+L, K, i:+i}; };
  const make = (code, from = code, keep = {}) => {
    const {layer, K} = parse(code), src = parse(from), seed = strHash(from) & 0xffffff, r = mulberry32(seed ^ 0x5bd1);
    STAGES[code] = {code, layer, kind:STAGE_KIND[K], seed, name:NAME_A[Math.floor(r()*NAME_A.length)] + NAME_B[Math.floor(r()*NAME_B.length)], theme:(src.layer + src.i + strHash(src.K)) % THEMES.length, ...(from !== code ? {movedFrom:from} : {}), ...(STAGE_OVERRIDES[from] || {}), ...keep, ...(STAGE_OVERRIDES[code] || {})};
  };
  const add = (layer, K, i) => { const code = `ISW-${layer}-${K}-${i}`; if (!STAGE_MOVES[code]) make(code); };
  for (let L = 1; L <= 3; L++) for (const [K, n] of Object.entries(STAGE_POOL)) if (K !== 'S' || L >= 2) for (let i = 1; i <= n; i++) add(L, K, i);
  add(4, 'F', 1);
  for (const [from, mv] of Object.entries(STAGE_MOVES)){
    make(mv.to, from, mv.keep);
    const {layer, K} = parse(from);                     // 原层补一个新关（序号接着往后排）
    let i = STAGE_POOL[K] + 1; while (STAGES[`ISW-${layer}-${K}-${i}`] || STAGE_MOVES[`ISW-${layer}-${K}-${i}`] || Object.values(STAGE_MOVES).some(m => m.to === `ISW-${layer}-${K}-${i}`)) i++;
    make(`ISW-${layer}-${K}-${i}`);
  }
})();
const stagesOf = (layer, kind) => Object.values(STAGES).filter(s => s.layer === layer && s.kind === kind);
/* 由编号生成关卡内容（纯函数：同一编号结果相同；extra = 强化增援额外敌人数） */
function buildStage(st, extra = 0){
  const kind = st.kind, r = mulberry32(st.seed);
  const W = st.w || (kind === 'final' ? 30 : 26), H = st.h || (kind === 'final' ? 18 : 16);
  const g = st.rows ? st.rows.map(row => [...row]) : genArena(st.seed, W, H);
  const theme = THEMES[st.theme % THEMES.length], lv = runEnemyLv(kind, st.layer);
  const obj = stageObj(st), L = st.layer, T = (tier, n) => tierPick(r, theme, tier, n, L), boss = () => ENEMY_BOSS[Math.floor(r() * ENEMY_BOSS.length)];
  /* v0.32 按梯队配兵：杂兵给 AOE 清，精锐各有克制，头目带范围护壁要集火 / 近卫补刀 */
  let keys = [], later = [], targets = 0;
  if (!st.enemies){
    if (kind === 'battle'){
      if (obj === 'survive') keys = [...T('杂兵', 3 + L), ...T('精锐', 1)];
      else if (obj === 'targets'){ targets = L >= 2 ? 3 : 2; keys = [...T('头目', targets), ...T('杂兵', 2 + L), ...T('精锐', 1)]; }
      else { keys = [...T('杂兵', 3 + L), ...T('精锐', 1), ...(L >= 2 ? T('头目', 1) : [])]; later.push([...T('杂兵', 2 + L), ...(L >= 2 ? T('精锐', 1) : []), ...T('头目', 1)]); }
    }
    if (kind === 'source'){ keys = [...T('杂兵', 3 + L), ...T('精锐', 2), ...T('头目', 1)]; later.push([...T('杂兵', 2 + L), ...T('精锐', 1), ...T('头目', 1)]); }
    if (kind === 'elite' || kind === 'guard'){
      /* v0.33 第 1 层：精英战不出 Boss（压轴改成 2 个头目），出口守军的 Boss 只在最后一波；第 2 层起才是原来的配置 */
      if (L === 1){ keys = [...T('杂兵', 4), ...T('精锐', 1), ...T('头目', 1)]; later.push([...T('杂兵', 3), ...T('精锐', 1)]); later.push(kind === 'guard' ? [...T('头目', 1), boss()] : T('头目', 2)); }
      else { keys = [...T('杂兵', 3 + L), ...T('精锐', 2), boss()]; later.push([...T('杂兵', 2 + L), ...T('精锐', 1), ...T('头目', 1)]); later.push([...T('精锐', 1), ...T('头目', 2), boss()]); }
    }
    if (kind === 'chase'){ keys = [...T('杂兵', 3 + L), ...T('精锐', 1), 'pursuer', 'pursuer']; later.push([...T('杂兵', 3 + L), 'pursuer']); }
    if (kind === 'final'){ keys = ['captain','tank','funnel','sniper','berserker','regen']; later.push(['venom','venom','skyfort','captain','bomber','bomber']); later.push(['flagship','fortress','venom','captain']); }
  }
  if (st.waves) later = [];
  const affixPool = L === 1 ? AFFIXES.filter(a => a.name !== '护盾' && a.name !== '再生') : AFFIXES;   // v0.34.2 第 1 层不出护盾、再生词缀
  const affixDefault = (kind === 'elite' || kind === 'guard' || kind === 'final') ? affixPool[Math.floor(r() * affixPool.length)] : null;
  const affix = 'affix' in st ? (st.affix ? AFFIXES.find(a => a.name === st.affix) : null) : affixDefault;
  const r2 = mulberry32(st.seed ^ 0x77);
  for (let i=0; i<extra; i++) keys.push(...tierPick(r2, theme, '杂兵', 1));
  const occ = [];
  const place = (list, eliteLv) => {
    const out = [];
    for (const k of list){
      const t = ENEMY_T[k];
      for (let tries = 0; tries < 400; tries++){
        const x = obj === 'reach' ? ri(r, Math.floor(W / 2) - 3, W - t.w - 5) : obj === 'targets' ? ri(r, Math.floor(W / 2), W - t.w - 6) : ri(r, W - 10, W - t.w - 1), y = ri(r, 1, H - t.h - 1), probe = {x, y, w:t.w, h:t.h};
        if (occ.some(o => distU(probe, o) < 1)) continue;
        if (!st.rows && tilesOf(probe).some(([a, b]) => g[b] && (['c','x','v'].includes(g[b][a]) || (!t.flying && g[b][a] === 'w')))) continue;   // v0.33 不把敌人放进裂谷，免得把战线墙挖穿
        occ.push(probe); out.push({t:k, x, y, facing:'left', lv: lv + TIER_LV[tierOfEnemy(k)]});
        break;
      }
    }
    return out;
  };
  const enemies = [];
  const pass = e => ({...(e.target ? {target:true} : {}), ...(e.guardZone ? {guardZone:e.guardZone} : {})});   // 手工关：斩首目标、守卫型
  if (st.enemies) for (const e of st.enemies){ enemies.push({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv || lv + (e.lvAdd || 0), ...pass(e)}); occ.push({x:e.x, y:e.y, w:ENEMY_T[e.t].w, h:ENEMY_T[e.t].h}); }
  enemies.push(...place(keys, false));
  for (let i = 0; i < targets && i < enemies.length; i++) enemies[enemies.length - keys.length + i].target = true;   // 斩首目标 = 最先配的那几个头目
  const waves = [{at:null, enemies}];
  if (st.waves) st.waves.forEach((wv, i) => { occ.length = 0; waves.push({at:wv.at || 3 + i*2, enemies:wv.enemies.map(e => ({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv || lv + (e.lvAdd || 0), ...pass(e)}))}); });
  else later.forEach((list, i) => { occ.length = 0; waves.push({at:3 + i*2, enemies:place(list, true)}); });
  for (const e of waves.flatMap(w => w.enemies)){ const t = ENEMY_T[e.t]; for (let j=0;j<t.h;j++) for (let i=0;i<t.w;i++) if (g[e.y+j] && (['c','x','v'].includes(g[e.y+j][e.x+i]) || (!t.flying && g[e.y+j][e.x+i] === 'w'))) g[e.y+j][e.x+i] = '.'; }
  const my = Math.floor(H/2);
  const spots = st.spots || [[2,my],[2,my-2],[2,my+2],[4,my-1],[4,my+1],[1,my-4],[1,my+4],[4,my-3],[4,my+3]].map(([x,y]) => [x, clamp(y,0,H-2)]);
  if (!st.rows) for (const [x,y] of spots) for (let j=0;j<2;j++) for (let i=0;i<2;i++) if (g[y+j] && g[y+j][x+i]) g[y+j][x+i] = '.';
  return {W, H, g, enemies, waves, spots, affix, theme, lv, obj};
}
async function runBattle(kind, code){
  RUN.battles++;
  if (!code || !STAGES[code]){ const pool = stagesOf(RUN.layer, kind); code = (pool[Math.floor(Math.random() * pool.length)] || {}).code; }
  const st = STAGES[code];
  const extra = RUN.erosion === 'reinforce' && !RUN.erosionCleared ? Math.max(1, Math.round((3 + RUN.layer) * .3)) : 0;
  const {W, H, g, enemies, waves, spots, affix, lv, obj} = buildStage(st, extra);
  RUN.layerBattles = (RUN.layerBattles || 0) + 1;
  const keys = waves.map(w => w.enemies.map(e => e.t).join(',')).join(' | ');
  const label = KIND_NAME[kind];
  const c = RUN.cmd;
  RUN.mods = {atk: c ? c.atk : 0, def: c ? c.def : 0, art:[0,10,20,30][skLv('炮术')], ecm:[0,5,10,15][skLv('电子战')], overload: RUN.erosion === 'overload' && !RUN.erosionCleared, fog: RUN.erosion === 'fog' && !RUN.erosionCleared};
  if (c){
    const base = COMMANDS.meteor;
    COMMANDS.meteorRun = {...base, name:'陨石召唤', dmg:Math.round(base.dmg * (1 + c.lead * .05)), cd:Math.max(1, base.cd - (skLv('月光加护') >= 2 ? 1 : 0) - Math.floor(c.know/3)), size: skLv('月光加护') >= 3 ? 5 : 3};
  }
  RUN.battleKind = kind; RUN.lostThis = []; RUN.bstat = {}; RUN.chestParts = 0;
  rlog('battle_start', {code, kind, lv, affix: affix ? affix.name : null, erosion: RUN.mods.overload || RUN.mods.fog || (RUN.erosion && !RUN.erosionCleared) ? RUN.erosion : null, enemies:keys});
  LEVELS.run = {
    run:true, affix, code, name:`${code} ${st.name} · ${label}${obj !== 'annihilate' ? ' · ' + OBJ_NAME[obj] : ''}${affix ? ' · 【' + affix.name + '】' : ''}`, w:W, h:H, speed:.6, formation:true, noCmd:true,
    rows:g.map(row => row.join('')), rosterList:RUN.units.map(u => ({...u})), maxDeploy:deployCap(), hangar:true, spots, allyFacing:'right',
    defaultDeploy:[...RUN.units].sort((a,b) => b.lv - a.lv).map(u => u.mech),
    waves: waves.map((w, i) => ({at:w.at, lv, label:`第 ${i+1} 波`, enemies:w.enemies})),
    onSpawn: e => { e.facing = 'left'; if (affix) affix.fn(e); relicApplyFoe(e, units.filter(u => u.side === 'ally')); },
    loadout:{init:RUN.loadouts || {}, save:lo => { RUN.loadouts = {...lo}; }, hide:(u, w) => !!(u.awakenSwap && Object.values(u.awakenSwap).includes(w.name)),
      note:'★ 是 Lv20 大招。宗介 U7 的 λ 武器不能直接带：λ 觉醒后，带上的单分子刀会变成隔空 λ 拳、散弹炮变成 λ 驱动·散弹炮。'},
    ...(obj === 'survive' ? {victory:{type:'survive', turns:SURVIVE_TURNS}, goalText:`坚守 ${SURVIVE_TURNS} 回合（撑到第 ${SURVIVE_TURNS + 1} 回合我方阶段）。敌人每 2 回合从右侧增援，打不完也没关系`,
          respawn:{every:2, lv, list:t => [...tierPick(Math.random, null, '杂兵', 2 + st.layer), ...(t >= 5 ? tierPick(Math.random, null, '精锐', 1) : [])]}}
      : obj === 'targets' ? {victory:{type:'targets'}, goalText:`斩首：击破所有标 ★ 的头目（${enemies.filter(e => e.target).length} 台）。杂兵${st.layer >= 2 ? '每回合' : '每 2 回合'}增援`,
          respawn:{every:st.layer >= 2 ? 1 : 2, lv, list:() => tierPick(Math.random, null, '杂兵', 2)}}
      : obj === 'reach' ? {victory:{type:'reachAny'}, zone:{x0:W - 3, y0:2, x1:W - 1, y1:H - 3}, goalText:'突破：任意一台我方机体进入右侧撤离区（绿色框）'}
      : {victory:{type:'annihilate'}, goalText:`击破全部 ${waves.length} 波敌军（第 2 波起按回合到达，清空当前敌人会让下一波提前出现）`}),
    tips: st.desc ? [{on:'turn:1', text:`<b>${code} ${st.name}</b><br>${st.desc}`}] : [],
    afterStart:() => {
      units.filter(u => u.side === 'ally').forEach(u => {
        if (RUN.erosion === 'gravity' && !RUN.erosionCleared){ u.flying = false; u.canFly = false; }
        if (skLv('后勤') >= 3) u.mov += 1;
      });
      /* v0.31 藏品：出击机体的常驻加成和属性；已在场的敌人补算减益 */
      { const al = units.filter(u => u.side === 'ally'); relicApplyAllies(al); relicBattleStart(al); units.filter(u => u.side === 'enemy').forEach(e => relicApplyFoe(e, al));
        if (RUN.relics && RUN.relics.length) log(`藏品生效：${RUN.relics.map(id => RELICS[id].name).join('、')}`, null, 'sys'); }
      rlog('deploy', {units:units.filter(u => u.side === 'ally').map(u => `${u.mech}:${u.lv}[${(u.loadout || []).join('/')}]`).join(','), cap:deployCap()});
      if (c){ const f = makeUnit(tplOf('M1'), 'ally', 0, 0); f.command = 'meteorRun'; for (let k=1;k<20;k++) levelUp(f); setCommander(f); }
      /* v0.30 补给箱：普通战 1 个、精英战 2 个，放在地图右半边的空地上 */
      { const want = (kind === 'elite' ? 2 : 1) + (hasRelic('f2') ? 1 : 0), W = LV.w, H = LV.h; let placed = 0;
        for (let tries = 0; tries < 200 && placed < want; tries++){
          const x = Math.floor(W / 2) + Math.floor(Math.random() * Math.max(1, W / 2 - 2)), y = 1 + Math.floor(Math.random() * Math.max(1, H - 2));
          if (occupant(x, y) || walls.has(y*N+x) || TER[map[y][x]].groundBlock) continue;
          const c = makeUnit(CHEST_T, 'neutral', x, y); c.facing = 'down'; units.push(c); placed++;
        }
        if (placed) log(`战场上有 ${placed} 个补给箱（HP 1500）：击破后获得源碳结晶或零件`, null, 'sys'); }
      if (affix) log(`精英词缀【${affix.name}】：${affix.desc}`, null, 'sys');
      if (RM() && RM().overload) log('侵蚀场【过载侵蚀】：我方伤害 +30%，每次攻击自身受到 5% 最大 HP 伤害', null, 'sys');
      refresh();
    },
  };
  runHide();
  startLevel('run');
  return new Promise(res => { RUN.battleDone = res; });
}
Hooks.on('unitDestroyed', c => {
  if (!(LV && LV.run && RUN) || !c.unit.chest) return;
  const both = hasRelic('f2'), cur = both || Math.random() < .6;   // 战地回收协议：两样都给
  if (cur){ const g = 3 + Math.floor(Math.random() * 3); RUN.he += g; addFloat(c.unit, `+${g} 源碳结晶`, '#ffd166'); log(`补给箱：源碳结晶 +${g}`, null, 'sys'); }
  if (both || !cur){ RUN.chestParts = (RUN.chestParts || 0) + 1; if (!both) addFloat(c.unit, '+零件', '#ffd166'); log('补给箱：获得零件（战后领取）', null, 'sys'); }
  if (Math.random() < .05){ RUN.chestRelic = true; log('补给箱里有一件藏品（战后挑选）', null, 'sys'); }
  rlog('chest', {mech: c.by ? c.by.mech : null});
}, '肉鸽：补给箱掉落');
Hooks.on('unitDestroyed', c => {
  if (!(LV && LV.run && RUN)) return;
  if (c.unit.side === 'ally') RUN.lostThis.push(c.unit);
  if (c.by && c.by.side === 'ally' && c.unit.side === 'enemy'){ const b = RUN.bstat[c.by.mech] = RUN.bstat[c.by.mech] || {dmg:0, hits:0, kills:0}; b.kills++; }
}, '肉鸽：记录被击破的单位（游玩记录）');
Hooks.on('strikeResolved', c => {
  if (!(LV && LV.run && RUN) || c.att.side !== 'ally') return;
  const b = RUN.bstat[c.att.mech] = RUN.bstat[c.att.mech] || {dmg:0, hits:0, kills:0};
  b.hits++; b.dmg += c.dmg || 0;
}, '肉鸽：统计我方伤害（游玩记录）');
Hooks.on('strikeResolved', c => {
  const rm = RM(); if (!rm || !rm.overload || c.att.side !== 'ally' || c.att.hp <= 0) return;
  const d = Math.round(c.att.maxHp * .05); c.att.hp = Math.max(0, c.att.hp - d); addFloat(c.att, `过载 ${d}`, '#ff5ec4');
  if (c.att.hp <= 0) destroy(c.att, null);
}, '肉鸽·过载侵蚀：我方每次攻击自损 5%');
async function runBattleEnd(win){
  const kind = RUN.battleKind;
  const unspawned = LV.waves ? LV.waves.slice(waveIdx + 1).reduce((a, w) => a + w.enemies.length, 0) : 0;
  rlog('battle_end', {kind, win, turns:turn, wavesSeen:waveIdx + 1, enemiesLeft:units.filter(u => u.side === 'enemy' && u.hp > 0).length + unspawned, lost:RUN.lostThis.map(u => u.mech).join(','),
    allies:units.filter(u => u.side === 'ally').map(u => `${u.mech}:${Math.round(u.hp/u.maxHp*100)}%`).join(','), stats:RUN.bstat, durBefore:RUN.dur});
  const lines = [];
  if (RUN.lostThis.length) lines.push(`被击破 ${RUN.lostThis.length} 台（不扣作战耐久）`);
  if (!win){
    const left = LV.victory.type === 'annihilate' ? units.filter(u => u.side === 'enemy' && u.hp > 0).length + unspawned : 3;   // v0.32 坚守 / 突破 / 斩首失败固定扣 3
    RUN.dur -= left;
    lines.push(`作战失败：剩余敌人 ${left} 台，作战耐久 −${left}`);
    runLog(`作战失败，剩余敌人 ${left} 台，耐久 −${left}`);
    if (RUN.dur <= 0){
      runShow();
      await dlg(`<div class="eyebrow">作战失败</div><h2>作战耐久耗尽</h2><p>${lines.join('<br>')}</p><div class="acts"><button class="btn primary" data-v="ok">结算</button></div>`);
      runGameOver('作战耐久耗尽'); return;
    }
  }
  if (RUN.dur <= 0){ runGameOver('作战耐久耗尽'); return; }
  if (kind === 'final'){ if (!win){ runShow(); await dlg(`<div class="eyebrow">终点</div><h2>作战失败</h2><p>${lines.join('<br>')}</p><div class="acts"><button class="btn primary" data-v="ok">继续</button></div>`); } runVictory(); return; }
  if (kind === 'final' && !win) lines.push('没能击败蓝色大肥鱼，但作战耐久还没耗尽，仍然算作通过。');
  const exp = {battle:5, elite:8, guard:9, source:9, chase:7}[kind] || 5, he = 2 + Math.floor(Math.random() * 4) + (kind === 'elite' ? 3 : 0);
  RUN.he += he;
  RUN.parts.forEach(p => { if (p.k === 'bloodcap') p.value += 2; });
  const tcls = randTicket();
  lines.unshift(`经验 +${exp}，源碳结晶 +${he}，获得【${ticketName(tcls)}】`);
  if (RUN.map && RUN.map.nodes[RUN.cur] && RUN.map.nodes[RUN.cur].type !== 'guard') emptyNode(RUN.map.nodes[RUN.cur]);
  if (kind === 'source'){ RUN.erosionCleared = true; lines.push(`侵蚀源被摧毁：【${EROSIONS[RUN.erosion].name}】解除`); }
  runLog(`${LV.name} ${win ? '胜利' : '失败'}（${turn} 回合）`);
  runShow();
  await dlg(`<div class="eyebrow" style="color:${win ? 'var(--good)' : 'var(--enemy)'}">${LV.name}</div><h2>${win ? '作战胜利' : '作战失败 · 仍然结算'}</h2><p>${lines.join('<br>')}</p><div class="acts"><button class="btn primary" data-v="ok">继续</button></div>`);
  await gainExp(exp, '作战');
  if (RUN.cmd) await cmdXP({battle:1, elite:2, guard:2, source:2, chase:2}[kind] || 1);
  if (kind === 'elite' || Math.random() < .35) await givePart(pick(Object.keys(PARTS)), '战利品');
  for (let i = 0; i < (RUN.chestParts || 0); i++) await givePart(pick(Object.keys(PARTS)), '补给箱'); RUN.chestParts = 0;
  if (win && kind === 'elite') await offerRelics(['普通', '稀有'], '精英战');
  if (win && (kind === 'guard' || kind === 'final')) await offerRelics(['稀有', '传说'], kind === 'final' ? '蓝色大肥鱼' : '层底守军');
  if (RUN.chestRelic){ RUN.chestRelic = false; await offerRelics(['普通'], '补给箱'); }
  addTicket(tcls, '战后');
  await useTicket(RUN.tickets.length - 1);
  if (kind === 'guard' || kind === 'chase'){ if (kind === 'chase') RUN.chased = true; await enterLayer(RUN.layer + 1); }
  runRender();
  RUN.battleDone && RUN.battleDone();
}
async function runChase(){
  await dlg(`<div class="eyebrow" style="color:var(--enemy)">推进剂耗尽</div><h2>追击战</h2><p>推进剂用完了，迷宫里的追兵追了上来。打完这一场就会冲进下一层（下一层推进剂上限 −2）；打输的话，剩余敌人数会扣作战耐久。</p><div class="acts"><button class="btn primary" data-v="ok">迎战</button></div>`);
  const cp = stagesOf(RUN.layer, 'chase'); await runBattle('chase', cp.length ? cp[(RUN.seedBase + RUN.layer) % cp.length].code : null);
}
async function runFinal(){
  await passageDlg(`<div class="eyebrow" style="color:var(--enemy)">终点</div><h2>蓝色大肥鱼</h2><p>穿过 3 层航区，迷宫最深处，一条巨大的蓝色大肥鱼正游向终点。</p>`, '<button class="btn primary" data-v="ok">出击</button>');   // v0.40.8 出击前可以用招募券
  await runBattle('final', 'ISW-4-F-1');
}
async function cmdXP(x){
  const c = RUN.cmd; c.xp += x;
  while (c.lv < XP_NEED.length && c.xp >= XP_NEED[c.lv]){
    c.lv++;
    const st = pick(['atk','def','lead','know']); c[st]++;
    const opts = sample(Object.keys(SKILLS).filter(k => (c.skills[k] || 0) < 3 && (c.skills[k] || Object.keys(c.skills).length < 6)), 3);
    const v = await dlg(`<div class="eyebrow" style="color:#9fb7d8">指挥官升级</div><h2>Feena 升到 Lv${c.lv}</h2><p>${({atk:'攻击',def:'防御',lead:'统率',know:'知识'})[st]} +1。选择一个二级技能：</p>
      <div class="rcards">${opts.map(k => { const l = (c.skills[k] || 0) + 1; return `<button class="rcard" style="--fc:#9fb7d8" data-v="${k}"><b>${k} · ${['','初级','中级','高级'][l]}</b><small>${SKILLS[k].desc[l-1]}</small></button>`; }).join('')}</div>`, true);
    c.skills[v] = (c.skills[v] || 0) + 1;
    runLog(`Feena 升到 Lv${c.lv}，学会 ${v}（${['','初级','中级','高级'][c.skills[v]]}）`);
  }
}
function runPromote(m){
  const u = RUN.units.find(x => x.mech === m); if (!u) return;
  const to = u.lv === 10 ? 20 : u.lv === 20 ? 30 : null; if (!to) return;
  const cost = promoCost(m, to); if (cost > RUN.hope) return;
  RUN.hope -= cost; u.lv = to; if (RUN.promoDiscount) RUN.promoDiscount = false;
  if (to === 20 && CAP_CHARS.includes(m)){ RUN.capBonus++; runLog(`${tplOf(m).pilot} 晋升 Lv20：出击上限 +1`); }
  runLog(`${tplOf(m).pilot} 晋升到 Lv${to}（−${cost} 希望）`);
  runRender();
}
function runVictory(){
  RUN.over = true; rlog('run_end', runSummary('通关')); rlogFlush(true); runShow();
  $('#runView').querySelector('.rv-main').innerHTML = `<div class="rv-card" style="grid-column:1/-1"><h3>通关</h3><h2 style="font-family:var(--font-d);font-size:34px;margin:0">蓝色大肥鱼被击败</h2>
    <p>作战 ${RUN.battles} 场 · 剩余作战耐久 ${RUN.dur} · 队伍 ${RUN.units.length} 人${RUN.cmd ? ` · Feena Lv${RUN.cmd.lv}` : ''}</p>
    <p class="small">局外成长树和多结局还没做（占位）。</p><button class="btn primary" id="rvAgain">再来一局</button></div>`;
  $('#rvAgain').onclick = () => { RUN = null; runStartScreen(); };
}
function runGameOver(why){
  RUN.over = true; rlog('run_end', runSummary(why)); rlogFlush(true); runShow();
  $('#runView').querySelector('.rv-main').innerHTML = `<div class="rv-card" style="grid-column:1/-1"><h3>本局结束</h3><h2 style="font-family:var(--font-d);font-size:34px;margin:0">${why}</h2>
    <p>到达第 ${RUN.layer} 层 · 作战 ${RUN.battles} 场 · 队伍 ${RUN.units.length} 人</p><button class="btn primary" id="rvAgain">再来一局</button></div>`;
  $('#rvAgain').onclick = () => { RUN = null; runStartScreen(); };
}


