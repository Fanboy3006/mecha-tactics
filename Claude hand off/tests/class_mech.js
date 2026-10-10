/* v0.25 分类通用机制（Claude 维护）：近卫 DASH、狙击援护攻击、重装援护防御 / 卡嘉莉进攻援护 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(200);   // v0.29 开场模式选择：选肉鸽，回到原来的初始状态
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  // 准备：载入关卡，把指定单位摆好位置
  const setup = (lv, fn) => p.evaluate(([lv, fn]) => { const g = window.__game; g.setSpeed(0.01); g.startLevel(lv); document.querySelector('#endModal').hidden = true; document.querySelector('#tipCard').hidden = true; g.cheatLevel(20); return new Function('g', fn)(g); }, [lv, fn]);
  // 选中 → 原地 → 对目标开火
  const attack = (mech, tIdx, wait = true) => p.evaluate(async ([mech, tIdx, wait]) => { const g = window.__game, u = g.units.find(x => x.mech === mech), t = g.units.filter(x => x.side === 'enemy')[tIdx];
    g.onTile(u.x, u.y); g.onTile(u.x, u.y); g.choosePick(t); const pr = g.onAction('fire'); if (wait) await pr; return true; }, [mech, tIdx, wait]);
  const settle = async (ms = 1500) => { await p.waitForTimeout(ms); };

  /* 1. DASH：雷萨击破相邻敌机后可以再移动 3 格、再攻击一次；每回合只有 1 次 */
  await setup('trial_B1', `const u = g.units.find(x => x.mech === 'B1'), es = g.units.filter(x => x.side === 'enemy');
    es.forEach((e, i) => { e.x = u.x + 1 + i * 2; e.y = u.y; e.hp = 1; e.eva = -999; }); u.weapons = u.weapons.filter(w => w.special !== 'gamble'); return true;`);   // 传送斩可能打出「当前 HP 90%」，打不死 1 HP 的目标
  await attack('B1', 0); await settle();
  let st = await p.evaluate(() => ({mode: window.__game.S.mode, dash: window.__game.S.dash, n: window.__game.S.reach.length}));
  check('近卫击破后进入 DASH（3 格移动）', st.mode === 'moving2' && st.dash && st.n > 0, JSON.stringify(st));
  await p.evaluate(() => { const g = window.__game, u = g.S.sel, e2 = g.units.filter(x => x.side === 'enemy' && x.hp > 0).sort((a,b) => a.x - b.x)[0]; g.onTile(e2.x - 1, e2.y); });
  await p.waitForTimeout(200);
  st = await p.evaluate(() => ({mode: window.__game.S.mode, n: (window.__game.S.atkList || []).length}));
  check('DASH 移动到下一个敌人旁边后进入攻击菜单', st.mode === 'menu' && st.n > 0, JSON.stringify(st));
  const n2 = await p.evaluate(async () => { const g = window.__game, t = (g.S.atkList || [])[0]; if (!t) return 'no-target'; g.choosePick(t); await g.onAction('fire'); return t.hp; });
  await settle();
  st = await p.evaluate(() => ({mode: window.__game.S.mode, sel: !!window.__game.S.sel, dash: window.__game.S.dash}));
  check('雷萨第二次击破不再 DASH（上限 1）', n2 === 0 && !st.dash && st.mode !== 'moving2', JSON.stringify({...st, 第二个目标HP: n2}));

  /* 2. 刹那 DASH 上限 2 */
  await setup('trial_CB1', `const u = g.units.find(x => x.mech === 'CB1'), es = g.units.filter(x => x.side === 'enemy');
    es.forEach((e, i) => { e.x = u.x + 1; e.y = u.y + i - 1; if (i > 2){ e.x = u.x + 3; e.y = u.y; } e.hp = 1; e.eva = -999; }); return true;`);
  let dashes = 0;
  await attack('CB1', 0); await settle();
  for (let k = 0; k < 3; k++){
    const s = await p.evaluate(() => window.__game.S.dash);
    if (!s) break; dashes++;
    await p.keyboard.press(' '); await p.waitForTimeout(150);
    const ok = await p.evaluate(async () => { const g = window.__game; if (g.S.mode !== 'menu') return false; const tt = (g.S.atkList || [])[0]; if (!tt) return false; g.choosePick(tt); await g.onAction('fire'); return true; });
    if (!ok) break; await settle();
  }
  check('刹那一回合 DASH 2 次（共行动 3 次）', dashes === 2, `DASH ${dashes} 次`);

  /* 3. 援护攻击：伊萨克攻击后，射程内的露娜弹窗询问（v0.41.4 克莱因派换人），空格 = 伤害最高的武装 */
  await setup('trial_S3', `const a = g.units.find(x => x.mech === 'S4'), s = g.units.find(x => x.mech === 'S3'), e = g.units.filter(x => x.side === 'enemy')[0];
    e.x = 10; e.y = 6; e.maxHp = e.hp = 999999; a.x = 9; a.y = 6; s.x = 6; s.y = 6; g.units.filter(x => x.side === 'enemy').slice(1).forEach((o, i) => { o.x = 20; o.y = i; }); return true;`);
  await attack('S4', 0, false); await settle(1200);
  const dlg = await p.evaluate(() => !document.querySelector('#reactModal').hidden && document.querySelector('#reactDlg').innerText.includes('援护攻击'));
  check('我方攻击后弹出援护攻击询问', dlg);
  if (dlg){ await p.keyboard.press(' '); await settle(1200); }
  st = await p.evaluate(() => { const g = window.__game, s = g.units.find(x => x.mech === 'S3'); return {sup: s.supTurn === g.turn, log: document.querySelector('#log').innerText.includes('援护攻击')}; });
  check('空格默认执行援护攻击', st.sup && st.log, JSON.stringify(st));

  /* 4. 重装都有援护防御（v0.41.4：卡嘉莉改指挥，进攻援护去掉；史黛拉改重装） */
  const ab = await p.evaluate(() => { const T = window.__game.data.ALLY_T; return ['M2','S5','A4'].map(m => T.find(t => t.mech === m).abilities.includes('guard')).every(Boolean) && !T.find(t => t.mech === 'S2').abilities.includes('guard'); });
  check('三台重装都有援护防御，卡嘉莉（指挥）没有', ab);
  // 进攻援护（guardAtk）原来只有卡嘉莉有；v0.41.4 她改成指挥，现在没有我方机体带它，测试去掉
  // 敌方援护：狙击机能找到援护机会
  const es = await p.evaluate(() => { const g = window.__game; return g.data.ENEMY_T.sniper.abilities.includes('supportAtk') && g.data.ENEMY_T.funnel.abilities.includes('supportAtk'); });
  check('敌方狙击机 / 浮游炮母机带援护攻击', es);
  /* 5. v0.26：援护范围 = 移动力覆盖范围；势力招募券 */
  const gr = await p.evaluate(() => { const g = window.__game; g.startLevel('trial_M2'); document.querySelector('#endModal').hidden = true;
    const m = g.units.find(x => x.mech === 'M2'), a = g.units.find(x => x.side === 'ally' && x !== m);
    a.x = m.x + 3; a.y = m.y + 2; const far = g.guardReach(m, a); a.x = m.x + 12; a.y = m.y; const tooFar = g.guardReach(m, a); return {far, tooFar, mov: m.mov}; });
  check('援护范围按移动力覆盖（不相邻也能援护，太远不行）', gr.far && !gr.tooFar, JSON.stringify(gr));
  const tk = await p.evaluate(() => { const g = window.__game; return {fac: g.FACTIONS && g.FACTIONS.includes('秘银') && g.FACTIONS.includes('月球王国'), ok: g.ticketOk('月球王国', 'M4') && g.ticketOk('狙击', 'M4') && !g.ticketOk('天人', 'M4')}; });
  check('势力招募券：按势力筛选角色（秘银改名、Nagi 属于月球王国 / 狙击）', tk.fac && tk.ok, JSON.stringify(tk));
  check('普通档招募免费（反馈第 21 条）', await p.evaluate(() => { const G = window.__game, A = G.data.ALLY_T; return A.filter(t => G.tierOf(t.mech) === 'B').every(t => G.recCost(t.mech) === 0) && G.recCost(A.find(t => G.tierOf(t.mech) === 'A').mech) === 3; }));
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
