
window.__runbot = async function(maxSteps, squad){
  const g = window.__game, S = g.S, used = {};
  const dist = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const clickW = w => { const i = S.sel.weapons.indexOf(w); const b = document.querySelector(`#actionCard [data-w="${i}"]`); if (b) b.click(); return !!b; };
  if (!window.__autoReact) window.__autoReact = setInterval(() => {
    if (!document.querySelector('#reactModal').hidden){ const b = document.querySelector('#reactDlg button'); if (b) b.click(); }
    if (!document.querySelector('#askModal').hidden) document.querySelector('#askNo').click();
  }, 5);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  g.startLevel('roguelike');
  const trace = [];
  let boosted = false;
  for (let step = 0; step < maxSteps; step++){
    await wait(15);
    const R = g.RUN;
    if (R && !boosted && window.__boost){ R.dur = 999; boosted = true; }
    if (R && R.over){ trace.push('OVER'); break; }
    const modal = !document.querySelector('#endModal').hidden;
    if (modal){
      const form = document.querySelector('#btnForm');
      if (form){ form.click(); g.setSpeed(0.002); continue; }
      const bs = [...document.querySelectorAll('#endDlg [data-v]')].filter(b => !b.disabled);
      const pref = ['go','ok','dur','0'];
      let b = bs.find(b => b.dataset.v === squad) || bs.find(b => b.classList.contains('rcard') && b.dataset.v !== 'moon') || bs.find(b => pref.includes(b.dataset.v)) || bs.find(b => b.dataset.v === 'leave') || bs.find(b => b.dataset.v === 'skip') || bs[0];
      if (!b){ trace.push('stuck-modal'); break; }
      trace.push('dlg:' + b.dataset.v); b.click(); continue;
    }
    if (g.level === 'run' && !g.over){
      // play one ally phase
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
      if (!best){ g.onAction && g.onAction('wait'); continue; }   // 没有可去的格子（偶发）：跳过这台
      g.onTile(best.x, best.y);
      for (let k = 0; k < 200 && S.mode === 'busy'; k++) await new Promise(r => setTimeout(r, 25));   // v0.40.20 路上挨敌方压制射击时移动是异步的
      if (!S.sel || !g.units.includes(u) || u.hp <= 0) continue;
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

      if (!g.over) await g.endTurn();
      continue;
    }
    if (R && R.map && !document.querySelector('#runView').hidden){
      // promote if possible
      const pb = [...document.querySelectorAll('[data-promo]')].find(b => !b.disabled);
      if (pb && R.hope >= 6){ pb.click(); trace.push('promo'); continue; }
      const N = R.map.nodes, tg = g.moveTargets();
      if (!tg.length || R.prop <= 0){ trace.push('nomove'); await wait(50); continue; }
      // head right, prefer uncleared
      const md = g.moveDist();
      const sc = k => (k % 6) * 3 - md.get(k) * 4 + (N[k].cleared ? -2 : 1) + (['exit','guard'].includes(N[k].type) && R.prop < 4 ? 20 : 0) + Math.random();
      const k = tg.sort((a,b) => sc(b) - sc(a))[0];
      trace.push(`L${R.layer} mv ${N[k].type}`);
      g.runClickNode(k);
      continue;
    }
    trace.push('idle?'); await wait(50);
  }
  const R = g.RUN;
  return {trace: trace.slice(-60).join(' | '), layer: R && R.layer, dur: R && R.dur, hope: R && R.hope, units: R && R.units.map(u => u.mech + ':' + u.lv).join(','), battles: R && R.battles, over: R && R.over, log: R && R.log.slice(-15).join(' / ')};
};
