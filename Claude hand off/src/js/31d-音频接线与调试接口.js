/* ---------- 音频接线（音乐对话维护） ----------
   播放层 MechAudio：2026-10-08 起是 audio/local-music.js（作者本地的版权音乐，不进仓库；读不到文件时声音按钮隐藏）。
   DSH 的合成器（audio/score.js + mech-audio.js）不再打包。曲目表在 local-music.js 里，这里只决定「什么时候放什么」：
     场景 menu（编队 / 肉鸽开局）→ title；map（肉鸽大地图）→ mapStrategy；
     battle → 每个阶段开始按阵营切 allyPhase / enemyPhase，场上有 Boss 级敌人或在终点关时一律 boss；
     主题曲（作者 10-08）：有主题曲的我方机体出手（反击、援护也算）就切成它的主题曲；
       我方阶段在这台机体行动结束（actionEnd）时切回；敌方阶段在下一台敌机主动出手时切回；阶段开始一律切回。
       「出手」现在用 strikeResolved（打完才切，晚半拍）；规则对话加了 attackStart 事件后自动改用它。
     胜利 / 失败 → victory / defeat；有曲子时放完约 6 秒再回到当前场景，没有曲子（现在）就直接淡出。
   音效：现在没有（local-music.js 的 sfx 是空的），snd() 的调用先留着。 */
function snd(name, gap = 70){
  if (!AU || !SOUND.on) return;
  const t = performance.now();
  if (gap && SND_LAST[name] && t - SND_LAST[name] < gap) return;
  SND_LAST[name] = t; AU.sfx(name);
}
const BOSS_MECH = new Set([...ENEMY_BOSS, 'flagship'].map(k => ENEMY_T[k] && ENEMY_T[k].mech).filter(Boolean));
const bossOnField = () => !!(LV && LV.run && /-F-/.test(LV.code || '')) || units.some(u => u.side === 'enemy' && u.hp > 0 && BOSS_MECH.has(u.mech));
function sceneCue(){
  if (SOUND.scene === 'menu') return 'title';
  if (SOUND.scene === 'map') return 'mapStrategy';
  if (SOUND.theme && !over) return SOUND.theme;
  return bossOnField() ? 'boss' : (phaseSide === 'enemy' ? 'enemyPhase' : 'allyPhase');
}
function bgm(id){ if (AU && SOUND.on) AU.play(id); }
/* 切场景：刚放完胜利 / 失败号角的 6 秒内先不切，等它放完 */
function audioScene(scene){
  SOUND.scene = scene; SOUND.theme = null; clearTimeout(SOUND.timer);
  const wait = 6000 - (performance.now() - SOUND.jingleAt);
  if (wait > 0) SOUND.timer = setTimeout(() => bgm(sceneCue()), wait);
  else if (scene !== 'battle') bgm(sceneCue());       // 战斗的曲子由阶段开始决定
}
function audioJingle(id){
  SOUND.theme = null; clearTimeout(SOUND.timer);
  SOUND.jingleAt = (AU && AU.hasCue && !AU.hasCue(id)) ? -1e9 : performance.now();   // 没有胜利 / 失败曲子时不用等
  bgm(id);
}
/* 主题曲 */
const themeOf = u => (AU && AU.themeOf && u && u.side === 'ally') ? AU.themeOf(u.mech, tplOf(u.mech)) : null;
function setTheme(cue){
  if (SOUND.theme === cue) return;
  SOUND.theme = cue;
  if (SOUND.scene === 'battle' && !over && performance.now() - SOUND.jingleAt >= 6000) bgm(sceneCue());
}
function themeOnAttack(c){
  const t = themeOf(c.att);
  if (t) setTheme(t);
  else if (c.att && c.att.side === 'enemy' && !c.counter && phaseSide === 'enemy') setTheme(null);
}
let ATK_HOOK = false;
const AUH = {
  attackStart: c => { ATK_HOOK = true; themeOnAttack(c); },
  strike: c => { if (!ATK_HOOK) themeOnAttack(c); },
  actionEnd: c => { if (c.side === 'ally') setTheme(null); },
};
Hooks.on('attackStart', AUH.attackStart, '音频：出手时切主题曲');
Hooks.on('strikeResolved', AUH.strike, '音频：出手时切主题曲（attackStart 接好前的替代）');
Hooks.on('actionEnd', AUH.actionEnd, '音频：行动结束切回回合曲');
AUH.phase = c => {
  phaseSide = c.side; SOUND.scene = 'battle'; SOUND.theme = null;       // 阶段开始只会发生在战斗里（编队界面结束后）
  if (over || performance.now() - SOUND.jingleAt < 6000) return;
  bgm(sceneCue());
  if (c.side === 'ally' && deadline && deadline - turn <= 1) snd('warn', 0);
};
Hooks.on('phaseStart', AUH.phase, '音频：阶段开始切 BGM');
Hooks.on('strikeResolved', c => snd(!c.hit ? 'miss' : c.crit ? 'crit' : 'hit'), '音频：命中 / 未中 / 暴击');
Hooks.on('unitDestroyed', () => snd('destroy', 40), '音频：击破');
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')){ if (AU) AU.unlock(); snd('ui', 50); } }, true);
function setSound(on){
  SOUND.on = on; try { localStorage.setItem('mecha-tactics-sound', on ? 'on' : 'off'); } catch(e){}
  const b = $('#btnSound'); if (b){ b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '声音' : '静音'; }
  if (!AU) return;
  AU.mute(!on);
  if (on) bgm(sceneCue()); else AU.stop();
}
$('#btnSound').onclick = () => setSound(!SOUND.on);
document.addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) setSound(!SOUND.on); });
if (!AU) $('#btnSound').hidden = true;
else {
  if (AU.onAvailable){ $('#btnSound').hidden = true; AU.onAvailable(ok => { $('#btnSound').hidden = !ok; }); }
  setSound(SOUND.on);
}
/* 测试 / 调试用（音乐对话） */
window.__audio = {themeOf, setTheme, get theme(){ return SOUND.theme; }, on:AUH};   // on.attackStart / strike / actionEnd / phase：只跑音频这边的处理

