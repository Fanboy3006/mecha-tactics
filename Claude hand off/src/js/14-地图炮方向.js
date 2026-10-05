/* ---------- 地图炮方向 ---------- */
function unitsOnTiles(path, u, w){
  const hit = [];
  for (const [x,y] of path){ const o = occupant(x,y); if (o && o !== u && !hit.includes(o) && (!w || !w.iff || (o.side !== u.side && o.side !== 'neutral'))) hit.push(o); }
  return hit;
}
function mapDirs(u, w){
  const shape = w && w.shape;
  if (shape === 'burst'){
    const r = wv(u, w, 'rad'), path = [];
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){ const d = distRect(u.x,u.y,u.w,u.h,x,y,1,1); if (d >= 1 && d <= r) path.push([x,y]); }
    return [{burst:true, dx:0, dy:0, arrow:'◎', path, land:null, ok:true, hit:unitsOnTiles(path, u, w)}];
  }
  return DIR8.filter(Boolean).map(([dx,dy,arrow]) => {
    if (shape === 'line'){
      const len = wv(u, w, 'len'), width = wv(u, w, 'width') || 1, path = [];
      for (let k=1; k<=len; k++){
        const cx = u.x+dx*k, cy = u.y+dy*k;
        path.push([cx,cy]);
        if (width >= 3){ path.push([cx-dy, cy+dx]); path.push([cx+dy, cy-dx]); }
      }
      const inP = path.filter(([x,y]) => inb(x,y));
      return {dx, dy, arrow, path:inP, land:null, ok:inP.length > 0, hit:unitsOnTiles(inP, u, w)};
    }
    const path = [1,2,3,4].map(k => [u.x+dx*k, u.y+dy*k]);
    const land = [u.x+dx*5, u.y+dy*5];
    const ok = inb(...land) && canStand(u, ...land);
    return {dx, dy, arrow, path, land, ok, hit: ok ? unitsOnTiles(path, u, w) : []};
  });
}

