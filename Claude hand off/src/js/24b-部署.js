/* ---------- v0.39 部署区域、机库、前线中继、撤回（作者 2026-10-07 定） ----------
   - 编队里选的是「首发」（同时在场上限 = LV.maxDeploy）；队里其余机体都带进战斗，放在机库里；
   - 我方阶段可以从机库派出机体：只能放在部署格（出击点 + 前线中继周围）上，格子不能有人、不能在敌方控制区里，场上人数不能超过上限；
   - 刚派出的机体当回合不能移动，但可以攻击、可以选朝向；
   - 尖兵「前线中继」：移动后在脚下插一个中继，周围 2 格变成部署格（每台尖兵 1 个，再插就挪过去；插完本回合结束；尖兵被击破，中继消失）；
   - 撤回：在指挥职业机体 4 格内（含指挥自己）可以撤回机库，算这台的行动；撤回的机体当回合不能再派出，换别人上可以；
   - v0.39.2 全图部署（作者 10-08：先给迪奥 W2 试玩）：派出时可以放在任意空格，仍然不能进敌方控制区；名单在 GLOBAL_DEPLOY；
   - 母舰：暂不做。 */
let HANGAR = [];
const RELAYS = new Map();   // 尖兵 uid → {x, y}
const RELAY_R = 2, RETREAT_R = 4;
const GLOBAL_DEPLOY = ['W1','W2','W3','W4','W5'];   // 全图部署名单：v0.40.19 角色对话定为流星小队五人（作者 10-08）
ALLY_T.forEach(t => { if (GLOBAL_DEPLOY.includes(t.mech) && !t.abilities.includes('globalDeploy')) t.abilities.push('globalDeploy'); });
const hangarOn = () => !!(LV && LV.hangar);
const fieldAllies = () => units.filter(u => u.side === 'ally' && u.hp > 0 && !u.commandOnly);
const fieldCap = () => (LV && LV.maxDeploy) || 99;
function baseDeploySet(){
  const s = new Set();
  for (const [x, y] of (LV && LV.spots) || []) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (inb(x+i, y+j)) s.add((y+j)*N + x+i);
  for (const [uid, r] of RELAYS){
    if (!units.some(u => u.uid === uid && u.hp > 0)) continue;
    for (let dy = -RELAY_R; dy <= RELAY_R; dy++) for (let dx = -RELAY_R; dx <= RELAY_R; dx++) if (Math.abs(dx) + Math.abs(dy) <= RELAY_R && inb(r.x+dx, r.y+dy)) s.add((r.y+dy)*N + r.x+dx);
  }
  return s;
}
function allTilesSet(){ const s = new Set(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) s.add(y*N + x); return s; }
function deployTiles(u){
  const set = abilOn(u, 'globalDeploy') ? allTilesSet() : baseDeploySet(), zs = zocSet(u), out = [];
  for (const k of set){
    const x = k % N, y = (k / N) | 0;
    if (!tilesOf(u, x, y).every(([a, b]) => set.has(b*N + a))) continue;
    if (!canStand(u, x, y) || inZoc(u, x, y, zs)) continue;
    out.push({x, y});
  }
  return out;
}
const canDeploy = u => hangarOn() && HANGAR.includes(u) && u.retreatTurn !== turn && fieldAllies().length < fieldCap() && deployTiles(u).length > 0;
function startDeploy(u){
  if (!canDeploy(u)) return;
  Object.assign(S, {sel:null, mode:'deploy', depUnit:u, depTiles:deployTiles(u), inspect:u});
  refresh();
}
function doDeploy(x, y){
  const u = S.depUnit; if (!u || !S.depTiles.some(t => t.x === x && t.y === y)) return false;
  HANGAR = HANGAR.filter(h => h !== u);
  u.x = x; u.y = y; u.facing = LV.allyFacing || 'right'; u.deployTurn = turn; u.enterB = BATTLE_ID; u.enterT = turn; u.acted = false; u.moved = false; u.movedThisRound = false;
  units.push(u);
  log(`${fullName(u)} 从机库出击（场上 ${fieldAllies().length} / ${fieldCap()}）`, null, 'ally');
  select(u);
  S.origin = {x, y, facing:u.facing, flying:u.flying, toggledTurn:u.toggledTurn}; S.noUndo = true; S.mode = 'menu';
  refresh();
  return true;
}
const commanderNear = u => units.some(c => c.side === 'ally' && c.hp > 0 && c.tags && c.tags.战斗分类 === '指挥' && distU(c, u) <= RETREAT_R);
const canRetreat = u => hangarOn() && !!u && u.side === 'ally' && !u.commandOnly && commanderNear(u);
async function doRetreat(u){
  if (!canRetreat(u)) return;
  units.splice(units.indexOf(u), 1);
  u.retreatTurn = turn; u.acted = true;
  HANGAR.push(u);
  if (RELAYS.has(u.uid)) RELAYS.delete(u.uid);
  log(`${fullName(u)} 撤回机库（场上 ${fieldAllies().length} / ${fieldCap()}）`, null, 'ally');
  clearSel(); refresh();
  checkEnd();
}
const canRelay = u => hangarOn() && !!u && abilOn(u, 'relay');
async function doRelay(u){
  if (!canRelay(u)) return;
  RELAYS.set(u.uid, {x:u.x, y:u.y});
  addFloat(u, '前线中继', '#7fe6ff');
  log(`${fullName(u)} 在 (${u.x},${u.y}) 插下前线中继：周围 ${RELAY_R} 格成为部署格`, null, 'ally');
  await finish(u);
}
Hooks.on('unitDestroyed', c => { if (c.unit && RELAYS.has(c.unit.uid)){ RELAYS.delete(c.unit.uid); log('前线中继随机体一起失效', null, 'sys'); } }, '前线中继：尖兵被击破就消失');
/* 开战：编队选出的首发已经上场；其余队员先一起上场（吃到开战时的藏品 / 词缀 / 零件效果），再收进机库 */
function stowHangar(list){
  HANGAR = [];
  for (const u of list){ const i = units.indexOf(u); if (i >= 0) units.splice(i, 1); u.acted = false; HANGAR.push(u); }
  if (HANGAR.length) log(`机库待命 ${HANGAR.length} 台：${HANGAR.map(u => u.short).join('、')}。我方阶段可以在部署格派出（场上上限 ${fieldCap()} 台）`, null, 'sys');
}
function resetDeploy(){ HANGAR = []; RELAYS.clear(); }
function hangarHTML(){
  if (!hangarOn()) return '';
  const n = fieldAllies().length, cap = fieldCap();
  const rows = HANGAR.map(u => {
    const why = u.retreatTurn === turn ? '本回合刚撤回' : n >= cap ? '场上已满' : !deployTiles(u).length ? '没有空的部署格' : '';
    return `<button class="btn" data-hangar="${u.uid}" ${why ? 'disabled' : ''} title="${why}">${u.short} ${u.pilot} · HP ${u.hp}/${u.maxHp}${why ? `（${why}）` : ''}</button>`;
  }).join('');
  return `<div class="facerow"><span class="small">机库（场上 ${n} / ${cap}）${HANGAR.length ? '：点一台派出到部署格（当回合不能移动，可以攻击）' : '：空'}</span><div class="acts">${rows}</div></div>`;
}
