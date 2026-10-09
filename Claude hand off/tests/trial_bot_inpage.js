// in-page bot helpers
window.__bot = async function(levelId, maxTurns, lv){
  const g = window.__game, S = g.S;
  document.querySelector('#endModal').hidden = true; g.startLevel(levelId);
  await new Promise(r => setTimeout(r, 30));
  if (!document.querySelector('#endModal').hidden) document.querySelector('#btnForm').click();
  if (lv) g.cheatLevel(lv);
  g.setSpeed(0.002);
  const used = {};
  const dist = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  if (!window.__autoReact) window.__autoReact = setInterval(() => {
    if (!document.querySelector('#reactModal').hidden){ const b = document.querySelector('#reactDlg button'); if (b) b.click(); }
    if (!document.querySelector('#askModal').hidden) document.querySelector('#askNo').click();
  }, 5);
  const clickW = w => { const i = S.sel.weapons.indexOf(w); const b = document.querySelector(`#actionCard [data-w="${i}"]`); if (b) b.click(); return !!b; };
  while (!g.over && g.turn <= maxTurns){
    if (g.CMD && g.turn >= g.CMD.readyTurn){
      const foe = g.units.find(u => u.side === 'enemy'); const ally = g.units.find(u => u.side === 'ally');
      document.querySelector('#btnCmd').click();
      if (g.CMD.skill === 'reAct'){ /* later */ g.onAction('cmd-cancel'); }
      else { const ok = g.execCommand(foe.x, foe.y); used['cmd:' + g.CMD.skill] = ok; g.onAction('cmd-cancel'); }
    }
    for (const u of g.units.filter(u => u.side === 'ally' && !u.acted)){
      if (g.over) break;
      if (!g.units.includes(u)) continue;
      g.select(u);
      const foes = g.units.filter(e => e.side === 'enemy');
      if (!foes.length) break;
      const ranges = u.weapons.filter(w => u.lv >= w.unlock && ['melee','direct','indirect'].includes(w.fire)).map(w => w.range);
      const score = t => {
        const ds = foes.map(f => Math.abs(t.x-f.x)+Math.abs(t.y-f.y));
        const can = ranges.some(r => ds.some(d => d >= r[0] && d <= r[1]));
        const threat = foes.filter((f,i) => ds[i] <= f.mov + Math.max(1, ...f.weapons.map(w => w.range[1]))).length;
        return (can ? 100 : 0) - threat * (u.hp < u.maxHp*.5 ? 25 : 12) - Math.min(...ds) * 2 + (t.x === u.x && t.y === u.y ? 1 : 0);
      };
      const best = S.reach.slice().sort((a,b) => score(b) - score(a))[0];
      g.onTile(best.x, best.y);
      for (let k = 0; k < 200 && S.mode === 'busy'; k++) await new Promise(r => setTimeout(r, 25));   // v0.40.11 路上挨敌方压制射击时移动是异步的，等它走完
      if (!g.units.includes(u) || u.hp <= 0) continue;
      if (S.mode !== 'menu'){ continue; }
      document.querySelector('#actionCard [data-a="attack"]') && document.querySelector('#actionCard [data-a="attack"]').click();
      let done = false;
      for (const w of [...u.weapons].reverse()){
        if (S.mode !== 'weapon') break;
        if (!g.weaponUsable(u, w).ok) continue;
        if (w.special === 'lock'){ clickW(w); for (const t of g.units.filter(e => e.side === 'enemy')) if (g.canHit(u, w, t)) g.toggleLock(t); if (S.locks.length){ await g.onAction('lockfire'); used[w.name] = 1; done = true; break; } g.onAction('back-weapon'); continue; }
        if (w.fire === 'map'){ clickW(w); const ds = S.dirs.filter(d => d.ok && d.hit.some(t => t.side === 'enemy') && !d.hit.some(t => t.side === 'ally')); if (ds.length){ S.dir = ds[0]; S.mode = 'mapconfirm'; await g.onAction('mapfire'); used[w.name] = 1; done = true; break; } g.onAction('back-weapon'); continue; }
        if (w.fire === 'support'){ clickW(w); await g.onAction('cast'); used[w.name] = 1; done = true; break; }
        if (w.fire === 'heal'){ clickW(w); const b = document.querySelector('#actionCard [data-heal]'); if (b){ b.click(); used[w.name] = 1; await new Promise(r => setTimeout(r, 30)); done = true; break; } g.onAction('back-weapon'); continue; }
      }
      if (!done && S.sel === u){
        if (S.mode !== 'menu') g.onAction('back-menu');
        const ts = g.attackables(u);
        if (ts.length){ const t = ts[0]; g.choosePick(t); const wn = S.weapon && S.weapon.name; await g.onAction('fire'); used[wn] = (used[wn]||0) + 1; }
        else await g.onAction('wait');
      }
      for (let k=0; k<5 && S.sel === u; k++){
        if (S.mode === 'moving2'){ used.hitAway = 1; await g.onAction('wait'); }
        else if (S.mode === 'menu'){ const ts = g.attackables(u); if (ts.length){ g.choosePick(ts[0]); await g.onAction('fire'); used.extra = 1; } else await g.onAction('wait'); }
        else break;
      }
    }
    if (g.over) break;
    await g.endTurn();
  }
  const allies = g.units.filter(u => u.side === 'ally').length, foes = g.units.filter(u => u.side === 'enemy').length;
  return {levelId, turn: g.turn, over: g.over, allies, foes, used: Object.keys(used).join('|')};
};
