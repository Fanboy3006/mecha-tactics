/* v0.40.19 流星小队（原预防者）：五人、改名、单独行动、全图部署、卡托尔近卫、五飞拉人、希罗双联破坏步枪 3×6（斜向连成一片）；影凤凰斜向连成一片 */
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
  await p.evaluate(() => window.__game.startLevel('trial_W1')); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0; g.setSpeed(0.01);
    const A = (m, x, y, lv = 20, face = 'right') => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const E = (k, x, y, face = 'left') => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = face; us.push(u); return u; };
    const squad = D.ALLY_T.filter(t => t.tags.势力 === '流星小队');
    out.squad = squad.map(t => t.mech).join(',');
    out.noOld = !D.ALLY_T.some(t => t.tags.势力 === '预防者' || t.mech === 'W6' || t.mech === 'W7');
    out.noSupport = squad.every(t => t.tags.战斗分类 !== '指挥');
    out.quatre = D.ALLY_T.find(t => t.mech === 'W4').tags.战斗分类;
    out.tier = ['W1','W2','W3','W4','W5'].map(m => g.tierOf(m)).join('');
    out.global = squad.every(t => t.abilities.includes('globalDeploy'));
    out.group = [...document.querySelectorAll('#levelSel optgroup')].some(o => o.label.includes('流星小队'));
    // 单独行动
    const he = A('W1', 5, 6), foe = E('shield', 9, 6);
    const rifle = he.weapons.find(w => w.name.startsWith('破坏步枪'));
    out.alone1 = C.isAlone(he); const d1 = g.damageCalc(he, rifle, foe, {}).dmg, h1 = g.forecast(foe, foe.weapons[0], he, null).hit;
    const du = A('W2', 6, 7); out.alone2 = C.isAlone(he); const d2 = g.damageCalc(he, rifle, foe, {}).dmg, h2 = g.forecast(foe, foe.weapons[0], he, null).hit;
    out.lone = [d1, d2, h1, h2];
    // 双联破坏步枪 3×6 = 18 格，斜向连成一片
    us.length = 0;
    const h2u = A('W1', 10, 6);
    const tw = h2u.weapons.find(w => w.name === '双联破坏步枪'), dirs = g.mapDirs(h2u, tw);
    const right = dirs.find(d => d.dx === 1 && d.dy === 0), diag = dirs.find(d => d.dx === 1 && d.dy === 1);
    const conn = path => { const S = new Set(path.map(([x,y]) => x + ',' + y)), seen = new Set([[...S][0]]), st = [[...S][0]]; while (st.length){ const [x,y] = st.pop().split(',').map(Number); for (const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const k = (x+a) + ',' + (y+b); if (S.has(k) && !seen.has(k)){ seen.add(k); st.push(k); } } } return seen.size === S.size; };
    out.beam = [right.path.length, diag.path.length, new Set(diag.path.map(String)).size, conn(diag.path)];
    // 影凤凰：斜向冲刺路径连成一片
    const rk = A('B2', 3, 3);
    const ph = rk.weapons.find(w => w.name === '影凤凰'), pd = g.mapDirs(rk, ph).find(d => d.dx === 1 && d.dy === 1);
    out.phoenix = [pd.path.length, conn(pd.path)];
    // 五飞拉人
    us.length = 0;
    const wu = A('W5', 3, 6), t5 = E('grunt', 7, 6); t5.hp = t5.maxHp = 999999;
    const claw = wu.weapons.find(w => w.name === '龙爪');
    out.clawRange = g.canHit(wu, claw, t5);
    const R = Math.random; Math.random = () => 0; await C.strike(wu, claw, t5); Math.random = R;
    out.pulled = t5.x;
    return out;
  });
  check('流星小队五人：W1–W5', r.squad === 'W1,W2,W3,W4,W5', r.squad);
  check('没有「预防者」、杰克斯、诺茵', r.noOld === true);
  check('流星小队没有指挥（卡托尔改近卫）', r.noSupport === true && r.quatre === '近卫', r.quatre);
  check('档位：希罗精锐，其余骨干', r.tier === 'SAAAA', r.tier);
  check('五人都能全图部署', r.global === true);
  check('机体展示有「流星小队」分组', r.group === true);
  check('单独行动：2 格内没有友军时成立，有友军就不成立', r.alone1 === true && r.alone2 === false);
  check('单独行动：伤害更高、敌人命中更低', r.lone[0] > r.lone[1] && r.lone[2] < r.lone[3], JSON.stringify(r.lone));
  check('双联破坏步枪：横向 3×6 = 18 格', r.beam[0] === 18, r.beam[0]);
  check('双联破坏步枪：斜向也是 18 格且连成一片', r.beam[1] === 18 && r.beam[2] === 18 && r.beam[3] === true, JSON.stringify(r.beam));
  check('影凤凰：斜向冲刺路径连成一片', r.phoenix[1] === true, JSON.stringify(r.phoenix));
  check('五飞龙爪 4 格外也能抓', r.clawRange === true);
  check('五飞龙爪把目标拉到身边', r.pulled === 4, r.pulled);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
