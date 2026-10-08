/* v0.39.4 敌方狙击压制射击：敌方狙击模板带 overwatch；我方移动走进射界挨一发、不能取消移动；射界外移动不受影响；每个阶段 1 次 */
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
  await p.evaluate(() => window.__game.startLevel('trial_B1')); await p.waitForTimeout(300);
  await p.click('#btnForm', {timeout:1500}).catch(() => {}); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    const g = window.__game, us = g.units, out = {};
    out.tpl = g.data.ENEMY_T.sniper.abilities.includes('overwatch');
    for (let i = us.length - 1; i >= 0; i--) if (us[i].side !== 'ally') us.splice(i, 1);
    const me = us.find(u => u.mech === 'B1'); g.setSpeed(0.01);
    // 清出一片平地，避免地形挡视线
    const plain = g.map.flat().find(v => v === 'plain') || 'plain'; for (let y = 0; y < 10; y++) for (let x = 2; x < 18; x++) g.map[y][x] = plain;
    const sn = g.makeUnit(g.data.ENEMY_T.sniper, 'enemy', 15, 5); sn.facing = 'left'; for (let i = 1; i < 10; i++) g.levelUp(sn); sn.hp = sn.maxHp; us.push(sn);
    me.x = 9; me.y = 0; me.acted = false; me.moved = false; me.hp = me.maxHp;
    const hp0 = me.hp;
    g.select(me);
    const t = g.S.reach.find(q => q.x === 9 && q.y === 5);
    out.reachOk = !!t;
    g.onTile(9, 5);
    for (let i = 0; i < 60 && g.S.mode === 'busy'; i++) await new Promise(r => setTimeout(r, 50));
    out.hit = me.hp < hp0 || me.owHit; out.noUndo = !!g.S.noUndo; out.at = [me.x, me.y]; out.mode = g.S.mode;
    out.once = sn.owPhase === g.phaseNo;
    // 同一阶段第二台我方再走进去：这台狙击已经打过了，不再开火
    const o = us.find(u => u.side === 'ally' && u !== me);
    if (o){ o.x = 8; o.y = 0; o.acted = false; o.moved = false; const h1 = o.hp; g.select(o); g.onTile(8, 5); for (let i = 0; i < 60 && g.S.mode === 'busy'; i++) await new Promise(r => setTimeout(r, 50)); out.second = o.hp === h1 && !o.owHit; }
    return out;
  });
  check('敌方狙击模板带压制射击', r.tpl, JSON.stringify(r));
  check('我方走进敌方狙击射界：挨一发', r.reachOk && r.hit);
  check('挨打后不能取消移动、停在目标格', r.noUndo && r.at[0] === 9 && r.at[1] === 5 && r.mode === 'menu');
  check('每台狙击每个阶段只打 1 次', r.once && r.second !== false);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
