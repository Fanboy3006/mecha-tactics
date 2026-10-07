/* ---------- 回合流程 ---------- */
function fireTip(key){
  if (!LV || !LV.tips) return;
  const t = LV.tips.find(t => t.on === key && !t.shown);
  if (!t) return;
  t.shown = true;
  $('#tipText').innerHTML = t.text;
  $('#tipCard').hidden = false;
}
function setPhase(side){
  const p = $('#phase');
  p.textContent = side === 'ally' ? '我方阶段' : '敌方阶段';
  p.classList.toggle('enemy', side !== 'ally');
  $('#turnNo').textContent = turn;
  updateLimit();
  $('#battleNo').textContent = level === 'skirmish' ? battleNo : '—';
}
const clearSel = () => Object.assign(S, {mode:'idle', sel:null, origin:null, reach:[], weapon:null, target:null, dirs:[], dir:null, teleported:false, portalTiles:[], noUndo:false, locks:[], pickSel:null, dash:false});
function startPlayerPhase(){
  units.filter(u => u.side === 'ally').forEach(u => { u.moved = u.acted = false; });
  clearSel();
  setPhase('ally');
  log(`第 ${turn} 回合 · 我方阶段`, null, 'sys');
  phaseNo++;
  Hooks.emit('phaseStart', {side:'ally', turn});
  fireTip('turn:' + turn);
  if (CMD && CMD.pending.some(m => m.land <= turn)) resolveMeteors();
  if (LV && LV.waves) while (waveIdx < LV.waves.length - 1 && LV.waves[waveIdx + 1].at && LV.waves[waveIdx + 1].at <= turn) spawnWave(waveIdx + 1);
  updateLimit();
  refresh();
}
const midAction = () => !!(S.sel && S.origin);
async function endTurn(){
  if (over || S.mode === 'enemy' || S.mode === 'busy') return;
  if (midAction()) return;
  if (deadline && turn >= deadline && units.some(u => u.side === 'enemy')){ defeat(`没能在第 ${deadline} 回合结束前${LV.waves[waveIdx].label}。`); return; }
  clearSel(); S.mode = 'enemy';
  setPhase('enemy');
  log(`第 ${turn} 回合 · 敌方阶段`, null, 'sys');
  units.filter(u => u.side === 'enemy').forEach(u => { u.moved = u.acted = false; });
  phaseNo++;
  Hooks.emit('phaseStart', {side:'enemy', turn});
  refresh();
  for (const e of units.filter(u => u.side === 'enemy')){
    if (over) return;
    if (e.hp <= 0) continue;
    await aiAct(e);
  }
  if (over) return;
  Hooks.emit('turnEnd', {turn});
  turn++;
  startPlayerPhase();
}
async function aiAct(e){
  if (e.stunned){ e.stunned = false; e.acted = true; log(`${fullName(e)} 被骇入，本阶段无法行动`, null, 'sys'); await sleep(250); return; }
  const tiles = reach(e), players = units.filter(u => u.side === 'ally');
  if (!players.length) return;
  /* v0.30 统一 AI（作者 10-05 定）：
     1. 目标 = 最近的我方单位（按实际要走的步数），同距离打 HP 比例最低的；刺客型（assassin）反过来，先挑 HP 比例最低的。
     2. 打得到目标就打：选对它期望伤害最高的武器；近战 / 短程从移动最少的格子打，远程（最大射程 ≥ 3）在射程内离目标最远的格子打。
     3. 打不到就朝目标前进。只盯这一个目标，不会转去打别人。
     4. 守卫型（guardZone: N）：我方进入 N 格内才启动；炮台（移动 0）自然原地不动。 */
  if (e.guardZone && !e.awake){
    if (players.some(p => distU(e, p) <= e.guardZone)){ e.awake = true; log(`${fullName(e)} 发现目标，开始行动`, null, 'sys'); }
    else { e.acted = true; return; }
  }
  const far = reach(e, 60, {zoc:false});   // 算远处目标的步数时不管控制区
  const steps = p => { let m = Infinity; for (const t of far) if (t.d < m && distU(e, p, t.x, t.y) <= 1) m = t.d; return m === Infinity ? 1000 + distU(e, p) : m; };
  const hpr = p => p.hp / p.maxHp;
  const target = [...players].sort((a, b) => e.assassin ? (hpr(a) - hpr(b) || steps(a) - steps(b)) : (steps(a) - steps(b) || hpr(a) - hpr(b)))[0];
  let best = null;
  if (e.disarmed) log(`${fullName(e)} 武装损坏，本阶段不能攻击`, null, 'sys');
  for (const t of (e.disarmed ? [] : tiles)){
    const moved = !(t.x === e.x && t.y === e.y);
    for (const w of e.weapons){
      if (wStatus(e, w, {moved})) continue;
      if (!canHit(e, w, target, t.x, t.y)) continue;
      const f = forecast(e, w, target, null, {from:[t.x, t.y]});
      const pos = w.range[1] >= 3 ? distU(e, target, t.x, t.y) * 2 - t.d * 0.1 : -t.d;
      const s = Math.round(f.exp / 100) * 1000 + pos;
      if (!best || s > best.s) best = {s, t, w, p:target};
    }
  }
  focusOn(e); S.inspect = e; refresh();
  await sleep(240);
  if (best){
    if (best.t.face) e.facing = best.t.face;
    moveUnit(e, best.t.x, best.t.y); refresh();
    await sleep(300);
    const g = units.find(m => m !== best.p && m.side === best.p.side && m.hp > 0 && m.abilities.includes('guard') && m.guardLeft > 0 && guardReach(m, best.p));
    if (g && await askGuard(e, best.w, best.p, g)){
      g.guardLeft--;
      log(`${fullName(g)} 援护 ${fullName(best.p)}（本阶段剩 ${g.guardLeft} 次）`, null, 'ally');
      await battle(e, best.w, g, 'defend', null, {guard:true});
      if (e.hp > 0) await supportAttack(e, best.p, {guard:g});
    } else {
      const r = await askReaction(e, best.w, best.p);
      await battle(e, best.w, best.p, r.reaction, r.weapon);
      if (e.hp > 0) await supportAttack(e, best.p, {reaction:r.reaction});
    }
  } else {
    let bt = null, bd = 1e9;
    for (const t of tiles){
      const d = distU(e, target, t.x, t.y);
      if (d < bd || (d === bd && t.d < bt.d)){ bd = d; bt = t; }
    }
    if (bt){ moveUnit(e, bt.x, bt.y); e.facing = dirToward(e, target); refresh(); await sleep(220); }
  }
  e.disarmed = false;
  e.acted = true;
}
function checkEnd(){
  if (over) return;
  if (LV && LV.victory.type === 'reach'){
    const req = LV.victory.units.map(m => roster.find(u => u.mech === m));
    if (req.some(u => !u || u.hp <= 0 || !units.includes(u))) return defeat();
    if (req.every(inZone)) return victory();
    return;
  }
  const allies = units.filter(u => u.side === 'ally'), foes = units.filter(u => u.side === 'enemy');
  if (!allies.length) return defeat();
  /* v0.32 关卡目标 */
  if (LV && LV.victory.type === 'survive') return;   // 坚守：撑够回合数才算赢（见 30b），敌人打光也会继续增援
  if (LV && LV.victory.type === 'targets'){ if (!units.some(u => u.target && u.side === 'enemy' && u.hp > 0)) victory(); return; }
  if (LV && LV.victory.type === 'reachAny'){ if (allies.some(u => u.hp > 0 && inZone(u))) victory(); return; }
  if (!foes.length && LV && LV.waves && waveIdx < LV.waves.length - 1){ spawnWave(waveIdx + 1); refresh(); return; }
  if (!foes.length) victory();
  else if (!allies.length) defeat();
}
function victory(){
  over = true; S.mode = 'over'; audioJingle('victory');
  if (LV && LV.run){ runBattleEnd(true); return; }
  if (level !== 'skirmish'){
    log(`${LV.name} 完成（${turn} 回合）`, null, 'sys');
    const b1 = roster.find(u => u.portal);
    updateLimit();
    $('#endDlg').innerHTML = `<div class="eyebrow" style="color:var(--good)">${LV.name} · ${turn} 回合</div><h2>${LV.victory.type === 'reach' ? '撤离成功' : '作战成功'}</h2>
      <p>${LV.winText}${b1 && b1.backlash ? `雷萨的反噬值：${b1.backlash}/100。` : ''}</p>
      <p class="small">${LV.summary}</p>
      <div class="acts"><button class="btn primary" id="btnAgain">再玩一次</button><button class="btn" id="btnSkir">去自由对战</button></div>`;
    $('#endModal').hidden = false;
    $('#btnAgain').onclick = () => { $('#endModal').hidden = true; startLevel(level); };
    $('#btnSkir').onclick = () => { $('#endModal').hidden = true; newCampaign(); };
    $('#btnAgain').focus();
    refresh(); return;
  }
  const rows = roster.filter(u => u.deployed).map(u => { const from = u.lv; levelUp(u); return `<li>${fullName(u)}　<b>Lv ${from} → Lv ${u.lv}</b></li>`; }).join('');
  log(`作战成功：全歼敌军（${turn} 回合）`, null, 'sys');
  $('#endDlg').innerHTML = `<div class="eyebrow" style="color:var(--good)">第 ${battleNo} 战 · ${turn} 回合</div><h2>作战成功</h2>
    <p>全歼敌军。所有出击机体升 1 级（HP +200，格斗 / 射击 / 技量 +2）：</p><ul>${rows}</ul>
    <p class="small">下一战会生成新地图，敌机等级同步提升到 Lv ${battleNo+1}。</p>
    <div class="acts"><button class="btn primary" id="btnNext">进入第 ${battleNo+1} 战</button></div>`;
  $('#endModal').hidden = false;
  $('#btnNext').onclick = () => { $('#endModal').hidden = true; battleNo++; startBattle(Date.now() & 0xffffff); };
  $('#btnNext').focus();
  refresh();
}
function defeat(reason){
  over = true; S.mode = 'over'; audioJingle('defeat'); updateLimit();
  if (LV && LV.run){ runBattleEnd(false); return; }
  log(`作战失败：${reason || '我方全灭'}`, null, 'sys');
  $('#endDlg').innerHTML = `<div class="eyebrow">第 ${battleNo} 战 · ${turn} 回合</div><h2>作战失败</h2>
    <p>${reason || (level === 'skirmish' ? '我方机体全部被击破。可以用同一张地图重来，或者从第 1 战重新开始。' : level === 'tut1' ? '有机体被击破，撤离失败。' : '我方机体全部被击破。')}</p>
    <div class="acts"><button class="btn primary" id="btnRetry">重开本战</button>${level === 'skirmish' ? '<button class="btn" id="btnFresh">从第 1 战开始</button>' : ''}</div>`;
  $('#endModal').hidden = false;
  $('#btnRetry').onclick = () => { $('#endModal').hidden = true; level === 'skirmish' ? startBattle(seed) : startLevel(level); };
  if ($('#btnFresh')) $('#btnFresh').onclick = () => { $('#endModal').hidden = true; newCampaign(); };
  refresh();
}
function startBattle(sd){
  walls = new Map(); CMD = null;
  level = 'skirmish'; LV = LEVELS.skirmish; waveIdx = -1; deadline = 0; SPEED = 1; $('#levelSel').value = 'skirmish'; $('#tipCard').hidden = true; setMapSize(40, 40);
  seed = sd; over = false; turn = 1;
  const g = genMap(seed); map = g.m;
  placeUnits(g.r);
  buildTerrain();
  $('#log').innerHTML = '';
  log(`第 ${battleNo} 战开始 · 地图种子 ${seed} · 胜利条件：全歼敌军`, null, 'sys');
  S.inspect = null; S.threatSet = null;
  showFormation(picked => { placeAllies(picked, SKIRMISH_SPOTS, {clear:true}); buildTerrain(); startPlayerPhase(); focusOn(units.find(u => u.side === 'ally'), false); });
}
function freeSpotNear(t, x, y){
  const probe = {x, y, w:t.w, h:t.h, flying:t.flying};
  for (let d=0; d<20; d++){
    const cand = [];
    for (let yy=0; yy<MH; yy++) for (let xx=0; xx<MW; xx++){
      if (Math.abs(xx-x) + Math.abs(yy-y) !== d) continue;
      if (canStand(probe, xx, yy)) cand.push([xx,yy]);
    }
    if (cand.length) return cand[0];
  }
  return [x, y];
}
function spawnWave(i, quiet){
  waveIdx = i;
  const wv = LV.waves[i];
  for (const e of wv.enemies){
    const t = ENEMY_T[e.t], [x,y] = freeSpotNear(t, e.x, e.y);
    const u = makeUnit(t, 'enemy', x, y); u.facing = e.facing || 'down'; u.wave = i;
    if (e.target) u.target = true;   // v0.32 斩首目标
    refreshBadges(u);
    for (let k=1; k<(e.lv || wv.lv || 1); k++) levelUp(u); u.hp = u.maxHp;
    if (LV.onSpawn) LV.onSpawn(u);
    units.push(u);
  }
  deadline = wv.limit ? (i === 0 ? wv.limit : turn + wv.limit) : 0;
  if (!quiet){
    log(`第 ${i+1} 波敌人出现：${wv.label}，回合上限：第 ${deadline} 回合结束前`, null, 'sys');
    if (wv.tip) fireTip(wv.tip);
    focusOn(units[units.length-1]);
  }
  updateLimit();
}
function updateLimit(){
  const c = $('#limitChip');
  const nxt = LV && LV.waves && waveIdx < LV.waves.length - 1 ? LV.waves[waveIdx + 1] : null;
  if (!deadline && nxt && nxt.at && !over){
    c.hidden = false; c.classList.toggle('urgent', nxt.at - turn <= 1);
    c.querySelector('.lbl').textContent = '下一波';
    $('#limitTxt').textContent = `第 ${nxt.at} 回合 · 第 ${waveIdx + 2}/${LV.waves.length} 波`;
    return;
  }
  c.querySelector('.lbl').textContent = '上限';
  if (!deadline || over){ c.hidden = true; return; }
  c.hidden = false;
  const left = deadline - turn + 1;
  $('#limitTxt').textContent = `第 ${deadline} 回合前 · 剩 ${left} 回合`;
  c.classList.toggle('urgent', left <= 1);
}
const FORM_MEM = {};
function setCommander(u){
  if (!u){ CMD = null; return; }
  units = units.filter(x => x !== u);
  CMD = {unit:u, skill:u.command, readyTurn:1, pending:[]};
  log(`${fullName(u)} 担任指挥官（不出场）：指挥技能【${COMMANDS[u.command].name}】`, null, 'sys');
}
function showFormation(done){
  audioScene('menu');
  const cap = LV.maxDeploy || roster.length;
  const fixed = !LV.spots && level !== 'skirmish';      // 教学等固定出场的关卡：只选指挥官
  const pool = roster.filter(u => !u.commandOnly);
  const cmdCands = roster.filter(u => u.command);
  const mem = FORM_MEM[level];
  let sel = new Set(fixed ? roster.map(u => u.mech) : (mem ? mem.sel : (LV.defaultDeploy || pool.map(u => u.mech)).slice(0, cap)));
  let cmd = mem && !fixed ? mem.cmd : null;
  if (fixed && !cmdCands.length){ done(roster); return; }
  const groups = [...new Set(roster.map(u => u.tags.势力))];
  // 肉鸽：每台出击机体选 2 个武装，Lv20 大招最多 1 个
  const LO = LV.loadout ? {...LV.loadout.init} : null;
  const isUlt = w => w.unlock >= 20;
  const loChoices = u => u.weapons.filter(w => u.lv >= w.unlock && !(LV.loadout.hide && LV.loadout.hide(u, w)));
  const loDefault = u => { const ws = loChoices(u), ult = ws.filter(isUlt), base = ws.filter(w => !isUlt(w)); return [...ult.slice(0,1), ...base].slice(0, 2).map(w => w.name); };
  const loOf = u => { if (!LO[u.mech] || !LO[u.mech].every(n => loChoices(u).some(w => w.name === n))) LO[u.mech] = loDefault(u); return LO[u.mech]; };
  const card = (u, kind) => {
    const on = kind === 'cmd' ? cmd === u.mech : sel.has(u.mech);
    const dis = kind === 'dep' && !on && (sel.size >= cap || cmd === u.mech);
    return `<button class="fm ${kind === 'cmd' ? 'cmd' : ''} ${on ? 'on' : ''}" style="--fc:${FACTION_COL[u.tags.势力] || '#4f95e0'}" data-${kind}="${u.mech}" ${dis ? 'disabled' : ''}>
      <b>${u.short} ${u.pilot}</b><small>${u.mechName ? u.mechName + ' · ' : ''}${u.tags.战斗分类}${kind === 'cmd' ? ` · ${COMMANDS[u.command].name}` : ` · Lv${u.lv}`}</small></button>`;
  };
  const render = () => {
    const deploy = groups.map(g => {
      const list = pool.filter(u => u.tags.势力 === g); if (!list.length || fixed) return '';
      return `<div class="fgroup"><i style="--fc:${FACTION_COL[g] || '#4f95e0'}"></i>${g}</div><div class="fgrid">${list.map(u => card(u, 'dep')).join('')}</div>`;
    }).join('');
    $('#endDlg').innerHTML = `<div class="eyebrow" style="color:var(--accent)">战前编队</div><h2>${fixed ? '选择指挥官' : `选择出击机体（${sel.size} / ${cap}）`}</h2>
      <p class="small">${fixed ? '这一关的出场机体是固定的。' : `这一关最多出击 ${cap} 台。点击机体切换是否出击。`}${LV.noCmd ? '' : '指挥官不会出场作战，而是在战场外下达指挥（最多一位，可以不设）。'}</p>
      ${deploy}
      ${LO ? `<div class="fgroup"><i style="--fc:var(--accent)"></i>出击武装：每台最多 2 个，其中 Lv20 大招最多 1 个（反击也只能用带上的武装）</div>
        ${roster.filter(u => sel.has(u.mech)).map(u => { const cur = loOf(u); return `<div class="rv-row"><span class="nm" style="flex:0 0 120px">${u.short} ${u.pilot}</span><span style="display:flex;flex-wrap:wrap;gap:4px">${loChoices(u).map(w => `<button class="rv-btn ${cur.includes(w.name) ? 'on' : ''}" data-lo="${u.mech}|${w.name}" title="${FIRE[w.fire]}${w.desc ? ' · ' + w.desc.replace(/"/g, '') : ''}">${isUlt(w) ? '★ ' : ''}${w.name}</button>`).join('')}</span></div>`; }).join('') || '<p class="small">先选出击机体。</p>'}
        ${LV.loadout.note ? `<p class="small">${LV.loadout.note}</p>` : ''}` : ''}
      ${LV.noCmd ? '' : `<div class="fgroup"><i style="--fc:var(--accent)"></i>指挥官（可选）</div>
      <div class="fgrid"><button class="fm cmd ${cmd ? '' : 'on'}" style="--fc:#888" data-cmd=""><b>不设指挥官</b><small>全部机体作战</small></button>${cmdCands.map(u => card(u, 'cmd')).join('')}</div>
      ${cmd ? `<p class="small">【${COMMANDS[roster.find(u => u.mech === cmd).command].name}】${COMMANDS[roster.find(u => u.mech === cmd).command].desc}</p>` : ''}`}
      <div class="acts">${fixed ? '' : '<button class="btn" id="btnFormClear">清空</button>'}<button class="btn primary" id="btnForm" ${sel.size ? '' : 'disabled'}>开始作战</button></div>`;
    $('#endDlg').classList.add('wide');
    $('#endDlg').querySelectorAll('[data-dep]').forEach(b => b.onclick = () => { const m = b.dataset.dep; sel.has(m) ? sel.delete(m) : (sel.size < cap && sel.add(m)); render(); });
    $('#endDlg').querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => { cmd = b.dataset.cmd || null; if (cmd && !fixed) sel.delete(cmd); render(); });
    if ($('#btnFormClear')) $('#btnFormClear').onclick = () => { sel.clear(); render(); };
    $('#endDlg').querySelectorAll('[data-lo]').forEach(b => b.onclick = () => {
      const [m, name] = b.dataset.lo.split('|'), u = roster.find(x => x.mech === m), cur = loOf(u).slice(), w = u.weapons.find(x => x.name === name);
      const i = cur.indexOf(name);
      if (i >= 0) cur.splice(i, 1);
      else {
        if (isUlt(w)){ const j = cur.findIndex(n => isUlt(u.weapons.find(x => x.name === n))); if (j >= 0) cur.splice(j, 1); }
        if (cur.length >= 2) cur.shift();
        cur.push(name);
      }
      LO[m] = cur; render();
    });
    $('#btnForm').onclick = () => {
      $('#endModal').hidden = true; $('#endDlg').classList.remove('wide');
      if (!fixed) FORM_MEM[level] = {sel:[...sel], cmd};
      if (!fixed) roster.forEach(u => { u.deployed = false; });
      const cu = cmd ? roster.find(u => u.mech === cmd) : null;
      const picked = roster.filter(u => sel.has(u.mech) && u !== cu && !u.commandOnly);
      if (LO){
        picked.forEach(u => { const cur = loOf(u).length ? loOf(u) : loDefault(u); if (cur.length) u.weapons = u.weapons.filter(w => cur.includes(w.name)); u.loadout = cur.slice(); });
        if (LV.loadout.save) LV.loadout.save(LO);
      }
      CMD = null;
      done(picked);
      if (cu) setCommander(cu);
      refresh();
    };
  };
  render();
  $('#endModal').hidden = false;
}
function cmdCells(cx, cy){
  const k = COMMANDS[CMD.skill], h = (k.size-1)/2, out = [];
  for (let y=cy-h; y<=cy+h; y++) for (let x=cx-h; x<=cx+h; x++) if (inb(x,y)) out.push([x,y]);
  return out;
}
function orderMeteor(cx, cy){
  snd('warn', 0);
  const k = COMMANDS[CMD.skill], cells = cmdCells(cx, cy);
  CMD.pending.push({cells, land: turn + k.delay});
  CMD.readyTurn = turn + k.cd;
  log(`指挥官 ${fullName(CMD.unit)}【${k.name}】：陨石将在第 ${turn + k.delay} 回合我方阶段开始时落在 (${cx}, ${cy}) 周围`, null, 'ally');
}
function execCommand(x, y){
  const k = COMMANDS[CMD.skill], who = `指挥官 ${fullName(CMD.unit)}【${k.name}】`;
  if (k.kind === 'area' && !k.instant){ orderMeteor(x, y); return true; }
  if (k.kind === 'area'){
    const cells = cmdCells(x, y), set = new Set(cells.map(([a,b]) => b*N+a));
    const pw = {name:k.name, dmgType:k.dmgType || '物理', fire:'command', ignoreDef:false};
    const hitU = units.filter(u => u.hp > 0 && u.side !== 'neutral' && tilesOf(u).some(([a,b]) => set.has(b*N+a)));
    log(`${who}：炮击 (${x}, ${y}) 周围，命中 ${hitU.length} 台`, null, 'ally');
    S.echoFlash = {set, t0:performance.now()};
    fx('beam', {a:[x*TS+TS/2, -40], b:[x*TS+TS/2, y*TS+TS/2], color:'#ffb38a', dur:420});
    for (const u of hitU){
      const d = reduceOnly(CMD.unit, pw, u, k.dmg, null, null, false);
      u.hp = Math.max(0, u.hp - d); addFloat(u, String(d), '#ffb38a');
      log(`${fullName(u)} 受到 ${d} 伤害`, null, u.side);
      if (u.hp <= 0) destroy(u, null);
    }
    checkEnd();
  } else if (k.kind === 'enemy'){
    const t = occupant(x, y); if (!t || t.side !== 'enemy') return false;
    t.buffs.push({src:k.name, eva:-30}); t.debuffs.push({pct:30, src:k.name});
    addFloat(t, '锁定', '#ff9a8a'); log(`${who}：锁定 ${fullName(t)}，闪避 −30、破防 −30%`, null, 'ally');
  } else if (k.kind === 'ally'){
    const t = occupant(x, y); if (!t || t.side !== 'ally' || !t.acted) return false;
    t.acted = false; t.moved = false; addFloat(t, '再动', '#9fe0b8'); log(`${who}：${fullName(t)} 可以再行动一次`, null, 'ally');
  } else if (CMD.skill === 'resupply'){
    units.filter(u => u.side === 'ally' && u.hp > 0).forEach(u => { const amt = Math.min(Math.round(u.maxHp*.25), u.maxHp - u.hp); u.hp += amt; u.debuffs = []; if (amt) addFloat(u, `+${amt}`, '#9fe0b8'); });
    log(`${who}：全体出击机体回复 25% HP，破防清除`, null, 'ally');
  } else if (CMD.skill === 'battlePlan'){
    units.filter(u => u.side === 'ally' && u.hp > 0).forEach(u => { u.buffs.push({src:k.name, hit:15, crit:15}); addFloat(u, '↑', '#9fe0b8'); });
    log(`${who}：全体出击机体命中 +15、暴击 +15`, null, 'ally');
  }
  CMD.readyTurn = turn + k.cd;
  return true;
}
async function resolveMeteors(){
  if (!CMD) return;
  const k = COMMANDS[CMD.skill], now = CMD.pending.filter(m => m.land <= turn);
  CMD.pending = CMD.pending.filter(m => m.land > turn);
  const pseudoW = {name:k.name, dmgType:'物理', fire:'passive', ignoreDef:false};
  for (const m of now){
    const set = new Set(m.cells.map(([x,y]) => y*N+x));
    const hitU = units.filter(u => u.hp > 0 && tilesOf(u).some(([x,y]) => set.has(y*N+x)));
    const xs = m.cells.map(c => c[0]), ys = m.cells.map(c => c[1]);
    await fx('meteor', {b:[(Math.min(...xs) + Math.max(...xs) + 1)/2*TS, (Math.min(...ys) + Math.max(...ys) + 1)/2*TS], dur:900});
    log(`☄ 陨石落下！区域内 ${hitU.length} 台单位受到冲击`, null, 'sys');
    S.echoFlash = {set, t0: performance.now()};
    for (const u of hitU){
      const d = reduceOnly(CMD.unit, pseudoW, u, k.dmg, null, null, false);
      u.hp = Math.max(0, u.hp - d);
      addFloat(u, String(d), '#ffb38a');
      log(`${fullName(u)} 受到陨石伤害 ${d}`, null, u.side === 'ally' ? 'ally' : 'enemy');
      if (u.hp <= 0) destroy(u, null);
    }
    let n = 0;
    for (const [x,y] of m.cells){
      if (occupant(x,y) || walls.has(y*N+x) || TER[map[y][x]].groundBlock) continue;
      const r = makeUnit(DEBRIS_T, 'neutral', x, y); r.facing = 'down'; units.push(r); n++;
    }
    if (n) log(`生成陨石残骸 ${n} 块（HP 1000，挡移动和直射）`, null, 'sys');
    await sleep(500);
  }
  refresh(); checkEnd();
}
function startLevel(id){
  if (id === 'editor'){ openEditor(); return; }
  if ($('#editView')) $('#editView').hidden = true;
  audioScene('battle');
  $('#endModal').hidden = true;      // 关掉上一个模式留下的对话框（例如肉鸽开局选分队）
  CMD = null;
  walls = new Map();
  if (id === 'skirmish'){ newCampaign(); return; }
  if (id === 'roguelike'){ runOpen(); return; }
  runHide();
  level = id; LV = LEVELS[id]; $('#levelSel').value = LV.run ? 'roguelike' : id; SPEED = LV.speed || 1;
  over = false; turn = 1; seed = 0;
  setMapSize(LV.w, LV.h, Math.max(1, Math.min(1.7, (wrap.clientWidth - 4) / (LV.w*TS))));
  map = LV.rows.map(r => [...r].map(c => TILE_CH[c]));
  if (LV.rosterList){
    roster = LV.rosterList.map(({mech, lv}) => { const u = makeUnit(ALLY_T.find(t => t.mech === mech), 'ally', 0, 0); for (let k=1;k<lv;k++) levelUp(u, true); return u; });
    units = [];
  } else if (LV.spots){
    roster = ALLY_T.map(t => { const u = makeUnit(t, 'ally', 0, 0); for (let k=1;k<(LV.rosterLv||1);k++) levelUp(u, true); return u; });
    units = [];
  } else {
    roster = LV.allies.map(a => {
      const u = makeUnit(ALLY_T.find(t => t.mech === a.mech), 'ally', a.x, a.y);
      u.facing = a.facing || 'right'; if (a.flying != null) u.flying = a.flying; if (a.forceTrait) u.forceTrait = true;
      for (let k=1;k<(a.lv||1);k++) levelUp(u, true);
      u.deployed = true;
      return u;
    });
    units = [...roster];
  }
  units.push(...(LV.enemies || []).map(e => { const u = makeUnit(ENEMY_T[e.t], 'enemy', e.x, e.y); u.facing = e.facing || 'left'; for (let k=1;k<(e.lv||LV.enemyLv||1);k++) levelUp(u); u.hp = u.maxHp; return u; }));
  waveIdx = -1; deadline = 0;
  if (LV.waves) spawnWave(0, true);
  LV.tips.forEach(t => { t.shown = false; });
  $('#tipCard').hidden = true;
  buildTerrain();
  $('#log').innerHTML = '';
  log(`${LV.code && !LV.run ? '[' + LV.code + '] ' : ''}${LV.name} 开始 · 胜利条件：${LV.goalText}`, null, 'sys');
  if (LV.waves) log(`第 1 波：${LV.waves[0].label}，回合上限：第 ${deadline} 回合结束前`, null, 'sys');
  S.inspect = null; S.threatSet = null;
  const go = () => { SOUND.scene = 'battle'; startPlayerPhase(); focusOn(units.find(u => u.side === 'ally'), false); if (LV.afterStart) LV.afterStart(); };
  if (LV.formation) showFormation(picked => { if (LV.spots) placeAllies(picked, LV.spots, {facing:LV.allyFacing || 'up'}); go(); });
  else { if (LV.presetCmd) setCommander(roster.find(u => u.mech === LV.presetCmd)); go(); }
}
const inZone = u => tilesOf(u).every(([x,y]) => x >= LV.zone.x0 && x <= LV.zone.x1 && y >= LV.zone.y0 && y <= LV.zone.y1);
function newCampaign(){
  battleNo = 1;
  roster = ALLY_T.map(t => makeUnit(t, 'ally', 0, 0));
  startBattle(Date.now() & 0xffffff);
}

