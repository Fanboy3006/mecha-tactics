/* v0.32 关卡改造（Claude 维护）：敌人梯队、难度曲线、坚守 / 斩首 / 突破三种目标 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const start = async (obj) => {
    const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
    await p.route('**/*', r => r.abort());
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
    await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
    await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
    await p.evaluate(obj => { const g = window.__game; g.setSpeed(0.01); const code = 'ISW-1-N-1'; g.STAGES[code].obj = obj; g.runBattle('battle', code); }, obj);
    await p.waitForTimeout(500); await p.click('#btnForm', {timeout:3000}).catch(() => {});
    await p.waitForFunction(() => window.__game.units.some(u => u.side === 'enemy'), null, {timeout:8000}).catch(() => {});
    await p.waitForTimeout(300);
    return p;
  };
  // 梯队与曲线
  let p = await start('annihilate');
  const comp = await p.evaluate(() => { const g = window.__game; return {cap:g.LV.maxDeploy, foes:g.units.filter(u => u.side === 'enemy').map(u => `${u.mech}:${u.lv}`), w2:g.LV.waves[1] && g.LV.waves[1].enemies.map(e => `${e.t}:${e.lv}`), lv:g.LV.waves[0].lv}; });
  check('第 1 层第 1 场：杂兵 4 + 精锐 1（精锐 Lv2）；第 2 波有头目（Lv3）', comp.foes.length === 5 && comp.w2 && comp.w2.some(s => /:3$/.test(s)), JSON.stringify(comp));
  check('初始出击上限 4', comp.cap === 4);
  check('头目带范围护壁（范围 −50%）', await p.evaluate(() => window.__game.data.ENEMY_T.captain.weak.范围 === -50));
  await p.close();
  // 坚守
  p = await start('survive');
  const rsp = await p.evaluate(async () => { const g = window.__game, n0 = g.units.filter(u => u.side === 'enemy').length; g.setTurn(2); await g.endTurn(); for (let i = 0; i < 80 && g.turn < 3; i++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 300)); return {n0, n1:g.units.filter(u => u.side === 'enemy').length, turn:g.turn}; });
  check('坚守：第 3 回合有增援', rsp.n1 > rsp.n0 - 2 && rsp.turn === 3, JSON.stringify(rsp));
  const sv = await p.evaluate(async () => { const g = window.__game; const t0 = g.LV.victory.type; g.setTurn(6); await g.endTurn(); for (let i = 0; i < 80 && !g.over; i++) await new Promise(r => setTimeout(r, 100)); return {t0, over:g.over, turn:g.turn}; });
  check('坚守：撑过 6 回合就胜利', sv.t0 === 'survive' && sv.over, JSON.stringify(sv));
  await p.close();
  // 斩首
  p = await start('targets');
  const tg = await p.evaluate(() => { const g = window.__game, ts = g.units.filter(u => u.target); const n = ts.length, star = ts.every(u => u.badgeList && u.badgeList.length); ts.forEach(u => { u.hp = 0; }); g.checkEnd(); return {n, star, over:g.over, type:g.LV.victory.type}; });
  check('斩首：2 个带 ★ 的头目，打掉就胜利', tg.type === 'targets' && tg.n === 2 && tg.star && tg.over, JSON.stringify(tg));
  await p.close();
  // 突破
  p = await start('reach');
  const rc = await p.evaluate(() => { const g = window.__game, z = g.LV.zone, u = g.units.find(x => x.side === 'ally'); const before = g.over; u.x = z.x1; u.y = z.y0 + 1; g.checkEnd(); return {zone:!!z, before, over:g.over, type:g.LV.victory.type}; });
  check('突破：任意一台进入撤离区就胜利', rc.type === 'reachAny' && rc.zone && !rc.before && rc.over, JSON.stringify(rc));
  await p.close();
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
