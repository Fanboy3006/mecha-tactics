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
const effMov = u => Math.max(1, u.mov + buffSum(u, 'mov') + taMovAdd(u));   // v0.40.16 加上 TRANS-AM

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
  drawMaoZone(ctx);
  for (const u of units) if (u.hp > 0 && taActive(u)){ ctx.strokeStyle = 'rgba(255,90,122,.85)'; ctx.lineWidth = 2; ctx.strokeRect(u.x*TS + 2, u.y*TS + 2, u.w*TS - 4, u.h*TS - 4); }   // TRANS-AM 红框   // 秘银：毛的指挥范围（20 只调 drawSmoke 一个入口）
  if (!SMOKES.length) return;
  ctx.fillStyle = 'rgba(200,205,215,.38)';
  for (const s of SMOKES) if (s.b === BATTLE_ID && turn < s.until) for (const k of s.set) ctx.fillRect((k%N)*TS, ((k/N)|0)*TS, TS, TS);
}

/* 响介·赌徒的直觉：场上每有一次攻击打空（敌我都算，反击也算；必中的地图炮 / 被动不会打空），
   带 evadeCd 的武器（左轮打桩机）冷却永久 −1：先用 cutCd 减开场冷却和当前冷却，
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

/* ===== 秘银（v0.40.13） ===== */
/* 梅丽莎·毛「指挥网络」（Lv10 特技）：以她为中心 5×5（切比雪夫距离 ≤ MAO_R）是指挥范围。范围内的敌机：
   - 克鲁兹（MAO_LINK.sight）的直射无视障碍物（13 的 canHit 读 ignoresLos）；
   - 宗介和毛自己（MAO_LINK.striker，作者 10-08 补充）每次主动攻击它们、目标没被击破时，克鲁兹（MAO_LINK.support）跟着支援射击：
     自动选期望伤害最高、射程够得着的武器，不弹窗，也不占他每回合 1 次的援护攻击（18 的 supportAttack 开头调 linkSupport）。 */
const MAO_R = 2, MAO_LINK = {sight:['U6'], striker:['U7','U2'], support:'U6'};
const maoUnits = side => units.filter(m => m.side === side && m.hp > 0 && hasTrait(m, 'maoNet'));
const inMaoZone = (t, side) => maoUnits(side).some(m => tilesOf(t).some(([x, y]) => Math.max(Math.abs(x - m.x), Math.abs(y - m.y)) <= MAO_R));
const ignoresLos = (u, t) => !!u && !!t && t.side !== u.side && MAO_LINK.sight.includes(u.mech) && inMaoZone(t, u.side);
async function linkSupport(att, t){
  if (!MAO_LINK.striker.includes(att.mech) || t.hp <= 0 || !inMaoZone(t, att.side)) return;
  const s = units.find(k => k.mech === MAO_LINK.support && k.side === att.side && k.hp > 0 && !k.stunned && !k.disarmed);
  if (!s) return;
  const ws = s.weapons.filter(w => SUPPORT_FIRES.includes(w.fire) && !w.special?.match?.(/lock|gamble/) && !wStatus(s, w, {counter:true}) && canHit(s, w, t))
    .map(w => ({w, f:forecast(s, w, t, null)})).sort((a, b) => b.f.exp - a.f.exp);
  if (!ws.length){ log(`${fullName(s)}【指挥网络】${fullName(t)} 不在射程内，没能支援射击`, null, s.side); return; }
  log(`${fullName(s)}【指挥网络】支援射击：用【${ws[0].w.name}】攻击 ${fullName(t)}（不占援护攻击次数）`, null, s.side);
  await strike(s, ws[0].w, t, null);
  refresh(); checkEnd();
}
function drawMaoZone(ctx){
  for (const m of units) if (m.side === 'ally' && m.hp > 0 && hasTrait(m, 'maoNet')){
    ctx.strokeStyle = 'rgba(110,220,230,.75)'; ctx.lineWidth = 2; ctx.setLineDash && ctx.setLineDash([4, 3]);
    const x0 = Math.max(0, m.x - MAO_R), y0 = Math.max(0, m.y - MAO_R), x1 = Math.min(MW - 1, m.x + MAO_R), y1 = Math.min(MH - 1, m.y + MAO_R);
    ctx.strokeRect(x0*TS + 1, y0*TS + 1, (x1 - x0 + 1)*TS - 2, (y1 - y0 + 1)*TS - 2);
    ctx.setLineDash && ctx.setLineDash([]);
  }
}

/* ===== 天人（v0.40.16） ===== */
/* TRANS-AM（Lv10，能力 transAm）：移动前在指令面板开启，不占行动。
   从开启那回合起 TA_LEN 个回合（turn < taEnd）：武器威力 ×1.3（15 的 wPow）、移动 +2（effMov）、闪避 +15（03 TRAIT_FX）、各机体专属效果；
   结束后那 1 回合（turn === taEnd）移动 −2；从结束起冷却 TA_CD 回合。按 BATTLE_ID 区分，换场就重置。 */
