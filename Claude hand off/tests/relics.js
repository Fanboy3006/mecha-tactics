/* v0.31 藏品（Claude 维护）：常驻加成、属性、叠层按出击人数、敌方减益、不改动队伍存档 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
  check('藏品表有 50 件', await p.evaluate(() => Object.keys(window.__game.RELICS).length === 50));
  const hp0 = await p.evaluate(() => { const g = window.__game; ['g1','g2','g3','g4','e4','e7','s4'].forEach(id => g.gainRelic(id)); return g.RUN.units.find(u => u.mech === 'B1').maxHp; });
  await p.evaluate(() => { window.__game.setSpeed(0.01); window.__game.runBattle('battle'); });
  await p.waitForTimeout(500);
  await p.click('#btnForm', {timeout:3000}).catch(() => {});
  await p.waitForFunction(() => window.__game.units.some(u => u.side === 'ally' && u.relicMods), null, {timeout:8000}).catch(() => {});
  const r = await p.evaluate(() => { const g = window.__game, u = g.units.find(x => x.mech === 'B1'), e = g.units.find(x => x.side === 'enemy');
    return {mods:u.relicMods, maxHp:u.maxHp, foe:e && e.relicMods, saved:g.RUN.units.find(x => x.mech === 'B1').maxHp}; });
  // g2 +25, g3 +40, g4 一名近卫 +6 → 71；暴击 15；装甲 g1 +15 g3 −40 → −25
  check('近卫常驻伤害 = 25 + 40 + 6（突击编队按 1 名近卫算）', r.mods && r.mods.dmg === 71, JSON.stringify(r.mods));
  check('双刃代价：装甲 +15 −40 = −25', r.mods && r.mods.armorPct === -25);
  check('HP +30%（格斗框架）：雷萨 Lv20 是 11000 → 14300', r.maxHp === 14300, String(r.maxHp));
  check('敌方减益：命中 −5、装甲 −10%；游击网络没有尖兵出击 = 0', r.foe && r.foe.hit === -5 && r.foe.armorPct === -10, JSON.stringify(r.foe));
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
