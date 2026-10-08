/* 战术挑战（05c，关卡对话维护）：每一关都能开、单位站在能站的格子上、没有报错；另外检查手工关卡的守卫型敌人（guardZone）接线 */
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
  check('开场菜单有「战术挑战」入口', await p.$('#endDlg [data-v="challenge"]') !== null);
  const keys = await p.evaluate(() => Object.keys(window.__game.levels).filter(k => k.startsWith('ch_')));
  console.log(`  战术挑战共 ${keys.length} 关`);
  for (const k of keys){
    await p.evaluate(k => window.__game.startLevel(k), k); await p.waitForTimeout(300);
    await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const g = window.__game, us = g.units, occ = new Set(); let clash = 0, badTile = 0;
      for (const u of us){ for (let j = 0; j < u.h; j++) for (let i = 0; i < u.w; i++){ const key = (u.y+j)*100 + u.x+i; if (occ.has(key)) clash++; occ.add(key); const t = g.map[u.y+j] && g.map[u.y+j][u.x+i]; if (!t || ['chasm','cliff','abyss'].includes(t) && !u.flying || t === 'cliff' || t === 'abyss') badTile++; } }
      const L = g.LV;
      return {allies:us.filter(u => u.side === 'ally').length + g.HANGAR.length, foes:us.filter(u => u.side === 'enemy').length, clash, badTile, over:g.over, tip:!!(L.tips && L.tips.some(t => t.on === 'turn:1')), goal:!!L.goalText};
    });
    check(`${k}：开局正常（有开场提示、有目标）`, r.allies && r.foes > 0 && !r.clash && !r.badTile && !r.over && r.tip && r.goal, JSON.stringify(r));
  }
  // 守卫型接线：临时塞一关
  const gz = await p.evaluate(() => { const g = window.__game, L = g.levels;
    L.__gz = {code:'GZ', name:'守卫测试', w:16, h:8, rows:Array(8).fill('.'.repeat(16)), allies:[{mech:'G1', x:1, y:3, lv:10}], enemies:[{t:'grunt', x:14, y:3, guardZone:4}], victory:{type:'annihilate'}, goalText:'x', winText:'x', summary:'', tips:[]};
    g.startLevel('__gz'); const e = g.units.find(u => u.side === 'enemy'); const r = {gz:e.guardZone, awake:!!e.awake}; delete L.__gz; return r; });
  check('手工关卡的敌人可以写 guardZone', gz.gz === 4 && !gz.awake, JSON.stringify(gz));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
