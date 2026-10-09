/* v0.40.13 秘银重设计（角色对话）：毛「指挥网络」5×5——克鲁兹无视障碍物、宗介或毛攻击时克鲁兹自动支援射击（不占援护次数）；档位；全员不能飞 */
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
  await p.evaluate(() => window.__game.startLevel('trial_U2')); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, C = window.__chars, D = g.data, us = g.units, out = {};
    for (let y = 0; y < g.map.length; y++) for (let x = 0; x < g.map[y].length; x++) g.map[y][x] = 'plain';
    us.length = 0; g.setSpeed(0.01);
    const A = (m, x, y, lv = 20, face = 'right') => { const u = g.makeUnit(D.ALLY_T.find(t => t.mech === m), 'ally', x, y); for (let i = 1; i < lv; i++) g.levelUp(u); u.facing = face; us.push(u); return u; };
    const E = (k, x, y, face = 'left') => { const u = g.makeUnit(D.ENEMY_T[k], 'enemy', x, y); u.facing = face; us.push(u); return u; };
    out.tier = ['U7','U2','U6','U1','U8'].map(m => g.tierOf(m)).join('');
    out.noFly = D.ALLY_T.filter(t => t.tags.势力 === '秘银').every(t => !t.flying && !t.canFly);
    // 克鲁兹隔着山打毛范围里的敌人
    const mao = A('U2', 10, 6), kurz = A('U6', 6, 6), sou = A('U7', 9, 7);   // v0.41 直射改成 3×6，克鲁兹挪近到 5 格
    const foe = E('shield', 11, 6), far = E('grunt', 14, 6);
    g.map[6][8] = 'mountain';
    const rifle = kurz.weapons.find(w => w.name === '76mm 狙击炮');
    out.blocked = !g.losClear(kurz, kurz.x, kurz.y, foe);
    out.zone = C.inMaoZone(foe, 'ally') && !C.inMaoZone(far, 'ally');
    out.sight = g.canHit(kurz, rifle, foe);
    // 宗介攻击 → 克鲁兹自动支援射击（不占援护次数）
    foe.hp = foe.maxHp = 999999;
    const hp0 = foe.hp, R = Math.random; Math.random = () => 0;
    await C.linkSupport(sou, foe);
    Math.random = R;
    out.link = foe.hp < hp0 && kurz.supTurn !== g.turn;
    // 毛不在场 / 目标不在范围：不触发
    const hp1 = far.hp; Math.random = () => 0; await C.linkSupport(sou, far); Math.random = R;
    out.noLinkFar = far.hp === hp1;
    const hp2 = foe.hp; await C.linkSupport(kurz, foe); out.onlySousuke = foe.hp === hp2;
    const hp3 = foe.hp; Math.random = () => 0; await C.linkSupport(mao, foe); Math.random = R; out.maoLink = foe.hp < hp3;
    const yang = A('U8', 9, 5), hp4 = foe.hp; await C.linkSupport(yang, foe); out.notOthers = foe.hp === hp4;
    // Lv10 前毛的特技没解锁
    us.length = 0;
    const m9 = A('U2', 10, 6, 9), f9 = E('grunt', 11, 6);
    out.lv9 = !C.inMaoZone(f9, 'ally');
    return out;
  });
  check('档位：宗介精锐，毛 / 克鲁兹骨干，克鲁佐 / 杨普通', r.tier === 'SAABB', r.tier);
  check('秘银五人都不能飞', r.noFly === true);
  check('（前提）山挡住了克鲁兹的视线', r.blocked === true);
  check('指挥范围是毛周围 5×5', r.zone === true);
  check('克鲁兹打毛范围里的敌人无视障碍物', r.sight === true);
  check('宗介攻击范围里的敌人 → 克鲁兹自动支援射击，不占援护次数', r.link === true);
  check('范围外的敌人不触发', r.noLinkFar === true);
  check('克鲁兹自己的攻击不触发', r.onlySousuke === true);
  check('毛自己攻击范围里的敌人也触发克鲁兹支援', r.maoLink === true);
  check('其他人（杨）的攻击不触发', r.notOthers === true);
  check('毛 Lv10 前没有指挥网络', r.lv9 === true);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
