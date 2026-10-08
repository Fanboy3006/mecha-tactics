/* ---------- 状态 ---------- */
let level = 'tut1', LV = null, waveIdx = -1, deadline = 0;
let walls = new Map();
let CMD = null;   // {unit, skill, readyTurn, pending:[{cells, land}]}  // key -> 到期回合（该回合的我方阶段开始时消失）
let map = [], units = [], roster = [], turn = 1, battleNo = 1, seed = 0, over = false, uidc = 0, terrainCanvas = null;
const S = {mode:'idle', sel:null, origin:null, reach:[], weapon:null, target:null, inspect:null, hover:null, atkTiles:[], threat:false, threatSet:null, dirs:[], dir:null, names:false, grid:false};
const floats = [];
const fullName = u => u.side === 'ally' ? `${u.pilot}·${u.mech}` : u.mech;

ENEMY_SUPPORT.forEach(k => { if (ENEMY_T[k] && !ENEMY_T[k].abilities.includes('supportAtk')) ENEMY_T[k].abilities.push('supportAtk'); });
const AIM_BY_CLASS = {狙击:180, 尖兵:170, 近卫:165, 特种:165, 指挥:160, 重装:150};   // 我方按战斗分类的初始命中，敌人默认 160
function makeUnit(t, side, x, y){
  return {...t, aim: t.aim ?? (side === 'ally' ? (AIM_BY_CLASS[(t.tags || {}).战斗分类] ?? 160) : 160), shieldHp:t.shield || 0, uid:++uidc, side, x, y, lv:1, maxHp:t.hp, hp:t.hp, moved:false, movedThisRound:false, moveEva:0, acted:false, barrierLeft:3, guardLeft:2, buffs:[], debuffs:[], backlash:0, toggledTurn:0, facing: side === 'ally' ? 'up' : 'down',
    tags:{...(t.tags||{})}, abilities:[...t.abilities], weapons:t.weapons.map(w => ({...w, usesLeft:w.uses, cdLeft:0}))};
}
function levelUp(u, heal=false){
  u.lv++; u.maxHp += 200; if (heal) u.hp += 200; u.melee += 2; u.shoot += 2; u.awaken = (u.awaken ?? 100) + 2; u.defense = (u.defense || 0) + (u.side === 'neutral' ? 0 : 2);
  /* v0.24 晋升档位：我方到 Lv20、Lv30 时基础属性再提升一档（HP 和装甲 +25%，格斗 / 射击 / 觉醒 / 防御 +25，闪避 +8；Lv30 移动 +1）。v0.37 去掉技量，加觉醒、防御 */
  if (u.side === 'ally' && (u.lv === 20 || u.lv === 30)){
    const add = Math.round(u.maxHp * .25); u.maxHp += add; if (heal) u.hp += add;
    u.armor = Math.round(u.armor * 1.25); u.melee += 25; u.shoot += 25; u.awaken += 25; u.defense += 25; u.eva += 8; u.aim += 10;
    if (u.lv === 30) u.mov += 1;
  }
}
function revertForm(u){
  if (!u.transformed) return;
  const t = ALLY_T.find(t => t.mech === u.mech);
  u.transformed = false; u.armor = t.armor; u.eva = t.eva; u.mov = t.mov;
  u.weapons = t.weapons.map(w => ({...w, usesLeft:w.uses, cdLeft:0}));
}
function resetForBattle(u){ revertForm(u);
  if (u.awakened){ const t = ALLY_T.find(t => t.mech === u.mech); u.weapons = t.weapons.map(w => ({...w, usesLeft:w.uses, cdLeft:0})); }
  u.awakened = false; u.shieldBreaks = 0; u.facing = 'up'; u.buffs = []; u.debuffs = []; u.hp = u.maxHp; u.moved = u.acted = false; u.barrierLeft = 3; u.shieldHp = u.shield || 0; u.coreUsed = false; u.extStack = 0; u.hitLog = null; u.disarmed = false; u.stunned = false; u.lastMove = 0; u.lambdaPhase = u.lsPhase = -1; u.deployed = false; u.weapons.forEach(w => { w.usesLeft = w.uses; w.cdLeft = 0; }); }

