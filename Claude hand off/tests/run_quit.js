/* 肉鸽「撤退」和「放弃本局」：浏览器自带的确认弹窗一律当作被拦截（自动取消），按钮仍然要能用（Claude 维护） */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; let nativeDialogs = 0;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { nativeDialogs++; d.dismiss(); });
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  let bad = 0; const check = (label, ok, extra='') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(200);
  await p.click('[data-v="近卫"]'); await p.waitForTimeout(100);
  await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(100);
  for (let i = 0; i < 4; i++){ if (!(await p.isVisible('#endModal'))) break; const k = await p.$('#endDlg [data-v="keep"], #endDlg [data-v="ok"]'); if (!k) break; await k.click(); await p.waitForTimeout(100); }
  const node = await p.evaluate(() => { const g = window.__game, N = g.RUN.map.nodes, md = g.moveDist(); const hit = [...md].filter(([k,d]) => d >= 1 && N[k].type === 'battle').sort((a,b) => a[1]-b[1])[0]; return hit && hit[0]; });
  p.evaluate(k => window.__game.runClickNode(k), node); await p.waitForTimeout(500);
  await p.click('#btnForm'); await p.waitForTimeout(500);
  const dur0 = await p.evaluate(() => window.__game.RUN.dur);
  await p.click('#btnRestart'); await p.waitForTimeout(200);
  check('点「撤退」弹出游戏内确认框', await p.isVisible('#endDlg [data-v="y"]'));
  await p.click('#endDlg [data-v="n"]'); await p.waitForTimeout(200);
  check('取消后仍在战斗中', await p.evaluate(() => !window.__game.over));
  await p.click('#btnRestart'); await p.waitForTimeout(200); await p.click('#endDlg [data-v="y"]'); await p.waitForTimeout(800);
  const st = await p.evaluate(() => ({over: window.__game.over, hp: window.__game.RUN.dur}));
  check('确认撤退后判负、扣耐久', st.over && st.hp < dur0, `耐久 ${dur0} → ${st.hp}`);
  for (let i = 0; i < 10; i++){ if (!(await p.isVisible('#endModal'))) break; const k = await p.$('#endDlg [data-v="ok"], #endDlg [data-v="keep"], #endDlg [data-v]'); if (!k) break; await k.click(); await p.waitForTimeout(150); }
  check('回到大地图', await p.isVisible('#rvQuit'));
  await p.click('#rvQuit'); await p.waitForTimeout(200);
  check('点「放弃本局」弹出游戏内确认框', await p.isVisible('#endDlg [data-v="y"]'));
  await p.click('#endDlg [data-v="n"]'); await p.waitForTimeout(200);
  check('取消后本局还在', await p.evaluate(() => !window.__game.RUN.over) && await p.isVisible('#rvQuit'));
  await p.click('#rvQuit'); await p.waitForTimeout(200); await p.click('#endDlg [data-v="y"]'); await p.waitForTimeout(400);
  check('确认放弃后本局结束', await p.evaluate(() => window.__game.RUN.over));
  check('没有用到浏览器自带弹窗', nativeDialogs === 0, `(${nativeDialogs})`);
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
