/* ============================================================================
 * 本地音乐播放层 MechAudio（音乐对话维护，2026-10-08 起取代 DSH 的合成器）
 * ----------------------------------------------------------------------------
 * 作者试玩用自己电脑上的版权音乐：mp3 放在仓库 audio/ 下，.gitignore 已排除，
 * 不进仓库、不上传。页面从相对路径读它们：
 *   Claude hand off/src/index.html → ../../audio/<文件名>
 * 读不到（claude.ai 试玩页、GitHub Pages、测试环境）就整体不可用，声音按钮隐藏，游戏照常。
 *
 * 接口和 DSH 的 MechAudio 一样（31d 的接线不用大改）：
 *   play(cue)  切到某个场景的曲子（淡出旧的、淡入新的，每首记住播到哪里，切回来接着放）
 *   stop()     全部淡出；mute(bool)；unlock()（浏览器要用户点一下才能出声）；sfx(name)（暂时没有音效）
 *   state()    {ready, cue, track, muted, playing}
 * 新增：
 *   themeOf(mech, tpl)  这台机体出手时放的主题曲 cue（没有就 null）
 *   hasCue(cue)         这个 cue 有没有对应的曲子（胜利 / 失败现在没有）
 *   onAvailable(fn)     文件读得到 / 读不到时回调 fn(true / false)
 * 改曲目只改下面三张表。
 * ========================================================================== */
(function(){
  'use strict';
  /* 曲目：文件名 + 实测响度（LUFS，ffmpeg ebur128）。音量按响度拉平到 REF，所以换曲子要重测 */
  const TRACKS = {
    '主角音乐':     {file:'主角音乐.mp3',     lufs:-15.3},
    '战略音乐1':    {file:'战略音乐1.mp3',    lufs:-15.5},
    '战斗音乐1':    {file:'战斗音乐1.mp3',    lufs:-17.3},
    '战斗音乐2':    {file:'战斗音乐2.mp3',    lufs:-15.9},
    'BOSS BGM':     {file:'BOSS BGM.mp3',     lufs:-15.0},
    '影世界音乐':   {file:'影世界音乐.mp3',   lufs:-8.4},
    '流星小队BGM':  {file:'流星小队BGM.mp3',  lufs:-14.8},
    'ATX小队音乐':  {file:'ATX小队音乐.mp3',  lufs:-17.2},
  };
  /* 场景 → 曲目（作者 10-08 定）。null = 静音（胜利 / 失败暂时没有曲子） */
  const CUES = {
    title:'主角音乐', mapStrategy:'战略音乐1',
    allyPhase:'战斗音乐1', enemyPhase:'战斗音乐2', boss:'BOSS BGM',
    victory:null, defeat:null,
  };
  /* 主题曲（作者 10-08：像机战一样；10-09：只有放大招才切，保持到本回合结束）。先查机体代号，再查主势力；什么时候切在 31d */
  const THEMES = {
    unit:    {B1:'主角音乐'},                          // 雷萨
    faction: {'流星小队':'流星小队BGM', 'ATX':'ATX小队音乐', '影世界':'影世界音乐'},
  };

  const BASE = (typeof window !== 'undefined' && window.MECHA_MUSIC_BASE) || '../../audio/';
  const REF = -17.5, MASTER = 0.8, FADE = 600;
  const gainOf = n => Math.min(1, Math.pow(10, (REF - TRACKS[n].lufs) / 20)) * MASTER;
  const urlOf = n => { try { return new URL(BASE + TRACKS[n].file, document.baseURI).href; } catch(e){ return null; } };
  const nameOf = cue => !cue ? null : cue.startsWith('theme:') ? cue.slice(6) : (CUES[cue] || null);

  const els = {};
  let avail = null, muted = false, unlocked = false, cue = null, cur = null;
  const waiters = [];
  function setAvail(v){ if (avail !== null) return; avail = v; waiters.splice(0).forEach(f => { try { f(v); } catch(e){} }); if (v) resume(); }

  function el(n){
    if (els[n]) return els[n];
    const u = urlOf(n); if (!u || typeof Audio === 'undefined') return null;
    const a = new Audio(); a.preload = 'auto'; a.loop = true; a.volume = 0; a.src = u;
    a._target = 0;
    return (els[n] = a);
  }
  /* 淡入淡出：每 30ms 把每个元素的音量往目标挪一步，到 0 就暂停（保留播放位置） */
  let timer = null;
  function tick(){
    let busy = false;
    for (const n in els){
      const a = els[n], step = 30 / FADE;
      if (a.volume !== a._target){
        const v = a.volume < a._target ? Math.min(a._target, a.volume + step) : Math.max(a._target, a.volume - step);
        a.volume = v; busy = true;
      }
      if (a._target === 0 && a.volume === 0 && !a.paused) a.pause();
    }
    if (!busy){ clearInterval(timer); timer = null; }
  }
  function fadeTo(n, v){ const a = els[n]; if (!a) return; a._target = v; if (!timer) timer = setInterval(tick, 30); }
  function start(n){
    const a = el(n); if (!a) return;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    fadeTo(n, gainOf(n));
  }
  function resume(){ if (cur && avail && !muted && unlocked) start(cur); }

  function play(c){
    cue = c || null;
    const n = nameOf(cue);
    if (n === cur){ resume(); return; }
    if (cur) fadeTo(cur, 0);
    cur = n;
    resume();
  }
  function stop(){ cue = null; if (cur) fadeTo(cur, 0); cur = null; }
  function mute(on){ muted = !!on; if (muted){ for (const n in els) fadeTo(n, 0); } else resume(); }
  function unlock(){ if (unlocked) return; unlocked = true; resume(); }
  function themeOf(mech, tpl){
    const n = THEMES.unit[mech] || (tpl && tpl.tags && THEMES.faction[tpl.tags.势力]);   // 双势力按主势力（拉米亚 → ATX）
    return n && TRACKS[n] ? 'theme:' + n : null;
  }
  function onAvailable(fn){ if (avail !== null) fn(avail); else waiters.push(fn); }
  function state(){ const a = cur && els[cur]; return {ready: !!avail, cue, track: cur, muted, playing: !!(a && !a.paused)}; }

  /* 探测：先载第一首战斗曲的元数据，读得到就算可用 */
  (function probe(){
    const a = el('战斗音乐1');
    if (!a){ setAvail(false); return; }
    a.addEventListener('loadedmetadata', () => setAvail(true), {once:true});
    a.addEventListener('error', () => setAvail(false), {once:true});
    a.load();
  })();
  /* 浏览器要用户手势才放声音：任何一次点击 / 按键都算 */
  if (typeof document !== 'undefined'){
    const u = () => { unlock(); document.removeEventListener('pointerdown', u, true); document.removeEventListener('keydown', u, true); };
    document.addEventListener('pointerdown', u, true); document.addEventListener('keydown', u, true);
  }

  globalThis.MechAudio = {local:true, play, stop, mute, unlock, sfx(){}, setVolume(){}, state, themeOf, hasCue: c => !!nameOf(c), onAvailable, TRACKS, CUES, THEMES};
})();
