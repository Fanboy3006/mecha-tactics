/* 模式切换（Claude 维护）：默认进入肉鸽；肉鸽打到一半切去别的模式，再切回来要接着打同一战；肉鸽对话框开着时不能切。 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  await p.waitForTimeout(300);
  check('开场先显示模式选择（推荐肉鸽）', await p.isVisible('#titleRun') && await p.isVisible('#endDlg [data-v="tut1"]') && await p.isVisible('#endDlg [data-v="story"]'));
  await p.click('#titleRun'); await p.waitForTimeout(300);
  check('选肉鸽后进入肉鸽开局', await p.evaluate(() => document.querySelector('#levelSel').value === 'roguelike') && await p.isVisible('#endDlg [data-v="近卫"]'));
  const groups = await p.evaluate(() => [...document.querySelectorAll('#levelSel optgroup')].map(g => g.label));
  check('下拉菜单分三大类', groups[0].includes('肉鸽') && groups[1].includes('剧情模式（待施工）') && groups.slice(2, -1).every(g => g.startsWith('机体展示')) && groups[groups.length-1] === '工具', groups.join(' / ') + JSON.stringify([groups[0].includes('肉鸽'), groups[1], groups.slice(2,-1).every(g => g.startsWith('机体展示')), groups[groups.length-1]]));
  // 开局
  await p.click('[data-v="近卫"]'); await p.waitForTimeout(100);
  await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(100);
  for (let i = 0; i < 4; i++){ if (!(await p.isVisible('#endModal'))) break; const k = await p.$('#endDlg [data-v="keep"], #endDlg [data-v="ok"]'); if (!k) break; await k.click(); await p.waitForTimeout(100); }
  // 在大地图上切走再切回
  const before = await p.evaluate(() => ({id: window.__game.RUN.runId, hope: window.__game.RUN.hope}));
  await p.selectOption('#levelSel', 'trial_U7'); await p.waitForTimeout(300);
  await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(200);
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({id: window.__game.RUN.runId, hope: window.__game.RUN.hope}));
  check('大地图：切走再回来还是同一局', before.id === after.id && await p.isVisible('#rvQuit'));
  // 进一场作战，打到第 2 回合再切走
  const node = await p.evaluate(() => { const g = window.__game, N = g.RUN.map.nodes, md = g.moveDist(); const hit = [...md].filter(([k,d]) => d >= 1 && N[k].type === 'battle').sort((a,b) => a[1]-b[1])[0]; return hit && hit[0]; });
  p.evaluate(k => window.__game.runClickNode(k), node); await p.waitForTimeout(500);
  await p.selectOption('#levelSel', 'tut1'); await p.waitForTimeout(200);
  check('编队界面开着时不能切走', await p.evaluate(() => document.querySelector('#levelSel').value === 'roguelike' && window.__game.level === 'run'));
  await p.click('#btnForm'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__game.setSpeed(0.02); window.__game.endTurn(); }); await p.waitForTimeout(4000);
  const mid = await p.evaluate(() => { const g = window.__game; const e = g.units.find(u => u.side === 'enemy'); e.hp = 1234; return {turn: g.turn, name: g.LV.name, n: g.units.length, code: g.LV.code}; });
  await p.selectOption('#levelSel', 'trial_B1'); await p.waitForTimeout(300);
  await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(200);
  check('切到机体展示', await p.evaluate(() => window.__game.level === 'trial_B1'));
  await p.selectOption('#levelSel', 'roguelike'); await p.waitForTimeout(400);
  const back = await p.evaluate(() => { const g = window.__game; return {turn: g.turn, name: g.LV.name, n: g.units.length, hp: g.units.some(u => u.side === 'enemy' && u.hp === 1234), lvl: g.level, runView: !document.querySelector('#runView').hidden}; });
  check('切回肉鸽：回到同一战、同一回合、敌人状态不变', back.lvl === 'run' && back.turn === mid.turn && back.name === mid.name && back.n === mid.n && back.hp && !back.runView, `${mid.code} 第 ${back.turn} 回合`);
  // 接着把这战撤退掉，确认流程还能走完
  await p.click('#btnRestart'); await p.waitForTimeout(200); await p.click('#endDlg [data-v="y"]'); await p.waitForTimeout(800);
  for (let i = 0; i < 10; i++){ if (!(await p.isVisible('#endModal'))) break; const k = await p.$('#endDlg [data-v="ok"], #endDlg [data-v="keep"], #endDlg [data-v]'); if (!k) break; await k.click(); await p.waitForTimeout(150); }
  check('恢复的那一战还能正常结算并回到大地图', await p.isVisible('#rvQuit'));
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
