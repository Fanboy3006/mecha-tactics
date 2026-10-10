/* v0.41.8 雷萨的传送斩也加反噬（+25，和传送共用），反噬 ≥100 时不能用 */
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
  await p.evaluate(() => window.__game.startLevel('trial_B1')); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0; g.setSpeed(0.01);
    const u = g.makeUnit(D.ALLY_T.find(t => t.mech === 'B1'), 'ally', 3, 6); for (let i = 1; i < 20; i++) g.levelUp(u); us.push(u);
    const t = g.makeUnit(D.ENEMY_T.fortress, 'enemy', 6, 6); t.hp = t.maxHp = 999999; us.push(t);
    const w = u.weapons.find(x => x.special === 'gamble');
    out.b0 = u.backlash || 0;
    const R = Math.random; Math.random = () => 0.9999; await C.strike(u, w, t); Math.random = R;   // 打空也传送
    out.b1 = u.backlash;
    u.backlash = 100; out.locked = g.wStatus(u, w);
    u.backlash = 75; out.open = g.wStatus(u, w);
    return out;
  });
  check('传送斩用一次（打空也算）反噬 +25', r.b1 === r.b0 + 25, `${r.b0} → ${r.b1}`);
  check('反噬 ≥100 时传送斩不能用', String(r.locked).includes('反噬'), r.locked);
  check('反噬 75 时还能用', r.open === null || !String(r.open).includes('反噬'), String(r.open));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
