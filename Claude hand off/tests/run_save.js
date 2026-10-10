/* 肉鸽存档（v0.42.2，规则对话）：大地图上自动存档；重开页面能继续；开新局 / 一局结束会清掉 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1400,height:900}});
  const errs = []; let bad = 0;
  const check = (label, ok, extra='') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`;
  /* localStorage 要有真实来源：用一个假网址，内容由 route 提供 */
  await ctx.route('**/*', r => r.request().url().startsWith('http://game.test/') ? r.fulfill({contentType:'text/html; charset=utf-8', body:html}) : r.abort());
  const open = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('http://game.test/'); await p.waitForTimeout(300); return p; };
  const closeDlgs = async p => { for (let i = 0; i < 6; i++){ if (!(await p.isVisible('#endModal'))) break; const k = await p.$('#endDlg [data-v="keep"], #endDlg [data-v="ok"]'); if (!k) break; await k.click(); await p.waitForTimeout(100); } };

  let p = await open();
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(200);
  await p.click('[data-v="近卫"]'); await p.waitForTimeout(100);
  await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(100);
  await closeDlgs(p);
  /* 走一步非战斗格（有的话），让存档里有移动过的状态 */
  p.evaluate(() => { const g = window.__game, N = g.RUN.map.nodes, md = g.moveDist(); const hit = [...md].filter(([k,d]) => d === 1 && N[k].type === 'empty')[0]; if (hit) g.runClickNode(hit[0]); });
  await p.waitForTimeout(500); await closeDlgs(p);
  const before = await p.evaluate(() => { const R = window.__game.RUN; return {id:R.runId, cur:R.cur, prop:R.prop, units:R.units.map(u => u.mech).join(), visited:[...R.visited].sort().join()}; });
  const saved = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('mecha-tactics-run-save')); } catch(e){ return null; } });
  check('大地图上有存档', !!(saved && saved.run && saved.run.runId === before.id), saved ? saved.v : '');
  await p.close();

  p = await open();
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(200);
  check('重开页面后问要不要继续', await p.isVisible('#endDlg [data-v="load"]'));
  await p.click('#endDlg [data-v="load"]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => { const R = window.__game.RUN; return {id:R.runId, cur:R.cur, prop:R.prop, units:R.units.map(u => u.mech).join(), visited:[...R.visited].sort().join(), isSet:R.visited instanceof Set, ok:document.querySelector('#rvQuit') !== null}; });
  check('读档后是同一局、位置和推进剂一样', after.id === before.id && after.cur === before.cur && after.prop === before.prop && after.units === before.units, JSON.stringify(after));
  check('走过的格子还原成 Set', after.isSet && after.visited === before.visited);
  check('读档后回到大地图', after.ok);
  const md = await p.evaluate(() => window.__game.moveDist().size);
  check('读档后可以继续走', md > 0, `可走 ${md} 格`);
  /* 进一场战斗：战斗中不存档，存档停在进战斗之前 */
  const cur0 = after.cur;
  p.evaluate(() => { const g = window.__game, N = g.RUN.map.nodes, md = g.moveDist(); const hit = [...md].filter(([k,d]) => d >= 1 && N[k].type === 'battle').sort((a,b) => a[1]-b[1])[0]; if (hit) g.runClickNode(hit[0]); });
  await p.waitForTimeout(800);
  const mid = await p.evaluate(() => ({inBattle: window.__game.level !== 'roguelike' || !!document.querySelector('#btnForm'), cur: window.__game.RUN.cur, saved: JSON.parse(localStorage.getItem('mecha-tactics-run-save')).run.cur}));
  check('战斗中存档停在进战斗之前', mid.saved === cur0 && mid.cur !== cur0, JSON.stringify(mid));
  await p.close(); p = await open();
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(200);
  await p.click('#endDlg [data-v="load"]'); await p.waitForTimeout(300);
  check('战斗中关掉再读档：回到战斗前的格子', await p.evaluate(c => window.__game.RUN.cur === c && !!document.querySelector('#rvQuit'), cur0));
  /* 放弃本局 → 存档删掉 */
  await p.click('#rvQuit'); await p.waitForTimeout(200); await p.click('#endDlg [data-v="y"]'); await p.waitForTimeout(400);
  check('一局结束后存档删掉', await p.evaluate(() => localStorage.getItem('mecha-tactics-run-save') === null));
  await p.close();

  p = await open();
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(200);
  check('没有存档时直接选分队', await p.isVisible('[data-v="近卫"]') && !(await p.isVisible('#endDlg [data-v="load"]')));
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
