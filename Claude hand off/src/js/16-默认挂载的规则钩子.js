/* ---------- 默认挂载的规则钩子 ---------- */
Hooks.on('phaseStart', c => {
  units.filter(u => u.side === c.side).forEach(u => u.weapons.forEach(w => { if (w.cdLeft > 0) w.cdLeft--; }));
}, '武器冷却：己方阶段开始时 CD −1');
Hooks.on('phaseStart', c => {
  if (c.side !== 'ally') return;
  units.forEach(u => { if (u.buffs.length){ u.buffs = []; } });
}, '月光祝福：我方阶段开始时失效');
Hooks.on('phaseStart', c => { if (c.side === 'ally') units.forEach(u => { u.debuffs = []; }); }, '破防：我方阶段开始时清除');
Hooks.on('phaseStart', c => {
  if (c.side !== 'ally' || !walls.size) return;
  let n = 0; for (const [k, exp] of walls) if (turn >= exp){ walls.delete(k); n++; }
  if (n) log(`GN 力场壁消散（${n} 格）`, null, 'sys');
}, 'GN 力场壁：到期后在我方阶段开始时消失');
Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || c.w.special !== 'push') return;
  pushUnit(c.att, c.def, c.w.push);
}, 'GN 冲撞：命中后推开目标');
Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || c.w.special !== 'markBreak' || hasTrait(c.def,'wSeries')) return;
  c.def.debuffs.push({pct:20, src:c.w.name});
  log(`${fullName(c.def)} 被【${c.w.name}】标记：破防 −20%（合计 −${Math.min(100, breakSum(c.def))}%）`, null, c.att.side);
}, 'TRANS-AM 狙击：命中后直接挂一层背面破防');
Hooks.on('strikeResolved', c => {
  if (c.hit || c.def.hp <= 0 || !c.def.abilities.includes('dodgeFatigue')) return;
  c.def.dodgePen = (c.def.dodgePen || 0) + 10;
  if (c.def.side === 'ally') fireTip('fatigue');
  log(`${fullName(c.def)} 闪避疲劳：闪避 −10（本回合合计 −${c.def.dodgePen}，当前 ${Math.max(0, c.def.eva - c.def.dodgePen)}）`, null, c.def.side);
}, '闪避疲劳：完全闪避一次攻击后闪避 −10');
Hooks.on('phaseStart', c => { if (c.side === 'ally') units.forEach(u => { u.dodgePen = 0; }); }, '闪避疲劳：我方阶段开始时恢复');
Hooks.on('phaseStart', c => { units.filter(u => u.side === c.side && u.shield).forEach(u => { u.shieldHp = u.shield; }); }, '护盾：己方阶段开始时回满');
Hooks.on('strikeResolved', c => {
  if (!c.hit || !c.dmg || c.w.special !== 'splash') return;
  const amt = Math.round(c.dmg * .5);
  for (const o of units.filter(o => o !== c.def && o.hp > 0 && o.side === c.def.side && distU(o, c.def) === 1)){
    o.hp = Math.max(0, o.hp - amt); addFloat(o, String(amt), '#ffb38a');
    log(`【${c.w.name}】溅射 ${fullName(o)}：${amt}`, null, c.att.side);
    if (o.hp <= 0) destroy(o, c.att);
  }
}, '溅射：命中后相邻的同阵营单位受到 50% 伤害');
Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || c.w.special !== 'pull') return;
  pullUnit(c.att, c.def, c.w.pull || 1);
}, '拉拽：命中后把目标拉近');
Hooks.on('strikeResolved', c => {
  if (!c.hit || c.def.hp <= 0 || c.w.special !== 'lock' || !wv(c.att, c.w, 'disarm')) return;
  c.def.disarmed = true; addFloat(c.def, '武装损坏', '#c9a8ff');
}, '多重锁定 Lv30：命中目标武装损坏');
Hooks.on('phaseStart', c => {
  if (c.side !== 'enemy') return;
  for (const u of units.filter(u => u.side === 'enemy' && u.hp > 0 && abilOn(u,'regen') && u.hp < u.maxHp)){
    const amt = Math.min(Math.round(u.maxHp * .15), u.maxHp - u.hp); u.hp += amt; addFloat(u, `+${amt}`, '#9fe0b8');
    log(`${fullName(u)}【自修复】回复 ${amt}`, null, 'enemy');
  }
}, '自修复：敌方阶段开始时回复 15%');
Hooks.on('unitDestroyed', c => {
  const u = c.unit; if (!abilOn(u,'selfDestruct')) return;
  const pw = {name:'自爆', dmgType:'物理', fire:'passive', ignoreDef:false};
  const vs = units.filter(o => o.hp > 0 && distU(o, u) === 1);
  log(`${fullName(u)} 自爆！相邻 ${vs.length} 台单位受到冲击`, null, 'sys');
  fx('burst', {b:cpx(u), crit:true, seed:Math.random(), dur:500});
  for (const o of vs){ const d = reduceOnly(u, pw, o, 2500, null, null, false); o.hp = Math.max(0, o.hp - d); addFloat(o, String(d), '#ffb38a'); if (o.hp <= 0) destroy(o, null); }
}, '自爆：被击破时伤害相邻所有单位');
Hooks.on('actionEnd', () => {}, '残月的余响 / 月华再生：我方阶段行动结束后释放（由 finish 结算）');
Hooks.on('phaseStart', c => {
  for (const src of units.filter(u => u.side === c.side && u.hp > 0 && abilOn(u, 'psyRes'))){
    const pct = L30(src) ? .15 : .1, parts = [];
    units.filter(a => a.side === src.side && a.hp > 0 && distU(a, src) <= 3).forEach(a => { const amt = Math.min(Math.round(a.maxHp * pct), a.maxHp - a.hp); if (amt > 0){ a.hp += amt; addFloat(a, `+${amt}`, '#9fe0b8'); parts.push(`${fullName(a)} +${amt}`); } });
    if (parts.length) log(`${fullName(src)}【念动共鸣】${parts.join('，')}`, null, src.side);
  }
}, '念动共鸣：阶段开始时群体回复');
Hooks.on('phaseStart', c => { units.filter(u => u.side === c.side).forEach(u => { u.movedThisRound = false; if (c.side === 'ally') u.moveEva = 0; }); }, '回合开始：清除"本回合已移动"与剩余移动闪避');
Hooks.on('phaseStart', c => { if (c.side === 'enemy') units.forEach(u => { u.guardLeft = 2 + (hasTrait(u,'steadfast') && !u.movedThisRound ? 1 : 0); }); else units.forEach(u => { if (abilOn(u,'guardAtk')) u.guardLeft = 2; }); }, '援护防御：敌方阶段开始时重置为 2 次（不动如山 +1）；进攻援护在我方阶段开始时也重置为 2 次');

