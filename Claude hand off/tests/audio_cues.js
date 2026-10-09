/* 音频接线测试（音乐对话维护，2026-10-08 改成本地音乐版）
   第一部分：没有音乐文件（和 claude.ai 试玩页一样）→ 声音按钮隐藏、cue 照样跟着场景走、主题曲切换逻辑对、没有报错。
   第二部分：如果 audio/ 下有作者的 mp3（只在作者电脑上有，不进仓库），用 file:// 打开真页面，确认真的在放、切曲子。
   用法：node tests/audio_cues.js    需要 playwright + Chromium */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let bad = 0;
const check = (ok, label, got) => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label}${got !== undefined ? '：' + got : ''}`); };

(async () => {
  const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});

  /* ---------- 第一部分：没有文件 ---------- */
  {
    const p = await b.newPage({viewport:{width:1400,height:900}});
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.route('**/*', r => r.abort());
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
    await p.waitForTimeout(300);
    check(await p.evaluate(() => typeof MechAudio !== 'undefined' && MechAudio.local), '打包的是本地音乐播放层');
    check(await p.evaluate(() => document.querySelector('#btnSound').hidden), '读不到音乐文件 → 声音按钮隐藏');
    const cue = () => p.evaluate(() => window.__game.sound.cue);
    const expect = async (label, want) => { const c = await cue(); check(c === want, label, c + (c === want ? '' : `（应为 ${want}）`)); };
    await p.mouse.click(5, 5);
    await expect('打开页面（开局界面）', 'title');
    await p.selectOption('#levelSel', 'tut1'); await p.waitForTimeout(400);
    await expect('教学 1 我方阶段', 'allyPhase');

    /* 主题曲：直接发事件 */
    const themeOf = code => p.evaluate(c => { const t = window.__game.data.ALLY_T.find(t => t.mech === c); return window.__audio.themeOf({side:'ally', mech:c}); }, code);
    check(await themeOf('W1') === 'theme:流星小队BGM', '希罗 → 流星小队BGM', await themeOf('W1'));
    check(await themeOf('A1') === 'theme:ATX小队音乐', '响介 → ATX小队音乐', await themeOf('A1'));
    check(await themeOf('A3') === 'theme:ATX小队音乐', '拉米亚（双势力）按主势力 → ATX', await themeOf('A3'));
    check(await themeOf('B1') === 'theme:主角音乐', '雷萨 → 主角音乐', await themeOf('B1'));
    check(await themeOf('B2') === 'theme:影世界音乐', '蕾卡 → 影世界音乐', await themeOf('B2'));
    check(await themeOf('M1') === null, 'Feena（月球王国）没有主题曲', await themeOf('M1'));

    const MAP = {strikeResolved:'strike', attackStart:'attackStart', actionEnd:'actionEnd', phaseStart:'phase'};
    const emit = (ev, c) => p.evaluate(([k, c]) => window.__audio.on[k](c), [MAP[ev], c]);
    const ally = m => ({side:'ally', mech:m}), foe = {side:'enemy', mech:'x'}, ULT = {name:'大招', unlock:20}, BASIC = {name:'普通', unlock:1};
    await emit('strikeResolved', {att:ally('A1'), def:foe, w:BASIC, hit:true});
    await expect('普通武器出手不切（v0.40.23 只有大招才切）', 'allyPhase');
    await emit('strikeResolved', {att:ally('A1'), def:foe, w:ULT, hit:true});
    await expect('我方阶段：响介出手', 'theme:ATX小队音乐');
    await emit('strikeResolved', {att:foe, def:ally('A1'), hit:true, counter:true});
    await expect('敌机反击不切回', 'theme:ATX小队音乐');
    await emit('strikeResolved', {att:ally('W2'), def:foe, w:ULT, hit:true});
    await expect('援护的迪奥出手 → 流星小队', 'theme:流星小队BGM');
    await emit('actionEnd', {unit:ally('A1'), side:'ally'});
    await expect('行动结束不切回（v0.40.23）', 'theme:流星小队BGM');
    await emit('strikeResolved', {att:ally('M1'), def:foe, hit:true});
    await expect('Feena 出手不切', 'theme:流星小队BGM');
    await emit('phaseStart', {side:'enemy', turn:1});
    await expect('敌方阶段：主题曲保持到回合结束', 'theme:流星小队BGM');
    await emit('strikeResolved', {att:foe, def:ally('B1'), hit:true});
    await expect('敌机出手不切回', 'theme:流星小队BGM');
    await emit('strikeResolved', {att:ally('B1'), def:foe, w:ULT, hit:true, counter:true});
    await expect('另一首主题曲触发就换：雷萨大招反击 → 主角音乐', 'theme:主角音乐');
    await emit('phaseStart', {side:'ally', turn:2});
    await expect('新回合（我方阶段开始）切回', 'allyPhase');
    await emit('attackStart', {att:ally('W5'), def:foe, w:ULT});
    await expect('attackStart 接好后用它（出手前就切）', 'theme:流星小队BGM');
    await emit('strikeResolved', {att:ally('A1'), def:foe, w:ULT, hit:true});
    await expect('有 attackStart 后 strikeResolved 不再切', 'theme:流星小队BGM');
    await emit('phaseStart', {side:'ally', turn:3});

    await p.keyboard.press('m'); await expect('按 M 静音', null);
    await p.keyboard.press('m'); await expect('再按 M 恢复', 'allyPhase');
    await p.evaluate(() => window.__game.startLevel('trial_B1')); await p.waitForTimeout(300);
    await p.click('#btnForm', {timeout:800}).catch(() => {}); await p.waitForTimeout(400);
    await expect('试玩关（场上有重装要塞）', 'boss');
    await emit('attackStart', {att:ally('A1'), def:foe, w:ULT});
    await expect('Boss 在场时主题曲照样切', 'theme:ATX小队音乐');
    await emit('phaseStart', {side:'ally', turn:2});
    await expect('新回合切回 Boss 曲', 'boss');
    await p.evaluate(() => { const g = window.__game, a = g.units; for (let i = a.length-1; i >= 0; i--) if (a[i].side === 'enemy') a.splice(i,1); g.checkEnd(); }); await p.waitForTimeout(300);
    await expect('胜利（暂时没有曲子，淡出）', 'victory');
    check(await p.evaluate(() => window.__game.sound && MechAudio.state().track === null), '胜利时没有曲子在放');
    console.log('ERRS', JSON.stringify(errs)); if (errs.length) bad++;
    await p.close();
  }

  /* ---------- 第二部分：有作者的音乐文件时 ---------- */
  const probe = path.join(ROOT, 'audio', '战斗音乐1.mp3');
  if (!fs.existsSync(probe)){ console.log('（audio/ 下没有 mp3，跳过真播放测试——只在作者电脑上跑）'); }
  else {
    const p = await b.newPage({viewport:{width:1400,height:900}});
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('file://' + path.join(ROOT, 'Claude hand off', 'src', 'index.html').replace(/\\/g, '/'));
    await p.waitForFunction(() => MechAudio.state().ready, null, {timeout:5000}).catch(() => {});
    check(await p.evaluate(() => MechAudio.state().ready), '读到了本地音乐文件');
    check(!(await p.evaluate(() => document.querySelector('#btnSound').hidden)), '声音按钮显示');
    await p.mouse.click(5, 5);
    await p.selectOption('#levelSel', 'tut1'); await p.waitForTimeout(1200);
    let s = await p.evaluate(() => MechAudio.state());
    check(s.track === '战斗音乐1' && s.playing, '我方阶段在放 战斗音乐1', JSON.stringify(s));
    await p.evaluate(() => window.__audio.on.attackStart({att:{side:'ally', mech:'B2'}, def:{side:'enemy'}, w:{unlock:20}}));   // v0.40.23 起只有大招才切
    await p.waitForTimeout(1000);
    s = await p.evaluate(() => MechAudio.state());
    check(s.track === '影世界音乐' && s.playing, '蕾卡放大招 → 影世界音乐', JSON.stringify(s));
    await p.evaluate(() => window.__audio.on.phase({side:'ally', turn:2}));
    await p.waitForTimeout(1000);
    s = await p.evaluate(() => MechAudio.state());
    check(s.track === '战斗音乐1' && s.playing, '新回合 → 回到 战斗音乐1（接着刚才的位置）', JSON.stringify(s));
    console.log('ERRS', JSON.stringify(errs)); if (errs.length) bad++;
    await p.close();
  }
  await b.close();
  console.log(bad ? `✗ ${bad} 项不对` : '✓ 全部通过');
  process.exit(bad ? 1 : 0);
})();
