/* ---------- 敌方机制（敌方设计对话维护，2026-10-09 起） ----------
   敌人的特殊行为、特殊能力放这里。18 的 aiAct 开头按 e.ai 分派到 ENEMY_AI（被骇入 / 眩晕仍然先判定）。
   - ENEMY_AI[key](e)：完全接管这台敌人的行动；
   - 不能被拉、推的敌人写 immovable:true（17 的 pullUnit / pushUnit 开头判定）。 */
const ENEMY_AI = {};

/* ---------- 蓝色大肥鱼（作者 10-09：肉鸽终点 Boss，取代迷宫之主） ----------
   - 3×3，HP、装甲、防御都极高；不会回避；
   - 每个敌方阶段向右走 laneMov 格（默认 2），不看地形、不看控制区，路线上的单位（敌我、中立、召唤物）直接摧毁，力场壁也撞碎；
   - 右边缘碰到地图边 = 游到终点，作战失败；
   - 走完后对身边 2 格内的我方单位放一次周身冲击（必中、地图炮类，不能反击）；武装损坏时不放；
   - 被眩晕 / 骇入那一回合不走；不能被拉、推。
   - 击破它（★）就过关。打法（作者定）：纯数值硬打，或用无视防御 / 特殊伤害 / 按比例的伤害。 */
const laneGoalX = u => MW - u.w;   // 走到这个 x 就算到终点（右边缘贴地图边）
async function laneCrushStep(e){
  const nx = e.x + 1;
  const col = []; for (let j = 0; j < e.h; j++) col.push([nx + e.w - 1, e.y + j]);
  const hit = units.filter(u => u !== e && u.hp > 0 && tilesOf(u).some(([a, b]) => col.some(([c, d]) => a === c && b === d)));
  for (const [c, d] of col) if (walls.has(d*N + c)){ walls.delete(d*N + c); log(`${fullName(e)} 撞碎了力场壁`, null, 'sys'); }
  e.x = nx; e.moved = true; e.facing = 'right';
  for (const u of hit){
    u.hp = 0; u.coreUsed = true;   // 碾压：不触发核心分离
    addFloat(u, '碾碎', '#ff6b5e');
    log(`${fullName(e)} 从 ${fullName(u)} 身上碾了过去`, null, 'sys');
    destroy(u, e);
  }
  refresh(); focusOn(e);
  await sleep(hit.length ? 420 : 200);
}
ENEMY_AI.lane = async function(e){
  focusOn(e); S.inspect = e; refresh();
  await sleep(240);
  const steps = Math.max(0, Math.min(effMov(e), laneGoalX(e) - e.x));
  for (let i = 0; i < steps && !over; i++) await laneCrushStep(e);
  e.facing = 'right';
  if (over) return;
  if (e.x >= laneGoalX(e)){ refresh(); defeat(`${fullName(e)} 游到了终点。`); return; }
  checkEnd(); if (over) return;
  const w = e.weapons.find(w => w.fire === 'map');
  if (w && !e.disarmed){
    const foes = units.filter(u => u.side === 'ally' && u.hp > 0 && distU(e, u) <= w.range[1]);
    if (foes.length){
      log(`${fullName(e)}【${w.name}】周围 ${w.range[1]} 格内 ${foes.length} 台我方机体受到冲击`, null, 'enemy');
      fx('pulse', {b:cpx(e), r:TS * (w.range[1] + 1.5), color:'#7fb8ff', dur:500});
      await sleep(350);
      for (const u of foes) if (u.hp > 0 && units.includes(u)) await strike(e, w, u, null, {skipConsume:true});
      refresh(); checkEnd();
    }
  } else if (e.disarmed) log(`${fullName(e)} 武装损坏，本阶段不能攻击`, null, 'sys');
  e.disarmed = false; e.acted = true;
};
/* 终点线：场上有走直线的敌人时，在右边缘它那几行画一道蓝色终点线 */
Hooks.on('drawOverlay', ({ctx}) => {
  for (const e of units){
    if (e.ai !== 'lane' || e.hp <= 0 || e.side !== 'enemy') continue;
    e.facing = 'right';   // 永远朝右（出场时 31 的 onSpawn 会统一改成朝左，这里扳回来）
    const x = laneGoalX(e) + e.w - 1;
    ctx.fillStyle = 'rgba(80,150,255,.22)'; ctx.fillRect(x*TS, e.y*TS, TS, e.h*TS);
    ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(120,180,255,.95)'; ctx.lineWidth = 2;
    ctx.strokeRect(x*TS+1, e.y*TS+1, TS-2, e.h*TS-2); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(170,210,255,.95)'; ctx.font = '700 11px "Noto Sans SC", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('终点', (x + .5)*TS, e.y*TS - 4); ctx.textAlign = 'start';
    /* 本回合会走到的格子：淡蓝色 */
    const n = Math.min(effMov(e), laneGoalX(e) - e.x);
    if (n > 0){ ctx.fillStyle = 'rgba(80,150,255,.14)'; ctx.fillRect((e.x + e.w)*TS, e.y*TS, n*TS, e.h*TS); }
  }
});
/* 测试接口（敌方对话自己的，__game 归规则对话） */
window.__enemy = {ENEMY_AI, laneGoalX, pullUnit:(a, d, n) => pullUnit(a, d, n), pushUnit:(a, d, n) => pushUnit(a, d, n), destroy:(u, by) => destroy(u, by)};