/* ---------- v0.25 援护攻击 ----------
   己方阶段，同伴主动攻击、目标没被击破时，带「援护攻击」的机体可以用一个武装跟着打同一个目标（目标不能反击）。每回合 1 次。
   我方会弹窗询问（默认按钮 = 伤害最高的武装，所以一路按空格就会援护）；敌方自动援护。
   援护防御挡下的是一整轮：敌方的援护攻击也打在援护者身上。 */
const SUPPORT_FIRES = ['melee', 'direct', 'indirect'];
function supportOptions(att, t){
  const out = [];
  for (const s of units){
    if (s === att || s.side !== att.side || s.hp <= 0 || !abilOn(s,'supportAtk') || s.supTurn === turn || s.stunned || s.disarmed) continue;
    const ws = s.weapons.filter(w => SUPPORT_FIRES.includes(w.fire) && !w.special?.match?.(/lock|gamble/) && !wStatus(s, w, {counter:true}) && canHit(s, w, t))
      .map(w => ({w, f:forecast(s, w, t, null)})).sort((a, b) => b.f.exp - a.f.exp);
    if (ws.length) out.push({s, ws});
  }
  return out.sort((a, b) => b.ws[0].f.exp - a.ws[0].f.exp);
}
function askSupport(att, t, opts){
  return new Promise(resolve => {
    const rows = opts.map((o, i) => `<div class="opt"><h4>${fullName(o.s)}</h4>${o.ws.map((x, j) => `<button class="btn ${i === 0 && j === 0 ? 'primary' : ''}" data-sp="${i}:${j}" style="display:block;width:100%;margin:4px 0">【${x.w.name}】命中 ${x.f.hit}%　伤害 ${x.f.dmg}</button>`).join('')}</div>`).join('');
    $('#reactDlg').innerHTML = `<div class="eyebrow">援护攻击</div>
      <h2>${fullName(t)} 还没被击破</h2>
      <p class="small">可以让一台带「援护攻击」的机体跟着攻击同一个目标（目标不能反击，每台每回合 1 次）。按空格 = 第一个按钮（伤害最高）。</p>
      <div class="opts" style="grid-template-columns:repeat(${Math.min(3, opts.length + 1)},minmax(0,1fr))">${rows}<div class="opt"><h4>不援护</h4><button class="btn" data-sp="no" style="display:block;width:100%;margin:4px 0">不援护</button></div></div>`;
    $('#reactModal').hidden = false;
    $('#reactDlg').querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { $('#reactModal').hidden = true; if (b.dataset.sp === 'no') return resolve(null); const [i, j] = b.dataset.sp.split(':').map(Number); resolve({s:opts[i].s, w:opts[i].ws[j].w}); });
    $('#reactDlg').querySelector('[data-sp="0:0"]').focus();
  });
}
async function supportAttack(att, t, {guard = null, reaction = null} = {}){
  if (over || t.hp <= 0) return;
  const opts = supportOptions(att, t); if (!opts.length) return;
  const pick = att.side === 'ally' ? await askSupport(att, t, opts) : {s:opts[0].s, w:opts[0].ws[0].w};
  if (!pick || over) return;
  const tgt = guard && guard.hp > 0 ? guard : t;
  pick.s.supTurn = turn;
  log(`${fullName(pick.s)}【援护攻击】用【${pick.w.name}】攻击 ${fullName(tgt)}${tgt !== t ? '（被援护防御挡下）' : ''}`, null, pick.s.side);
  await strike(pick.s, pick.w, tgt, guard ? 'defend' : (reaction === 'defend' || reaction === 'evade' ? reaction : null), guard ? {zone:'front'} : {});
  refresh(); checkEnd();
}

