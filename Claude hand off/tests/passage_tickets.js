/* v0.40.8 通往下一层的关口（出口 / 层底守军 / 终点）可以用招募券：对话框列出手上的券，用完回到关口对话框 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const g = window.__game; g.RUN.hope = 20; g.RUN.tickets.length = 0; window.__u0 = g.RUN.units.length; g.addTicket('狙击', '测试'); window.__pv = null; g.passageDlg('<h2>出口</h2>', '<button class="btn primary" data-v="go">前进</button>').then(v => { window.__pv = v; }); });
  await p.waitForTimeout(300);
  const has = await p.$('#endDlg [data-v="t:0"]');
  check('关口对话框列出手上的招募券', !!has);
  if (has){ await has.click(); await p.waitForTimeout(300); }
  const recruit = await p.$('#endDlg .rcard[data-v]:not([disabled])');
  check('点券进入招募 / 晋升', !!recruit);
  if (recruit){ await recruit.click(); await p.waitForTimeout(300); }
  const r = await p.evaluate(() => ({left: window.__game.RUN.tickets.length, added: window.__game.RUN.units.length - window.__u0, back: !!document.querySelector('#endDlg [data-v="go"]')}));
  check('用完回到关口对话框、券少了一张', r.left === 0 && r.added === 1 && r.back, JSON.stringify(r));
  await p.click('#endDlg [data-v="go"]'); await p.waitForTimeout(200);
  check('关口按钮照常返回', await p.evaluate(() => window.__pv === 'go'));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
