/* ---------- 输入 ---------- */
function select(u){
  S.moveCost = 0; S.lastPick = u; S.cursor = null; S.selFly = u.flying; S.selFacing = u.facing;
  Object.assign(S, {sel:u, inspect:u, origin:null, reach: u.deployTurn === turn ? [{x:u.x, y:u.y, d:0, face:null}] : reach(u), mode:'moving', weapon:null, target:null, dirs:[], dir:null, teleported:false, portalTiles:[]});
  fireTip('select:' + u.mech);
  refresh();
}
/* v0.39.4 我方移动也要过敌方压制射击（作者 10-08）：有敌方狙击在看时一格一格走（和敌方移动同一套 moveWatched）；
   挨了一发就不能取消移动；被打爆就结束。返回 false = 这台没了 */
async function allyMove(u, t){
  if (!watchers(u).length){ if (t.face) u.facing = t.face; moveUnit(u, t.x, t.y); return true; }
  const mode = S.mode; S.mode = 'busy'; u.owHit = false;
  const alive = await moveWatched(u, S.reach, t);
  if (!alive || u.hp <= 0 || !units.includes(u)){ clearSel(); refresh(); checkEnd(); return false; }
  if (t.face) u.facing = t.face;
  if (u.owHit){ S.noUndo = true; S.owHit = true; }
  S.mode = mode; return true;
}
function cancel(){
  if (S.sel && S.origin){ S.sel.x = S.origin.x; S.sel.y = S.origin.y; S.sel.facing = S.origin.facing; S.sel.moved = false; S.sel.movedThisRound = false; }
  clearSel(); refresh();
}
async function finish(u){
  const used = S.moveCost || 0;
  u.acted = true; clearSel(); S.moveCost = 0; u.lastMove = 0;
  if (hasTrait(u,'moveEva')){
    const left = Math.max(0, u.mov - used);
    u.moveEva = left * 5;
    if (left) log(`${fullName(u)}【游刃有余】剩余移动力 ${left} → 闪避 +${u.moveEva}（到下一个我方阶段）`, null, u.side);
  }
  const ctx = Hooks.emit('actionEnd', {unit:u, side:u.side, queue:[]});
  const autoW = autoWeapon(u);
  if ((autoW || regenWeapon(u)) && !over){
    S.mode = 'busy'; refresh();
    if (autoW && autoW.fire === 'support'){ castSupport(u, autoW); await sleep(400); }
    else if (autoW) await echoRelease(u);
    if (regenWeapon(u) && !over) await regenRelease(u);
    if (!over) S.mode = 'idle';
  }
  checkEnd();
  refresh();
}
function onTile(x,y){
  if (over || S.mode === 'enemy' || S.mode === 'busy') return;
  if (S.mode === 'command'){ if (execCommand(x, y)){ S.mode = 'idle'; } refresh(); return; }
  const u = occupant(x,y);
  if (S.mode === 'deploy'){ if (!doDeploy(x, y)){ S.mode = 'idle'; S.depUnit = null; refresh(); } return; }
  switch (S.mode){
    case 'idle':
      if (u && u.side === 'ally' && !u.acted) select(u); else { S.inspect = u || null; refresh(); }
      break;
    case 'moving': {
      const t = S.reach.find(t => t.x === x && t.y === y);
      if (t){ S.moveCost = t.d; S.sel.lastMove = t.d; S.origin = {x:S.sel.x, y:S.sel.y, facing:S.sel.facing, flying:S.sel.flying, toggledTurn:S.sel.toggledTurn}; const me = S.sel; if (!watchers(me).length){ if (t.face) me.facing = t.face; moveUnit(me, x, y); S.mode = 'menu'; refresh(); } else allyMove(me, t).then(ok => { if (ok){ S.mode = 'menu'; refresh(); } }); }
      else if (u && u.side === 'ally' && !u.acted) select(u);
      else if (u){ S.inspect = u; refresh(); }
      else cancel();
      break;
    }
    case 'portal': {
      const me = S.sel, t = S.portalTiles.find(t => t.x === x && t.y === y);
      if (t){
        S.origin = {x:me.x, y:me.y, facing:me.facing};
        fx('warp', {b:cpx(me), dur:300}); me.x = x; me.y = y; fx('warp', {b:cpx(me), out:true, dur:360}); me.moved = true; me.movedThisRound = true; me.backlash += me.portal.cost; S.teleported = true;
        addFloat(me, `反噬 ${me.backlash}`, '#c9a8ff');
        log(`${fullName(me)} 传送至 (${x}, ${y})，反噬值 ${me.backlash}/100`, null, 'ally');
        S.mode = 'menu'; fireTip('teleported'); refresh();
      } else if (u === me){ S.mode = 'moving'; refresh(); }
      else if (u){ S.inspect = u; refresh(); }
      break;
    }
    case 'menu': case 'weapon':
      if (u){ S.inspect = u; refresh(); }
      break;
    case 'lock':
      if (u && targetsFor(S.sel, S.weapon).includes(u)) toggleLock(u);
      else if (u){ S.inspect = u; refresh(); }
      break;
    case 'moving2': {
      if (S.dash && u === S.sel){ dashArrive(); break; }
      const t = S.reach.find(t => t.x === x && t.y === y);
      const me = S.sel, sync = !watchers(me).length;   // 没有敌方狙击在看：照旧同步移动（测试和快捷键依赖这个）
      if (t && S.dash){ if (sync){ if (t.face) me.facing = t.face; moveUnit(me, x, y); dashArrive(); } else allyMove(me, t).then(ok => { if (ok) dashArrive(); }); }
      else if (t){ S.moveCost += t.d; if (sync){ if (t.face) me.facing = t.face; moveUnit(me, x, y); finish(me); } else allyMove(me, t).then(ok => { if (ok) finish(me); }); }
      break;
    }
    case 'pick':
      if (u && S.atkList.includes(u)) choosePick(u);
      else if (u){ S.inspect = u; refresh(); }
      break;
    case 'target': case 'confirm':
      if (u && u.side === 'enemy' && canHit(S.sel, S.weapon, u)){ S.target = u; S.mode = 'confirm'; refresh(); }
      else if (u){ S.inspect = u; refresh(); }
      break;
    case 'device': {
      if (S.devTiles.some(t => t.x === x && t.y === y)){
        transformUnit(S.sel, x, y);
        S.noUndo = true; S.mode = 'menu'; refresh();
      } else if (u){ S.inspect = u; refresh(); }
      break;
    }
    case 'hack': {
      if (u && trialTargets(S.sel, S.weapon).includes(u)) hackAct(u);
      else if (u){ S.inspect = u; refresh(); }
      break;
    }
    case 'heal':
      if (u && healTargets(S.sel, S.weapon).includes(u)) healAct(u);
      else if (u){ S.inspect = u; refresh(); }
      break;
    case 'mapdir': case 'mapconfirm': {
      const d = S.weapon && S.weapon.shape === 'box' ? (S.dirs.find(d => d.box[0] === x && d.box[1] === y) || S.dirs.find(d => d.path.some(([a,b]) => a === x && b === y)))   // v0.40.10 选区域：点的格子当左上角
        : S.dirs.find(d => d.ok && (d.path.some(([a,b]) => a === x && b === y) || (d.land && d.land[0] === x && d.land[1] === y)));
      if (d){ S.dir = d; S.mode = 'mapconfirm'; refresh(); }
      else if (u){ S.inspect = u; refresh(); }
      break;
    }
  }
}
async function onAction(a){
  const u = S.sel;
  if (a === 'cancel') cancel();
  else if (a === 'attack'){ S.mode = 'weapon'; refresh(); }
  else if (a === 'transform'){ S.devTiles = wallCenters(u, {range:[1,3]}); S.mode = 'device'; refresh(); }
  else if (a === 'cmd-cancel'){ S.mode = 'idle'; refresh(); }
  else if (a === 'cmd-go'){ if (execCommand()) S.mode = 'idle'; refresh(); }
  else if (a === 'portal'){ S.portalTiles = portalTiles(u); S.mode = 'portal'; refresh(); }
  else if (a === 'portal-back'){ S.mode = 'moving'; refresh(); }
  else if (a === 'fly'){
    u.flying = !u.flying;
    log(`${fullName(u)} ${u.flying ? '起飞' : '落地'}`, null, 'ally');
    if (S.mode === 'moving') S.reach = reach(u);
    refresh();
  }
  else if (a === 'feenaPick'){ if (canSwitchPick(u)){ u.pick = FEENA_PICK = pickOf(u) === 'bless' ? 'echo' : 'bless'; log(`Feena 携带【${u.pick === 'bless' ? '月光祝福' : '残月的余响'}】`, null, 'ally'); } refresh(); }   // v0.40.10 只能携带一个技能
  else if (a === 'wait') await finish(u);
  else if (a === 'relay') await doRelay(u);
  else if (a === 'retreat') await doRetreat(u);
  else if (a === 'deploy-cancel'){ S.mode = 'idle'; S.depUnit = null; refresh(); }
  else if (a === 'undo'){ u.x = S.origin.x; u.y = S.origin.y; u.facing = S.origin.facing; u.movedThisRound = false; S.moveCost = 0; if (S.origin.flying != null) u.flying = S.origin.flying; u.moved = false; S.origin = null; S.reach = reach(u); S.mode = 'moving'; refresh(); }
  else if (a === 'back-menu'){ S.mode = 'menu'; refresh(); }
  else if (a === 'back-weapon'){ S.mode = 'weapon'; S.target = null; S.dir = null; S.dirs = []; refresh(); }
  else if (a === 'fire'){
    const t = S.target, w = S.weapon, r = aiReaction(t, u, w);
    S.mode = 'busy'; refresh();
    await battle(u, w, t, r.reaction, r.weapon);
    if (!over && u.hp > 0 && t.hp > 0) await supportAttack(u, t);
    const foesLeft = units.some(e => e.side !== u.side);
    if (!over && u.hp > 0 && t.hp <= 0 && foesLeft){
      let why = null;
      if (abilOn(u,'dash')){
        if (u.dashTurn !== turn){ u.dashTurn = turn; u.dashCount = 0; }
        if (u.dashCount < dashLimit(u)){
          u.dashCount++;
          S.dash = true; S.noUndo = true; S.extraUsed = true; S.weapon = null; S.target = null;
          S.reachLeft = 3; S.reach = reach(u, 3); S.mode = 'moving2';
          log(`${fullName(u)}【DASH】击破目标：获得 3 点移动力和一次额外攻击（本回合第 ${u.dashCount}/${dashLimit(u)} 次）`, null, 'ally');
          refresh(); return;
        }
      }
      if (wv(u, w, 'again') && !S.extraUsed){ why = w.name; }
      if (why){
        S.extraUsed = true; S.noUndo = true; S.weapon = null; S.target = null; S.mode = 'menu';
        log(`${fullName(u)}【${why}】击破目标，可以再攻击一次（不能移动）`, null, 'ally');
        refresh(); return;
      }
    }
    S.extraUsed = false;
    if (!over && u.hp > 0) await afterAttack(u); else if (!over){ clearSel(); refresh(); }
  }
  else if (a === 'lockfire'){
    const w = S.weapon, ts = S.locks.slice();
    S.mode = 'busy'; refresh();
    consume(w);
    log(`${fullName(u)}【${w.name}】锁定 ${ts.length} 台敌机`, null, 'ally');
    for (const t of ts){ if (over || u.hp <= 0) break; if (t.hp > 0) await strike(u, w, t, null, {skipConsume:true}); }
    refresh(); checkEnd();
    if (!over && u.hp > 0) await afterAttack(u); else if (!over){ clearSel(); refresh(); }
  }
  else if (a === 'cast'){
    const w = S.weapon; S.mode = 'busy'; refresh();
    castSupport(u, w); await sleep(400);
    await finish(u);
  }
  else if (a === 'mapfire'){
    const w = S.weapon, d = S.dir;
    S.mode = 'busy'; refresh();
    await mapAttack(u, w, d);
    if (!over && u.hp > 0) await finish(u); else if (!over){ clearSel(); refresh(); }
  }
}
const dashLimit = u => abilOn(u,'dash') ? 1 + (abilOn(u,'followUp') ? 1 : 0) : 0;
/* v0.26 援护范围 = 援护者的移动力覆盖范围：援护者能在本回合移动范围内走到被攻击者旁边，就能援护（援护时不实际移动） */
function guardReach(m, p){
  if (distU(m, p) <= 1) return true;
  if (distU(m, p) > m.mov + 1) return false;
  return reach(m).some(t => distRect(t.x, t.y, m.w, m.h, p.x, p.y, p.w, p.h) <= 1);
}
function toggleLock(t){
  const max = wv(S.sel, S.weapon, 'lockN'), i = S.locks.indexOf(t);
  if (i >= 0) S.locks.splice(i, 1); else if (S.locks.length < max) S.locks.push(t);
  refresh();
}
/* DASH 移动完（或原地）→ 进入只能攻击 / 待机的指令菜单 */
function dashArrive(){ S.dash = false; S.mode = 'menu'; S.reach = []; refresh(); }
async function afterAttack(u){
  const left = u.mov - (S.moveCost || 0);
  if (hasTrait(u,'hitAway') && left > 0 && !over){
    S.noUndo = true; S.reachLeft = left; S.reach = reach(u, left); S.mode = 'moving2';
    log(`${fullName(u)}【一击脱离】还可以移动 ${left}`, null, 'ally'); refresh(); return;
  }
  await finish(u);
}
async function hackAct(t){
  const u = S.sel, w = S.weapon;
  S.mode = 'busy'; refresh();
  consume(w); t.stunned = true;
  addFloat(t, '骇入', '#c9a8ff');
  log(`${fullName(u)}【${w.name}】骇入 ${fullName(t)}：下一个敌方阶段无法行动`, null, 'ally');
  await sleep(350);
  await finish(u);
}
async function healAct(t){
  const u = S.sel, w = S.weapon;
  S.mode = 'busy'; refresh();
  doHeal(u, w, t); await sleep(400);
  await finish(u);
}
function atkTilesFor(u, w){
  const out = [], rg = effRange(u, w);
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){
    const d = distRect(u.x,u.y,u.w,u.h,x,y,1,1);
    if (d >= rg[0] && d <= rg[1]) out.push({x,y});
  }
  return out;
}
$('#actionCard').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.a) onAction(b.dataset.a);
  if (b.dataset.w != null){
    S.weapon = S.sel.weapons[+b.dataset.w];
    if (S.weapon.fire === 'map'){ S.dirs = mapDirs(S.sel, S.weapon); S.dir = S.weapon.shape === 'burst' ? S.dirs[0] : null; S.mode = S.weapon.shape === 'burst' ? 'mapconfirm' : 'mapdir'; }
    else if (S.weapon.special === 'lock'){ S.locks = []; S.atkTiles = atkTilesFor(S.sel, S.weapon); S.mode = 'lock'; }
    else if (S.weapon.fire === 'support'){ S.mode = 'support'; }
    else if (S.weapon.fire === 'heal'){ S.mode = 'heal'; }
    else if (S.weapon.fire === 'device'){ S.mode = 'hack'; }
    else { S.atkTiles = atkTilesFor(S.sel, S.weapon); S.mode = 'target'; S.target = null; }
    refresh();
  }
  if (b.dataset.face && S.sel){ S.sel.facing = b.dataset.face; refresh(); }
  if (b.dataset.hangar != null){ const h = HANGAR.find(x => x.uid === +b.dataset.hangar); if (h) startDeploy(h); }
  if (b.dataset.pick != null){ const t = units.find(x => x.uid === +b.dataset.pick); if (t) choosePick(t); }
  if (b.dataset.lock != null){ const t = units.find(x => x.uid === +b.dataset.lock); if (t) toggleLock(t); }
  if (b.dataset.hack != null){ const t = units.find(x => x.uid === +b.dataset.hack); if (t) hackAct(t); }
  if (b.dataset.heal != null){
    const t = units.find(x => x.uid === +b.dataset.heal);
    if (t) healAct(t);
  }
  if (b.dataset.dir != null){
    const [dx,dy] = DIR8[+b.dataset.dir];
    S.dir = S.dirs.find(d => d.dx === dx && d.dy === dy); S.mode = 'mapconfirm'; refresh();
  }
});
function tileOf(e){ const r = cv.getBoundingClientRect(); return {x:Math.floor((e.clientX - r.left)/(TS*SC)), y:Math.floor((e.clientY - r.top)/(TS*SC))}; }
cv.addEventListener('click', e => { const {x,y} = tileOf(e); if (inb(x,y)){ showTile(x,y); onTile(x,y); } });
cv.addEventListener('mousemove', e => { const {x,y} = tileOf(e); if (!inb(x,y)) return; if (!S.hover || S.hover.x !== x || S.hover.y !== y){ S.hover = {x,y}; showTile(x,y); } });
cv.addEventListener('mouseleave', () => { S.hover = null; });
function showTile(x,y){
  const t = TER[map[y][x]], u = occupant(x,y);
  $('#tileInfo').innerHTML = `(${x}, ${y})　<b>${walls.has(y*N+x) ? 'GN 力场壁 · ' : ''}${t.name}</b>　移动消耗 ${t.cost}　防御 ${t.def}%　闪避 +${t.eva}${t.blockLOS ? '　阻挡直射' : ''}` +
    (u ? `　·　<b>${fullName(u)}</b> HP ${u.hp}/${u.maxHp}` : '');
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  if (!$('#askModal').hidden || !$('#reactModal').hidden || !$('#endModal').hidden) return;
  if (!over && S.sel && S.mode === 'pick' && S.atkList.length){
    e.preventDefault();
    const L = S.atkList, i = L.indexOf(S.pickSel);
    S.pickSel = L[((i < 0 ? 0 : i) + (e.shiftKey ? -1 : 1) + L.length) % L.length];
    S.inspect = S.pickSel; refresh(); return;
  }
  if (over || S.sel || S.mode !== 'idle') return;
  e.preventDefault();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  let pool = units.filter(u => u.side === 'ally' && !u.acted);
  if (!pool.length) pool = units.filter(u => u.side === 'ally');
  if (!pool.length) return;
  const cur = S.cursor || S.lastPick, i = pool.indexOf(cur);
  const next = pool[((i < 0 ? (e.shiftKey ? 0 : -1) : i) + (e.shiftKey ? -1 : 1) + pool.length) % pool.length];
  S.cursor = next; S.inspect = next; focusOn(next); refresh();
});
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
  if (!$('#askModal').hidden){ e.preventDefault(); askEnd(true); return; }
  if (!$('#reactModal').hidden || !$('#endModal').hidden) return;
  if (over) return;
  if (!S.sel){
    if (S.mode !== 'idle') return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const ready = units.filter(u => u.side === 'ally' && !u.acted);
    if (!ready.length){ $('#askModal').hidden = false; return; }
    if (S.cursor && ready.includes(S.cursor)){ const c = S.cursor; S.cursor = null; S.lastPick = c; select(c); focusOn(c); return; }
    const order = units.filter(u => u.side === 'ally');
    const start = S.lastPick ? order.indexOf(S.lastPick) : -1;
    let next = null;
    for (let i=1; i<=order.length; i++){ const c = order[(start + i + order.length) % order.length]; if (c && !c.acted){ next = c; break; } }
    if (next){ S.lastPick = next; select(next); focusOn(next); }
    return;
  }
  e.preventDefault();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const u = S.sel;
  if (S.mode === 'moving') onTile(u.x, u.y);
  else if (S.mode === 'menu'){
    if (S.atkList && S.atkList.length){ enterPick(); }
    else onAction('wait');
  }
  else if (S.mode === 'pick'){ const t = S.atkList.includes(S.pickSel) ? S.pickSel : S.atkList[0]; if (t) choosePick(t); }
  else if (S.mode === 'confirm') onAction('fire');
  else if (S.mode === 'mapconfirm') onAction('mapfire');
  else if (S.mode === 'lock'){ if (S.locks.length) onAction('lockfire'); }
  else if (S.mode === 'moving2'){ if (S.dash) dashArrive(); else onAction('wait'); }
});
document.addEventListener('keydown', e => {
  const f = {w:'up', a:'left', s:'down', d:'right'}[e.key.toLowerCase()];
  if (!f || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
  if (!$('#askModal').hidden || !$('#reactModal').hidden || !$('#endModal').hidden) return;
  if (!S.sel || !['menu','weapon','pick'].includes(S.mode)) return;
  e.preventDefault();
  S.sel.facing = f; refresh();
});
function askEnd(yes){
  $('#askModal').hidden = true;
  if (yes) endTurn();
}
$('#askYes').onclick = () => askEnd(true);
$('#askNo').onclick = () => askEnd(false);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#askModal').hidden){ askEnd(false); return; }
  if (e.key !== 'Escape' || !$('#reactModal').hidden || !$('#endModal').hidden) return;
  if (S.mode === 'command'){ onAction('cmd-cancel'); return; }
  if (S.sel && !['busy','enemy','over'].includes(S.mode)) escCancel();
  else if (S.cursor){ S.cursor = null; refresh(); }
});
function escCancel(){
  const u = S.sel;
  if (S.teleported || S.noUndo){
    // 传送、变身、击破后的额外攻击已经发生，无法撤回：剩下的行动按待机处理
    log(`${fullName(u)} 已有不可撤回的行动，Esc 按待机处理`, null, 'ally');
    finish(u); return;
  }
  log(`${fullName(u)} 撤回本次行动`, null, 'ally');
  cancel();
  if (S.selFly != null) u.flying = S.selFly;
  if (S.selFacing) u.facing = S.selFacing;
  refresh();
}
function cheatLevel(n){
  roster.forEach(u => { while (u.lv < n) levelUp(u, u.hp > 0); });
  log(`测试：全队升到 Lv ${roster.map(u => u.lv).join(' / ')}`, null, 'sys');
  refresh();
}
$('#btnLv1').onclick = () => cheatLevel(Math.max(...roster.map(u => u.lv)) + 1);
$('#btnLv20').onclick = () => cheatLevel(20);
$('#btnLv30').onclick = () => cheatLevel(30);
$('#btnEnd').onclick = endTurn;
$('#btnRestart').onclick = () => { if (S.mode === 'enemy' || S.mode === 'busy') return; if (LV && LV.run){ if (!over) ask('撤退？', '撤退会判定为作战失败：剩余敌人数（包括还没出场的波次）会扣作战耐久。战后奖励照常发放。', '撤退').then(y => { if (y && !over) defeat('撤退'); }); return; } (level === 'skirmish' ? startBattle(seed) : startLevel(level)); };
/* 切换模式。肉鸽进行中切走时，正在打的那一战原样保存，切回「肉鸽模式」时接着打（RUN 本身一直在内存里）。
   肉鸽的对话框（编队、事件、商店、战后结算……）开着的时候不能切，免得流程断在半路。 */
