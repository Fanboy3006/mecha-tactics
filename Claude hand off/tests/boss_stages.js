/* 肉鸽关底 Boss（30c，关卡对话维护）：每场 Boss 战能开、★ 数量对、敌我站位合法、空过两回合没有报错；
   Boss 模板（规则对话，需求单 #10）没到位时，出口守军的关卡池不抽 Boss 战。 */
const { chromium } = require('playwright');
const fs = require('fs');
const CASES = [['ISW-1-G-1','guard',1], ['ISW-2-G-1','guard',1], ['ISW-3-G-1','guard',2], ['ISW-4-F-1','final',1]];
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  for (const [code, kind, stars] of CASES){
    const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(code + ': ' + e.message)); p.on('dialog', d => d.dismiss());
    await p.route('**/*', r => r.abort());
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
    await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
    await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
    const pre = await p.evaluate(([code, kind]) => { const g = window.__game, st = g.STAGES[code]; g.setSpeed(0.01); g.RUN.layer = st.layer; g.runBattle(kind, code); return {boss:!!st.boss, keys:st.bossKeys}; }, [code, kind]);
    await p.waitForTimeout(500); await p.click('#btnForm', {timeout:3000}).catch(() => {});
    await p.waitForFunction(() => window.__game.units.some(u => u.side === 'enemy'), null, {timeout:8000}).catch(() => {});
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const g = window.__game, us = g.units, occ = new Set(); let clash = 0, badTile = 0;
      for (const u of us){ for (let j = 0; j < u.h; j++) for (let i = 0; i < u.w; i++){ const k = (u.y+j)*100 + u.x+i; if (occ.has(k)) clash++; occ.add(k); const t = g.map[u.y+j] && g.map[u.y+j][u.x+i]; if (!t || t === 'cliff' || t === 'abyss' || (t === 'chasm' && !u.flying)) badTile++; } }
      return {name:g.LV.name, type:g.LV.victory.type, stars:us.filter(u => u.target && u.side === 'enemy').length, allies:us.filter(u => u.side === 'ally').length, foes:us.filter(u => u.side === 'enemy').length, clash, badTile, tip:!!(g.LV.tips && g.LV.tips.length)};
    });
    check(`${code}：开局正常（斩首 ★${stars}、站位合法、有开场说明）`, pre.boss && r.type === 'targets' && r.stars === stars && r.allies > 0 && !r.clash && !r.badTile && r.tip, JSON.stringify(r));
    const t = await p.evaluate(async () => { const g = window.__game; for (let n = 0; n < 2 && !g.over; n++){ const t0 = g.turn; g.S.mode = 'idle'; g.endTurn(); for (let i = 0; i < 300 && g.turn === t0 && !g.over; i++){ document.querySelectorAll('#reactModal:not([hidden]) [data-r], #reactModal:not([hidden]) [data-c], #reactModal:not([hidden]) [data-g]').forEach(x => x.click()); await new Promise(r => setTimeout(r, 50)); } } return {turn:g.turn, over:g.over}; });
    check(`${code}：空过两回合不报错`, t.turn >= 3 || t.over, JSON.stringify(t));
    if (code === 'ISW-1-G-1'){
      const pool = await p.evaluate(() => { const g = window.__game, st = Object.values(g.STAGES).filter(s => s.boss); return st.map(s => `${s.code}:${s.bossKeys.every(k => g.data.ENEMY_T[k]) ? 'ready' : 'fallback'}`); });
      console.log('  Boss 模板：', pool.join(' '));
    }
    await p.close();
  }
  console.log('ERRS', JSON.stringify(errs)); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
