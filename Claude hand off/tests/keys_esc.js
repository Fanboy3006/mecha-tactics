const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}}); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.selectOption('#levelSel','tut1'); await p.waitForTimeout(200);   // v0.23 起默认进入肉鸽模式
  await p.waitForTimeout(300); await p.click('#tipCard');
  console.log(await p.evaluate(async ()=>{ const g=window.__game, b2=g.units.find(u=>u.mech==='B2'), o=[b2.x,b2.y,b2.flying,b2.facing];
    g.onTile(b2.x,b2.y); await g.onAction('fly'); g.onTile(b2.x+3,b2.y); await g.onAction('attack'); return 'before esc: '+g.S.mode+' pos '+b2.x+','+b2.y+' fly '+b2.flying+' orig '+o; }));
  await p.keyboard.press('Escape');
  console.log(await p.evaluate(()=>{ const g=window.__game, b2=g.units.find(u=>u.mech==='B2'); return 'after esc: sel '+(g.S.sel?g.S.sel.mech:'-')+' mode '+g.S.mode+' pos '+b2.x+','+b2.y+' fly '+b2.flying+' acted '+b2.acted+' facing '+b2.facing; }));
  // teleport then esc -> wait
  console.log(await p.evaluate(async ()=>{ const g=window.__game, b1=g.units.find(u=>u.mech==='B1'); g.onTile(b1.x,b1.y); await g.onAction('portal'); const t=g.S.portalTiles[0]; g.onTile(t.x,t.y); return 'teleported mode '+g.S.mode; }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  console.log(await p.evaluate(()=>{ const g=window.__game, b1=g.units.find(u=>u.mech==='B1'); return 'b1 acted '+b1.acted+' backlash '+b1.backlash+' sel '+(g.S.sel?'yes':'no'); }));
  console.log('ERRS', errs); await b.close();
})();
