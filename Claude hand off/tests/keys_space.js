const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}}); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.waitForTimeout(300);
  await p.selectOption('#levelSel','tut2'); await p.waitForTimeout(300);
  await p.click('#tipCard'); // move focus off select
  const st = () => p.evaluate(()=>window.__game.S.mode + ' atk=' + (window.__game.S.atkList||[]).length);
  // B1: select, move next to tank (6,7), space -> pick, space -> confirm, space -> fire
  await p.evaluate(()=>{ const g=window.__game, b1=g.units.find(u=>u.mech==='B1'); g.onTile(b1.x,b1.y); g.onTile(6,7); });
  console.log('after move', await st());
  await p.keyboard.press('Space'); console.log('space1', await st());
  await p.screenshot({path:'pick.png'});
  await p.keyboard.press('Space'); console.log('space2', await st(), await p.evaluate(()=>window.__game.S.weapon && window.__game.S.weapon.name));
  await p.keyboard.press('Space'); await p.waitForTimeout(2500); console.log('space3', await st(), await p.evaluate(()=>window.__game.units.find(u=>u.mech==='B1').acted));
  // B2: select, space (in place) -> menu; if no target -> space waits
  await p.evaluate(()=>{ const g=window.__game, b2=g.units.find(u=>u.mech==='B2'); b2.x=1; b2.y=13; g.onTile(b2.x,b2.y); });
  await p.keyboard.press('Space'); console.log('b2 space1', await st());
  await p.keyboard.press('Space'); await p.waitForTimeout(300); console.log('b2 space2', await st(), await p.evaluate(()=>window.__game.units.find(u=>u.mech==='B2').acted));
  console.log('ERRS', errs); await b.close();
})();
