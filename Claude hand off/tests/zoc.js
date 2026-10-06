/* v0.36 控制区（ZOC）：走进敌方相邻格要停；尖兵、隐形机无视；空中机体、召唤物没有控制区 */
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
  await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.__game; g.setSpeed(0.01); g.runBattle('battle', 'ISW-1-N-1'); });
  await p.waitForTimeout(500); await p.click('#btnForm', {timeout:3000}).catch(() => {});
  await p.waitForFunction(() => window.__game.units.some(u => u.side === 'enemy'), null, {timeout:8000}).catch(() => {});
  const r = await p.evaluate(() => {
    const g = window.__game, D = g.data, map = g.map, us = g.units;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) map[y][x] = 'plain';
    g.walls.clear && g.walls.clear();
    us.length = 0;
    const T = m => D.ALLY_T.find(t => t.mech === m);
    const foe = (k, x, y) => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); us.push(u); return u; };
    // 敌人一排：(7,3) (7,5) (7,7)，缝 (7,4) (7,6) 都是控制区
    const e1 = foe('grunt', 7, 3), e2 = foe('grunt', 7, 5), e3 = foe('grunt', 7, 7);
    const has = (list, x, y) => list.find(t => t.x === x && t.y === y);
    const ally = m => { const u = g.makeUnit(T(m), 'ally', 4, 5); u.flying = false; u.mov = 6; us.push(u); return u; };
    const out = {};
    const a = ally('B1');
    let R = g.reach(a);
    out.gapZoc = !!(has(R, 7, 4) && has(R, 7, 4).zoc);
    out.blocked = !has(R, 8, 4);
    out.freeNoZoc = !!has(g.reach(a, 6, {zoc:false}), 8, 4);
    us.splice(us.indexOf(a), 1);
    const s = ally('B2'); R = g.reach(s);
    out.scout = !!has(R, 8, 4) && !R.some(t => t.zoc);
    us.splice(us.indexOf(s), 1);
    // 空中敌人、召唤物没有控制区
    const a2 = ally('B1');
    e1.flying = true; e2.flying = true; e3.flying = true;
    out.airNone = !!has(g.reach(a2), 8, 4);
    e1.flying = e2.flying = e3.flying = false;
    [e1, e2, e3].forEach(e => e.abilities.push('summon'));
    out.summonNone = !!has(g.reach(a2), 8, 4);
    [e1, e2, e3].forEach(e => e.abilities.pop());
    // 起点在控制区里可以离开
    a2.x = 6; a2.y = 5; R = g.reach(a2);
    out.leave = !!has(R, 5, 5) && !!has(R, 3, 5);
    // 我方也给敌人控制区：敌人走不过我方
    const ea = g.makeUnit(D.ENEMY_T.grunt, 'enemy', 10, 5); ea.mov = 6; us.push(ea);
    a2.x = 8; a2.y = 3;   // 我方占在敌方线后，敌人从 (10,5) 往左
    out.enemyStops = g.reach(ea).some(t => t.zoc);
    out.droneSummon = D.ENEMY_T.drone.abilities.includes('summon') && D.ENEMY_T.swarm.abilities.includes('summon');
    out.scoutAbil = T('B2').abilities.includes('zocFree') && !T('B1').abilities.includes('zocFree');
    return out;
  });
  check('敌人之间的缝是控制区', r.gapZoc, JSON.stringify(r));
  check('近卫穿不过敌人一排（走到缝里就停）', r.blocked && r.freeNoZoc);
  check('尖兵无视控制区', r.scout);
  check('空中敌人没有控制区', r.airNone);
  check('召唤物没有控制区', r.summonNone);
  check('起点在控制区里可以正常离开', r.leave);
  check('我方单位也给敌人控制区', r.enemyStops);
  check('无人机 / 蜂群是召唤物；尖兵有「渗透」', r.droneSummon && r.scoutAbil);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
