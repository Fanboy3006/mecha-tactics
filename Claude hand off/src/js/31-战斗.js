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
const KIND_NAME = {battle:'作战', elite:'精英作战', guard:'出口守军', source:'侵蚀源', chase:'追击战', final:'终点 · 迷宫之主'};
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
  if (st.enemies) for (const e of st.enemies){ enemies.push({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv || lv}); occ.push({x:e.x, y:e.y, w:ENEMY_T[e.t].w, h:ENEMY_T[e.t].h}); }
  enemies.push(...place(keys, false));
  for (let i = 0; i < targets && i < enemies.length; i++) enemies[enemies.length - keys.length + i].target = true;   // 斩首目标 = 最先配的那几个头目
  const waves = [{at:null, enemies}];
  if (st.waves) st.waves.forEach((wv, i) => { occ.length = 0; waves.push({at:wv.at || 3 + i*2, enemies:wv.enemies.map(e => ({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv || lv}))}); });
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
      note:'★ 是 Lv20 大招。宗介 U7 的 λ 武器不能直接带：λ 觉醒后，带上的单分子刀会变成隔空 λ 拳、散弹炮变成 λ 驱动·散弹炮（仍算 2 个武装）。'},
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
  if (kind === 'final' && !win) lines.push('没能击败迷宫之主，但作战耐久还没耗尽，仍然算作通过。');
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
  if (win && (kind === 'guard' || kind === 'final')) await offerRelics(['稀有', '传说'], kind === 'final' ? '迷宫之主' : '层底守军');
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
  await dlg(`<div class="eyebrow" style="color:var(--enemy)">终点</div><h2>迷宫之主</h2><p>穿过 3 层航区，迷宫最深处的指挥舰在等着你。</p><div class="acts"><button class="btn primary" data-v="ok">出击</button></div>`);
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
  $('#runView').querySelector('.rv-main').innerHTML = `<div class="rv-card" style="grid-column:1/-1"><h3>通关</h3><h2 style="font-family:var(--font-d);font-size:34px;margin:0">迷宫之主被击败</h2>
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


/* ---------- 肉鸽游玩记录（只记录肉鸽模式）----------
   每一局的事件都记在 RUN.events：本地浏览器里保留最近 20 局；
   在 claude.ai 里打开且有写入权限时，同时上传到这个页面的数据库 runlogs/<玩家>/runs/<局 id>，
   作者（页面所有者）能看到所有人的记录。没有权限或单独打开 html 时，用「下载」导出发回来。 */
const GAME_VERSION = 'v0.39.2';
document.querySelectorAll('.gv').forEach(e => { e.textContent = GAME_VERSION; });   // 顶栏和规则面板的版本号跟着 GAME_VERSION 走
const RLOG_KEY = 'mecha-tactics-runlogs';
function rlog(type, data){
  if (!RUN || !RUN.events) return;
  RUN.events.push({t:Math.round((Date.now() - RUN.t0)/1000), L:RUN.layer, type, ...data});
  rlogSaveLocal();
  if (['battle_end','run_end','note'].includes(type)) rlogFlush();
}
const runSummary = result => ({result, layer:RUN.layer, battles:RUN.battles, dur:RUN.dur, lvl:RUN.lvl, hope:RUN.hope, units:RUN.units.map(u => `${u.mech}:${u.lv}`).join(','), parts:RUN.parts.map(p => p.k).join(','), feena:RUN.cmd ? {lv:RUN.cmd.lv, skills:RUN.cmd.skills} : null, minutes:Math.round((Date.now() - RUN.t0)/60000)});
function rlogRecord(){ return RUN ? {id:RUN.runId, version:GAME_VERSION, squad:RUN.squad, startedAt:new Date(RUN.t0).toISOString(), over:!!RUN.over, events:RUN.events} : null; }
function rlogLoad(){ try { return JSON.parse(localStorage.getItem(RLOG_KEY) || '[]'); } catch(e){ return []; } }
function rlogSaveLocal(){
  const rec = rlogRecord(); if (!rec) return;
  try { const all = rlogLoad().filter(r => r.id !== rec.id); all.push(rec); localStorage.setItem(RLOG_KEY, JSON.stringify(all.slice(-20))); } catch(e){}
}
const RLOG_CLOUD = {state:'未连接', db:null, uid:null, tried:false, timer:null};
async function rlogCloud(){
  if (RLOG_CLOUD.tried) return RLOG_CLOUD.db;
  RLOG_CLOUD.tried = true;
  try {
    if (!window.claude || !window.claude.use){ RLOG_CLOUD.state = '本地模式（单独打开的 html 不能上传，请用下载）'; return null; }
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user){ RLOG_CLOUD.state = '没有云端权限（请用下载）'; return null; }
    const uid = await user.id();
    if (!uid){ RLOG_CLOUD.state = '未登录（请用下载）'; return null; }
    RLOG_CLOUD.db = db; RLOG_CLOUD.uid = uid; RLOG_CLOUD.state = '已连接，会自动上传';
    /* 父文档让 Claude 能列出玩家；顺便把本地存着的最近记录补传一次 */
    try {
      await db.doc(`runlogs/${uid}`).set({uid, updatedAt:new Date().toISOString()});
      for (const r of rlogLoad()) if (r && r.id) await db.doc(`runlogs/${uid}/runs/${r.id}`).set({...r, events:(r.events || []).slice(-1500), updatedAt:new Date().toISOString()});
      RLOG_CLOUD.state = '已连接，本地记录已补传';
    } catch(e){}
    return db;
  } catch(e){ RLOG_CLOUD.state = '没有云端权限（请用下载）'; return null; }
}
setTimeout(() => { rlogCloud(); }, 2000);   // 打开页面 2 秒后就连云端并补传本地记录
function rlogFlush(now){
  clearTimeout(RLOG_CLOUD.timer);
  RLOG_CLOUD.timer = setTimeout(async () => {
    const rec = rlogRecord(); if (!rec) return;
    const db = await rlogCloud(); if (!db) return;
    try {
      await db.doc(`runlogs/${RLOG_CLOUD.uid}`).set({uid:RLOG_CLOUD.uid, updatedAt:new Date().toISOString()});
      await db.doc(`runlogs/${RLOG_CLOUD.uid}/runs/${rec.id}`).set({...rec, events:rec.events.slice(-1500), updatedAt:new Date().toISOString()});
      RLOG_CLOUD.state = `已上传（${new Date().toLocaleTimeString()}）`;
    } catch(e){
      RLOG_CLOUD.state = e && e.code === 'invalid_argument' ? '你的权限不能上传（请用下载）' : `上传失败：${e && e.code || e}`;
      if (e && e.code === 'invalid_argument') RLOG_CLOUD.db = null;
    }
  }, now ? 50 : 1500);
}
function rlogText(rec){
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const lines = [`机甲战棋 肉鸽游玩记录 · ${rec.version} · 分队 ${rec.squad === 'moon' ? '月之国' : rec.squad} · 开始于 ${rec.startedAt}`, ''];
  for (const e of rec.events){
    const {t, L, type, ...d} = e;
    const body = type === 'log' ? d.text : type === 'note' ? `【玩家备注】${d.text}` : `<${type}> ${JSON.stringify(d)}`;
    lines.push(`[${fmt(t)}][${L === 4 ? '终' : 'L' + L}] ${body}`);
  }
  return lines.join('\n');
}
async function rlogDownload(kind){
  const recs = kind === 'all' ? rlogLoad() : [rlogRecord() || rlogLoad().slice(-1)[0]].filter(Boolean);
  if (!recs.length) return '还没有记录';
  const isJson = kind === 'all';
  const name = isJson ? `mecha-roguelike-all-${new Date().toISOString().slice(0,10)}.json` : `mecha-roguelike-${recs[0].startedAt.slice(0,10)}-${recs[0].id}.txt`;
  const data = isJson ? JSON.stringify(recs, null, 1) : rlogText(recs[0]) + '\n\n----- JSON -----\n' + JSON.stringify(recs[0]);
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl){ await dl.save({filename:name, data}); return '已下载'; }
  } catch(e){ if (e && e.code === 'declined') return '取消了下载'; }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: isJson ? 'application/json' : 'text/plain'})); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return '已下载';
  } catch(e){}
  try { await navigator.clipboard.writeText(data); return '下载不可用，已复制到剪贴板'; } catch(e){ return '下载和复制都不可用'; }
}
async function openRunLogs(msg){
  await rlogCloud();
  const all = rlogLoad(), cur = rlogRecord();
  const rows = all.slice().reverse().map(r => { const end = r.events.find(e => e.type === 'run_end');
    return `<div class="rv-row"><span class="nm">${r.startedAt.slice(0,16).replace('T',' ')} · ${r.squad === 'moon' ? '月之国' : r.squad}分队<small>${end ? `${end.result} · 第 ${end.layer} 层 · ${end.battles} 场` : (cur && cur.id === r.id ? '进行中' : '未完成')} · ${r.events.length} 条</small></span></div>`; }).join('');
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">游玩记录 · 只记录肉鸽模式</div><h2>游玩记录</h2>
    <p class="small">自动记录每一步：移动、事件、招募、晋升、每场战斗的出击阵容、回合数、伤害、击破和结果。本地浏览器保留最近 20 局。<br>云端：<b>${RLOG_CLOUD.state}</b></p>
    ${msg ? `<p style="color:var(--good)">${msg}</p>` : ''}
    ${cur && !cur.over ? `<label class="small" for="rlNote">给这一局加备注（bug、手感、建议都可以，会和记录一起保存）</label>
      <textarea id="rlNote" rows="3" style="width:100%;box-sizing:border-box;background:var(--panel2);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:6px;font:inherit"></textarea>` : ''}
    <div class="rv-card" style="margin-top:8px;max-height:220px;overflow:auto">${rows || '<p class="small">还没有记录。</p>'}</div>
    <div class="acts">${cur && !cur.over ? '<button class="btn" data-v="note">保存备注</button>' : ''}
      <button class="btn primary" data-v="cur">下载本局（文本）</button><button class="btn" data-v="all">下载全部（JSON）</button>
      <button class="btn" data-v="clear">清空本地记录</button><button class="btn" data-v="close">关闭</button></div>`, true);
  if (v === 'note'){
    const t = (document.querySelector('#rlNote') || {}).value;
    if (t && t.trim()){ rlog('note', {text:t.trim()}); return openRunLogs('备注已保存'); }
    return openRunLogs();
  }
  if (v === 'cur' || v === 'all') return openRunLogs(await rlogDownload(v));
  if (v === 'clear'){ if (await ask('清空本地保存的游玩记录？', '云端的不受影响。', '清空')){ try { localStorage.removeItem(RLOG_KEY); } catch(e){} return openRunLogs('本地记录已清空'); } return openRunLogs(); }
}
window.addEventListener('error', e => { if (RUN && !RUN.over && RUN.events) rlog('error', {msg:String(e.message).slice(0, 200), at:`${e.lineno}:${e.colno}`}); });
window.addEventListener('unhandledrejection', e => { if (RUN && !RUN.over && RUN.events) rlog('error', {msg:String(e.reason && (e.reason.message || e.reason.code) || e.reason).slice(0, 200)}); });

