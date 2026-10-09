/* v0.40.10 月球王国重设计（角色对话）：Feena 只带一个技能、祝福升级、余响按队友实际攻击格延伸；阿布拉德铁壁领域；Iris 修理射程；Nagi 连射；苏菲牵引 + 拘束 + 重力网 */
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
  await p.evaluate(() => window.__game.startLevel('trial_M1')); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0;
    const A = (m, x, y, lv = 20, face = 'right') => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const E = (k, x, y, face = 'left') => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = face; us.push(u); return u; };
    // 档位与模板
    out.tier = [g.tierOf('M1'), g.tierOf('M2'), g.tierOf('M3'), g.tierOf('M4'), g.tierOf('M5')].join('');
    const nagiT = D.ALLY_T.find(t => t.mech === 'M4');
    out.nagiDirect = nagiT.weapons.filter(w => w.fire === 'direct').length;
    // Feena 只带一个技能
    const fe = A('M1', 3, 6);
    C.setPick('bless'); out.bless = (C.autoWeapon(fe) || {}).name;
    C.setPick('echo'); out.echo = (C.autoWeapon(fe) || {}).name;
    out.blessBuff = C.supBuff(fe, fe.weapons.find(w => w.name === '月光祝福'));
    out.canSwitch = C.canSwitchPick(fe);
    // 余响：Nagi 在 Feena 右边 2 格、朝右；她前方 6 格的格子在范围内，她背后 6 格不在（也超出 Feena 自己 4 格）
    const ng = A('M4', 5, 6);
    const ar = g.echoArea(fe), N = 40, has = (x, y) => ar.set.has(y * N + x);
    out.front = has(11, 6); out.behind = has(5, 12) === false && has(5, 0) === false;   // Nagi 正下方 / 正上方 6 格：不在朝向范围，也超出 Feena 4 格
    out.self4 = has(3, 2);
    out.minRange = has(7, 6);   // 距 Nagi 2 格：月光狙击枪最小 3，但掷弹筒 2–5 能打 → 在范围内
    ng.facing = 'left'; const ar2 = g.echoArea(fe); out.turned = !ar2.set.has(6 * N + 11);
    // 阿布拉德铁壁领域：不动时控制区 2 格
    us.length = 0;
    const ab = A('M2', 6, 6); const foe = E('grunt', 12, 6);
    const zs = g.zocSet(foe); out.zoc2 = zs.has(6 * N + 9) && zs.has(5 * N + 8);   // 2×2 本体右边第 2 格、右上斜角 2 步
    ab.movedThisRound = true; out.zocMoved = !g.zocSet(foe).has(6 * N + 9);
    // Iris Lv20 修理射程 1–2
    us.length = 0;
    const ir = A('M3', 3, 3), mate = A('M2', 5, 3); mate.hp = 1000;
    out.heal2 = C.healTargets(ir, ir.weapons.find(w => w.fire === 'heal')).includes(mate);
    // Nagi 连射：预测是多段，惩罚 Lv20 起 55
    us.length = 0;
    const n2 = A('M4', 3, 6), tgt = E('fortress', 8, 6);
    const f = g.forecast(n2, n2.weapons[0], tgt, null);
    out.chainFc = !!f.multi && String(f.hits).includes('连射') && f.expHits > 0;
    out.step = [C.chainStepOf(n2, n2.weapons[0])];
    const n1 = A('M4', 3, 9, 10); out.step.push(C.chainStepOf(n1, n1.weapons[0]));
    return out;
  });
  check('档位：Feena 精锐、阿布拉德 / Iris 骨干、Nagi / 苏菲 普通', r.tier === 'SAABB', r.tier);
  check('Nagi 只有一把直射武器', r.nagiDirect === 1, r.nagiDirect);
  check('Feena 带祝福时只放祝福', r.bless === '月光祝福', r.bless);
  check('Feena 带余响时只放余响', r.echo === '残月的余响', r.echo);
  check('月光祝福 Lv20 加防御、暴击', r.blessBuff.def === 20 && r.blessBuff.crit === 10, JSON.stringify(r.blessBuff));
  check('第 1 回合可以切换携带技能', r.canSwitch === true);
  check('余响：Nagi 朝向前方打得到的格子在范围内', r.front === true);
  check('余响：Nagi 背后打不到的格子不在范围内', r.behind === true);
  check('余响：Feena 自身 4 格仍在范围内', r.self4 === true);
  check('余响：近处由掷弹筒覆盖', r.minRange === true);
  check('余响：Nagi 转身后前方那格就不在范围内了', r.turned === true);
  check('铁壁领域：阿布拉德不动时控制区 2 格', r.zoc2 === true);
  check('铁壁领域：移动过就恢复 1 格', r.zocMoved === true);
  check('Iris Lv20 修理射程 1–2', r.heal2 === true);
  check('Nagi 连射的战斗预测', r.chainFc === true);
  check('残心：Lv20 惩罚 −55，Lv10 −70', r.step[0] === 55 && r.step[1] === 70, JSON.stringify(r.step));

  // 连射实战：随机数固定为 0 → 每枪都中，直到命中率降到 0
  await p.evaluate(() => window.__game.startLevel('trial_M4')); await p.waitForTimeout(300);
  const r2 = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0; g.setSpeed(0.01);
    const A = (m, x, y, lv = 20) => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = 'right'; us.push(u); return u; };
    const E = (k, x, y) => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = 'left'; us.push(u); return u; };
    const n = A('M4', 3, 6), t = E('fortress', 8, 5); t.hp = t.maxHp = 999999;
    const R = Math.random; Math.random = () => 0;
    await C.strike(n, n.weapons[0], t);
    Math.random = R;
    out.shots = t.maxHp - t.hp > 0 ? (document.querySelector('#log').textContent.match(/连射命中 (\d+) 枪/) || [])[1] : 0;
    // 苏菲：牵引锚拉人 + 拘束；重力网减速
    us.length = 0;
    const so = A('M5', 3, 6), e1 = E('grunt', 8, 6); e1.hp = e1.maxHp = 99999;
    Math.random = () => 0; await C.strike(so, so.weapons[0], e1); Math.random = R;
    out.pulled = e1.x < 8; out.bind = e1.buffs.some(b => b.def === -20);
    const e2 = E('grunt', 6, 8), mov0 = C.effMov(e2);
    const net = so.weapons.find(w => w.name === '重力网'), dirs = g.mapDirs(so, net);
    const box = dirs.find(d => d.box[0] === 6 && d.box[1] === 8);
    out.box = !!box && box.path.length === 4 && box.hit.includes(e2);
    await C.mapAttack(so, net, box);
    out.slow = C.effMov(e2) === mov0 - 2;
    return out;
  });
  check('连射：每枪都中时会连开多枪', +r2.shots >= 2, r2.shots);
  check('苏菲牵引锚把敌人拉近', r2.pulled === true);
  check('拘束：被拉的敌人防御 −20', r2.bind === true);
  check('重力网：点格子当左上角，2×2 区域', r2.box === true);
  check('重力网：命中后移动力 −2', r2.slow === true);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
