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
  if (shape === 'box'){   // v0.40.10 选区域的地图炮（苏菲·重力网）：射程内任选一块 size×size，点哪格那格就是左上角
    const sz = w.size || 2, rg = effRange(u, w), out = [];
    for (let y=0;y+sz<=MH;y++) for (let x=0;x+sz<=MW;x++){
      const d = distRect(u.x,u.y,u.w,u.h,x,y,sz,sz); if (d < rg[0] || d > rg[1]) continue;
      const path = []; for (let j=0;j<sz;j++) for (let i=0;i<sz;i++) path.push([x+i, y+j]);
      out.push({box:[x,y], dx:Math.sign(x - u.x), dy:Math.sign(y - u.y), arrow:'□', path, land:null, ok:true, hit:unitsOnTiles(path, u, w)});
    }
    return out;
  }
  return DIR8.filter(Boolean).map(([dx,dy,arrow]) => {
    if (shape === 'line'){
      const len = wv(u, w, 'len'), width = Math.max(wv(u, w, 'width') || 1, taWidth(u, w)), path = [];   // v0.40.16 提耶利亚 TRANS-AM：高压全弹宽 3 格
      for (let k=1; k<=len; k++){
        const cx = u.x+dx*k, cy = u.y+dy*k;
        path.push([cx,cy]);
        if (width >= 3){ if (dx && dy){ path.push([cx-dx, cy]); path.push([cx, cy-dy]); } else { path.push([cx-dy, cy+dx]); path.push([cx+dy, cy-dx]); } }   // v0.40.19 斜向宽 3：每步补上两侧相邻格，18 格连成一片（作者 10-08）
      }
      const inP = path.filter(([x,y]) => inb(x,y));
      return {dx, dy, arrow, path:inP, land:null, ok:inP.length > 0, hit:unitsOnTiles(inP, u, w)};
    }
    const path = [1,2,3,4].flatMap(k => dx && dy ? [[u.x+dx*k, u.y+dy*(k-1)], [u.x+dx*k, u.y+dy*k]] : [[u.x+dx*k, u.y+dy*k]]);   // v0.40.19 斜向冲刺：每步补一格，路径连成一片（作者 10-08）
    const land = [u.x+dx*5, u.y+dy*5];
    const ok = inb(...land) && canStand(u, ...land);
    return {dx, dy, arrow, path, land, ok, hit: ok ? unitsOnTiles(path, u, w) : []};
  });
}