const TA_LEN = 3, TA_CD = 10;
const taOn = u => !!u && u.taB === BATTLE_ID;
const taActive = u => taOn(u) && turn < u.taEnd;
const taAfter = u => taOn(u) && turn === u.taEnd;
const taReadyTurn = u => taOn(u) ? u.taEnd + TA_CD : 0;
const canTA = u => !!u && u.side === 'ally' && abilOn(u, 'transAm') && !u.moved && !u.acted && !taActive(u) && turn >= taReadyTurn(u);
function activateTA(u){
  if (!canTA(u)) return false;
  u.taB = BATTLE_ID; u.taEnd = turn + TA_LEN;
  fx('pulse', {b:cpx(u), r:TS*2, color:'#ff5a7a', dur:600});
  log(`${fullName(u)}【TRANS-AM】启动！到第 ${u.taEnd - 1} 回合结束：武器威力 ×1.3、移动 +2、闪避 +15`, null, 'ally');
  return true;
}
function taButton(u){
  if (!u || u.side !== 'ally' || !u.abilities.includes('transAm')) return '';
  if (!abilOn(u, 'transAm')) return `<button class="btn" disabled>TRANS-AM（Lv10 解锁）</button>`;
  if (taActive(u)) return `<button class="btn" disabled>TRANS-AM 中（到第 ${u.taEnd - 1} 回合）</button>`;
  if (taOn(u) && turn < taReadyTurn(u)) return `<button class="btn" disabled>TRANS-AM 冷却（第 ${taReadyTurn(u)} 回合可用）</button>`;
  return `<button class="btn" data-a="transam" ${canTA(u) ? '' : 'disabled'} title="不占行动；持续 ${TA_LEN} 回合，之后 1 回合移动 −2，冷却 ${TA_CD} 回合">TRANS-AM 启动</button>`;
}
const taPowMul = u => taActive(u) ? 1.3 : 1;
const taMovAdd = u => taActive(u) ? 2 : (taAfter(u) ? -2 : 0);
/* 每台机体的专属效果：刹那 GN 剑命中 +20（03）、DASH +1；洛克昂狙击步枪移动后可用（13）、标记破防 ×2；阿雷路亚推 4 格、碰撞 ×2；提耶利亚高压全弹宽 3 格 */
const taDash = u => taActive(u) && u.mech === 'CB1' ? 1 : 0;
const markPct = (att, w) => taActive(att) && att.mech === 'CB2' ? 40 : 20;
const taPushN = (att, w) => taActive(att) && att.mech === 'CB3' ? Math.max(4, w.push || 0) : w.push;
let PUSH_SRC = null;
const collideDmg = () => PUSH_SRC && taActive(PUSH_SRC) && PUSH_SRC.mech === 'CB3' ? 1600 : 800;
const taWidth = (u, w) => taActive(u) && u.mech === 'CB4' ? 3 : 1;

/* 提耶利亚：脱装成纳德雷的那一刻，以自己为中心 5×5 内的敌机全部眩晕一回合（下一个敌方阶段不能行动、之前也不能反击 / 回避 / 防御）。
   脱装一场只能一次，相当于 CD 99。 */
const PURGE_R = 2;
function purgeStun(u){
  const hit = units.filter(e => e.side !== u.side && e.side !== 'neutral' && e.hp > 0 && tilesOf(e).some(([x, y]) => Math.max(Math.abs(x - u.x), Math.abs(y - u.y)) <= PURGE_R));
  hit.forEach(e => { e.stunned = true; addFloat(e, '眩晕', '#c9a8ff'); });
  fx('pulse', {b:cpx(u), r:TS*3, color:'#c9a8ff', dur:600});
  log(`${fullName(u)} 脱装的冲击：5×5 内 ${hit.length} 台敌机眩晕一回合${hit.length ? '（' + hit.map(fullName).join('、') + '）' : ''}`, null, 'ally');
}

/* 拉塞「GN 武装·护卫」（Lv20）：援护防御次数 +1（Lv30 +2）。16 在敌方阶段开始时重置次数，这里在它之后加上 */
Hooks.on('phaseStart', c => { if (c.side === 'enemy') units.forEach(u => { if (u.side === 'ally' && abilOn(u, 'gnArmsGuard')) u.guardLeft += L30(u) ? 2 : 1; }); }, '拉塞「GN 武装·护卫」：援护防御次数 +1');

/* 测试接口：角色机制的函数（tests/moon.js 等用；window.__game 归规则对话，所以单独挂一个） */
window.__chars = {autoWeapon:u => autoWeapon(u), echoWeapon:u => echoWeapon(u), attackTilesOf, pickOf, setPick:k => { FEENA_PICK = k; }, canSwitchPick, chainStepOf, effMov, zocRadius,
  strike:(a, w, d) => strike(a, w, d, null), healTargets:(u, w) => healTargets(u, w), supBuff:(u, w) => supBuff(u, w), mapAttack:(u, w, d) => mapAttack(u, w, d), smokeHit, inSmoke, evadeN, evadeCdCut, get SMOKES(){ return SMOKES; }, inMaoZone, ignoresLos, linkSupport:(a, t) => linkSupport(a, t), activateTA, taActive, taAfter, canTA, purgeStun, collideDmg};
