/* 蓝色大肥鱼（敌方对话，17c）：每个敌方阶段向右 2 格、碾碎路线上的单位（敌我都算）、不能被拉推、
   右边缘碰到地图边就失败、走完放周身冲击、击破它就胜利。 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const open = async () => {
    const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
    await p.route('**/*', r => r.abort());
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
    await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
    await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const g = window.__game, st = g.STAGES['ISW-4-F-1']; g.setSpeed(0.01); g.RUN.layer = st.layer; g.runBattle('final', 'ISW-4-F-1'); });
    await p.waitForTimeout(500); await p.click('#btnForm', {timeout:3000}).catch(() => {});
    await p.waitForFunction(() => window.__game.units.some(u => u.side === 'enemy'), null, {timeout:8000}).catch(() => {});
    await p.waitForTimeout(300);
    return p;
  };
  const endTurn = p => p.evaluate(async () => { const g = window.__game, t0 = g.turn; g.S.mode = 'idle'; g.endTurn(); for (let i = 0; i < 400 && g.turn === t0 && !g.over; i++){ document.querySelectorAll('#reactModal:not([hidden]) [data-r], #reactModal:not([hidden]) [data-c], #reactModal:not([hidden]) [data-g]').forEach(x => x.click()); await new Promise(r => setTimeout(r, 30)); } return {turn:g.turn, over:g.over}; });

  /* 1. 前进 + 碾压 + 不能拉推 */
  let p = await open();
  const s0 = await p.evaluate(() => {
    const g = window.__game, f = g.units.find(u => u.key === 'bluefish'), a = g.units.find(u => u.side === 'ally');
    const lane = g.units.filter(u => u !== f && u.y + u.h > f.y && u.y < f.y + f.h && u.x >= f.x + f.w && u.x <= f.x + f.w + 1);
    a.x = f.x + f.w + 1; a.y = f.y + 1;   // 我方站在第 2 步要走的格子上
    const x0 = f.x;
    g.data && 0;
    return {x0, fx:f.facing, hp:f.hp, armor:f.armor, lane:lane.length, tier:f.key, ally:a.mech};
  });
  check('大肥鱼在场（3×3、HP ≥ 20 万）', s0.hp >= 200000, JSON.stringify(s0));
  await endTurn(p);
  const s1 = await p.evaluate(() => { const g = window.__game, f = g.units.find(u => u.key === 'bluefish'); return {x:f.x, facing:f.facing, allies:g.units.filter(u => u.side === 'ally').length, over:g.over, log:[...document.querySelectorAll('#log *')].map(e => e.textContent).filter(t => /碾|游到/.test(t)).slice(-3)}; });
  check('一个敌方阶段向右 2 格、朝右', s1.x === s0.x0 + 2 && s1.facing === 'right', JSON.stringify(s1));
  check('站在鱼道上的我方被碾碎（场上没人 → 判负）', s1.allies === 0 && s1.over, JSON.stringify(s1));
  await p.close();

  /* 2. 敌人挡路也被碾、不能被拉 / 推、到终点判负 */
  p = await open();
  const s2 = await p.evaluate(() => {
    const g = window.__game, f = g.units.find(u => u.key === 'bluefish'), a = g.units.find(u => u.side === 'ally');
    const foe = g.units.find(u => u.side === 'enemy' && u !== f && u.w === 1);
    foe.x = f.x + f.w; foe.y = f.y + 2; foe.guardZone = 99; foe.awake = false;   // 敌人挡在第 1 步
    a.x = f.x + 1; a.y = f.y - 2;   // 我方离开鱼道
    const x = f.x; return {x, foe:foe.uid};
  });
  await endTurn(p);
  const s3 = await p.evaluate(fid => { const g = window.__game; return {foeAlive:g.units.some(u => u.uid === fid)}; }, s2.foe);
  check('挡路的敌人也被碾碎', !s3.foeAlive, JSON.stringify(s3));
  const s4 = await p.evaluate(() => {
    const g = window.__game, f = g.units.find(u => u.key === 'bluefish'); const x = f.x;
    g.units.forEach(u => { if (u.side === 'ally') { u.x = 28; u.y = 1; } });
    f.x = g.LV.w - f.w - 2;   // 再走一回合就到终点
    return {x:f.x, w:g.LV.w};
  });
  await endTurn(p);
  const s5 = await p.evaluate(() => { const g = window.__game, f = g.units.find(u => u.key === 'bluefish'); return {x:f.x, over:g.over}; });
  check('右边缘碰到地图边就判负', s5.over && s5.x === s4.w - 3, JSON.stringify(s5));
  await p.close();

  /* 3. 不能被拉 / 推；击破就胜利 */
  p = await open();
  const s6 = await p.evaluate(() => {
    const g = window.__game, E = window.__enemy, f = g.units.find(u => u.key === 'bluefish'), a = g.units.find(u => u.side === 'ally');
    a.x = f.x + 6; a.y = f.y + 1; const x0 = f.x, y0 = f.y;
    E.pullUnit(a, f, 4); E.pushUnit(a, f, 4);
    const still = f.x === x0 && f.y === y0;
    f.hp = 0; E.destroy(f, a); g.checkEnd();
    return {still, over:g.over, foes:g.units.filter(u => u.key === 'bluefish').length};
  });
  check('不能被拉、推', s6.still, JSON.stringify(s6));
  check('击破大肥鱼 → 作战结束', s6.over && !s6.foes, JSON.stringify(s6));
  await p.close();

  console.log('ERRS', JSON.stringify(errs)); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