document.querySelectorAll('#levelSel option').forEach(o => { const L = LEVELS[o.value]; if (L && L.code && !o.textContent.startsWith(L.code)) o.textContent = `${L.code} ${o.textContent}`; });
startLevel('roguelike');            // 默认入口：肉鸽模式（背后先准备好肉鸽开局，再盖一层模式选择）
/* 开场模式选择（作者 2026-10-05）：教学 / 肉鸽 / 剧情，推荐肉鸽 */
function goMode(v){ $('#levelSel').value = v; startLevel(v); }
async function titleScreen(){
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">机甲战棋 ${GAME_VERSION}</div><h2>选择模式</h2>
    <div class="acts" style="flex-direction:column;align-items:stretch;gap:8px">
      <button class="btn primary" data-v="roguelike" id="titleRun">★ 肉鸽模式 · 混沌迷宫（推荐）</button>
      <button class="btn" data-v="tut1">教学关 · 第一次玩从这里开始</button>
      <button class="btn" data-v="story">剧情模式（待施工）</button>
    </div><p class="small">之后随时可以在顶栏「关卡」菜单里切换模式。</p>`);
  if (v === 'story'){
    const s = await dlg(`<h2>剧情模式 · 待施工</h2><p class="small">剧本还没写。可以先玩这些原型关卡：</p>
      <div class="acts" style="flex-direction:column;align-items:stretch;gap:8px">
        <button class="btn" data-v="defense">大规模防卫战（Lv20）</button>
        <button class="btn" data-v="drill">弱点演习（Lv20）</button>
        <button class="btn" data-v="skirmish">自由对战 · 随机地图</button>
        <button class="btn" data-v="back">← 返回</button>
      </div>`);
    if (s === 'back') return titleScreen();
    return goMode(s);
  }
  goMode(v);
}
titleScreen();
requestAnimationFrame(draw);
/* ============================================================================
 *  关卡编辑器（v0.27，Claude 维护）
 * ----------------------------------------------------------------------------
 * 「关卡」菜单 → 工具 → 关卡编辑器。可以编辑肉鸽关卡（ISW-…）和原型关（教学、防卫战、弱点演习）：
 *   地形、各波敌人（种类 / 位置 / 朝向 / 等级）、波次到达回合、我方出击点或固定我方位置、词缀、名字、地图大小。
 * 编辑结果自动存在浏览器（localStorage: mecha-tactics-editor）；「试打」直接用编辑结果开一局；
 * 「导出」得到一段 JSON，交给 Claude 写进下面的 LEVEL_EDITS，之后所有人玩到的都是改过的版本。
 * ========================================================================== */
const ED_KEY = 'mecha-tactics-editor';
const ED_PROTO = ['tut1', 'tut2', 'tut3', 'defense', 'drill'];
const ED_TER = [['.', '平原'], ['f', '森林'], ['m', '山地'], ['w', '水域'], ['c', '裂谷'], ['x', '绝壁'], ['v', '重力深渊']];
const ED = {id:null, d:null, tool:'paint', ter:'.', etype:'grunt', elv:'', efacing:'left', wave:0, tp:24, drag:null, painting:false, dirty:false, testLv:20};
/* 改动先放在内存里（ED_ALL），同时尽量写进浏览器存储；浏览器存储被禁用时也能照常编辑、试打和导出，只是刷新后会丢 */
let ED_ALL = null, ED_SAVE_OK = true;
function edStore(){ if (ED_ALL) return ED_ALL; try { ED_ALL = JSON.parse(localStorage.getItem(ED_KEY) || '{}'); } catch(e){ ED_ALL = {}; } return ED_ALL; }
function edSaveStore(o){ ED_ALL = o; try { localStorage.setItem(ED_KEY, JSON.stringify(o)); ED_SAVE_OK = true; } catch(e){ ED_SAVE_OK = false; } return ED_SAVE_OK; }
const edClone = o => JSON.parse(JSON.stringify(o));
/* 把一个关卡读成编辑器的统一格式 */
function edLoad(id){
  const saved = edStore()[id];
  if (saved) return edClone(saved);
  if (STAGES[id]){
    const st = STAGES[id], b = buildStage(st);
    return {kind:'stage', id, name:st.name, w:b.W, h:b.H, rows:b.g.map(r => r.join('')),
      waves:b.waves.map(w => ({at:w.at, enemies:w.enemies.map(e => ({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv}))})),
      spots:b.spots.map(s => [...s]), allies:null, affix:b.affix ? b.affix.name : null, baseLv:b.lv};
  }
  const L = LEVELS[id];
  const waves = L.waves ? L.waves.map(w => ({at:w.at ?? null, limit:w.limit, label:w.label, enemies:edClone(w.enemies || [])})) : [{at:null, enemies:edClone(L.enemies || [])}];
  return {kind:'level', id, name:L.name, w:L.w, h:L.h, rows:[...L.rows], waves, spots:L.spots ? edClone(L.spots) : null,
    allies:L.allies ? edClone(L.allies) : null, affix:null, baseLv:L.enemyLv || 1};
}
/* 编辑器格式 → 游戏用的覆盖数据（肉鸽关进 STAGE_OVERRIDES，原型关覆盖 LEVELS） */
function edToOverride(d){
  if (d.kind === 'stage') return {name:d.name, w:d.w, h:d.h, rows:d.rows, enemies:d.waves[0].enemies,
    waves:d.waves.slice(1).map(w => ({at:w.at, enemies:w.enemies})), spots:d.spots, affix:d.affix};
  const o = {name:d.name, w:d.w, h:d.h, rows:d.rows};
  if (LEVELS[d.id].waves) o.waveEnemies = d.waves.map(w => w.enemies); else o.enemies = d.waves[0].enemies;
  if (d.allies) o.allies = d.allies; if (d.spots) o.spots = d.spots;
  return o;
}
function applyLevelEdit(L, o){
  if (!L) return;
  for (const k of ['name', 'w', 'h', 'rows', 'enemies', 'allies', 'spots']) if (o[k] != null) L[k] = edClone(o[k]);
  if (o.waveEnemies && L.waves) o.waveEnemies.forEach((es, i) => { if (L.waves[i]) L.waves[i].enemies = edClone(es); else L.waves.push({limit:0, label:`第 ${i+1} 波`, enemies:edClone(es)}); });
}
function edCur(){ return ED.d; }
function edMark(){ ED.dirty = true; const s = edStore(); s[ED.id] = ED.d; edStatus(edSaveStore(s) ? '已自动保存到本机' : '这个浏览器不让保存：改动只在本次打开期间有效，记得先导出'); }
function edStatus(t){ const e = $('#edStatus'); if (e) e.textContent = t; }
function openEditor(){
  runHide(); $('#endModal').hidden = true; level = 'editor'; $('#levelSel').value = 'editor'; audioScene('menu');
  const v = $('#editView'); v.hidden = false;
  if (!ED.id) edSelect('ISW-1-N-1'); else edRender();
}
function closeEditor(){ $('#editView').hidden = true; }
function edSelect(id){ ED.id = id; ED.d = edLoad(id); ED.wave = 0; ED.dirty = false; edRender(); }
function edOptions(){
  const st = edStore(), mark = id => st[id] ? ' ✎' : '';
  const byLayer = {};
  for (const s of Object.values(STAGES)) (byLayer[s.layer] = byLayer[s.layer] || []).push(s);
  return Object.entries(byLayer).map(([L, ss]) => `<optgroup label="肉鸽 · 第 ${L} 层">${ss.sort((a,b) => a.code.localeCompare(b.code)).map(s => `<option value="${s.code}" ${s.code === ED.id ? 'selected' : ''}>${s.code} ${s.name}${mark(s.code)}</option>`).join('')}</optgroup>`).join('')
    + `<optgroup label="原型关">${ED_PROTO.map(id => `<option value="${id}" ${id === ED.id ? 'selected' : ''}>${LEVELS[id].code || id} ${LEVELS[id].name}${mark(id)}</option>`).join('')}</optgroup>`;
}
function edRender(){
  const d = ED.d, v = $('#editView');
  const etypes = Object.entries(ENEMY_T).map(([k, t]) => `<option value="${k}" ${k === ED.etype ? 'selected' : ''}>${t.mech}（${k}${t.w > 1 ? ` · ${t.w}×${t.h}` : ''}）</option>`).join('');
  const waveRows = d.waves.map((w, i) => `<div class="ed-wave ${i === ED.wave ? 'on' : ''}" data-wave="${i}">
      <b>第 ${i+1} 波</b><span>${w.enemies.length} 台</span>
      ${i === 0 ? '<span class="small">开局</span>' : d.kind === 'stage' ? `<label class="small">第 <input type="number" min="1" max="30" value="${w.at ?? ''}" data-at="${i}" style="width:44px"> 回合到达</label>` : `<span class="small">${w.limit ? `上限 ${w.limit} 回合` : ''}</span>`}
      ${i > 0 && d.kind === 'stage' ? `<button class="rv-btn" data-delwave="${i}">删除</button>` : ''}</div>`).join('');
  v.innerHTML = `<div class="rv-bar"><span class="ttl">关卡编辑器</span>
      <select id="edSel">${edOptions()}</select>
      <label class="small">名字 <input id="edName" value="${d.name.replace(/"/g, '&quot;')}" style="width:120px"></label>
      <label class="small">宽 <input id="edW" type="number" min="10" max="40" value="${d.w}" style="width:48px"></label>
      <label class="small">高 <input id="edH" type="number" min="8" max="40" value="${d.h}" style="width:48px"></label>
      ${d.kind === 'stage' ? `<label class="small">词缀 <select id="edAffix"><option value="">无</option>${AFFIXES.map(a => `<option ${a.name === d.affix ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>` : ''}
      <span style="flex:1"></span>
      <label class="small">试打我方 Lv <select id="edTestLv">${[10, 20, 30].map(n => `<option ${n === ED.testLv ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="rv-btn" id="edTest">▶ 试打</button><button class="rv-btn" id="edRevert">还原为原版</button><button class="rv-btn" id="edExport">导出全部改动</button><button class="rv-btn" id="edClose">关闭</button></div>
    <div class="ed-body">
      <div class="ed-side">
        <div class="rv-card"><h3>工具</h3>
          <div class="ed-tools">${[['paint', '刷地形'], ['enemy', '放敌人'], ['spot', d.allies ? '我方位置' : '出击点'], ['move', '移动'], ['erase', '删除']].map(([k, n]) => `<button class="rv-btn ${ED.tool === k ? 'on' : ''}" data-tool="${k}">${n}</button>`).join('')}</div>
          ${ED.tool === 'paint' ? `<div class="ed-tools">${ED_TER.map(([c, n]) => `<button class="rv-btn ${ED.ter === c ? 'on' : ''}" data-ter="${c}"><i class="ed-sw" style="background:${COL[TILE_CH[c]]}"></i>${n}</button>`).join('')}</div><p class="small">按住拖动可以连续刷。</p>` : ''}
          ${ED.tool === 'enemy' ? `<p><select id="edEtype" style="width:100%">${etypes}</select></p>
            <p class="small">等级 <input id="edElv" type="number" min="1" max="40" value="${ED.elv}" placeholder="${d.baseLv}" style="width:52px">（空 = 按关卡默认 Lv${d.baseLv}）　朝向 <select id="edEface">${[['left','←'],['right','→'],['up','↑'],['down','↓']].map(([k,n]) => `<option value="${k}" ${k === ED.efacing ? 'selected' : ''}>${n}</option>`).join('')}</select></p>
            <p class="small">放在当前选中的第 ${ED.wave + 1} 波。</p>` : ''}
          ${ED.tool === 'spot' ? `<p class="small">${d.allies ? '拖动 / 点击：把选中的我方机体移到这里。先点一台我方机体选中它。' : '点空格子加一个出击点，再点一次去掉。出击点就是编队时我方机体的落点（按顺序）。'}</p>` : ''}
          ${ED.tool === 'move' ? '<p class="small">按住敌人 / 出击点拖到新位置。</p>' : ''}
          ${ED.tool === 'erase' ? '<p class="small">点敌人或出击点删除。</p>' : ''}
        </div>
        <div class="rv-card"><h3>波次</h3>${waveRows}${d.kind === 'stage' ? '<button class="rv-btn" id="edAddWave">＋ 加一波</button>' : '<p class="small">原型关的波次数量和回合上限沿用原设计，这里只改每波的敌人。</p>'}</div>
        <div class="rv-card"><h3>说明</h3><p class="small">改动会自动保存在这个浏览器里（下拉菜单里带 ✎ 的就是改过的关）。改完点「导出全部改动」，把得到的文本交给 Claude，写进游戏后所有人玩到的都是你的版本。</p><p class="small" id="edStatus">${ED.dirty ? '已自动保存到本机' : edStore()[ED.id] ? '这一关在本机有改动' : '原版'}</p><p class="small" id="edHover"></p></div>
      </div>
      <div class="ed-map"><canvas id="edCv"></canvas></div>
    </div>`;
  edBind(); edDraw();
}
function edDraw(){
  const d = ED.d, cv = $('#edCv'); if (!cv) return;
  const wrapW = Math.max(300, (cv.parentElement.clientWidth || 800) - 8);
  ED.tp = Math.max(14, Math.min(34, Math.floor(wrapW / d.w)));
  const tp = ED.tp, dpr = window.devicePixelRatio || 1;
  cv.width = d.w * tp * dpr; cv.height = d.h * tp * dpr; cv.style.width = d.w * tp + 'px'; cv.style.height = d.h * tp + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++){ const c = (d.rows[y] || '')[x] || '.'; g.fillStyle = COL[TILE_CH[c] || 'plain']; g.fillRect(x*tp, y*tp, tp, tp);
    if (c === 'f'){ g.fillStyle = COL.forestTree; g.beginPath(); g.moveTo(x*tp+tp/2, y*tp+3); g.lineTo(x*tp+tp-4, y*tp+tp-4); g.lineTo(x*tp+4, y*tp+tp-4); g.fill(); }
    if (c === 'm'){ g.fillStyle = COL.mountainPeak; g.beginPath(); g.moveTo(x*tp+tp/2, y*tp+3); g.lineTo(x*tp+tp-2, y*tp+tp-3); g.lineTo(x*tp+2, y*tp+tp-3); g.fill(); } }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  for (let x = 0; x <= d.w; x++){ g.beginPath(); g.moveTo(x*tp+.5, 0); g.lineTo(x*tp+.5, d.h*tp); g.stroke(); }
  for (let y = 0; y <= d.h; y++){ g.beginPath(); g.moveTo(0, y*tp+.5); g.lineTo(d.w*tp, y*tp+.5); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // 出击点 / 固定我方
  (d.spots || []).forEach(([x, y], i) => { g.fillStyle = 'rgba(79,149,224,.35)'; g.fillRect(x*tp+2, y*tp+2, tp-4, tp-4); g.strokeStyle = '#4f95e0'; g.lineWidth = 2; g.strokeRect(x*tp+2, y*tp+2, tp-4, tp-4); g.fillStyle = '#dfe9f6'; g.font = `700 ${Math.round(tp*.42)}px sans-serif`; g.fillText(String(i+1), x*tp+tp/2, y*tp+tp/2); });
  (d.allies || []).forEach((a, i) => { g.fillStyle = ED.sel === i ? 'rgba(92,192,138,.75)' : 'rgba(92,192,138,.45)'; g.fillRect(a.x*tp+2, a.y*tp+2, tp-4, tp-4); g.fillStyle = '#fff'; g.font = `700 ${Math.round(tp*.34)}px sans-serif`; g.fillText(a.mech, a.x*tp+tp/2, a.y*tp+tp/2); });
  // 敌人：当前波实心，其它波半透明
  d.waves.forEach((w, wi) => w.enemies.forEach(e => {
    const t = ENEMY_T[e.t] || {w:1, h:1, short:'?'}, cur = wi === ED.wave;
    g.globalAlpha = cur ? 1 : .35;
    g.fillStyle = cur ? '#d9564b' : '#8a3a33'; g.beginPath();
    if (t.w > 1) g.rect(e.x*tp+3, e.y*tp+3, t.w*tp-6, t.h*tp-6); else g.arc(e.x*tp+tp/2, e.y*tp+tp/2, tp/2-3, 0, Math.PI*2);
    g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(tp*(t.w > 1 ? .5 : .38))}px sans-serif`; g.fillText(t.short || e.t.slice(0, 2), e.x*tp+t.w*tp/2, e.y*tp+t.h*tp/2);
    if (!cur){ g.fillStyle = '#ffd38a'; g.font = `700 ${Math.round(tp*.3)}px sans-serif`; g.fillText(String(wi+1), e.x*tp+tp-5, e.y*tp+6); }
    if (e.lv && cur){ g.fillStyle = '#ffd38a'; g.font = `700 ${Math.round(tp*.28)}px sans-serif`; g.fillText(String(e.lv), e.x*tp+tp-6, e.y*tp+tp-5); }
    g.globalAlpha = 1;
  }));
}
function edHit(x, y){
  const d = ED.d;
  const w = d.waves[ED.wave];
  const ei = w.enemies.findIndex(e => { const t = ENEMY_T[e.t] || {w:1, h:1}; return x >= e.x && x < e.x + t.w && y >= e.y && y < e.y + t.h; });
  if (ei >= 0) return {kind:'enemy', i:ei};
  const si = (d.spots || []).findIndex(([a, b]) => a === x && b === y); if (si >= 0) return {kind:'spot', i:si};
  const ai = (d.allies || []).findIndex(a => a.x === x && a.y === y); if (ai >= 0) return {kind:'ally', i:ai};
  return null;
}
function edPaint(x, y){ const d = ED.d, r = d.rows[y]; if (!r || r[x] === ED.ter) return; d.rows[y] = r.slice(0, x) + ED.ter + r.slice(x + 1); }
function edResize(w, h){
  const d = ED.d; w = clamp(w|0, 10, 40); h = clamp(h|0, 8, 40);
  d.rows = [...Array(h)].map((_, y) => ((d.rows[y] || '') + '.'.repeat(w)).slice(0, w));
  d.w = w; d.h = h;
  d.waves.forEach(wv => wv.enemies = wv.enemies.filter(e => e.x < w && e.y < h));
  if (d.spots) d.spots = d.spots.filter(([x, y]) => x < w && y < h);
  if (d.allies) d.allies.forEach(a => { a.x = Math.min(a.x, w-1); a.y = Math.min(a.y, h-1); });
}
function edBind(){
  const v = $('#editView'), d = ED.d;
  $('#edSel').onchange = e => edSelect(e.target.value);
  $('#edName').onchange = e => { d.name = e.target.value; edMark(); };
  $('#edW').onchange = e => { edResize(+e.target.value, d.h); edMark(); edRender(); };
  $('#edH').onchange = e => { edResize(d.w, +e.target.value); edMark(); edRender(); };
  if ($('#edAffix')) $('#edAffix').onchange = e => { d.affix = e.target.value || null; edMark(); };
  $('#edTestLv').onchange = e => { ED.testLv = +e.target.value; };
  $('#edClose').onclick = () => { closeEditor(); startLevel('roguelike'); };
  $('#edRevert').onclick = async () => { if (await ask(`把 ${ED.id} 还原为原版？`, '会删除这一关在本机的改动。', '还原')){ const s = edStore(); delete s[ED.id]; edSaveStore(s); ED.d = null; edSelect(ED.id); } else edRender(); };
  $('#edExport').onclick = edExport;
  $('#edTest').onclick = edTest;
  if ($('#edAddWave')) $('#edAddWave').onclick = () => { d.waves.push({at:(d.waves[d.waves.length-1].at || 1) + 2, enemies:[]}); ED.wave = d.waves.length - 1; edMark(); edRender(); };
  if ($('#edEtype')) $('#edEtype').onchange = e => { ED.etype = e.target.value; };
  if ($('#edElv')) $('#edElv').onchange = e => { ED.elv = e.target.value; };
  if ($('#edEface')) $('#edEface').onchange = e => { ED.efacing = e.target.value; };
  v.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { ED.tool = b.dataset.tool; edRender(); });
  v.querySelectorAll('[data-ter]').forEach(b => b.onclick = () => { ED.ter = b.dataset.ter; edRender(); });
  v.querySelectorAll('[data-wave]').forEach(b => b.onclick = e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return; ED.wave = +b.dataset.wave; edRender(); });
  v.querySelectorAll('[data-at]').forEach(inp => inp.onchange = () => { d.waves[+inp.dataset.at].at = Math.max(1, +inp.value || 1); edMark(); });
  v.querySelectorAll('[data-delwave]').forEach(b => b.onclick = () => { d.waves.splice(+b.dataset.delwave, 1); ED.wave = 0; edMark(); edRender(); });
  const cv = $('#edCv');
  const cell = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / ED.tp), Math.floor((e.clientY - r.top) / ED.tp)]; };
  cv.onmousedown = e => {
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    const hit = edHit(x, y);
    if (ED.tool === 'paint'){ ED.painting = true; edPaint(x, y); edDraw(); }
    else if (ED.tool === 'enemy'){ if (!hit) { d.waves[ED.wave].enemies.push({t:ED.etype, x, y, facing:ED.efacing, ...(ED.elv ? {lv:+ED.elv} : {})}); edMark(); edRender(); } }
    else if (ED.tool === 'spot'){
      if (d.allies){ if (hit && hit.kind === 'ally'){ ED.sel = hit.i; ED.drag = hit; } else if (ED.sel != null){ d.allies[ED.sel].x = x; d.allies[ED.sel].y = y; edMark(); } edDraw(); }
      else { if (!d.spots) d.spots = []; if (hit && hit.kind === 'spot') d.spots.splice(hit.i, 1); else if (!hit) d.spots.push([x, y]); edMark(); edDraw(); }
    }
    else if (ED.tool === 'erase'){ if (hit && hit.kind === 'enemy') d.waves[ED.wave].enemies.splice(hit.i, 1); else if (hit && hit.kind === 'spot') d.spots.splice(hit.i, 1); else return; edMark(); edRender(); }
    else if (ED.tool === 'move'){ if (hit) ED.drag = hit; }
  };
  cv.onmousemove = e => {
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    const h = edHit(x, y), hv = $('#edHover');
    if (hv) hv.textContent = `(${x}, ${y}) ${({'.':'平原',f:'森林',m:'山地',w:'水域',c:'裂谷'})[(d.rows[y] || '')[x]] || ''}${h && h.kind === 'enemy' ? ' · ' + ENEMY_T[d.waves[ED.wave].enemies[h.i].t].mech : ''}`;
    if (ED.painting){ edPaint(x, y); edDraw(); }
    if (ED.drag){ const g = ED.drag; if (g.kind === 'enemy'){ const o = d.waves[ED.wave].enemies[g.i]; o.x = x; o.y = y; } else if (g.kind === 'spot') d.spots[g.i] = [x, y]; else if (g.kind === 'ally'){ d.allies[g.i].x = x; d.allies[g.i].y = y; } edDraw(); }
  };
  const up = () => { if (ED.painting || ED.drag){ ED.painting = false; ED.drag = null; edMark(); } };
  cv.onmouseup = up; cv.onmouseleave = up;
}
function edTest(){
  const d = ED.d, ov = edToOverride(d);
  let L;
  if (d.kind === 'stage'){
    const st = {...STAGES[d.id], ...ov}, b = buildStage(st), affix = b.affix;
    L = {code:d.id, name:`试打 · ${d.id} ${d.name}${affix ? ' · 【' + affix.name + '】' : ''}`, w:b.W, h:b.H, speed:.6, formation:true, noCmd:true, edit:true,
      rows:b.g.map(r => r.join('')), rosterList:ALLY_T.map(t => ({mech:t.mech, lv:ED.testLv})), maxDeploy:6, spots:b.spots, allyFacing:'right',
      defaultDeploy:['B1','CB1','M2','CB2','M3','S1'],
      waves:b.waves.map((w, i) => ({at:w.at, lv:b.lv, label:`第 ${i+1} 波`, enemies:w.enemies})),
      onSpawn:e => { if (affix) affix.fn(e); }, victory:{type:'annihilate'}, goalText:`击破全部 ${b.waves.length} 波敌军（编辑器试打）`, tips:[]};
  } else {
    const base = LEVELS[d.id];
    L = {...base, rows:[...base.rows], waves:base.waves ? base.waves.map(w => ({...w, enemies:edClone(w.enemies || [])})) : undefined,
      allies:base.allies ? edClone(base.allies) : undefined, enemies:base.enemies ? edClone(base.enemies) : undefined, spots:base.spots ? edClone(base.spots) : undefined};
    applyLevelEdit(L, ov);
    L.edit = true; L.name = `试打 · ${d.name}`;
    if (L.spots && !L.allies) L.rosterLv = ED.testLv;
  }
  LEVELS.edit = L; closeEditor(); startLevel('edit');
  log('编辑器试打：打完或想改的时候，在「关卡」菜单选「关卡编辑器」回到编辑器（改动都在）', null, 'sys');
}
async function edExport(){
  const all = edStore(), keys = Object.keys(all);
  if (!keys.length){ await dlg(`<h2>还没有改动</h2><p class="small">先改一关再导出。</p><div class="acts"><button class="btn primary" data-v="ok">好</button></div>`); edRender(); return; }
  const out = {}; keys.forEach(k => { out[k] = edToOverride(all[k]); });
  const text = JSON.stringify({version:GAME_VERSION, exportedAt:new Date().toISOString(), edits:out}, null, 1);
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">导出关卡改动</div><h2>${keys.length} 关：${keys.join('、')}</h2>
    <p class="small">把下面的文本（或下载的文件）交给 Claude，写进游戏后就固定下来了。</p>
    <textarea id="edOut" readonly style="width:100%;height:220px;font:12px/1.4 JetBrains Mono, monospace">${text.replace(/</g, '&lt;')}</textarea>
    <div class="acts"><button class="btn primary" data-v="dl">下载文件</button><button class="btn" data-v="copy">复制</button><button class="btn" data-v="ok">关闭</button></div>`, true);
  if (v === 'dl') edStatus(await saveFile(`mecha-level-edits-${new Date().toISOString().slice(0,10)}.json`, text, 'application/json'));
  if (v === 'copy'){ try { await navigator.clipboard.writeText(text); edStatus('已复制'); } catch(e){ edStatus('复制失败，请手动选中文本复制'); } }
  edRender();
}
async function saveFile(name, data, type){
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl){ await dl.save({filename:name, data}); return '已下载'; } } catch(e){ if (e && e.code === 'declined') return '取消了下载'; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return '已下载'; } catch(e){}
  try { await navigator.clipboard.writeText(data); return '下载不可用，已复制到剪贴板'; } catch(e){ return '下载和复制都不可用'; }
}
window.addEventListener('resize', () => { if (!$('#editView').hidden) edDraw(); });
/* 已经写进游戏的关卡改动（作者用编辑器导出、Claude 粘贴进 LEVEL_EDITS）：原型关在这里生效，肉鸽关在 STAGES 生成前已经并入 STAGE_OVERRIDES */
for (const [k, o] of Object.entries(LEVEL_EDITS)) if (LEVELS[k] && !k.startsWith('ISW-')) applyLevelEdit(LEVELS[k], o);

/* ---------- 音频接线（Claude 维护） ----------
   播放层 MechAudio 是 DSH 写的（audio/mech-audio.js，由 tools/build-src.mjs 注入），接口和行为约定见 协作/接口约定.md 第 4 节。
   这里只决定「什么时候放什么」：
     场景 menu（编队 / 肉鸽开局）→ title；map（肉鸽大地图）→ mapStrategy；
     battle → 每个阶段开始按阵营切 allyPhase / enemyPhase，场上有 Boss 级敌人或在终点关时一律 boss；
     胜利 / 失败 → victory / defeat（不循环），放完约 6 秒后再回到当前场景的曲子。
   音效：命中 / 未中 / 暴击 / 击破 / 护盾吸收 / λ 觉醒 / 回复 / 预警 / 按钮。同名音效 70ms 内只响一次（多段攻击不会糊成一团）。 */
function snd(name, gap = 70){
  if (!AU || !SOUND.on) return;
  const t = performance.now();
  if (gap && SND_LAST[name] && t - SND_LAST[name] < gap) return;
  SND_LAST[name] = t; AU.sfx(name);
}
const BOSS_MECH = new Set([...ENEMY_BOSS, 'flagship'].map(k => ENEMY_T[k] && ENEMY_T[k].mech).filter(Boolean));
const bossOnField = () => !!(LV && LV.run && /-F-/.test(LV.code || '')) || units.some(u => u.side === 'enemy' && u.hp > 0 && BOSS_MECH.has(u.mech));
function sceneCue(){
  if (SOUND.scene === 'menu') return 'title';
  if (SOUND.scene === 'map') return 'mapStrategy';
  return bossOnField() ? 'boss' : (phaseSide === 'enemy' ? 'enemyPhase' : 'allyPhase');
}
function bgm(id){ if (AU && SOUND.on) AU.play(id); }
/* 切场景：刚放完胜利 / 失败号角的 6 秒内先不切，等它放完 */
function audioScene(scene){
  SOUND.scene = scene; clearTimeout(SOUND.timer);
  const wait = 6000 - (performance.now() - SOUND.jingleAt);
  if (wait > 0) SOUND.timer = setTimeout(() => bgm(sceneCue()), wait);
  else if (scene !== 'battle') bgm(sceneCue());       // 战斗的曲子由阶段开始决定
}
function audioJingle(id){ SOUND.jingleAt = performance.now(); clearTimeout(SOUND.timer); bgm(id); }
Hooks.on('phaseStart', c => {
  phaseSide = c.side; SOUND.scene = 'battle';       // 阶段开始只会发生在战斗里（编队界面结束后）
  if (over || performance.now() - SOUND.jingleAt < 6000) return;
  bgm(sceneCue());
  if (c.side === 'ally' && deadline && deadline - turn <= 1) snd('warn', 0);
}, '音频：阶段开始切 BGM');
Hooks.on('strikeResolved', c => snd(!c.hit ? 'miss' : c.crit ? 'crit' : 'hit'), '音频：命中 / 未中 / 暴击');
Hooks.on('unitDestroyed', () => snd('destroy', 40), '音频：击破');
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')){ if (AU) AU.unlock(); snd('ui', 50); } }, true);
function setSound(on){
  SOUND.on = on; try { localStorage.setItem('mecha-tactics-sound', on ? 'on' : 'off'); } catch(e){}
  const b = $('#btnSound'); if (b){ b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '声音' : '静音'; }
  if (!AU) return;
  AU.mute(!on);
  if (on) bgm(sceneCue()); else AU.stop();
}
$('#btnSound').onclick = () => setSound(!SOUND.on);
document.addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) setSound(!SOUND.on); });
if (!AU) $('#btnSound').hidden = true; else setSound(SOUND.on);

window.__game = {get HANGAR(){ return HANGAR; }, RELAYS, deployTiles, startDeploy, doDeploy, doRetreat, doRelay, canRetreat, canRelay, makeUnit, levelUp, reach, zocSet, moveWatched, bestCounter, legalFaces, get phaseNo(){ return phaseNo; }, damageCalc, dispPow, atkStat, wPow, get map(){ return map; }, RELICS, gainRelic(id){ if (RUN && RELICS[id]){ RUN.relics = RUN.relics || []; if (!RUN.relics.includes(id)) RUN.relics.push(id); } return RUN ? RUN.relics : null; }, AIM_BY_CLASS, guardReach, recCost, tierOf, FACTIONS, ticketOk, ticketName, get sound(){ return {on:SOUND.on, scene:SOUND.scene, cue:AU && AU.state().cue}; }, get RUN(){ return RUN; }, STAGES, buildStage, rlogRecord, rlogText, openRunLogs, enterLayer, checkEnd, moveDist, runClickNode, runBattle, moveTargets, partTargets, get level(){ return level; }, get units(){ return units; }, data:{ALLY_T, ENEMY_T, ABIL, COMMANDS, TRIALS, FIRE}, get roster(){ return roster; }, get LV(){ return LV; }, get turn(){ return turn; }, get over(){ return over; }, setSpeed(v){ SPEED = v; }, startLevel, toggleLock, execCommand, attackables, bestWeaponFor, select, weaponUsable, get S(){ return S; }, orderMeteor, resolveMeteors, get CMD(){ return CMD; }, setTurn(t){ turn = t; }, pushUnit, get walls(){ return walls; }, echoArea, finish, zoneOf, battle, onTile, onAction, endTurn, cheatLevel, choosePick, mapDirs, losClear, canHit, forecast, get editor(){ return {ED, store:edStore()}; }, get art(){ return MI; }, unitSprite, iconIdOf,
  /* 给工具用：全部单位模板（含未出场的），tools/roster.mjs 靠它检查图标覆盖率。roster 已被玩家编队占用，所以叫 templates */
  get templates(){ return {allies: ALLY_T, enemies: ENEMY_T, forms: FORMS, debris: DEBRIS_T}; },
  get levels(){ return LEVELS; }};
})();
