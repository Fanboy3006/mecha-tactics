/* v0.41.4 克莱因派重设计（角色对话）：SEED 觉醒值成长、触发、闪避 / 防御加成；拉克丝无上限；卡嘉莉号令与奥布之狮；史黛拉暴走；人员五人 */
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
  await p.evaluate(() => window.__game.startLevel('trial_S1')); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0;
    const A = (m, x, y, lv = 20, face = 'right') => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const E = (k, x, y, lv = 1, face = 'left') => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const ks = D.ALLY_T.filter(t => t.tags.势力 === '克莱因派');
    out.roster = ks.map(t => `${t.mech}${t.pilot}${t.tags.战斗分类}${g.tierOf(t.mech)}`).join(' ');
    out.awaken = ks.map(t => t.awaken).join(',');
    out.allSeed = ks.every(t => t.abilities.includes('seed'));
    // 成长与触发
    const lx = A('S1', 2, 2), lu = A('S3', 2, 4), st = A('S5', 2, 6), cg = A('S2', 10, 10);
    const e = E('grunt', 6, 4, 2);
    const aw0 = C.awakenOf(lu);
    const hit0 = C.hitRate(e, e.weapons[0], lu, null).hit;
    out.add1 = C.addAwaken(lu, 30); out.seed1 = C.seedActive(lu);
    out.add2 = C.addAwaken(lu, 30); out.seed2 = C.seedActive(lu); out.add3 = C.addAwaken(lu, 5);
    out.luGain = C.awakenOf(lu) - aw0;
    const hit1 = C.hitRate(e, e.weapons[0], lu, null).hit;
    out.evaDrop = hit0 - hit1; out.evaWant = Math.round(C.awakenOf(lu) * .15);
    // 拉克丝无上限
    C.addAwaken(lx, 60); C.addAwaken(lx, 20); out.lxGain = C.awGain(lx); out.lxSeed = C.seedActive(lx);
    // 史黛拉：重装加防御，不加闪避；强化人上限 5；毁灭 SEED 后不伤友军
    const w0 = st.weapons.find(w => w.name === '光束翼刃');
    const d0 = g.damageCalc(e, e.weapons[0], st).dmg, h0 = C.hitRate(e, e.weapons[0], st, null).hit;
    const boom = st.weapons.find(w => w.name === '毁灭·全方位炮击');
    out.iffBefore = C.mapIff(st, boom); out.ext0 = C.extMax(st);
    C.addAwaken(st, 50);
    out.stDef = C.seedDefOf(st); out.stWant = Math.round(C.awakenOf(st) * .25);
    out.stDmgDrop = d0 > g.damageCalc(e, e.weapons[0], st).dmg; out.stHitSame = h0 === C.hitRate(e, e.weapons[0], st, null).hit;
    out.iffAfter = C.mapIff(st, boom); out.ext1 = C.extMax(st);
    // 回合成长：第 2 回合起 +5，奥布之狮 4 格内 +1（卡嘉莉在 (10,10)，伊萨克放她旁边）
    const ik = A('S4', 11, 10), far = A('S3', 0, 13);
    g.setTurn(1); C.emit('phaseStart', {side:'ally', turn:1}); out.t1 = C.awGain(ik);
    g.setTurn(2); C.emit('phaseStart', {side:'ally', turn:2}); out.t2near = C.awGain(ik); out.t2far = C.awGain(far); out.t2cg = C.awGain(cg);
    // 击破：克莱因派击破 → 在场克莱因派每人 +3；非克莱因派击破不加
    const ikB = C.awGain(ik); C.emit('unitDestroyed', {unit:e, by:ik}); out.kill = C.awGain(ik) - ikB;
    const fe = A('M1', 12, 12); const ikC = C.awGain(ik); C.emit('unitDestroyed', {unit:e, by:fe}); out.killOther = C.awGain(ik) - ikC;
    // 号令：全图我方（含别的势力）+5；卡嘉莉 SEED 后 +8
    const call = cg.weapons.find(w => w.name === '奥布之狮的号令');
    const feB = C.awGain(fe); C.awakenCall(cg, call); out.callFe = C.awGain(fe) - feB;
    C.addAwaken(cg, 50); const feC = C.awGain(fe); C.awakenCall(cg, call); out.callSeed = C.awGain(fe) - feC;
    out.feAwakenStat = C.awakenOf(fe) - fe.awaken;
    // 奥布之狮 SEED 后光环：4 格内友军受到伤害减少
    const e2 = E('grunt', 13, 10, 2); us.forEach(u => { u.buffs = []; });
    out.orb = g.damageCalc(e2, e2.weapons[0], ik).steps.join(' ').includes('减伤');
    // 参照伤害
    us.length = 0;
    const ref = {};
    const g2 = E('grunt', 8, 2, 2), sh = E('shield', 8, 4, 12);
    const at = (m, lv, wn, t, gain = 0) => { const u = A(m, 4, 2, lv); if (gain) C.addAwaken(u, gain); const w = u.weapons.find(w => w.name === wn); return g.damageCalc(u, w, t).dmg; };
    ref.cgRifle = at('S2', 10, '光束步枪', g2); ref.stWing = at('S5', 10, '光束翼刃', g2); ref.luCannon = at('S3', 10, '炮装·高能光束炮', g2); ref.ikSaber = at('S4', 10, '光束军刀', g2);
    ref.meteor = at('S1', 20, 'METEOR 全弹发射', sh); ref.meteorSeed = at('S1', 20, 'METEOR 全弹发射', sh, 50); ref.meteor100 = at('S1', 20, 'METEOR 全弹发射', sh, 100);
    ref.boom = at('S5', 20, '毁灭·全方位炮击', sh); ref.boomSeed = at('S5', 20, '毁灭·全方位炮击', sh, 50);
    out.ref = ref;
    return out;
  });
  console.log(JSON.stringify(r));
  check('克莱因派五人：拉克丝精锐、卡嘉莉骨干指挥、史黛拉骨干重装、露娜普通狙击、伊萨克普通近卫', r.roster === 'S1拉克丝特种S S2卡嘉莉指挥A S3露娜玛丽亚狙击B S4伊萨克近卫B S5史黛拉重装A', r.roster);
  check('觉醒初值：拉克丝 90，其他 70；全员有 SEED', r.awaken === '90,70,70,70,70' && r.allSeed, r.awaken);
  check('累计 +50 才觉醒，之后不再成长', r.add1 === 30 && !r.seed1 && r.add2 === 20 && r.seed2 && r.add3 === 0 && r.luGain === 50, `${r.add1}/${r.add2}/${r.add3}`);
  check('SEED 后闪避 + 觉醒 × 0.15', r.evaDrop === r.evaWant && r.evaWant > 0, `命中降 ${r.evaDrop}，应为 ${r.evaWant}`);
  check('拉克丝觉醒无上限', r.lxGain === 80 && r.lxSeed, `+${r.lxGain}`);
  check('重装 SEED：防御 + 觉醒 × 0.25，不加闪避', r.stDef === r.stWant && r.stDmgDrop && r.stHitSame, `防御 +${r.stDef}`);
  check('史黛拉暴走：强化人上限 3 → 5，毁灭不伤友军', !r.iffBefore && r.iffAfter && r.ext0 === 3 && r.ext1 === 5);
  check('第 1 回合不涨，第 2 回合 +5；奥布之狮 4 格内 +1', r.t1 === 0 && r.t2near === 6 && r.t2far === 5 && r.t2cg === 5, `${r.t1}/${r.t2near}/${r.t2far}/${r.t2cg}`);
  check('克莱因派击破 +3，别的势力击破不加', r.kill === 3 && r.killOther === 0);
  check('号令：全图我方觉醒 +5（别的势力也吃），卡嘉莉 SEED 后 +8', r.callFe === 5 && r.callSeed === 8, `${r.callFe}/${r.callSeed}`);
  check('奥布之狮 SEED 后光环减伤', r.orb);
  check('没有页面错误', !errs.length, errs.join(' | '));
  console.log(bad ? `${bad} 项失败` : '全部通过');
  await b.close(); process.exit(bad ? 1 : 0);
})();
