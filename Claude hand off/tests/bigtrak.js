/* v0.41.5 影世界新角色比格特拉克（角色对话）：抛射弹 2–4 曲射；Lv20 连锁投掷——命中后在目标 4 格内弹向下一台，每跳范围 −1，找不到就停 */
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
  await p.evaluate(() => window.__game.startLevel('trial_B4')); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    const us = g.units; us.length = 0;
    const T = D.ALLY_T.find(t => t.mech === 'B4');
    out.info = `${T.pilot}|${T.tags.势力}|${g.tierOf('B4')}|${T.weapons.map(w => w.name + ':' + w.fire + w.range.join('-')).join(',')}`;
    const u = g.makeUnit(T, 'ally', 2, 7); for (let i = 1; i < 20; i++) g.levelUp(u); us.push(u);
    const E = (x, y) => { const e = g.makeUnit(D.ENEMY_T.grunt, 'enemy', x, y); e.maxHp = e.hp = 999999; us.push(e); return e; };
    // 链：A(6,7) → B 距 A 4 格 (10,7) → C 距 B 3 格 (13,7) → D 距 C 2 格 (15,7) → E 距 D 1 格 (16,7) → F 距 E 1 格 (17,7)（范围已经到 0，不打）
    const A = E(6, 7), B = E(10, 7), Cc = E(13, 7), Dd = E(15, 7), Ee = E(16, 7), F = E(17, 7), far = E(6, 0);
    const w = u.weapons.find(w => w.name === '连锁投掷');
    u.bounceHit = g.BATTLE_ID + ':' + g.turn;   // 当作第一下打中了
    const hp = [A, B, Cc, Dd, Ee, F, far].map(e => e.hp);
    out.n = await C.bounceChain(u, w, A);
    out.dmg = [A, B, Cc, Dd, Ee, F, far].map((e, i) => hp[i] - e.hp);
    // 第一下没打中 → 不弹
    u.bounceHit = null; out.miss = await C.bounceChain(u, w, A);
    // 不回头打已经打过的：只有 A、B 两台，A 4 格内只有 B，B 4 格内只有 A（打过）→ 弹 1 次
    us.length = 0; us.push(u); const A2 = E(6, 7), B2 = E(8, 7);
    u.bounceHit = g.BATTLE_ID + ':' + g.turn; out.noBack = await C.bounceChain(u, w, A2);
    // 参照：Lv20 打 Lv12 盾卫一跳的伤害；Lv10 抛射弹打 Lv2 量产机
    const sh = g.makeUnit(D.ENEMY_T.shield, 'enemy', 5, 5); for (let i = 1; i < 12; i++) g.levelUp(sh);
    out.refUlt = g.damageCalc(u, w, sh).dmg;
    const u10 = g.makeUnit(T, 'ally', 2, 2); for (let i = 1; i < 10; i++) g.levelUp(u10);
    const gr = g.makeUnit(D.ENEMY_T.grunt, 'enemy', 5, 2); g.levelUp(gr);
    out.refShell = g.damageCalc(u10, u10.weapons[0], gr).dmg;
    out.cd = w.cd; out.noCounter = !!w.noCounter;
    return out;
  });
  // 走一遍实际界面：选中 → 攻击 → 连锁投掷 → 点目标 → 发射，第一下打中后弹到第二台
  await p.evaluate(() => window.__game.startLevel('trial_B4')); await p.waitForTimeout(400);
  const ui = await p.evaluate(async () => {
    const g = window.__game, D = g.data;
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    const u = g.units.find(x => x.mech === 'B4'), es = g.units.filter(x => x.side === 'enemy');
    while (u.lv < 20) g.levelUp(u);
    u.weapons.forEach(w => { w.cdLeft = 0; }); g.setTurn(10);   // 大招开场冷却 3 回合
    es.forEach((e, i) => { e.x = 22; e.y = i; e.maxHp = e.hp = 999999; e.eva = -999; });
    const [a, b2] = es; a.x = u.x + 4; a.y = u.y; b2.x = u.x + 7; b2.y = u.y;
    const h = [a.hp, b2.hp];
    g.onTile(u.x, u.y); g.onTile(u.x, u.y); await g.onAction('attack');
    const i = u.weapons.findIndex(w => w.name === '连锁投掷');
    document.querySelector(`#actionCard button[data-w="${i}"]`).click();
    const m1 = g.S.mode; g.onTile(a.x, a.y); if (!g.S.target) return {m1, mode:g.S.mode, facing:u.facing, ok:g.weaponUsable(u, u.weapons[i])};
    await g.onAction('fire');
    return {mode:g.S.mode, d:[h[0] - a.hp, h[1] - b2.hp]};
  });
  console.log(JSON.stringify(ui));
  check('界面流程：第一下打中后弹到 3 格外的第二台', ui.d && ui.d[0] > 0 && ui.d[1] > 0, JSON.stringify(ui));
  console.log(JSON.stringify(r));
  check('比格特拉克：影世界骨干，抛射弹 2–4 曲射，Lv20 连锁投掷 1–5', r.info.startsWith('比格特拉克|影世界|A|') && r.info.includes('抛射弹:indirect2-4') && r.info.includes('连锁投掷:indirect1-5'), r.info);
  check('冷却 5 回合、目标不能反击', r.cd === 5 && r.noCounter);
  check('弹跳范围 4 → 3 → 2 → 1：B、C、D、E 各吃一次，范围到 0 停下（F 不吃）', r.n === 4 && r.dmg[0] === 0 && r.dmg.slice(1, 5).every(d => d > 0) && r.dmg[5] === 0 && r.dmg[6] === 0, JSON.stringify(r.dmg));
  check('每跳伤害相同', new Set(r.dmg.slice(1, 5)).size === 1);
  check('第一下没打中就不弹', r.miss === 0);
  check('不会弹回已经打过的敌机', r.noBack === 1);
  check('参照伤害', r.refUlt > 0 && r.refShell > 0, `连锁投掷每跳 ${r.refUlt}（Lv20 打 Lv12 盾卫），抛射弹 ${r.refShell}（Lv10 打 Lv2 量产机）`);
  check('没有页面错误', !errs.length, errs.join(' | '));
  console.log(bad ? `${bad} 项失败` : '全部通过');
  await b.close(); process.exit(bad ? 1 : 0);
})();
