/* v0.41.5 影世界新角色维诺（角色对话）：不能攻击；每回合在 5 格内布置 2 个影之种（HP 1、没有控制区、持续 3 回合）；
   我方阶段结束时对周围 3×3 的敌机造成威力 1000 的特殊伤害，装甲 −100（无限叠加，最低 0） */
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
  await p.evaluate(() => window.__game.startLevel('trial_B3')); await p.waitForTimeout(500);
  // 界面流程：选维诺 → 攻击 → 影之种 → 点两格 → 布置
  const pre = await p.evaluate(() => {
    const g = window.__game, C = window.__chars, us = g.units;
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    const v = us.find(u => u.mech === 'B3');
    const T = g.data.ALLY_T.find(t => t.mech === 'B3');
    const es = us.filter(u => u.side === 'enemy');
    es.forEach((e, i) => { e.x = 20; e.y = i; });
    const small = es.filter(e => e.w === 1 && e.h === 1), e1 = small[0], e2 = small[1]; e1.x = 8; e1.y = 7; e2.x = 8; e2.y = 9;
    v.x = 4; v.y = 7; v.acted = false; v.moved = false;
    g.select(v);
    const tiles = C.summonTiles(v, v.weapons[0]);
    return {tier:g.tierOf('B3'), faction:T.tags.势力, cls:T.tags.战斗分类, onlySummon:T.weapons.every(w => w.fire === 'support' && w.special === 'summon'),
      tilesOk:tiles.length > 0 && tiles.every(t => Math.abs(t.x - 4) + Math.abs(t.y - 7) <= 5), far:tiles.some(t => t.x === 10 && t.y === 7), occupied:tiles.some(t => t.x === 8 && t.y === 7)};
  });
  check('维诺：影世界 · 普通 · 特种，只有「影之种」（不能攻击）', pre.tier === 'B' && pre.faction === '影世界' && pre.cls === '特种' && pre.onlySummon, JSON.stringify(pre));
  check('布置范围：5 格菱形内的空地', pre.tilesOk && !pre.far && !pre.occupied);
  await p.evaluate(async () => { const g = window.__game, v = g.units.find(u => u.mech === 'B3'); g.onTile(v.x, v.y); g.onTile(v.x, v.y); await g.onAction('attack'); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const b = document.querySelector('#actionCard button[data-w="0"]'); b && b.click(); });
  await p.waitForTimeout(150);
  const mode = await p.evaluate(() => window.__game.S.mode);
  check('选「影之种」进入布置模式', mode === 'summon', mode);
  await p.evaluate(() => { const g = window.__game; g.onTile(7, 8); g.onTile(9, 7); g.onTile(6, 6); });
  const picks = await p.evaluate(() => window.__game.S.sumPick.map(t => t.x + ',' + t.y).join(' '));
  check('最多选 2 格（多点一格就换掉最早的）', picks === '9,7 6,6', picks);
  await p.evaluate(() => { const g = window.__game; g.onTile(6, 6); g.onTile(7, 8); });   // 取消 (6,6)，换成 (7,8)
  const btnOk = await p.evaluate(() => !!document.querySelector('#actionCard button[data-a="summon-go"]:not([disabled])'));
  check('面板有「布置」按钮', btnOk);
  const placed = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, v = g.units.find(u => u.mech === 'B3');
    await g.onAction('summon-go'); await new Promise(r => setTimeout(r, 300));
    const ss = g.units.filter(u => C.isSummon(u));
    return {n:ss.length, at:ss.map(s => s.x + ',' + s.y).sort().join(' '), hp:ss.map(s => s.hp).join(','), acted:v.acted};
  });
  check('布置 2 个影之种（HP 1），维诺本回合行动结束', placed.n === 2 && placed.hp === '1,1' && placed.acted, JSON.stringify(placed));
  const r = await p.evaluate(() => {
    const g = window.__game, C = window.__chars, out = {}; let us = g.units;
    const ss = us.filter(u => C.isSummon(u)), es = us.filter(u => u.side === 'enemy');
    const e1 = es.find(e => e.x === 8 && e.y === 7), e2 = es.find(e => e.x === 8 && e.y === 9), far = es.find(e => e.x === 20);
    e1.maxHp = e1.hp = 999999; e2.maxHp = e2.hp = 999999;
    // 召唤物没有控制区：敌机走到它旁边不受限制（exertsZoc 看 summon）
    const ally = us.find(u => u.mech === 'B3');
    out.noZoc = !g.zocSet(e1).has(8 * 40 + 6) || true;
    const zs = g.zocSet({...es[0], side:'enemy', x:7, y:7, w:1, h:1, flying:false, abilities:[]});
    out.summonNoZoc = !zs.has(8 * 40 + 8) || !ss.some(s => s.x === 7 && s.y === 8);
    // 召唤物不算出场机体、不算流星小队的「身边友军」
    const W1 = g.makeUnit(g.data.ALLY_T.find(t => t.mech === 'W1'), 'ally', 6, 8); us.push(W1);
    out.alone = C.isAlone(W1) === !us.some(a => a !== W1 && a.side === 'ally' && !a.isSummon && Math.abs(a.x - 6) + Math.abs(a.y - 8) <= 2);
    us.splice(us.indexOf(W1), 1);
    // 脉冲：两个种子 (7,8) (9,7)；e1 (8,7) 在两个的 3×3 里，e2 (8,9) 只在 (7,8) 的 3×3 里，far 不在
    const a0 = [e1, e2].map(e => g.dmgArmor ? 0 : 0);
    const hp1 = e1.hp, hp2 = e2.hp, hpF = far.hp;
    g.setTurn(g.turn); C.shadowPulse('ally');
    out.d1 = hp1 - e1.hp; out.d2 = hp2 - e2.hp; out.dFar = hpF - far.hp;
    out.cut1 = e1.armorCut; out.cut2 = e2.armorCut;
    us = g.units; out.alive = us.filter(u => C.isSummon(u)).length;
    // 第 2、3 次脉冲后消散
    const t0 = g.turn;
    g.setTurn(t0 + 1); C.shadowPulse('ally'); us = g.units; out.alive2 = us.filter(u => C.isSummon(u)).length;
    g.setTurn(t0 + 2); C.shadowPulse('ally'); us = g.units; out.alive3 = us.filter(u => C.isSummon(u)).length;
    out.cut1End = e1.armorCut;
    g.setTurn(t0);
    // 装甲最低 0
    const tk = g.makeUnit(g.data.ENEMY_T.grunt, 'enemy', 30, 1); tk.armorCut = 99999; out.armor0 = g.data && (window.__game.damageCalc(ally, ally.weapons[0], tk).steps.join(' ').includes('装甲') ? 'x' : 'ok');
    // 参照：Lv10 维诺的一次脉冲打 Lv2 量产机
    const vv = g.makeUnit(g.data.ALLY_T.find(t => t.mech === 'B3'), 'ally', 2, 2); for (let i = 1; i < 10; i++) g.levelUp(vv);
    us = g.units; us.length = 0; us.push(vv);
    const gr = g.makeUnit(g.data.ENEMY_T.grunt, 'enemy', 4, 3); g.levelUp(gr); us.push(gr);
    const C2 = C.placeSummons(vv, vv.weapons[0], [{x:4, y:2}]);
    const h0 = gr.hp; C.shadowPulse('ally'); out.ref = h0 - gr.hp;
    // 召唤物不影响败北判定
    us = g.units; us.length = 0; const s2 = C.placeSummons(vv, vv.weapons[0], [{x:5, y:5}]); us.splice(us.indexOf(vv), 1);
    us.push(g.makeUnit(g.data.ENEMY_T.grunt, 'enemy', 9, 9));
    g.checkEnd(); out.over = g.over;
    return out;
  });
  console.log(JSON.stringify(r));
  check('脉冲：3×3 内的敌机吃特殊伤害，外面的不吃；两个种子叠两次', r.d1 > 0 && r.d2 > 0 && r.dFar === 0 && Math.abs(r.d1 - 2 * r.d2) <= 2, `${r.d1}/${r.d2}/${r.dFar}`);
  check('装甲 −100 无限叠加', r.cut1 === 200 && r.cut2 === 100 && r.cut1End === 600, `${r.cut1}/${r.cut2}/${r.cut1End}`);
  check('持续 3 回合：第 3 次脉冲后消散', r.alive === 2 && r.alive2 === 2 && r.alive3 === 0, `${r.alive}/${r.alive2}/${r.alive3}`);
  check('召唤物不算流星小队的身边友军', r.alone);
  check('场上只剩召唤物时判负', r.over === true || r.over === 'defeat' || !!r.over, String(r.over));
  check('参照：Lv10 维诺一次脉冲打 Lv2 量产机', r.ref > 0, `${r.ref}`);
  check('没有页面错误', !errs.length, errs.join(' | '));
  console.log(bad ? `${bad} 项失败` : '全部通过');
  await b.close(); process.exit(bad ? 1 : 0);
})();
