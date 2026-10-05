/* ---------- 视线（直射） ---------- */
function lineSteps(x0,y0,x1,y1){
  const steps = [], nx = Math.abs(x1-x0), ny = Math.abs(y1-y0), sx = Math.sign(x1-x0), sy = Math.sign(y1-y0);
  let x = x0, y = y0, ix = 0, iy = 0;
  while (ix < nx || iy < ny){
    const a = (1+2*ix)*ny, b = (1+2*iy)*nx;
    if (a === b){ steps.push({corner:[[x+sx,y],[x,y+sy]]}); x += sx; y += sy; ix++; iy++; }
    else if (a < b){ x += sx; ix++; }
    else { y += sy; iy++; }
    steps.push({tile:[x,y]});
  }
  return steps;
}
function losClear(att, ax, ay, tgt){
  const own = new Set(tilesOf(att,ax,ay).map(([x,y]) => y*N+x)), tg = new Set(tilesOf(tgt).map(([x,y]) => y*N+x));
  const blocked = (x,y) => {
    const k = y*N+x;
    if (own.has(k) || tg.has(k)) return false;
    if (walls.has(k)) return true;
    const o = occupant(x,y);
    if (tgt.flying){
      // 空中目标：地面阻挡（山地、地面单位）都不算，只有中间的空中大型敌方单位会挡
      return !!(o && o !== att && o.side !== att.side && o.flying && o.w * o.h > 1);
    }
    if (TER[map[y][x]].blockLOS) return true;
    return !!(o && o !== att && o.side !== att.side);
  };
  for (const [a0,a1] of tilesOf(att,ax,ay)) for (const [b0,b1] of tilesOf(tgt)){
    let ok = true;
    for (const s of lineSteps(a0,a1,b0,b1)){
      if (s.tile){ if (blocked(...s.tile)){ ok = false; break; } }
      else if (blocked(...s.corner[0]) && blocked(...s.corner[1])){ ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