window.__game = {get HANGAR(){ return HANGAR; }, passageDlg, addTicket, randTicket, get CMD_ENABLED(){ return CMD_ENABLED; }, wStatus, startWait, readyTurnOf, cutCd, startCdOf, get BATTLE_ID(){ return BATTLE_ID; }, RELAYS, deployTiles, startDeploy, doDeploy, doRetreat, doRelay, canRetreat, canRelay, makeUnit, levelUp, reach, zocSet, moveWatched, bestCounter, legalFaces, get phaseNo(){ return phaseNo; }, damageCalc, dispPow, atkStat, wPow, get map(){ return map; }, RELICS, gainRelic(id){ if (RUN && RELICS[id]){ RUN.relics = RUN.relics || []; if (!RUN.relics.includes(id)) RUN.relics.push(id); } return RUN ? RUN.relics : null; }, AIM_BY_CLASS, guardReach, recCost, tierOf, FACTIONS, ticketOk, ticketName, get sound(){ return {on:SOUND.on, scene:SOUND.scene, cue:AU && AU.state().cue}; }, get RUN(){ return RUN; }, STAGES, buildStage, rlogRecord, rlogText, openRunLogs, enterLayer, checkEnd, moveDist, runClickNode, runBattle, moveTargets, partTargets, get level(){ return level; }, get units(){ return units; }, data:{ALLY_T, ENEMY_T, ABIL, COMMANDS, TRIALS, FIRE}, get roster(){ return roster; }, get LV(){ return LV; }, get turn(){ return turn; }, get over(){ return over; }, setSpeed(v){ SPEED = v; }, startLevel, toggleLock, execCommand, attackables, bestWeaponFor, select, weaponUsable, get S(){ return S; }, orderMeteor, resolveMeteors, get CMD(){ return CMD; }, setTurn(t){ turn = t; }, pushUnit, get walls(){ return walls; }, echoArea, finish, zoneOf, battle, onTile, onAction, endTurn, cheatLevel, choosePick, mapDirs, losClear, canHit, forecast, get editor(){ return {ED, store:edStore()}; }, get art(){ return MI; }, unitSprite, iconIdOf,
  /* 给工具用：全部单位模板（含未出场的），tools/roster.mjs 靠它检查图标覆盖率。roster 已被玩家编队占用，所以叫 templates */
  get templates(){ return {allies: ALLY_T, enemies: ENEMY_T, forms: FORMS, debris: DEBRIS_T}; },
  get levels(){ return LEVELS; }};
})();
