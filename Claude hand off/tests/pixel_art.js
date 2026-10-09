/* 美术 10-08：像素画素材接入检查。CH-01 截图 + 在空地上摆出精锐 / 骨干看效果；所有我方机体都能拿到像素精灵。截图存 tests/pixel_*.png（不进仓库） */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.waitForFunction(() => window.MechPixel && window.MechPixel.ready(), null, {timeout: 5000});
  check('像素素材加载完成', true);
  await p.evaluate(() => window.__game.startLevel('ch_01')); await p.waitForTimeout(400);
  await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(600);
  await p.screenshot({path: __dirname + '/pixel_ch01.png'});
  const r = await p.evaluate(() => {
    const g = window.__game, out = {miss: [], size: {}};
    for (const t of g.data.ALLY_T){
      const u = g.makeUnit(t, 'ally', 0, 0); u.facing = 'down';
      const c = g.unitSprite(u); if (!c) { out.miss.push(t.mech); continue; }
      out.size[t.mech] = c.width;
    }
    // 在空地上摆精锐和骨干（只为截图）
    const list = ['B1','M1','CB1','S1','W1','A1','U7','B2','M3','U2','CB2','CB4','S2','S5','W2','W3','W4','W5','A2','A3','U6'];
    let x = 1, y = 3; const free = (x, y) => g.map[y] && g.map[y][x] === 'plain' && !g.units.some(u => u.x === x && u.y === y);
    for (const m of list){
      const t = g.data.ALLY_T.find(t => t.mech === m); if (!t) continue;
      while (!free(x, y)) { x++; if (x > 24) { x = 1; y++; } }
      const u = g.makeUnit(t, 'ally', x, y); u.facing = ['down','right','up','left'][list.indexOf(m) % 4]; g.units.push(u); x += 2;
    }
    return out;
  });
  check('所有 1×1 我方机体都有像素精灵', r.miss.filter(m => !['CB5'].includes(m)).length === 0, '缺：' + r.miss.join(','));
  await p.waitForTimeout(500);
  await p.screenshot({path: __dirname + '/pixel_lineup.png'});
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