let RUN_BATTLE = null;
$('#levelSel').onchange = e => {
  const v = e.target.value, inRun = RUN && !RUN.over && (level === 'run' || level === 'roguelike');
  const back = () => { e.target.value = level === 'run' ? 'roguelike' : level; };
  if (S.mode === 'enemy' || S.mode === 'busy'){ back(); return; }
  if (v === 'roguelike' && inRun){ back(); return; }
  if (inRun && !$('#endModal').hidden){ back(); log('肉鸽：先处理完当前对话框，再切换模式（进度会保留）', null, 'sys'); return; }
  if (inRun && level === 'run' && LV && LV.run && !over)
    RUN_BATTLE = {level, LV, waveIdx, deadline, walls, CMD, map, units, roster, turn, seed, over, phaseNo, MW, MH, SC, log:$('#log').innerHTML, speed:SPEED};
  startLevel(v);
};
function runBattleResume(){
  const b = RUN_BATTLE; RUN_BATTLE = null;
  ({level, LV, waveIdx, deadline, walls, CMD, map, units, roster, turn, seed, over, phaseNo} = b); SPEED = b.speed;
  runHide(); $('#endModal').hidden = true; $('#levelSel').value = 'roguelike';
  setMapSize(b.MW, b.MH, b.SC); buildTerrain(); $('#log').innerHTML = b.log;
  Object.assign(S, {mode:'idle', sel:null, origin:null, reach:[], weapon:null, target:null, inspect:null, atkTiles:[], threatSet:null});
  SOUND.scene = 'battle'; bgm(sceneCue());
  updateLimit(); refresh(); focusOn(units.find(u => u.side === 'ally'), false);
  log(`回到肉鸽：${LV.name}，第 ${turn} 回合`, null, 'sys');
}
$('#btnCmd').onclick = () => {
  if (!CMD || S.mode !== 'idle' || over || turn < CMD.readyTurn) return;
  S.mode = 'command'; refresh();
};
$('#btnNames').onclick = () => { S.names = !S.names; $('#btnNames').setAttribute('aria-pressed', String(S.names)); };
$('#btnGrid').onclick = () => { S.grid = !S.grid; $('#btnGrid').setAttribute('aria-pressed', String(S.grid)); };
$('#btnThreat').onclick = () => {
  S.threat = !S.threat; $('#btnThreat').setAttribute('aria-pressed', String(S.threat));
  S.threatSet = S.threat ? computeThreat() : null;
};
$('#hookList').innerHTML = '已注册的事件钩子：<br>' + Hooks.labels.map(l => `<code>${l}</code>`).join('<br>');

