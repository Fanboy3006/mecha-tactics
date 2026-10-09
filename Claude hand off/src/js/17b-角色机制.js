/* ---------- 角色机制（角色对话维护，v0.40.10 起） ----------
   按势力重设计角色时新增的机制放在这里：个人特技 / 被动的钩子、只给个别角色用的武器效果。
   规则层面的接口改动（读这里的函数）记在《规则对话交接》里。 */

/* ===== 月球王国 ===== */
/* Feena 只能携带一个技能（作者 10-08）：出击前在编队里选，或第 1 回合行动前在指令面板切换。
   'bless' = 月光祝福；'echo' = 残月的余响（Lv30 起满月·月蚀冷却好时优先）。Lv20 以前只有祝福。 */
let FEENA_PICK = 'echo';
const pickOf = u => u.lv < 20 ? 'bless' : (u.pick || FEENA_PICK);
const pickAllows = (u, w) => !u.skillPick || (pickOf(u) === 'bless' ? w.fire === 'support' : w.special === 'echo');
const canSwitchPick = u => !!u && u.skillPick && u.side === 'ally' && u.lv >= 20 && turn === 1 && !u.acted;

/* 一台机体在当前位置、当前朝向下实际打得到的格子（残月的余响的延伸范围用）。
   任意一把已解锁的近战 / 直射 / 曲射武器都算，冷却中也算；按朝向形状、最小射程、直射视线判定。
   每帧都会画余响范围，所以按局面缓存。 */
const ATK_TILE_CACHE = new Map();
function attackTilesOf(a){
  const sig = `${turn}|${a.uid}|${a.x},${a.y}|${a.facing}|${a.lv}|${a.flying ? 1 : 0}|${walls.size}|${units.map(o => o.uid + ':' + o.x + ',' + o.y).join(';')}`;
  const hit = ATK_TILE_CACHE.get(a.uid);
  if (hit && hit.sig === sig) return hit.set;
  const set = new Set(), ws = a.weapons.filter(w => a.lv >= w.unlock && (w.fire === 'melee' || w.fire === 'direct' || w.fire === 'indirect'));
  const R = ws.reduce((m, w) => Math.max(m, effRange(a, w)[1]), 0) + Math.max(a.w, a.h);
  for (let y = Math.max(0, a.y - R); y <= Math.min(MH - 1, a.y + R); y++) for (let x = Math.max(0, a.x - R); x <= Math.min(MW - 1, a.x + R); x++){
    const pt = {x, y, w:1, h:1, side:'enemy', flying:false, abilities:[], buffs:[], hp:1};
    if (ws.some(w => canHit(a, w, pt, a.x, a.y, a.facing))) set.add(y*N + x);
  }
  ATK_TILE_CACHE.set(a.uid, {sig, set});
  return set;
}

/* 小太刀 Nagi 的连射：每命中一次，下一枪命中修正再 −step；Lv20 被动「残心」减轻惩罚 */
const CHAIN_MAX = 8;
const chainStepOf = (u, w) => abilOn(u, 'zanshin') ? (L30(u) ? 45 : 55) : (w.chainStep || 70);

/* 移动力增减（重力网的减速等），reach() 默认用它 */
const effMov = u => Math.max(1, u.mov + buffSum(u, 'mov'));

/* 阿布拉德 Lv20「铁壁领域」：本回合没有移动时，控制区扩大到 2 格（11-移动.js 的 zocSet 读它） */
const zocRadius = o => abilOn(o, 'ironField') && !o.movedThisRound ? 2 : 1;

Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || !c.w.slow) return;
  c.def.buffs.push({src:c.w.name, mov:-c.w.slow});
  log(`${fullName(c.def)} 被【${c.w.name}】缠住：移动力 −${c.w.slow}（到下一个我方阶段开始）`, null, c.att.side);
}, '重力网：命中的敌机移动力 −2，到下一个我方阶段开始');
Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || c.w.special !== 'pull' || !hasTrait(c.att, 'bind')) return;
  c.def.buffs.push({src:'拘束', def:-20});
  log(`${fullName(c.def)} 被【拘束】：防御 −20（到下一个我方阶段开始）`, null, c.att.side);
}, '苏菲「拘束」：被牵引锚命中的敌机防御 −20');

