/* v0.40.22 需求单 #11 / #12：attackStart 事件在结算前发；注册了演出函数时，单体出手前后各调一次（start / result），地图炮不播；没注册时不显示「演出」按钮 */
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
  check('没注册演出时不显示「演出」按钮', await p.evaluate(() => document.querySelector('#btnScene').hidden));
  const r = await p.evaluate(async () => {
    const g = window.__game, out = {log:[]};
    g.startLevel('rt_formula'); await new Promise(r => setTimeout(r, 300));
    g.registerBattleScene(async info => { out.log.push(`${info.phase}:${info.att.mech}${info.phase === 'result' ? ':' + info.hit + ':' + info.dmg : ''}`); });
    out.btn = !document.querySelector('#btnScene').hidden;
    const me = g.units.find(u => u.mech === 'G3'), foe = g.units.find(u => u.side === 'enemy');
    const w = me.weapons.find(x => x.unlock <= 1 && x.fire === 'direct');
    const hp0 = foe.hp;
    await g.battle(me, w, foe, null).catch(e => { out.err = String(e); });
    out.order = out.log.slice(0, 2);
    out.dmgOk = out.log.some(s => s.startsWith('result:G3:'));
    out.hpChanged = foe.hp !== hp0 || out.log.some(s => s.startsWith('result:G3:false'));
    return out;
  });
  check('注册后显示「演出」按钮', r.btn, JSON.stringify(r));
  check('单体出手：先 start 再 result，result 带命中和伤害', r.order[0] === 'start:G3' && r.dmgOk);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
