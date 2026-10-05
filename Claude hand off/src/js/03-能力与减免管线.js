/* ---------- 能力与减免管线 ---------- */
const ABIL = {
  barrier:{name:'能量屏障', desc:'生成伤害 ≤2500 时完全无效，每场 3 次。'},
  frontArmor:{name:'正面装甲', desc:'从正面受到的伤害 −50%（百分比减免阶段）。侧面、背面不生效。这台机体不会回避，也不会防御。'},
  dodgeFatigue:{name:'闪避疲劳', desc:'同一回合内每完全闪避一次攻击，闪避 −10，下一个我方阶段开始时恢复。'},
  portalTrait:{name:'门之力', desc:'指令「传送」：移动到 7 格内任意空地，代替本回合移动。每次反噬 +25，反噬 ≥100 时不能使用。（之后还会改动 / 升级）'},
  moveEva:{name:'游刃有余', desc:'行动结束时，本回合没用完的移动力每 1 点转为闪避 +5，持续到下一个我方阶段开始。'},
  autoCast:{name:'月光共鸣（暂名）', desc:'不能主动使用武器。我方阶段每次行动结束后，自动释放已解锁、冷却好了的武器中序号最高的一把：Lv20 前是月光祝福，Lv20 起是残月的余响，Lv30 起满月·月蚀冷却好时优先释放它。'},
  steadfast:{name:'不动如山', desc:'本回合没有移动时，装甲 +30%，援护次数 +1。'},
  fieldAid:{name:'战地急救', desc:'修理友军时，额外给对方「物理减免 5%」，持续到下一个我方阶段开始。'},
  hallelujah:{name:'超兵·哈雷路亚', desc:'HP 低于 50% 时，另一个人格接管：命中 +20、暴击 +20。'},
  veda:{name:'Veda 连接', desc:'变身为纳德雷的那一回合，命中 +30。'},
  gundam:{name:'我就是高达', desc:'每有 1 台敌机与自己相邻，命中 +10、闪避 +10（最多 +30）。'},
  followUp:{name:'DASH+1', desc:'近卫的 DASH 每回合上限 +1（共 2 次）：一回合最多行动 3 次。'},
  dash:{name:'DASH', desc:'（近卫）主动攻击击破敌机后，获得 3 点移动力和一次额外攻击：可以先移动再攻击，也可以原地攻击。每回合 1 次。'},
  supportAtk:{name:'援护攻击', desc:'己方阶段，同伴主动攻击、目标没被击破时，可以跟着用一个武装攻击同一个目标（目标不能反击）。每回合 1 次。我方会询问，一路按空格默认用伤害最高的武装。'},
  guardAtk:{name:'进攻援护', desc:'援护防御在我方阶段也能用：援护范围内的友军攻击后被反击时，可以代为承受那次反击（自动防御）。'},
  overflowCrit:{name:'狙い撃つぜ', desc:'命中率超过 100 的部分，1:1 转为暴击率。'},
  gnShield:{name:'GN 全盾·哈罗', desc:'本回合没有移动时（架设狙击），正面受到的伤害 −30%。'},
  guard:{name:'援护防御', desc:'敌方阶段友军被攻击时，只要援护者用移动力能走到它旁边（援护范围 = 移动力覆盖范围），就可以代为承受并自动防御，每个敌方阶段 2 次。援护会挡下这一整轮攻击，包括对方随后的援护攻击。'},
  /* ---- v0.16 新角色：个人特技 ---- */
  seed:{name:'SEED', desc:'HP 低于 70%，或者 2 格内有 3 台以上敌机时觉醒：命中 +20、闪避 +20、暴击 +15。'},
  orbLion:{name:'奥布之狮', desc:'光环：2 格内其他友军命中 +10、受到的伤害 −5%。'},
  erratic:{name:'手感不稳', desc:'直射 / 曲射命中 −10，但暴击 +20。'},
  focusFire:{name:'集火', desc:'攻击本回合已经被其他友军攻击过的敌机时，伤害 +20%。'},
  extended:{name:'强化人', desc:'每被攻击一次（无论是否命中）叠 1 层，最多 3 层；下一次主动攻击每层伤害 +15%，攻击后清空。'},
  jetStream:{name:'喷射气流', desc:'主动攻击时，目标每有 1 台其他友军相邻，伤害 +15%（最多 +45%）。'},
  trio:{name:'M1 小队', desc:'3 格内每有 1 名其他 M1 小队成员，命中 +10、闪避 +10。'},
  zero:{name:'ZERO 系统', desc:'命中 +15、闪避 +15；暴击伤害倍率由 ×1.2 变为 ×1.5。'},
  hyperJammer:{name:'超级干扰器', desc:'3 格以外的敌机不能把它选为目标；敌机不能反击它的攻击。'},
  silentBlade:{name:'沉默之刃', desc:'反击造成的伤害 +30%。'},
  spaceHeart:{name:'宇宙之心', desc:'光环：3 格内其他友军闪避 +10。'},
  justice:{name:'正义', desc:'目标 2 格内没有其他敌机（一对一）时，伤害 +25%。'},
  lightning:{name:'闪电伯爵', desc:'本回合移动了 3 格以上后发动的近战攻击，暴击 +30。'},
  hitAway:{name:'一击脱离', desc:'主动攻击后，可以用本回合剩下的移动力继续移动。'},
  allIn:{name:'赌徒', desc:'命中率低于 70% 时，暴击 +30。'},
  lucky:{name:'天然', desc:'每个阶段第一次被攻击时，闪避 +30。'},
  wSeries:{name:'W 系列', desc:'人造人的冷静：被侧击 / 背击时不会被无视装甲，也不会被标记类技能破防。'},
  hotBlood:{name:'热血', desc:'每回合第一次主动攻击，伤害 +25%。'},
  juice:{name:'特制健康饮料', desc:'修理量 +50%，但被修理的友军闪避 −10，持续到下一个我方阶段（太难喝了）。'},
  pro:{name:'专业军人', desc:'直射 / 曲射命中 +10；对大型（大于 1×1）目标伤害 +20%。'},
  longShot:{name:'狙击之王', desc:'目标距离 6 格以上时，命中 +20、暴击 +20。'},
  squadLead:{name:'小队长', desc:'光环：3 格内其他友军暴击 +10。'},
  falke:{name:'冷血', desc:'侧击 / 背击时，伤害 +20%。'},
  ecs:{name:'ECS 隐形', desc:'本回合还没有攻击过（包括反击）时，3 格以外的敌机不能把它选为目标。'},
  iaiSnipe:{name:'居合', desc:'本回合没有移动时，直射命中 +15；用近战武器反击时，伤害 +30%。'},
  /* ---- 新能力（我方 / 敌方通用） ---- */
  beamReflect:{name:'光束反射装甲', desc:'受到的光束伤害 −50%；被直射或近战光束击中时，被减去部分的一半反射给攻击者。'},
  coreSplit:{name:'核心分离', lv:20, desc:'（Lv20）每场第一次被击破时，换上备用部件以 30% HP 继续战斗。'},
  beastMode:{name:'兽形态', desc:'地面移动时，森林、水域、山地每格都只消耗 1。'},
  lambda:{name:'λ 驱动器', lv:20, desc:'（Lv20）每个阶段第一次受到的伤害 −60%。'},
  stealth:{name:'隐形', desc:'3 格以外不能被选为目标。地图炮、范围攻击和指挥技能不受影响。'},
  regen:{name:'自修复', desc:'敌方阶段开始时回复最大 HP 的 15%。'},
  selfDestruct:{name:'自爆', desc:'被击破时爆炸，对相邻的所有单位（敌我不分）造成 2500 物理伤害。'},
  jamAura:{name:'电子干扰', desc:'光环：3 格内的敌对单位命中 −15。'},
  commandAura:{name:'指挥链路', desc:'光环：3 格内的其他同伴命中 +15、受到的伤害 −10%。'},
  berserk:{name:'狂暴', desc:'HP 低于 50% 时伤害 +30%。'},
  lambdaShield:{name:'λ 力场', desc:'每个阶段前 2 次受到的伤害各减少 3000（在装甲之后结算）。'},
  /* ---- v0.24 普通档晋升被动（Lv20 解锁，Lv30 加强）：原来的 Lv20 武装改成了这些被动 ---- */
  lunaPower:{name:'全功率炮装', lv:20, desc:'（Lv20）光束攻击伤害 +20%；Lv30 起 +35%。'},
  shihoOver:{name:'热能过载', lv:20, desc:'（Lv20）攻击 4 格以外的目标时伤害 +20%；Lv30 起 +35%。'},
  jetLink:{name:'喷射气流·连携', lv:20, desc:'（Lv20）光环：2 格内其他友军伤害 +10%；Lv30 起 +15%。'},
  suppress:{name:'压制射击', lv:20, desc:'（Lv20）光环：3 格内的敌机命中 −10；Lv30 起 −15。'},
  dataLink:{name:'战术数据链', lv:20, desc:'（Lv20）光环：4 格内其他友军命中 +10、暴击 +5；Lv30 起命中 +15、暴击 +10。'},
  pinDown:{name:'编队牵制', lv:20, desc:'（Lv20）光环：3 格内的敌机闪避 −10；Lv30 起 −15。'},
  darkSword:{name:'暗剑杀之心', lv:20, desc:'（Lv20）近战攻击伤害 +20%、暴击 +10；Lv30 起伤害 +35%、暴击 +15。'},
  psyRes:{name:'念动共鸣', lv:20, desc:'（Lv20）我方阶段开始时，3 格内的友军（含自己）回复最大 HP 的 10%；Lv30 起 15%。'},
  ecmAura:{name:'ECM 干扰', lv:20, desc:'（Lv20）光环：4 格内的敌机命中 −10；Lv30 起 −15。'},
  laserGuide:{name:'激光引导', lv:20, desc:'（Lv20）自己和 3 格内其他友军命中 +10；Lv30 起 +15。'},
  superSoldier:{name:'超兵反射', lv:20, desc:'（Lv20）闪避 +15；Lv30 起 +25。'},
};
/* 普通档晋升被动挂在哪台机体上（月华再生本来就是被动武装，不在这里） */
const PROMO_PASSIVE = {S3:'lunaPower', S4:'shihoOver', S6:'jetLink', S7:'suppress', S8:'dataLink', W7:'pinDown', A4:'darkSword', A5:'psyRes', U2:'ecmAura', U8:'laserGuide', CB3:'superSoldier'};
const L30 = u => u.side === 'ally' && u.lv >= 30;
/* 特技 / 能力的数值效果：hit / eva / crit / dmg（伤害%）/ red（减伤%）/ armorPct，可以是常数或函数 (自己, 对方, 武器, 选项)；aura 是光环 */
const TRAIT_FX = {
  seed:{hit:u => seedOn(u) ? 20 : 0, eva:u => seedOn(u) ? 20 : 0, crit:u => seedOn(u) ? 15 : 0},
  orbLion:{aura:{r:2, hit:10, red:5}},
  erratic:{hit:(u,o,w) => w && (w.fire === 'direct' || w.fire === 'indirect') ? -10 : 0, crit:(u,o,w) => w && (w.fire === 'direct' || w.fire === 'indirect') ? 20 : 0},
  focusFire:{dmg:(u,d) => d && d.hitLog && d.hitLog.turn === turn && [...d.hitLog.by].some(id => id !== u.uid) ? 20 : 0},
  extended:{dmg:(u,d,w,o) => o && o.counter ? 0 : 15 * (u.extStack || 0)},
  jetStream:{dmg:(u,d) => d ? 15 * Math.min(3, units.filter(a => a !== u && a.side === u.side && a.hp > 0 && distU(a, d) === 1).length) : 0},
  trio:{hit:u => 10 * trioN(u), eva:u => 10 * trioN(u)},
  zero:{hit:15, eva:15},
  silentBlade:{dmg:(u,d,w,o) => o && o.counter ? 30 : 0},
  spaceHeart:{aura:{r:3, eva:10}},
  justice:{dmg:(u,d) => d && !units.some(e => e !== d && e.side === d.side && e.hp > 0 && distU(e, d) <= 2) ? 25 : 0},
  lightning:{crit:(u,d,w) => w && w.fire === 'melee' && (u.lastMove || 0) >= 3 ? 30 : 0},
  lucky:{eva:u => u.luckyPhase !== phaseNo ? 30 : 0},
  hotBlood:{dmg:(u,d,w,o) => !(o && o.counter) && u.hotTurn !== turn ? 25 : 0},
  pro:{hit:(u,o,w) => w && (w.fire === 'direct' || w.fire === 'indirect') ? 10 : 0, dmg:(u,d) => d && d.w * d.h > 1 ? 20 : 0},
  longShot:{hit:(u,d,w,o) => d && distFrom(u, d, o) >= 6 ? 20 : 0, crit:(u,d,w,o) => d && distFrom(u, d, o) >= 6 ? 20 : 0},
  squadLead:{aura:{r:3, crit:10}},
  iaiSnipe:{hit:(u,d,w) => w && w.fire === 'direct' && !u.movedThisRound ? 15 : 0, dmg:(u,d,w,o) => o && o.counter && w && w.fire === 'melee' ? 30 : 0},
  falke:{dmg:(u,d,w,o) => o && (o.zone === 'side' || o.zone === 'back') ? 20 : 0},
  jamAura:{aura:{r:3, who:'foe', hit:-15}},
  commandAura:{aura:{r:3, hit:15, red:10}},
  berserk:{dmg:u => u.hp < u.maxHp/2 ? 30 : 0},
  lunaPower:{dmg:(u,d,w) => w && w.dmgType === '光束' ? (L30(u) ? 35 : 20) : 0},
  shihoOver:{dmg:(u,d,w,o) => d && distFrom(u, d, o) >= 4 ? (L30(u) ? 35 : 20) : 0},
  jetLink:{aura:{r:2, dmg:src => L30(src) ? 15 : 10}},
  suppress:{aura:{r:3, who:'foe', hit:src => L30(src) ? -15 : -10}},
  dataLink:{aura:{r:4, hit:src => L30(src) ? 15 : 10, crit:src => L30(src) ? 10 : 5}},
  pinDown:{aura:{r:3, who:'foe', eva:src => L30(src) ? -15 : -10}},
  darkSword:{dmg:(u,d,w) => w && w.fire === 'melee' ? (L30(u) ? 35 : 20) : 0, crit:(u,d,w) => w && w.fire === 'melee' ? (L30(u) ? 15 : 10) : 0},
  ecmAura:{aura:{r:4, who:'foe', hit:src => L30(src) ? -15 : -10}},
  laserGuide:{hit:u => L30(u) ? 15 : 10, aura:{r:3, hit:src => L30(src) ? 15 : 10}},
  superSoldier:{eva:u => L30(u) ? 25 : 15},
};
let phaseNo = 0;
const abilOn = (u, k) => !!u && u.abilities.includes(k) && (u.side !== 'ally' || !ABIL[k] || !ABIL[k].lv || u.lv >= ABIL[k].lv);
const FXK = u => [...(u.trait && hasTrait(u, u.trait) ? [u.trait] : []), ...u.abilities.filter(k => abilOn(u, k))].filter(k => TRAIT_FX[k]);
function auraSum(u, field){
  let s = 0;
  for (const src of units){
    if (src.hp <= 0 || src.side === 'neutral' || u.side === 'neutral') continue;
    for (const k of FXK(src)){
      const a = TRAIT_FX[k].aura; if (!a || !a[field]) continue;
      const ok = a.who === 'foe' ? src.side !== u.side : (src.side === u.side && src !== u);
      if (ok && distU(src, u) <= a.r) s += typeof a[field] === 'function' ? a[field](src, u) : a[field];
    }
  }
  return s;
}
function tfx(u, field, other, w, o){
  if (!u || u.side === 'neutral') return 0;
  let s = 0;
  for (const k of FXK(u)){ const f = TRAIT_FX[k][field]; if (f != null) s += typeof f === 'function' ? (f(u, other, w, o) || 0) : f; }
  return s + auraSum(u, field);
}
const distFrom = (u, d, o) => o && o.from ? distU(u, d, o.from[0], o.from[1]) : distU(u, d);
const foesNear = (u, r) => units.filter(e => e.side !== u.side && e.side !== 'neutral' && e.hp > 0 && distU(u, e) <= r).length;
const seedOn = u => u.hp < u.maxHp * .7 || foesNear(u, 2) >= 3;
const trioN = u => units.filter(a => a !== u && a.side === u.side && a.hp > 0 && hasTrait(a,'trio') && distU(a, u) <= 3).length;
const critMul = u => hasTrait(u,'zero') ? 1.5 : 1.2;
const hasStealth = t => abilOn(t,'stealth') || hasTrait(t,'hyperJammer') || (hasTrait(t,'ecs') && t.firedTurn !== turn);
const noCounterVs = (att, w) => !!w && (w.noCounter || w.special === 'lock' || hasTrait(att,'hyperJammer'));
/* 弱点 / 抗性：正数 = 弱点（生成阶段增伤），负数 = 抗性（百分比减免阶段，受破防削弱） */
const DMG_NOTE = {光束:'光束', 物理:'物理', 特殊:'特殊（无视光束 / 物理抗性，只会被护盾类效果抵消）'};
const WEAK_DESC = {光束:'光束伤害', 物理:'物理伤害', 近战:'近战攻击', 直射:'直射攻击', 曲射:'曲射攻击', 范围:'地图炮 / 被动 / 指挥技能', 背面:'从背面攻击', 暴击:'暴击', 多段:'多段攻击（每段）', 反击:'反击'};
function weakList(def, w, o = {}){
  if (!def.weak || !w) return [];
  const out = [];
  for (const [k, v] of Object.entries(def.weak)){
    const ok = k === '光束' || k === '物理' ? w.dmgType === k
      : k === '近战' ? w.fire === 'melee' : k === '直射' ? w.fire === 'direct' : k === '曲射' ? w.fire === 'indirect'
      : k === '范围' ? (isSure(w) || w.fire === 'command') : k === '背面' ? o.zone === 'back'
      : k === '暴击' ? !!o.crit : k === '多段' ? (w.special === 'multi' || w.special === 'funnel') : k === '反击' ? !!o.counter : false;
    if (ok) out.push([k, v]);
  }
  return out;
}
function genMods(att, w, def, o = {}){
  const notes = [];
  let pct = 0;
  for (const [k, v] of weakList(def, w, o)) if (v > 0){ pct += v; notes.push(`弱点·${k} +${v}%`); }
  const t = tfx(att, 'dmg', def, w, o); if (t){ pct += t; notes.push(`特技 ${t > 0 ? '+' : ''}${t}%`); }
  const b = att ? buffSum(att, 'dmg') : 0; if (b){ pct += b; notes.push(`增益 ${b > 0 ? '+' : ''}${b}%`); }
  const rm = RM();
  if (rm && att && att.side === 'ally'){
    const v = rm.atk * 2 + ((isSure(w) || w.fire === 'command') ? rm.art : 0) + (rm.overload ? 30 : 0);
    if (v){ pct += v; notes.push(`肉鸽 +${v}%`); }
  }
  return {pct, notes};
}
const genApply = (att, w, def, dmg, o) => { const g = genMods(att, w, def, o); return g.pct ? Math.max(0, Math.round(dmg * (1 + g.pct/100))) : dmg; };
const REDUCTIONS = [
  {id:'barrier', name:'能量屏障', stage:1, shield:true,
    applies:c => c.def.abilities.includes('barrier') && c.def.barrierLeft > 0 && c.dmg <= 2500,
    apply:c => { c.dmg = 0; c.nullified = true; if (!c.preview) c.def.barrierLeft--; return `≤2500 无效化（剩 ${c.preview ? c.def.barrierLeft : c.def.barrierLeft} 次）`; }},
  {id:'terrain', name:'地形防御', stage:2,
    applies:c => !c.def.flying && terrainOf(c.def).def > 0,
    apply:c => { const v = terrainOf(c.def).def * c.defMul; c.dmg *= 1 - v/100; return `−${+v.toFixed(1)}%`; }},
  {id:'frontArmor', name:'正面装甲', stage:2,
    applies:c => c.def.abilities.includes('frontArmor') && c.zone === 'front',
    apply:c => { const v = 50 * c.defMul; c.dmg *= 1 - v/100; return `正面 −${+v.toFixed(1)}%`; }},
  {id:'gnShield', name:'GN 全盾', stage:2,
    applies:c => c.def.abilities.includes('gnShield') && c.zone === 'front' && !c.def.movedThisRound,
    apply:c => { const v = 30 * c.defMul; c.dmg *= 1 - v/100; return `正面 −${+v.toFixed(1)}%`; }},
  {id:'physRed', name:'物理减免', stage:2,
    applies:c => c.w.dmgType === '物理' && buffSum(c.def,'physRed') > 0,
    apply:c => { const v = buffSum(c.def,'physRed') * c.defMul; c.dmg *= 1 - v/100; return `−${+v.toFixed(1)}%`; }},
  {id:'guard', name:'防御姿态', stage:2,
    applies:c => c.reaction === 'defend',
    apply:c => { const v = 50 * c.defMul; c.dmg *= 1 - v/100; return `−${+v.toFixed(1)}%`; }},
  {id:'resist', name:'抗性', stage:2,
    applies:c => weakList(c.def, c.w, c).some(([k,v]) => v < 0),
    apply:c => { const l = weakList(c.def, c.w, c).filter(([k,v]) => v < 0), v = Math.min(95, -l.reduce((a,[k,x]) => a + x, 0)) * c.defMul; c.dmg *= 1 - v/100; return `${l.map(([k]) => k).join('、')} −${+v.toFixed(1)}%`; }},
  {id:'beamReflect', name:'光束反射', stage:2,
    applies:c => abilOn(c.def,'beamReflect') && c.w.dmgType === '光束',
    apply:c => { const v = 50 * c.defMul, before = c.dmg; c.dmg *= 1 - v/100; if (c.w.fire === 'direct' || c.w.fire === 'melee') c.reflect = Math.round((before - c.dmg)/2); return `−${+v.toFixed(1)}%${c.reflect ? `（反射 ${c.reflect}）` : ''}`; }},
  {id:'softRed', name:'减伤（特技 / 增益）', stage:2,
    applies:c => softRed(c) > 0,
    apply:c => { const v = Math.min(90, softRed(c)) * c.defMul; c.dmg *= 1 - v/100; return `−${+v.toFixed(1)}%`; }},
  {id:'lambda', name:'λ 驱动器', stage:2,
    applies:c => abilOn(c.def,'lambda') && c.def.lambdaPhase !== phaseNo,
    apply:c => { const v = 60 * c.defMul; c.dmg *= 1 - v/100; if (!c.preview) c.def.lambdaPhase = phaseNo; return `本阶段第一次 −${+v.toFixed(1)}%`; }},
  {id:'armor', name:'装甲', stage:3,
    applies:c => c.dmg > 0,
    apply:c => { const base = effArmor(c.def), pr = c.zone && !hasTrait(c.def,'wSeries') ? ZONE[c.zone].pierce : 0, a = Math.round(base * c.defMul * (1 - pr/100)); c.dmg = Math.max(10, c.dmg - a); return `−${a}${a !== c.def.armor ? `（原 ${c.def.armor}${pr ? `，${ZONE[c.zone].name}无视 ${pr}%` : ''}）` : ''}`; }},
  {id:'lambdaShield', name:'λ 力场', stage:3, shield:true,
    applies:c => c.dmg > 0 && abilOn(c.def,'lambdaShield') && lsLeft(c.def) > 0,
    apply:c => { const a = Math.round(3000 * c.defMul); c.dmg = Math.max(0, c.dmg - a); if (!c.preview){ if (c.def.lsPhase !== phaseNo){ c.def.lsPhase = phaseNo; c.def.lsCount = 0; } c.def.lsCount++; } return `−${a}（本阶段剩 ${lsLeft(c.def)} 次）`; }},
];
REDUCTIONS.push({id:'shield', name:'护盾', stage:4, shield:true,
  applies:c => c.dmg > 0 && shieldOn(c.def) && c.def.shieldHp > 0,
  apply:c => { const a = Math.min(c.dmg, c.def.shieldHp); c.dmg -= a; if (!c.preview){ c.def.shieldHp -= a; if (a > 0) snd('shield'); if (c.def.shieldHp <= 0) shieldBroken(c.def); } return `吸收 ${a}（护盾剩 ${c.preview ? c.def.shieldHp - a : c.def.shieldHp}）`; }});
