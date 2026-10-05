const { chromium } = require('playwright');
const strat = process.argv[2] || 'mountain';
(async () => {
  const b = await chromium.launch();
  const results = [];
  for (let run=0; run<4; run++){
  const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR '+e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.waitForTimeout(300);
  await p.selectOption('#levelSel','tut3'); await p.waitForTimeout(200);
  let outcome='timeout', t;
  for (t=1;t<=15;t++){
    await p.evaluate(async ([strat,t]) => {
      const g = window.__game, u = g.units.find(x=>x.mech==='B2');
      g.onTile(u.x,u.y);
      if (t===1){
        if (strat==='mountain'){ g.onTile(10,7); await g.onAction('fly'); }
        else { g.onTile(u.x,u.y); }
      } else g.onTile(u.x,u.y);
      // attack lowest hp in range
      let best=null, bw=null;
      for (const wi of [0,1]){ const w=u.weapons[wi]; for (const e of g.units.filter(x=>x.side==='enemy')){ if (g.canHit(u,w,e) && (!best || e.hp<best.hp)){best=e; bw=wi;} } }
      if (best){ await g.onAction('attack'); document.querySelector(`[data-w="${bw}"]`).click(); g.onTile(best.x,best.y); await g.onAction('fire'); }
      else await g.onAction('wait');
    }, [strat,t]);
    if (await p.isVisible('#endModal')) { outcome = await p.$eval('#endDlg h2', h=>h.textContent); break; }
    await p.click('#btnEnd');
    for (let i=0;i<500;i++){
      await p.waitForTimeout(60);
      if (await p.isVisible('#reactModal')) { const c = await p.$('#reactDlg [data-c]'); if (c) await c.click(); else await p.click('#reactDlg [data-r="evade"]'); }
      if (await p.isVisible('#endModal')) break;
      if ((await p.textContent('#phase')).includes('我方')) break;
    }
    if (await p.isVisible('#endModal')) { outcome = await p.$eval('#endDlg h2', h=>h.textContent); break; }
  }
  const st = await p.evaluate(()=>{const g=window.__game,u=g.units.find(x=>x.mech==='B2'); return (u?('B2 hp '+u.hp):'B2 dead')+' enemies '+g.units.filter(x=>x.side==='enemy').length;});
  results.push(`${strat} run${run}: ${outcome} T${t} ${st} ${errs.join(';')}`);
  await p.close();
  }
  console.log(results.join('\n'));
  await b.close();
})();
