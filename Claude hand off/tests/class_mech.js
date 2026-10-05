/* v0.25 分类通用机制（Claude 维护）：近卫 DASH、狙击援护攻击、重装援护防御 / 卡嘉莉进攻援护 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
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

  /* 3. 援护攻击：希尔妲攻击后，射程内的志保弹窗询问，空格 = 伤害最高的武装 */
  await setup('trial_S4', `const a = g.units.find(x => x.mech === 'S6'), s = g.units.find(x => x.mech === 'S4'), e = g.units.filter(x => x.side === 'enemy')[0];
    e.x = 10; e.y = 6; e.maxHp = e.hp = 999999; a.x = 9; a.y = 6; s.x = 6; s.y = 6; g.units.filter(x => x.side === 'enemy').slice(1).forEach((o, i) => { o.x = 20; o.y = i; }); return true;`);
  await attack('S6', 0, false); await settle(1200);
  const dlg = await p.evaluate(() => !document.querySelector('#reactModal').hidden && document.querySelector('#reactDlg').innerText.includes('援护攻击'));
  check('我方攻击后弹出援护攻击询问', dlg);
  if (dlg){ await p.keyboard.press(' '); await settle(1200); }
  st = await p.evaluate(() => { const g = window.__game, s = g.units.find(x => x.mech === 'S4'); return {sup: s.supTurn === g.turn, log: document.querySelector('#log').innerText.includes('援护攻击')}; });
  check('空格默认执行援护攻击', st.sup && st.log, JSON.stringify(st));

  /* 4. 重装都有援护防御；卡嘉莉的援护防御在我方被反击时也能用 */
  const ab = await p.evaluate(() => { const T = window.__game.data.ALLY_T; return ['M2','S2','A4'].map(m => T.find(t => t.mech === m).abilities.includes('guard')).every(Boolean) && T.find(t => t.mech === 'S2').abilities.includes('guardAtk'); });
  check('三台重装都有援护防御，卡嘉莉另有进攻援护', ab);
  const mate = await setup('trial_S2', `const s = g.units.find(x => x.mech === 'S2'), a = g.units.find(x => x.side === 'ally' && x.mech !== 'S2'), es = g.units.filter(x => x.side === 'enemy');
    const e = es.find(x => x.weapons.some(w => w.fire === 'melee')) || es[0];
    a.x = 8; a.y = 6; s.x = 8; s.y = 7; e.x = 9; e.y = 6; e.maxHp = e.hp = 999999; es.filter(x => x !== e).forEach((o, i) => { o.x = 20; o.y = i; });
    a.weapons = a.weapons.filter(w => w.fire === 'melee'); return a.mech + ':' + es.indexOf(e);`);
  const [mm, ei] = mate.split(':');
  await attack(mm, +ei, false);
  let sawGuard = false;
  for (let k = 0; k < 20 && !sawGuard; k++){ await p.waitForTimeout(150); sawGuard = await p.evaluate(() => !document.querySelector('#reactModal').hidden && document.querySelector('#reactDlg').innerText.includes('进攻援护')); if (!sawGuard && await p.evaluate(() => !document.querySelector('#reactModal').hidden)) await p.click('#reactDlg [data-sp="no"]').catch(() => {}); }
  check('卡嘉莉相邻的友军被反击时弹出「进攻援护」', sawGuard, `攻击者 ${mm}`);
  if (sawGuard){ await p.click('#reactDlg [data-g="1"]'); await settle(1000); }
  const gl = await p.evaluate(() => window.__game.units.find(x => x.mech === 'S2').guardLeft);
  check('进攻援护消耗 1 次', gl === 1, `剩 ${gl}`);
  // 敌方援护：狙击机能找到援护机会
  const es = await p.evaluate(() => { const g = window.__game; return g.data.ENEMY_T.sniper.abilities.includes('supportAtk') && g.data.ENEMY_T.funnel.abilities.includes('supportAtk'); });
  check('敌方狙击机 / 浮游炮母机带援护攻击', es);
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
