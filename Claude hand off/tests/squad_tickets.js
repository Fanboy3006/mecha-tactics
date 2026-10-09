/* v0.40.13 指挥官系统关闭（没有月之国分队）；分队偏重招募券：战后约一半是本分队的券，开局第 1 张是本分队的券 */
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
  check('没有月之国（指挥官）分队', !(await p.$('#endDlg [data-v="moon"]')) && !(await p.evaluate(() => window.__game.CMD_ENABLED)));
  await p.click('#endDlg [data-v="狙击"]'); await p.waitForTimeout(300);
  await p.click('#endDlg .rcard[data-v]'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const g = window.__game; const first = g.RUN.tickets[0]; let n = 0; for (let i = 0; i < 4000; i++) if (g.randTicket() === '狙击') n++; return {first, share: n / 4000}; });
  check('开局第 1 张是本分队的券', r.first === '狙击', JSON.stringify(r));
  check('战后约一半是本分队的券（含随机里抽到的约 5%）', r.share > .5 && r.share < .6, String(r.share));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
