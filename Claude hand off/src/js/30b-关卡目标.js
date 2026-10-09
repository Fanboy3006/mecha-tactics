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
/* ---------- v0.37 新伤害公式：防御 / 觉醒属性，旧武器威力换算 ----------
   新公式：伤害 =（威力 − 装甲）×（1 +（攻击能力值 − 防御值）/ 100）。
   防御：我方按职业、敌方按梯队给初始值，每级 +2，晋升 +25。觉醒：暂时全员 100（角色对话再按设定分配）。
   源数据里的 power 还是旧公式（威力 + 属性 ×5）的数值，开局时按下面的参照点换算成新公式的威力，让参照情形下伤害不变：
   - 我方武器：Lv10 的攻击方，打 Lv2 杂兵（杂兵平均装甲、防御 52）；
   - 敌方武器：Lv5 的敌人，打 Lv10 我方平均（装甲 600、防御 103）；
   - 特殊伤害 / 无视防御：装甲、防御都按 0。
   角色对话以后按新公式重新写某个角色的武器时，把它的机体代号加进 NEW_POWER，它就不再换算。 */
const DEF_BY_CLASS = {重装:110, 近卫:95, 特种:85, 指挥:80, 狙击:75, 尖兵:75};
const DEF_BY_TIER = {杂兵:50, 精锐:65, 头目:80, Boss:95};
const NEW_POWER = new Set(['B1','M1','M2','M3','M4','M5','CB1','S1','W1','U7']);   // v0.40.4 角色对话：精锐已按新公式重写（其他角色重写过的单把武器带 v37:true）
function convPow(P, statRef, multi, noDef, Aref, Dref){
  const old = P + (multi ? .5 : 5) * statRef;
  if (noDef) return Math.max(1, Math.round(old / (1 + statRef / 100)));
  const coef = Math.max(.3, 1 + (statRef - Dref) / 100);
  return Math.max(1, Math.round((old - Aref) / coef + Aref));
}
function convWeapons(ws, t, lvAdd, Aref, Dref){
  for (const w of ws){
    if (!(w.power > 0) || w.fire === 'heal' || w.fire === 'support' || w.fire === 'device' || w.special === 'gamble' || w.v37) continue;
    const sr = (w.stat === '格斗' ? t.melee : t.shoot) + lvAdd, multi = w.special === 'multi' || w.special === 'funnel';
    const f = (p, dt) => convPow(p, sr, multi, dt === '特殊' || w.ignoreDef, Aref, Dref);
    w.power = f(w.power, w.dmgType);
    for (const up of w.upgrades || []) if (up.power > 0) up.power = f(up.power, w.dmgType);
    if (w.awaken && w.awaken.power > 0) w.awaken.power = f(w.awaken.power, w.awaken.dmgType || w.dmgType);
    w.v37 = true;
  }
}
{
  const gA = Math.round(ENEMY_TIER.杂兵.reduce((t, k) => t + ENEMY_T[k].armor, 0) / ENEMY_TIER.杂兵.length), gD = DEF_BY_TIER.杂兵 + 2;   // 杂兵平均装甲
  ALLY_T.forEach(t => {
    t.defense = t.defense ?? DEF_BY_CLASS[t.tags.战斗分类] ?? 85; t.awaken = t.awaken ?? 100;
    if (!NEW_POWER.has(t.mech)) convWeapons(t.weapons, t, 18, gA, gD);
  });
  for (const f of Object.values(FORMS)) if (f.weapons){ const t = ALLY_T.find(a => a.transform && FORMS[a.transform] === f) || {melee:150, shoot:150}; convWeapons(f.weapons, t, 18, gA, gD); }
  for (const [k, t] of Object.entries(ENEMY_T)){
    t.defense = t.defense ?? DEF_BY_TIER[tierOfEnemy(k)] ?? 50; t.awaken = t.awaken ?? 100;
    convWeapons(t.weapons, t, 8, 600, 103);
  }
}
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
