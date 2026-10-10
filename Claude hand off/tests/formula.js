/* v0.37 伤害公式：（威力 − 装甲）× 系数（攻击能力值 − 防御值）；v0.42 系数 = x>0 ? 1+3x/(x+200) : 1+x/100，命中后最少 10；暴击威力 ×2；赌神 ×4 */
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
  const r = await p.evaluate(() => {
    const K = x => x > 0 ? 1 + 3 * x / (x + 200) : 1 + x / 100;
    const g = window.__game, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0;
    const A = m => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', 3, 3); us.push(u); return u; };
    const E = (k, x = 4, y = 3) => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = 'left'; us.push(u); return u; };
    const b1 = A('B1'), w = b1.weapons.find(x => x.fire === 'melee' && x.unlock <= 1 && !x.special);
    const grunt = E('grunt');
    const atk = b1.melee, W = g.wPow(b1, w), Ar = grunt.armor, Df = grunt.defense;
    const exp = Math.max(10, Math.round(Math.max(0, W - Ar) * K(atk + 100 - Df)));   // 近卫打杂兵：压制杂兵 +100
    const c = g.damageCalc(b1, w, grunt, {zone:'front'});
    out.base = {exp, got:c.dmg, W, Ar, atk, Df};
    out.disp = g.dispPow(b1, w) === Math.round(W * K(atk));
    const cc = g.damageCalc(b1, w, grunt, {zone:'front', crit:true});
    out.crit = cc.dmg === Math.max(10, Math.round(Math.max(0, W * 2 - Ar) * K(atk + 100 - Df)));
    // 保底 10：防御值远高于攻击
    grunt.defense = 1000; out.floor = g.damageCalc(b1, w, grunt, {zone:'front'}).dmg === 10; grunt.defense = Df;
    // 防御姿态：防御值 +50
    const dg = g.damageCalc(b1, w, grunt, {zone:'front', reaction:'defend'}).dmg;
    out.defend = dg === Math.max(10, Math.round(Math.max(0, W - Ar) * K(atk + 100 - Df - 50)));
    // 属性：防御、觉醒，没有技量
    out.stats = b1.defense > 0 && b1.awaken === 140 && b1.skill === undefined && grunt.defense > 0;
    // 两项属性相加
    const w2 = {...w, stat:'格斗+觉醒', statMul:2};
    out.dual = g.atkStat(b1, w2) === (b1.melee + b1.awaken) * 2;
    // 赌神：响介 Lv10，未命中时 50% 改为 ×4 暴击
    const a1 = A('A1'); for (let i = 1; i < 10; i++) g.levelUp(a1);
    out.gambler = a1.trait === 'gambler' && !!D.ABIL.gambler;
    const aw = a1.weapons.find(x => x.fire === 'melee' && !x.special);
    const g4 = g.damageCalc(a1, aw, grunt, {crit:true, critX:4, zone:'front'}).dmg, g2 = g.damageCalc(a1, aw, grunt, {crit:true, zone:'front'}).dmg;
    out.x4 = g4 > g2 * 1.9;
    return out;
  });
  check('基本公式：（威力 − 装甲）× 系数（攻击 − 防御）', r.base.exp === r.base.got, JSON.stringify(r.base));
  check('面板攻击力 = 威力 × 系数（攻击）', r.disp);
  check('暴击：武器威力 ×2', r.crit);
  check('命中后最少 10 点', r.floor);
  check('防御姿态：防御值 +50', r.defend);
  check('属性有防御、觉醒，没有技量', r.stats);
  check('格斗+觉醒 两项相加，再乘大招倍率', r.dual);
  check('响介的特技换成赌神；×4 暴击', r.gambler && r.x4);
  // 实战：赌神的未命中改判
  const real = await p.evaluate(async () => {
    const g = window.__game, D = g.data, us = g.units;
    const a1 = us.find(u => u.mech === 'A1'), e = g.makeUnit(D.ENEMY_T.grunt, 'enemy', a1.x + 1, a1.y); e.facing = 'left'; e.hp = e.maxHp = 999999; us.push(e);
    const w = a1.weapons.find(x => x.fire === 'melee' && !x.special);
    e.eva = 999;   // 命中率 0：一定未中
    const R = Math.random; Math.random = () => .1;   // 赌神 50% 触发
    g.setSpeed(0.01);
    await g.battle(a1, w, e, null, null);
    Math.random = R;
    return {lost: 999999 - e.hp, x4: g.damageCalc(a1, w, e, {crit:true, critX:4, zone:'front'}).dmg};
  });
  check('赌神实战：未命中改为 ×4 暴击', real.lost >= real.x4 * .9, JSON.stringify(real));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
