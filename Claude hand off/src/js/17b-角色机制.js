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

/* 测试接口：角色机制的函数（tests/moon.js 等用；window.__game 归规则对话，所以单独挂一个） */
window.__chars = {autoWeapon:u => autoWeapon(u), echoWeapon:u => echoWeapon(u), attackTilesOf, pickOf, setPick:k => { FEENA_PICK = k; }, canSwitchPick, chainStepOf, effMov, zocRadius,
  strike:(a, w, d) => strike(a, w, d, null), healTargets:(u, w) => healTargets(u, w), supBuff:(u, w) => supBuff(u, w), mapAttack:(u, w, d) => mapAttack(u, w, d)};