function shieldBroken(u){
  u.shieldBreaks = (u.shieldBreaks || 0) + 1;
  log(`${fullName(u)} 的${u.shieldName || '护盾'}被完全击破${u.lambdaAwaken ? `（${Math.min(u.shieldBreaks, u.lambdaAwaken)}/${u.lambdaAwaken}）` : ''}`, null, 'sys');
  if (u.lambdaAwaken && !u.awakened && u.shieldBreaks >= u.lambdaAwaken){
    u.awakened = true;
    if (LV && LV.run && u.awakenSwap){
      // 肉鸽：带上的普通武器变成对应的 λ 武器（仍然算 2 个武装），λ 武器 0 CD
      const T = ALLY_T.find(t => t.mech === u.mech);
      u.weapons = u.weapons.map(w => { const to = u.awakenSwap[w.name], tw = to && T.weapons.find(x => x.name === to); return tw ? {...tw, cd:0, cdLeft:0, usesLeft:tw.uses} : w; });
    } else u.weapons.forEach(w => { if (w.awaken) Object.assign(w, w.awaken); if (w.lambda){ w.cd = 0; w.cdLeft = 0; } });
    addFloat(u, 'λ 觉醒', '#c9a8ff'); snd('lambda', 0);
    log(`${fullName(u)}【λ 觉醒】所有 λ 武器冷却变为 0，单分子刀升级为 λ 单分子刀`, null, u.side);
  }
}
const shieldOn = u => !!u && u.shield > 0 && (u.side !== 'ally' || u.lv >= (u.shieldLv || 1));
const lsLeft = u => u.lsPhase !== phaseNo ? 2 : 2 - (u.lsCount || 0);
const softRed = c => (RM() && c.def.side === 'ally' ? RM().def * 2 : 0) + buffSum(c.def,'red') + (c.w.dmgType === '光束' ? buffSum(c.def,'beamRed') : 0) + tfx(c.def, 'red', c.att, c.w, c);

