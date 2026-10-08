/* v0.40 规则试玩场：6 关都能开、单位都站在能站的格子上、大众脸没有个人特技、机库关能派出、开场菜单有入口；截图存到 tests/rt_*.png（不进仓库） */
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
  check('开场菜单有「规则试玩场」入口', await p.$('#endDlg [data-v="ruletest"]') !== null);
  const keys = await p.evaluate(() => Object.keys(window.__game.levels).filter(k => k.startsWith('rt_')));
  check('6 个试玩关', keys.length === 6, keys.join(','));
  for (const k of keys){
    await p.evaluate(k => window.__game.startLevel(k), k); await p.waitForTimeout(300);
    await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const g = window.__game, us = g.units, occ = new Set(); let clash = 0, badTile = 0;
      for (const u of us){ for (let j = 0; j < u.h; j++) for (let i = 0; i < u.w; i++){ const key = (u.y+j)*100 + u.x+i; if (occ.has(key)) clash++; occ.add(key); const t = g.map[u.y+j] && g.map[u.y+j][u.x+i]; if (!t || ['mountain','chasm','cliff','abyss'].includes(t) && !u.flying) badTile++; } }
      const allies = us.filter(u => u.side === 'ally');
      return {allies:allies.map(u => u.mech + 'Lv' + u.lv).join(' '), hangar:g.HANGAR.map(u => u.mech).join(' '), foes:us.filter(u => u.side === 'enemy').length, clash, badTile, noTrait:allies.filter(u => /^G/.test(u.mech)).every(u => !u.trait), over:g.over};
    });
    check(`${k}：开局正常`, r.allies && r.foes > 0 && !r.clash && !r.badTile && r.noTrait && !r.over, JSON.stringify(r));
    await p.screenshot({path: __dirname + `/${k}.png`});
  }
  // RT-1：尖兵能钻过控制区，近卫不能
  const z = await p.evaluate(() => { const g = window.__game; g.startLevel('rt_zoc'); const g1 = g.units.find(u => u.mech === 'G1'), g2 = g.units.find(u => u.mech === 'G2');
    const far = (u, cap) => Math.max(...g.reach(u, cap).map(t => t.x)); return {g1:far(g1, 30), g2:far(g2, 30)}; });
  check('RT-1：尖兵能穿过敌阵，近卫被控制区挡住', z.g2 >= 19 && z.g1 <= 13, JSON.stringify(z));
  // RT-5：机库里有迪奥，能全图部署
  const d = await p.evaluate(async () => { const g = window.__game; g.startLevel('rt_deploy'); await new Promise(r => setTimeout(r, 300)); document.querySelector('#btnForm') && document.querySelector('#btnForm').click(); await new Promise(r => setTimeout(r, 400));
    const duo = g.HANGAR.find(u => u.mech === 'W2'); return {hangar:g.HANGAR.map(u => u.mech), duoTiles: duo ? g.deployTiles(duo).length : 0, cap:g.LV.maxDeploy, field:g.units.filter(u => u.side === 'ally').length}; });
  check('RT-5：首发 3 台，其余进机库，迪奥可以全图部署', d.field === 3 && d.hangar.length === 3 && d.duoTiles > 100, JSON.stringify(d));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