/* ===== ATX 小队（v0.40.11） ===== */
/* 拉米亚·烟雾弹：一块 3×3 的烟雾，持续 N 回合（到第 放下回合 + N 回合的我方阶段开始消失）。
   从烟雾里开火、或者打烟雾里的目标，命中 −SMOKE_HIT（敌我都算；两边都在烟雾里也只算一次）。15 的 hitRate 读 smokeHit。 */
const SMOKE_HIT = 30;
let SMOKES = [];
const smokeAt = (x, y) => SMOKES.some(s => s.b === BATTLE_ID && turn < s.until && s.set.has(y*N + x));
const inSmoke = u => !!u && tilesOf(u).some(([x, y]) => smokeAt(x, y));
const smokeHit = (att, def) => SMOKES.length && (inSmoke(att) || inSmoke(def)) ? SMOKE_HIT : 0;
function placeSmoke(u, w, dir){
  SMOKES = SMOKES.filter(s => s.b === BATTLE_ID && turn < s.until);
  SMOKES.push({b:BATTLE_ID, until:turn + w.smoke, set:new Set(dir.path.map(([x, y]) => y*N + x))});
  log(`${fullName(u)}【${w.name}】在 (${dir.box[0]}, ${dir.box[1]}) 放下 ${w.size}×${w.size} 烟雾，持续到第 ${turn + w.smoke} 回合我方阶段开始：里外开火命中 −${SMOKE_HIT}`, null, u.side);
}
function drawSmoke(ctx){
  if (!SMOKES.length) return;
  ctx.fillStyle = 'rgba(200,205,215,.38)';
  for (const s of SMOKES) if (s.b === BATTLE_ID && turn < s.until) for (const k of s.set) ctx.fillRect((k%N)*TS, ((k/N)|0)*TS, TS, TS);
}

/* 响介·赌徒的直觉：场上每有一次攻击打空（敌我都算，反击也算；必中的地图炮 / 被动不会打空），
   带 evadeCd 的武器（左轮打桩机系列）冷却永久 −1：先用 cutCd 减开场冷却和当前冷却，
   开场冷却 EVADE_START 次减完后，多出来的次数减武器本身的冷却，减到 0 = 用完不进冷却。 */
const EVADE_START = 10;
const evadeN = u => u.evB === BATTLE_ID ? (u.evN || 0) : 0;
const evadeCdCut = u => Math.max(0, evadeN(u) - EVADE_START);
Hooks.on('strikeResolved', c => {
  if (c.hit || isSure(c.w)) return;
  for (const u of units) if (u.hp > 0 && u.weapons.some(w => w.evadeCd && u.lv >= w.unlock)){
    u.evN = evadeN(u) + 1; u.evB = BATTLE_ID;
    cutCd(u, 1);
    log(`${fullName(u)}【赌徒的直觉】${fullName(c.att)} 打空了：左轮打桩机冷却 −1（本场累计 ${u.evN} 次）`, null, u.side);
  }
}, '响介「赌徒的直觉」：场上每打空一次，左轮打桩机冷却 −1');
Hooks.on('strikeResolved', c => {
  if (!c.w.evadeCd || c.counter) return;
  const cut = evadeCdCut(c.att), w = c.att.weapons.find(x => x.name === c.w.name) || c.w;
  if (cut >= w.cd) w.cdLeft = 0; else if (cut > 0) w.cdLeft = Math.max(0, w.cdLeft - cut);
}, '响介「赌徒的直觉」：开场冷却减完后，多打空的次数减武器本身的冷却');

/* 测试接口：角色机制的函数（tests/moon.js 等用；window.__game 归规则对话，所以单独挂一个） */
window.__chars = {autoWeapon:u => autoWeapon(u), echoWeapon:u => echoWeapon(u), attackTilesOf, pickOf, setPick:k => { FEENA_PICK = k; }, canSwitchPick, chainStepOf, effMov, zocRadius,
  strike:(a, w, d) => strike(a, w, d, null), healTargets:(u, w) => healTargets(u, w), supBuff:(u, w) => supBuff(u, w), mapAttack:(u, w, d) => mapAttack(u, w, d), smokeHit, inSmoke, evadeN, evadeCdCut, get SMOKES(){ return SMOKES; }};
