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
function reach(u, cap = u.mov){
  const key = (x,y) => y*N+x, best = new Map([[key(u.x,u.y),0]]), pq = [[0,u.x,u.y]], par = new Map();
  while (pq.length){
    pq.sort((a,b) => a[0]-b[0]);
    const [d,x,y] = pq.shift();
    if (d > best.get(key(x,y))) continue;
    for (const [dx,dy] of DIRS){
      const nx = x+dx, ny = y+dy;
      const c = stepCost(u,nx,ny); if (c == null) continue;
      const nd = d + c; if (nd > cap) continue;
      if (nd < (best.get(key(nx,ny)) ?? 1e9)){ best.set(key(nx,ny), nd); par.set(key(nx,ny), [dx,dy]); pq.push([nd,nx,ny]); }
    }
  }
  const out = [];
  for (const [k,d] of best){ const x = k%N, y = (k/N)|0, st = par.get(k); if (canStand(u,x,y)) out.push({x, y, d, face: st ? (st[0] ? (st[0] > 0 ? 'right' : 'left') : (st[1] > 0 ? 'down' : 'up')) : null}); }
  return out;
}
function moveUnit(u,x,y){ if (u.x!==x || u.y!==y){ u.moved = true; u.movedThisRound = true; } u.x = x; u.y = y; }

