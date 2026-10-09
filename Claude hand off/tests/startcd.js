/* v0.39.3 开场冷却：大招默认 3 回合（从上场算）、显示「第 N 回合可用」、cutCd 一起减、换一场战斗重新算、普通武器不受影响 */
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
  await p.evaluate(() => window.__game.startLevel('trial_W2')); await p.waitForTimeout(300);
  await p.click('#btnForm', {timeout:1500}).catch(() => {}); await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const g = window.__game, u = g.units.find(x => x.mech === 'W2'), out = {};
    const ult = u.weapons.find(w => w.unlock >= 20), basic = u.weapons.find(w => w.unlock <= 1);
    out.lv = u.lv; out.ultName = ult && ult.name; out.sc = g.startCdOf(ult); out.basicSc = g.startCdOf(basic);
    out.t1 = g.wStatus(u, ult); out.basic1 = g.wStatus(u, basic);
    g.setTurn(3); out.t3 = g.wStatus(u, ult);
    g.setTurn(4); out.t4 = g.wStatus(u, ult);
    g.setTurn(1); g.cutCd(u, 1); out.cut = g.readyTurnOf(u, ult);
    const e = g.units.find(x => x.side === 'enemy'); out.enemyFree = e.weapons.every(w => g.startWait(e, w) === 0);
    const id = g.BATTLE_ID; g.startLevel('trial_W2'); out.newBattle = g.BATTLE_ID === id + 1;
    const u2 = g.units.find(x => x.mech === 'W2') || u; out.reset = g.readyTurnOf(u2, u2.weapons.find(w => w.unlock >= 20)) === 4;
    return out;
  });
  check('大招默认开场冷却 3、普通武器 0', r.sc === 3 && r.basicSc === 0, JSON.stringify(r));
  check('第 1 回合上场：显示「第 4 回合可用」', /第 4 回合可用/.test(r.t1 || ''));
  check('普通武器不受影响', !/开场冷却/.test(r.basic1 || ''));
  check('第 3 回合还不能用，第 4 回合可以', /开场冷却/.test(r.t3 || '') && !/开场冷却/.test(r.t4 || ''));
  check('cutCd 减 1：第 3 回合可用', r.cut === 3);
  check('敌人默认没有开场冷却', r.enemyFree);
  check('新的一场重新从第 1 回合算', r.newBattle && r.reset);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
