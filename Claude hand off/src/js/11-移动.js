/* ---------- 移动 ---------- */
function canStand(u, x, y, ignoreOcc=false){
  for (const [tx,ty] of tilesOf(u,x,y)){
    if (!inb(tx,ty)) return false;
    if (walls.has(ty*N+tx)) return false;
    const t = TER[map[ty][tx]];
    if (u.flying ? t.flyBlock : t.groundBlock) return false;
    if (!ignoreOcc){ const o = occupant(tx,ty); if (o && o !== u) return false; }
  }
  return true;
}
function stepCost(u, x, y){
  let c = 0;
  for (const [tx,ty] of tilesOf(u,x,y)){
    if (!inb(tx,ty)) return null;
    if (walls.has(ty*N+tx)) return null;
    const t = TER[map[ty][tx]];
    if (u.flying ? t.flyBlock : t.groundBlock) return null;
    const o = occupant(tx,ty);
    if (o && o !== u && o.side !== u.side) return null;
    c = Math.max(c, u.flying || abilOn(u,'beastMode') ? 1 : t.cost);
  }
  return c;
}
/* v0.36 控制区（ZOC，作者 10-06 定）：
   - 敌方机体上下左右相邻的格子（大体积按整个身体外围）是它的控制区；
   - 走进敌方控制区的格子就要停下；起点已经在控制区里的可以正常离开；
   - 没有控制区：空中的机体、召唤物（summon）、中立单位；
   - 无视控制区：尖兵（zocFree）、隐形机（stealth）。传送不走路，本来就不受影响。 */
const zocFree = u => u.abilities.includes('zocFree') || u.abilities.includes('stealth');
const exertsZoc = o => o.hp > 0 && o.side !== 'neutral' && !o.flying && !o.abilities.includes('summon');
function zocSet(u){
  const s = new Set();
  if (zocFree(u)) return s;
  for (const o of units){
    if (o === u || o.side === u.side || !exertsZoc(o)) continue;
    for (const [tx,ty] of tilesOf(o)) for (const [dx,dy] of DIRS){ const nx = tx+dx, ny = ty+dy; if (inb(nx,ny)) s.add(ny*N+nx); }
  }
  return s;
}
const inZoc = (u, x, y, zs) => zs.size > 0 && tilesOf(u,x,y).some(([a,b]) => zs.has(b*N+a));
function reach(u, cap = u.mov, opts = {}){
  const zs = opts.zoc === false ? new Set() : zocSet(u);
  const key = (x,y) => y*N+x, best = new Map([[key(u.x,u.y),0]]), pq = [[0,u.x,u.y]], par = new Map();
  while (pq.length){
    pq.sort((a,b) => a[0]-b[0]);
    const [d,x,y] = pq.shift();
    if (d > best.get(key(x,y))) continue;
    if ((x !== u.x || y !== u.y) && inZoc(u, x, y, zs)) continue;   // 进了控制区：停下
    for (const [dx,dy] of DIRS){
      const nx = x+dx, ny = y+dy;
      const c = stepCost(u,nx,ny); if (c == null) continue;
      const nd = d + c; if (nd > cap) continue;
      if (nd < (best.get(key(nx,ny)) ?? 1e9)){ best.set(key(nx,ny), nd); par.set(key(nx,ny), [dx,dy]); pq.push([nd,nx,ny]); }
    }
  }
  const out = [];
  for (const [k,d] of best){ const x = k%N, y = (k/N)|0, st = par.get(k); if (canStand(u,x,y)) out.push({x, y, d, zoc: (x !== u.x || y !== u.y) && inZoc(u, x, y, zs), face: st ? (st[0] ? (st[0] > 0 ? 'right' : 'left') : (st[1] > 0 ? 'down' : 'up')) : null}); }
  return out;
}
function moveUnit(u,x,y){ if (u.x!==x || u.y!==y){ u.moved = true; u.movedThisRound = true; } u.x = x; u.y = y; }

