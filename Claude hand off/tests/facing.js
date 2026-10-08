/* v0.38 朝向范围：反击只能打当前朝向范围内的敌人；主动攻击自动转向并锁定；被打不转身；狙击压制射击 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__game.startLevel('tut1')); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const g = window.__game, D = g.data, us = g.units, out = {};
    g.setSpeed(0.01);
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0;
    const A = (m, x, y, f) => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); u.facing = f; us.push(u); return u; };
    const E = (k, x, y, f) => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = f; us.push(u); return u; };
    // 远程机朝右，敌人贴在背后：不能反击；转到正面：可以
    const s3 = A('S3', 5, 5, 'right'), e1 = E('grunt', 4, 5, 'right');
    out.backNo = !g.bestCounter(s3, e1);
    s3.facing = 'left'; out.frontYes = !!g.bestCounter(s3, e1);
    // 近战：两侧也能反击，背后不行
    const b1 = A('B1', 8, 8, 'right'), e2 = E('grunt', 8, 9, 'up'), e3 = E('grunt', 7, 8, 'right');
    out.meleeSide = !!g.bestCounter(b1, e2) && !g.bestCounter(b1, e3);
    // 主动攻击：目标在背后也能打，打完锁定到能打到的朝向；被打的一方不转身
    s3.facing = 'right'; e1.hp = e1.maxHp = 999999;
    const w = s3.weapons.find(x => x.fire === 'direct' && x.unlock <= 1 && x.range[0] <= 1) || s3.weapons.find(x => x.fire === 'melee' && x.unlock <= 1);
    await g.battle(s3, w, e1, null, null);
    out.turned = s3.facing === 'left';
    out.defNoTurn = e1.facing === 'right';
    us.length = 0;
    // 压制射击：狙击朝右，敌人从右边走过来
    const sn = A('CB2', 2, 5, 'right');
    const f1 = E('grunt', 14, 5, 'left'), f2 = E('grunt', 14, 6, 'left'); f1.hp = f1.maxHp = 999999; f2.hp = f2.maxHp = 999999;
    const tiles1 = g.reach(f1, 9), dest1 = tiles1.find(t => t.x === 5 && t.y === 5);
    const ok1 = await g.moveWatched(f1, tiles1, dest1);
    out.ow1 = ok1 && f1.hp < 999999 && f1.x === 5 && f1.y === 5 && sn.owPhase === g.phaseNo;
    const tiles2 = g.reach(f2, 9), dest2 = tiles2.find(t => t.x === 6 && t.y === 6);
    await g.moveWatched(f2, tiles2, dest2);
    out.ow2once = f2.hp === 999999;
    out.abil = D.ALLY_T.find(t => t.mech === 'CB2').abilities.includes('overwatch');
    return out;
  });
  check('远程：背后的敌人不能反击，正面可以', r.backNo && r.frontYes, JSON.stringify(r));
  check('近战：两侧可以反击，背后不行', r.meleeSide);
  check('主动攻击：自动转到能打到目标的朝向并锁定', r.turned);
  check('被攻击的一方不再自动转身', r.defNoTurn);
  check('压制射击：第一个走进射界的敌人挨一发，打完继续走到终点', r.ow1);
  check('压制射击：每个敌方阶段只打一次', r.ow2once);
  check('狙击有「压制射击」', r.abil);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