/* =====================================================================
   肉鸽模式（试作）：混沌迷宫
   设计见《肉鸽模式设计 v0.3》。大地图是网格节点图，每层 3 层 + 终点。
   ===================================================================== */
let RUN = null;
const RM = () => (LV && LV.run && RUN) ? RUN.mods : null;
const TIER = {
  B1:'S', A1:'S', CB1:'S', S1:'S', W1:'S', U7:'S', M1:'S',
  B2:'A', M2:'A', M3:'A', CB2:'A', CB4:'A', S2:'A', S5:'A', W2:'A', W3:'A', W4:'A', W5:'A', W6:'A', A2:'A', A3:'A', U6:'A', U1:'A',
  M4:'B', M5:'B', CB3:'B', S3:'B', S4:'B', S6:'B', S7:'B', S8:'B', W7:'B', A4:'B', A5:'B', U2:'B', U8:'B',
};
const TIER_NAME = {S:'精锐', A:'骨干', B:'普通'};
const PRICE = {S:{rec:5, p20:3, p30:4}, A:{rec:3, p20:2, p30:3}, B:{rec:0, p20:1, p30:2}};
const CAP_CHARS = [];          // （已取消）原来晋升 Lv20 时出击上限 +1 的角色；以后改由藏品提供
const CLASSES = ['近卫','尖兵','指挥','重装','狙击','特种'];   // v0.39 辅助 → 指挥
/* v0.26 势力招募券：券上写的是战斗分类就按分类、写的是势力就按势力；每场胜利 60% 职业券、40% 势力券 */
const FACTIONS = [...new Set(ALLY_T.map(t => t.tags.势力))];
const ticketOk = (k, m) => CLASSES.includes(k) ? tplOf(m).tags.战斗分类 === k : inFaction(tplOf(m), k);   // v0.40.11 双势力
const ticketName = k => CLASSES.includes(k) ? `${k}招募券` : `${k}势力招募券`;
const anyTicket = () => Math.random() < .6 ? pick(CLASSES) : pick(FACTIONS);
/* v0.40.13 作者 10-08：分队偏重招募券——一半概率出本分队对应的券（职业分队出本职业券、势力分队出本势力券），另一半照旧随机 */
const squadTicket = () => RUN && (CLASSES.includes(RUN.squad) || FACTIONS.includes(RUN.squad)) ? RUN.squad : null;
const SQUAD_TICKET_P = .5;
const randTicket = () => { const sq = squadTicket(); return sq && Math.random() < SQUAD_TICKET_P ? sq : anyTicket(); };
const tierOf = m => TIER[m] || 'B';
const tplOf = m => ALLY_T.find(t => t.mech === m);
const recCost = m => PRICE[tierOf(m)].rec;
const promoCost = (m, to) => Math.max(0, PRICE[tierOf(m)][to === 20 ? 'p20' : 'p30'] + (to === 20 && CAP_CHARS.includes(m) ? 1 : 0) - (RUN && RUN.promoDiscount ? 1 : 0) - (to === 20 && RUN && skLv('编制') >= 3 ? 1 : 0));

