/* v0.30 补给箱（Claude 维护）：肉鸽战斗里会生成补给箱，我方能攻击它，击破后获得源碳结晶或零件 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
  check('开局源碳结晶 20', await p.evaluate(() => window.__game.RUN.he === 20));
  await p.evaluate(() => { window.__game.setSpeed(0.01); window.__game.runBattle('battle'); });
  await p.waitForTimeout(500);
  await p.click('#btnForm', {timeout:3000}).catch(() => {});
  await p.waitForFunction(() => window.__game.units.some(u => u.chest), null, {timeout:8000}).catch(() => {});
  const info = await p.evaluate(() => { const g = window.__game, c = g.units.find(u => u.chest); return c ? {x:c.x, y:c.y, side:c.side, hp:c.hp} : null; });
  check('战斗里生成了补给箱', !!info, JSON.stringify(info));
  if (info){
    const r = await p.evaluate(async () => {
      const g = window.__game, c = g.units.find(u => u.chest), u = g.units.find(x => x.side === 'ally' && x.mech === 'B1');
      c.hp = 1; u.x = c.x - 1; u.y = c.y; u.moved = false; u.acted = false;
      const can = g.attackables(u).includes(c);
      const he0 = g.RUN.he, parts0 = g.RUN.chestParts || 0;
      g.onTile(u.x, u.y); g.onTile(u.x, u.y); g.choosePick(c); await g.onAction('fire');
      for (let i = 0; i < 40 && c.hp > 0; i++) await new Promise(r => setTimeout(r, 100));
      return {can, dead: c.hp <= 0, gain: g.RUN.he - he0, parts: (g.RUN.chestParts || 0) - parts0};
    });
    check('补给箱可以被我方攻击', r.can, JSON.stringify(r));
    check('击破后获得源碳结晶或零件', r.dead && (r.gain >= 3 || r.parts === 1), JSON.stringify(r));
  }
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
