/* ---------- 朝向 ---------- */
const FACE = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
const FACE_ARROW = {up:'↑', down:'↓', left:'←', right:'→'};
const FACE_NAME = {up:'上', down:'下', left:'左', right:'右'};
const zname = z => z ? ZONE[z].name : '全方位';
const ZONE = {front:{name:'正面', eva:0, crit:0, pierce:0}, side:{name:'侧面', eva:10, crit:10, pierce:25}, back:{name:'背面', eva:20, crit:25, pierce:50}};
const centerOf = (u, x=u.x, y=u.y) => [x + (u.w-1)/2, y + (u.h-1)/2];
function dirToward(from, to, fx=from.x, fy=from.y){
  const [ax,ay] = centerOf(from,fx,fy), [bx,by] = centerOf(to), dx = bx-ax, dy = by-ay;
  if (dx === 0 && dy === 0) return from.facing;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
function zoneOf(att, def, {from, defFacing} = {}){
  const [ax,ay] = from ? centerOf(att, from[0], from[1]) : centerOf(att), [bx,by] = centerOf(def);
  const rx = ax-bx, ry = ay-by, [fx,fy] = FACE[defFacing || def.facing];
  const fw = rx*fx + ry*fy, sd = Math.abs(rx*fy - ry*fx);
  return fw > sd ? 'front' : (-fw > sd ? 'back' : 'side');
}
function terrainOf(u){ let best = null; for (const [x,y] of tilesOf(u)){ const t = TER[map[y][x]]; if (!best || t.def < best.def) best = t; } return best; }

