/* v0.41 射程形状：直射 3 宽 × 4–6（保留最小射程）、曲射 90° 扇形、援护者挡刀后可以反击（按原地朝向） */
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
  const r = await p.evaluate(() => {
    const g = window.__game; g.startLevel('rt_formula');
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[0].length; x++) g.map[y][x] = 'plain';
    const us = g.units; for (let i = us.length - 1; i >= 0; i--) if (us[i].side === 'enemy') us.splice(i, 1);
    const me = us.find(u => u.side === 'ally'); us.splice(0, us.length, me); me.x = 5; me.y = 6; me.facing = 'right';
    const at = (w, dx, dy) => g.canHit(me, w, {x:5+dx, y:6+dy, w:1, h:1, flying:false, side:'enemy', abilities:[], hp:1}, 5, 6, 'right');
    const rifle = {name:'t', fire:'direct', range:[1,5], upgrades:[]}, sn = {name:'s', fire:'direct', range:[3,9], upgrades:[]}, pistol = {name:'p', fire:'direct', range:[1,2], upgrades:[]};
    const mort = {name:'m', fire:'indirect', range:[2,4], upgrades:[]};
    return {
      rifle: [at(rifle,1,0), at(rifle,5,1), at(rifle,5,-1), !at(rifle,6,0), !at(rifle,3,2), !at(rifle,-1,0)],
      sniper: [!at(sn,2,0), at(sn,3,1), at(sn,6,-1), !at(sn,7,0)],
      pistol: [at(pistol,4,1), !at(pistol,5,0)],
      mortar: [!at(mort,1,0), at(mort,2,2), at(mort,4,-4), at(mort,3,0), !at(mort,4,5), !at(mort,5,0)],
    };
  });
  check('直射 1–5 → 3×5（前 1–5 格、左右各 1）', r.rifle.every(Boolean), JSON.stringify(r.rifle));
  check('狙击 3–9 → 3×6，3 格起', r.sniper.every(Boolean), JSON.stringify(r.sniper));
  check('短枪 1–2 → 3×4', r.pistol.every(Boolean), JSON.stringify(r.pistol));
  check('曲射 2–4 → 90° 扇形（第 N 格左右各 N 格，2 格起）', r.mortar.every(Boolean), JSON.stringify(r.mortar));
  // 援护反击
  const gr = await p.evaluate(async () => {
    const g = window.__game; g.startLevel('rt_overwatch'); await new Promise(r => setTimeout(r, 300));
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[0].length; x++) g.map[y][x] = 'plain';
    const us = g.units; for (let i = us.length - 1; i >= 0; i--) if (us[i].side === 'enemy' && us[i].mech !== '突击兵') us.splice(i, 1);
    const foe = us.find(u => u.side === 'enemy'); us.filter(u => u.side === 'enemy' && u !== foe).forEach(u => us.splice(us.indexOf(u), 1));
    const tank = us.find(u => u.mech === 'G4');
    tank.x = 8; tank.y = 6; tank.facing = 'right'; foe.x = 9; foe.y = 6; foe.facing = 'left';
    const hp0 = foe.hp, w = foe.weapons.find(x => x.fire === 'melee');
    g.setSpeed(0.01);
    await g.battle(foe, w, tank, 'defend', null, {guard:true});
    return {countered: foe.hp < hp0 || g.units.indexOf(foe) < 0, hp0, hp:foe.hp};
  });
  check('援护者挡刀后，在朝向范围内就反击', gr.countered, JSON.stringify(gr));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
