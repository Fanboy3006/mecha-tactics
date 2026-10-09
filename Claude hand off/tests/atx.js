/* v0.40.11 ATX 重设计（角色对话）：响介精锐 + 赌徒的直觉（打空减冷却）、拉米亚烟雾弹 + 双势力、艾克赛琳好运加护（暴击倍率）、库斯哈念动迷彩 */
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
  await p.evaluate(() => window.__game.startLevel('trial_A1')); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0; g.setSpeed(0.01);
    const A = (m, x, y, lv = 20, face = 'right') => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const E = (k, x, y, face = 'left') => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = face; us.push(u); return u; };
    out.tier = ['A1','A2','A3','A4','A5'].map(m => g.tierOf(m)).join('');
    out.dual = g.ticketOk('影世界', 'A3') && g.ticketOk('ATX', 'A3') && !g.ticketOk('影世界', 'A2');
    out.groups = [...document.querySelectorAll('#levelSel optgroup')].filter(o => o.querySelector('option[value="trial_A3"]')).map(o => o.label);
    // 烟雾弹
    const la = A('A3', 3, 6), foe = E('grunt', 6, 6), mate = A('A4', 3, 9);
    const h0 = g.forecast(foe, foe.weapons[1], mate, null).hit;
    const sm = la.weapons.find(w => w.name === '烟雾弹'), box = g.mapDirs(la, sm).find(d => d.box[0] === 5 && d.box[1] === 5);
    await C.mapAttack(la, sm, box);
    out.smokeHp = foe.hp === foe.maxHp;
    const h1 = g.forecast(foe, foe.weapons[1], mate, null).hit;
    out.smoke = [h0, h1];
    // 好运加护：暴击倍率 +1
    us.length = 0;
    const ex = A('A2', 3, 6), a4 = A('A4', 4, 6), t = E('shield', 5, 6);
    const w = a4.weapons.find(x => x.name === '计都罗睺剑');
    const c0 = g.damageCalc(a4, w, t, {crit:true}).dmg;
    a4.buffs.push({src:'好运加护', ...C.supBuff(ex, ex.weapons.find(x => x.name === '好运加护'))});
    const c1 = g.damageCalc(a4, w, t, {crit:true}).dmg, n1 = g.damageCalc(a4, w, t, {}).dmg;
    out.crit = [c0, c1, n1];
    // 念动迷彩：3 格内敌机命中 −10
    us.length = 0;
    const vic = A('A4', 3, 6), en = E('grunt', 5, 6);
    const hv0 = g.forecast(en, en.weapons[1], vic, null).hit;
    A('A5', 4, 7);
    out.veil = [hv0, g.forecast(en, en.weapons[1], vic, null).hit];
    // 赌徒的直觉：场上打空 → 左轮打桩机冷却 −1
    us.length = 0;
    const ky = A('A1', 3, 6), ally = A('A4', 3, 9); ally.buffs.push({src:'测试', eva:200}); const e2 = E('grunt', 4, 9, 'left'), tgt = E('fortress', 4, 5);
    tgt.hp = tgt.maxHp = 999999;
    const rv = ky.weapons.find(x => x.name === '左轮打桩机');
    out.ready0 = g.readyTurnOf(ky, rv);
    const R = Math.random;
    Math.random = () => 0.9999; for (let i = 0; i < 4; i++) await C.strike(e2, e2.weapons[0], ally);
    out.ready4 = g.readyTurnOf(ky, rv); out.n4 = C.evadeN(ky);
    for (let i = 0; i < 9; i++) await C.strike(e2, e2.weapons[0], ally);
    out.n13 = C.evadeN(ky); out.cut = C.evadeCdCut(ky); out.wait = g.startWait(ky, rv);
    Math.random = () => 0; await C.strike(ky, rv, tgt);
    Math.random = R;
    out.cdAfter = rv.cdLeft;
    // 左轮打桩机：12–16 段、每段威力 500
    const shots = [...document.querySelectorAll('#log li')].map(l => l.textContent).find(t => t.includes('左轮打桩机') && t.includes(' 段命中 ')) || '';
    out.segs = +((shots.match(/：(\d+) 段命中/) || [])[1] || 0);
    out.rvPow = rv.power; out.rvMulti = rv.special === 'multi' && rv.hits === 12 && rv.hitsMax === 16;
    out.rvFc = String(g.forecast(ky, rv, tgt, null).hits);
    return out;
  });
  check('档位：响介精锐，艾克赛琳 / 拉米亚骨干，布鲁克林 / 库斯哈普通', r.tier === 'SAABB', r.tier);
  check('拉米亚同时算 ATX 和影世界（招募券）', r.dual === true);
  check('机体展示里拉米亚在 ATX 和影世界两组都有', r.groups.length === 2, JSON.stringify(r.groups));
  check('烟雾弹不造成伤害', r.smokeHp === true);
  check('烟雾弹：从烟雾里开火命中 −30', r.smoke[0] - r.smoke[1] === 30 || (r.smoke[1] === 0 && r.smoke[0] < 30), JSON.stringify(r.smoke));
  check('好运加护：暴击伤害按 ×3 算', r.crit[1] > r.crit[0] * 1.3, JSON.stringify(r.crit));
  check('念动迷彩：3 格内敌机命中 −10', r.veil[0] - r.veil[1] === 10, JSON.stringify(r.veil));
  check('左轮打桩机开场冷却 10 回合（第 11 回合可用）', r.ready0 === 11, r.ready0);
  check('场上打空 4 次 → 开场冷却 −4', r.ready4 === 7 && r.n4 === 4, `${r.ready4} / ${r.n4}`);
  check('打空 13 次 → 开场冷却清零，本身冷却再 −3', r.n13 === 13 && r.cut === 3 && r.wait === 0, `${r.n13} / ${r.cut} / ${r.wait}`);
  check('冷却减到 0 后用完不进冷却', r.cdAfter === 0, r.cdAfter);
  check('左轮打桩机：每段威力 500、12–16 段', r.rvPow === 500 && r.rvMulti === true, `${r.rvPow}`);
  check('左轮打桩机：实际打出 12–16 段', r.segs >= 12 && r.segs <= 16, r.segs);
  check('战斗预测显示 12–16 段', r.rvFc === '12–16', r.rvFc);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
