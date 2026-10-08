/* 音频接线测试（Claude 维护）：各场景切到对的 cue、Boss 判定、胜利号角、M 键静音、没有报错。
   用法：node tests/audio_cues.js    需要 playwright + Chromium */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  if (!(await p.evaluate(() => typeof MechAudio !== 'undefined'))){ const hid = await p.evaluate(() => document.querySelector('#btnSound').hidden); console.log(`${hid ? '✓' : '✗'} 音频暂停（作者 10-08 全部静音）：没有打包音频，声音按钮已隐藏`); console.log('ERRS', JSON.stringify(errs)); await b.close(); process.exit(hid && !errs.length ? 0 : 1); }
  let bad = 0;
  const expect = async (label, want) => { const s = await p.evaluate(() => window.__game.sound); const ok = s.cue === want; if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label}：${s.cue}${ok ? '' : `（应为 ${want}）`}`); };
  await p.mouse.click(5, 5);
  await expect('打开页面（默认肉鸽开局界面）', 'title');
  await p.selectOption('#levelSel', 'tut1'); await p.waitForTimeout(400);
  await expect('教学 1 我方阶段', 'allyPhase');
  await p.selectOption('#levelSel', 'defense'); await p.waitForTimeout(300);
  await expect('编队界面', 'title');
  await p.click('#btnForm'); await p.waitForTimeout(400);
  await expect('防卫战开打（第 1 波没有 Boss）', 'allyPhase');
  await p.evaluate(() => window.__game.startLevel('trial_B1')); await p.waitForTimeout(300);
  await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(400);
  await expect('试玩关（场上有重装要塞）', 'boss');
  await p.keyboard.press('m'); await expect('按 M 静音', null);
  await p.keyboard.press('m'); await expect('再按 M 恢复', 'boss');
  await p.evaluate(() => { const g = window.__game, a = g.units; for (let i = a.length-1; i >= 0; i--) if (a[i].side === 'enemy') a.splice(i,1); g.checkEnd(); }); await p.waitForTimeout(300);
  await expect('胜利', 'victory');
  await p.click('#btnAgain'); await p.waitForTimeout(400);
  await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(300);
  await expect('马上重开：号角还在放', 'victory');
  await p.waitForTimeout(6500);
  await expect('6 秒后回到战斗曲', 'boss');
  console.log('ERRS', errs);
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
