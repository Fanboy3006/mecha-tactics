/* v0.40.9 肉鸽出击武装：普通武装全部带上，★ 大招每台最多 1 个（点一下切换） */
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
  await p.evaluate(() => { const g = window.__game, R = g.RUN; R.units.length = 0; R.units.push({mech:'S1', lv:30}, {mech:'B1', lv:20}); g.setSpeed(0.01); g.STAGES['ISW-1-N-1'].obj = 'annihilate'; g.runBattle('battle', 'ISW-1-N-1'); });
  await p.waitForTimeout(700);
  const r0 = await p.evaluate(() => {
    const T = m => window.__game.data.ALLY_T.find(t => t.mech === m);
    const row = m => [...document.querySelectorAll('#endDlg [data-lo^="' + m + '|"], #endDlg .rv-btn')].filter(x => (x.dataset.lo || '').startsWith(m + '|'));
    const s1 = T('S1'), s1base = s1.weapons.filter(w => w.unlock < 20).length, s1ults = s1.weapons.filter(w => w.unlock >= 20 && w.unlock <= 30).length;
    const on = [...document.querySelectorAll('#endDlg .rv-btn.on')].length, disabledOn = [...document.querySelectorAll('#endDlg .rv-btn.on[disabled]')].length;
    return {s1base, s1ults, ultBtns: row('S1').length, on, disabledOn};
  });
  check('大招可以点、普通武装默认全带（不能取消）', r0.ultBtns === r0.s1ults && r0.disabledOn > 0, JSON.stringify(r0));
  // S1 换成另一个大招
  const ults = await p.$$('#endDlg [data-lo^="S1|"]');
  if (ults.length > 1){ await ults[1].click(); await p.waitForTimeout(200); }
  const sw = await p.evaluate(() => [...document.querySelectorAll('#endDlg [data-lo^="S1|"].on')].length);
  check('切换大招后仍然只带 1 个', sw === 1, String(sw));
  await p.click('#btnForm'); await p.waitForTimeout(600);
  const r = await p.evaluate(() => { const g = window.__game, all = [...g.units, ...g.HANGAR];
    return all.filter(u => u.side === 'ally').map(u => ({m:u.mech, ult:u.weapons.filter(w => w.unlock >= 20).length, base:u.weapons.filter(w => w.unlock < 20).length, need:g.data.ALLY_T.find(t => t.mech === u.mech).weapons.filter(w => w.unlock < 20).length})); });
  check('出击后：普通武装全在、大招最多 1 个', r.length && r.every(x => x.ult <= 1 && x.base === x.need), JSON.stringify(r));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
