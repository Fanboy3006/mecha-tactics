const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR '+e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.waitForTimeout(400);
  await p.selectOption('#levelSel','tut2'); await p.waitForTimeout(300);
  const endTurn = async (mode='counter') => {
    // v0.25：我方攻击后可能弹出「援护攻击」询问，先默认接受
    for (let i=0;i<20 && await p.isVisible('#reactModal');i++){ const sp = await p.$('#reactDlg [data-sp="0:0"]'); if (sp) await sp.click(); await p.waitForTimeout(300); }
    await p.click('#btnEnd');
    for (let i=0;i<400;i++){
      await p.waitForTimeout(80);
      if (await p.isVisible('#reactModal')) { const sp = await p.$('#reactDlg [data-sp]'); if (sp){ await sp.click(); continue; } const c = mode==='counter' ? await p.$('#reactDlg [data-c]') : null; if (c) await c.click(); else await p.click('#reactDlg [data-r="defend"]'); }
      if (await p.isVisible('#endModal')) return 'END';
      if ((await p.textContent('#phase')).includes('我方')) return 'ok';
    }
  };
  // generic: for each ally, find tile reachable from which attacking target is back/side with weapon wi, prefer back
  const smartAttack = (mech, wi, wantZones) => p.evaluate(async ([mech,wi,wantZones]) => {
    const g = window.__game, u = g.units.find(x=>x.mech===mech); if (!u) return mech+' dead';
    const foes = g.units.filter(x=>x.side==='enemy'); if (!foes.length) return 'no foes';
    g.onTile(u.x,u.y); const tiles = g.S.reach.slice(); const ox=u.x, oy=u.y;
    let best=null;
    for (const t of tiles){ for (const f of foes){ u.x=t.x; u.y=t.y; const w=u.weapons[wi];
      if (!g.canHit(u,w,f)) continue; const z = g.zoneOf(u,f); const rank = wantZones.indexOf(z); if (rank<0) continue;
      if (!best || rank<best.rank || (rank===best.rank && f.hp<best.f.hp)) best={t,f,rank,z}; } }
    u.x=ox; u.y=oy;
    if (!best){ await g.onAction('cancel'); return mech+' no position'; }
    g.onTile(best.t.x,best.t.y); await g.onAction('attack'); document.querySelector(`[data-w="${wi}"]`).click(); g.onTile(best.f.x,best.f.y); await g.onAction('fire');
    if (g.S.sel && (g.S.dash || g.S.mode === 'menu')) await g.onAction('wait');   // v0.25：近卫击破后的 DASH，这个脚本直接放弃
    return `${mech} hit ${best.f.mech} from ${best.z} at ${best.t.x},${best.t.y}; foe hp ${best.f.hp}`;
  }, [mech,wi,wantZones]);
  const info = () => p.evaluate(() => window.__game.units.map(u=>`${u.mech}@${u.x},${u.y} hp${u.hp}`).join(' | ') + ' | ' + document.querySelector('#limitTxt').textContent);
  for (let t=1;t<=9;t++){
    // B2 first then B1 for pincer
    for (const [m,wi] of [['B2',0],['B1',0]]){
      let r = await smartAttack(m, wi, ['back','side']);
      if (r.includes('no position')) r = await smartAttack(m, m==='B2'?1:0, ['back','side','front']);
      if (r.includes('no position')) r = await smartAttack(m, 0, ['back','side','front']);
      if (r.includes('no position')) { await p.evaluate(async (m)=>{const g=window.__game,u=g.units.find(x=>x.mech===m); if(!u)return; g.onTile(u.x,u.y); const foes=g.units.filter(x=>x.side==='enemy'); const f=foes[0]; if(!f){await g.onAction('cancel');return;} let bt=g.S.reach[0]; for(const t of g.S.reach){ if(Math.abs(t.x-f.x)+Math.abs(t.y-f.y) < Math.abs(bt.x-f.x)+Math.abs(bt.y-f.y)) bt=t;} g.onTile(bt.x,bt.y); await g.onAction('wait');}, m); r = m+' moved closer'; }
      console.log('T'+t, r);
      if (await p.isVisible('#endModal')) break;
    }
    console.log('  ', await info());
    if (await p.isVisible('#endModal')) break;
    const e = await endTurn();
    if (e==='END') break;
  }
  console.log('END:', await p.evaluate(()=>document.querySelector('#endDlg').innerText.replace(/\n+/g,' / ')));
  console.log(await p.evaluate(() => [...document.querySelectorAll('#log li')].map(l=>l.innerText.split('\n')[0]).filter(t=>t.includes('波')||t.includes('失败')||t.includes('成功')).join('\n')));
  console.log('ERRS', errs);
  await b.close();
})();
