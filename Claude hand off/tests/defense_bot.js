const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}}); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  const html = require('fs').readFileSync(require('path').join(__dirname,'../src/artifact-fragment.html'),'utf8');
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>');
  await p.waitForTimeout(300);
  await p.selectOption('#levelSel','defense'); await p.waitForTimeout(300);
  const t0 = Date.now();
  let res='timeout';
  for (let turn=1; turn<=16; turn++){
    await p.evaluate(async () => {
      const g = window.__game;
      const allies = g.units.filter(u=>u.side==='ally' && !u.acted);
      for (const u of allies){
        if (u.hp<=0 || !g.units.includes(u)) continue;
        if (document.querySelector('#endModal') && !document.querySelector('#endModal').hidden) return;
        g.onTile(u.x,u.y); if (g.S.mode!=='moving'){ continue; }
        const tiles = g.S.reach.slice(), ox=u.x, oy=u.y, foes = g.units.filter(e=>e.side==='enemy');
        let best=null;
        if (u.mech!=='M1'){
          for (const t of tiles){ u.x=t.x; u.y=t.y; const moved = !(t.x===ox&&t.y===oy);
            u.weapons.forEach((w,wi)=>{ if (!['melee','direct','indirect'].includes(w.fire)) return; if (u.lv<w.unlock) return; if (w.usesLeft!=null&&w.usesLeft<=0) return; if (w.cdLeft>0) return; if (moved && !w.afterMove) return;
              for (const e of foes){ if (!g.canHit(u,w,e)) continue; const f=g.forecast(u,w,e,null); const sc=f.exp+(f.dmg>=e.hp?6000:0)-t.d*10; if(!best||sc>best.sc) best={sc,t,wi,e}; } }); }
          u.x=ox; u.y=oy;
        }
        if (best){ g.onTile(best.t.x,best.t.y); if (g.S.mode!=='menu'){ continue; } await g.onAction('attack'); const btn=document.querySelector(`[data-w="${best.wi}"]`); if(!btn||btn.disabled){ await g.onAction('back-menu'); await g.onAction('wait'); continue;} btn.click(); g.onTile(best.e.x,best.e.y); if (g.S.mode==='confirm'){ await g.onAction('fire'); if (g.S.mode==='menu') await g.onAction('wait'); } else { await g.onAction('back-weapon'); await g.onAction('back-menu'); await g.onAction('wait'); } }
        else {
          // move toward nearest foe but keep 2 tiles back for supports
          let bt=tiles[0], bd=1e9; const near = foes.length? foes : [];
          for (const t of tiles){ const d = near.length? Math.min(...near.map(e=>Math.abs(e.x-t.x)+Math.abs(e.y-t.y))) : 0; if (d<bd){bd=d;bt=t;} }
          if (u.mech==='M1'||u.mech==='M3'){ bt = tiles.find(t=>t.x===ox&&t.y===oy) || bt; }
          g.onTile(bt.x,bt.y); if (g.S.mode==='menu') await g.onAction('wait');
        }
        if (g.S.sel && g.S.origin && g.S.mode!=='busy'){ if (g.S.mode!=='menu') await g.onAction('back-menu'); await g.onAction('wait'); }
        if (g.S.mode==='moving') await g.onAction('cancel');
      }
    });
    if (await p.isVisible('#endModal')) { res = await p.$eval('#endDlg h2', h=>h.textContent); break; }
    await p.click('#btnEnd');
    for (let i=0;i<3000;i++){
      await p.waitForTimeout(40);
      if (await p.isVisible('#reactModal')) {
        const gb = await p.$('#reactDlg [data-g="1"]'); if (gb){ await gb.click(); continue; }
        const c = await p.$('#reactDlg [data-c]'); if (c) await c.click(); else { const d = await p.$('#reactDlg [data-r="defend"]'); if (d) await d.click(); }
      }
      if (await p.isVisible('#endModal')) break;
      if ((await p.textContent('#phase')).includes('我方')) break;
    }
    const st = await p.evaluate(()=>{const g=window.__game; return `T${document.querySelector('#turnNo').textContent} allies ${g.units.filter(u=>u.side==='ally').length} (${g.units.filter(u=>u.side==='ally').map(u=>u.mech+':'+Math.round(u.hp/u.maxHp*100)+'%').join(' ')}) enemies ${g.units.filter(u=>u.side==='enemy').length} ${document.querySelector('#limitTxt').textContent}`;});
    console.log(st, ((Date.now()-t0)/1000).toFixed(0)+'s');
    if (await p.isVisible('#endModal')) { res = await p.$eval('#endDlg h2', h=>h.textContent); break; }
  }
  console.log('RESULT', res, 'ERRS', errs.slice(0,3));
  await b.close();
})();
