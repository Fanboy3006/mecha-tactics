const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR '+e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.waitForTimeout(500);
  await p.screenshot({path:'tut0.png'});
  const act = async (fn) => p.evaluate(fn);
  const endTurn = async () => {
    await p.click('#btnEnd');
    for (let i=0;i<300;i++){
      await p.waitForTimeout(100);
      if (await p.isVisible('#reactModal')) { const c = await p.$('#reactDlg [data-r="evade"]'); if (c) await c.click(); }
      if (await p.isVisible('#endModal')) return 'end';
      if ((await p.textContent('#phase')).includes('我方')) return 'ok';
    }
  };
  // turn 1
  console.log(await act(async () => {
    const g = window.__game, [b1,b2] = g.units.filter(u=>u.side==='ally'), out=[];
    g.onTile(b2.x,b2.y); out.push('tip: '+document.querySelector('#tipText').innerText.slice(0,30));
    out.push('panel: '+document.querySelector('#actionCard').innerText.replace(/\n/g,' | '));
    await g.onAction('fly'); out.push('b2 flying '+b2.flying+' reach '+g.S.reach.length);
    g.onTile(11,7); await g.onAction('wait');
    g.onTile(b1.x,b1.y); out.push('b1 panel: '+document.querySelector('#actionCard').innerText.replace(/\n/g,' | '));
    g.onTile(9,4); out.push('b1 at '+b1.x+','+b1.y+' mode '+g.S.mode);
    await g.onAction('wait');
    return out.join('\n');
  }));
  console.log('end1', await endTurn());
  console.log(await act(async () => {
    const g = window.__game, [b1,b2] = g.units.filter(u=>u.side==='ally'), out=[];
    out.push('hp b1 '+b1.hp+' b2 '+b2.hp+' enemies '+g.units.filter(u=>u.side==='enemy').map(e=>e.x+','+e.y).join(' '));
    g.onTile(b1.x,b1.y); g.onTile(13,4); out.push('b1 at '+b1.x+','+b1.y); await g.onAction('wait');
    g.onTile(b2.x,b2.y); g.onTile(17,7); out.push('b2 at '+b2.x+','+b2.y); await g.onAction('wait');
    return out.join('\n');
  }));
  console.log('end2', await endTurn());
  console.log(await act(async () => {
    const g = window.__game, [b1,b2] = g.units.filter(u=>u.side==='ally'), out=[];
    out.push('hp b1 '+b1.hp+' b2 '+b2.hp);
    g.onTile(b1.x,b1.y); await g.onAction('portal'); out.push('portal tiles '+g.S.portalTiles.length);
    g.onTile(20,4); out.push('b1 at '+b1.x+','+b1.y+' backlash '+b1.backlash+' mode '+g.S.mode);
    await g.onAction('wait');
    g.onTile(b2.x,b2.y); g.onTile(23,7); await g.onAction('wait');
    return out.join('\n');
  }));
  console.log('end3', await endTurn());
  console.log(await act(async () => {
    const g = window.__game, [b1,b2] = g.units.filter(u=>u.side==='ally');
    g.onTile(b1.x,b1.y); g.onTile(23,4); await g.onAction('wait');
    return 'b1 '+b1.x+','+b1.y+' end visible '+!document.querySelector('#endModal').hidden + ' ' + document.querySelector('#endDlg').innerText.slice(0,60);
  }));
  await p.screenshot({path:'tut1.png'});
  // switch to skirmish
  await p.selectOption('#levelSel','skirmish');
  await p.waitForTimeout(300);
  console.log('skirmish units', await act(()=>window.__game.units.length));
  console.log('ERRS', errs);
  await b.close();
})();
