/* ---------- 敌人梯队与关卡目标 ---------- */
/* v0.32 关卡改造（作者 10-05 定，设计见 docs/肉鸽模式设计.md「关卡改造 v0.32」）：
   - 敌人分梯队：杂兵（AOE 能清）/ 精锐（各自克制一类打法）/ 头目（范围护壁：范围类伤害 −50%，要集火或近卫补刀）/ Boss；
   - 普通作战加三种目标：坚守、突破、斩首。 */
const ENEMY_TIER = {
  杂兵:['grunt','fighter','drone','swarm','raider','hound','bomber'],
  精锐:['shield','beamcoat','phase','stealth','mirror','jammer','sniper','artillery','beetle'],
  头目:['captain','venom','regen','funnel','berserker'],
};
for (const k of ENEMY_TIER.头目) if (ENEMY_T[k]) ENEMY_T[k].weak = {...(ENEMY_T[k].weak || {}), 范围:-50};   // 范围护壁
for (const k of Object.keys(ENEMY_T)) ENEMY_T[k].key = k;   // v0.35 单位上记住模板键，方便按梯队判断
const tierOfEnemy = k => ENEMY_BOSS.includes(k) || k === 'flagship' ? 'Boss' : Object.keys(ENEMY_TIER).find(t => ENEMY_TIER[t].includes(k)) || '杂兵';
const TIER_LV = {杂兵:0, 精锐:1, 头目:2, Boss:2};
/* 按梯队挑 n 个：一半概率从本关主题里有的挑 */
/* v0.32.1 头目按层开放：第 1 层只有指挥官机、狂战士；第 2 层加浮游炮母机、自修复机；第 3 层起才有 λ 试作机 */
const HEAD_BY_LAYER = [null, ['captain','berserker'], ['captain','berserker','funnel','regen'], null, null];
function tierPick(r, theme, tier, n, layer){
  const pool = tier === '头目' && layer && HEAD_BY_LAYER[layer] ? HEAD_BY_LAYER[layer] : ENEMY_TIER[tier], th = ((theme && theme.units) || []).filter(k => pool.includes(k)), out = [];
  for (let i = 0; i < n; i++){ const src = th.length && r() < .5 ? th : pool; out.push(src[Math.floor(r() * src.length)]); }
  return out;
}
/* 头顶徽记：斩首目标 ★、λ 力场剩余次数（紫色 λ，每个阶段 2 次） */
function refreshBadges(u){
  if (!u) return;
  const b = [];
  if (u.target) b.push({color:'#ff5a5a', glyph:'★'});
  if (u.abilities && u.abilities.includes('lambdaShield')) for (let i = 0; i < lsLeft(u); i++) b.push({color:'#c08cff', glyph:'λ'});
  u.badgeList = b;
}
Hooks.on('phaseStart', () => { units.forEach(refreshBadges); }, '徽记：每个阶段刷新 λ 力场次数');
const OBJ_NAME = {annihilate:'全歼', survive:'坚守', reach:'突破', targets:'斩首'};
const SURVIVE_TURNS = 6;
/* 普通作战的目标：全歼 40% / 坚守 20% / 突破 20% / 斩首 20%（按关卡种子固定） */
function stageObj(st){
  if (st.obj) return st.obj;
  if (st.kind !== 'battle') return 'annihilate';
  const r = mulberry32(st.seed ^ 0x0b1);
  return ['annihilate','annihilate','survive','reach','targets'][Math.floor(r() * 5)];
}
/* 坚守 / 斩首的持续刷新：在我方阶段开始时从右边缘（突破关从上下边缘）刷出 */
function respawnFoes(list, lv){
  const W = LV.w, H = LV.h;
  for (const k of list){
    const t = ENEMY_T[k];
    for (let tries = 0; tries < 60; tries++){
      const x = W - t.w - Math.floor(Math.random() * 3), y = Math.floor(Math.random() * (H - t.h));
      if (tilesOf({x, y, w:t.w, h:t.h}).some(([a, b]) => occupant(a, b) || walls.has(b*N+a) || TER[map[b][a]].groundBlock)) continue;
      const u = makeUnit(t, 'enemy', x, y); u.facing = 'left';
      for (let i = 1; i < lv + TIER_LV[tierOfEnemy(k)]; i++) levelUp(u); u.hp = u.maxHp;
      if (LV.onSpawn) LV.onSpawn(u);
      refreshBadges(u); units.push(u); break;
    }
  }
}
Hooks.on('phaseStart', c => {
  if (c.side !== 'ally' || !LV || !LV.victory || over) return;
  const v = LV.victory;
  if (v.type === 'survive' && c.turn > v.turns){ log(`坚守成功：撑过了 ${v.turns} 回合`, null, 'sys'); victory(); return; }
  const rs = LV.respawn;
  if (rs && c.turn > 1 && (c.turn - 1) % rs.every === 0){
    const list = rs.list(c.turn);
    respawnFoes(list, rs.lv);
    log(`敌方增援 ${list.length} 台从右侧出现`, null, 'sys');
  }
}, '关卡目标：坚守胜利、持续刷新');
