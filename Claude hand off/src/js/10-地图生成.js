/* ---------- 地图生成 ---------- */
function genMap(sd){
  const r = mulberry32(sd);
  const m = [...Array(N)].map(() => Array(N).fill('plain'));
  const blob = (cx,cy,rad,t) => {
    for (let y=cy-rad-1; y<=cy+rad+1; y++) for (let x=cx-rad-1; x<=cx+rad+1; x++)
      if (inb(x,y) && Math.hypot(x-cx,y-cy) <= rad*(0.7+r()*0.55)) m[y][x] = t;
  };
  for (let i=0;i<24;i++) blob(ri(r,0,N-1), ri(r,0,N-1), ri(r,1,3), 'forest');
  for (let i=0;i<8;i++){
    let x = ri(r,0,N-1), y = ri(r,0,N-1);
    const horiz = r() < .5, len = ri(r,6,13);
    for (let k=0;k<len;k++){
      m[y][x] = 'mountain';
      if (r() < .45){ const nx = x+(horiz?0:1), ny = y+(horiz?1:0); if (inb(nx,ny)) m[ny][nx] = 'mountain'; }
      if (horiz){ x++; if (r()<.35) y += r()<.5?-1:1; } else { y++; if (r()<.35) x += r()<.5?-1:1; }
      x = clamp(x,0,N-1); y = clamp(y,0,N-1);
    }
  }
  for (let i=0;i<2;i++) blob(ri(r,14,32), ri(r,6,28), ri(r,2,4), 'water');
  let rx = ri(r,12,28);
  for (let y=0;y<N;y++){ m[y][rx] = 'water'; if (r() < .35){ rx = clamp(rx+(r()<.5?-1:1),0,N-1); m[y][rx] = 'water'; } }
  return {m, r};
}
function placeUnits(r){
  units = [];
  const lineup = [...Array(9)].map(() => ENEMY_POOL[Math.floor(r() * ENEMY_POOL.length)]);
  lineup.push(ENEMY_BOSS[(battleNo - 1) % ENEMY_BOSS.length]);
  const blocked = SKIRMISH_SPOTS.map(([x,y]) => ({x, y, w:2, h:2}));
  for (const key of lineup){
    const t = ENEMY_T[key]; let pos = null;
    for (let i=0; i<2000 && !pos; i++){
      const x = ri(r,16,37), y = ri(r,2,24);
      const probe = {x, y, w:t.w, h:t.h};
      if (x+t.w > N || y+t.h > N) continue;
      if (units.some(u => distU(probe, u) < 2) || blocked.some(b => distU(probe, b) < 3)) continue;
      if (!t.flying && tilesOf(probe).some(([a,b]) => map[b][a] === 'water')) continue;
      pos = {x,y};
    }
    if (!pos) continue;
    const u = makeUnit(t, 'enemy', pos.x, pos.y);
    for (let k=1;k<battleNo;k++) levelUp(u);
    u.hp = u.maxHp;
    units.push(u);
  }
}
const SKIRMISH_SPOTS = [[6,33],[9,34],[7,36],[10,30],[4,35],[12,35],[3,31],[13,32],[8,31],[11,37]];
/* 把编队选中的机体放到出击点：大型机体优先，放不下就找最近的空位 */
function placeAllies(list, spots, {clear=false, facing='up'} = {}){
  const order = [...list].sort((a,b) => b.w*b.h - a.w*a.h);
  order.forEach((u, i) => {
    resetForBattle(u);
    let [x,y] = spots[i % spots.length];
    if (clear) for (let j=0;j<u.h;j++) for (let k=0;k<u.w;k++) if (inb(x+k,y+j)) map[y+j][x+k] = 'plain';
    if (!canStand(u, x, y)) [x,y] = freeSpotNear(u, x, y);
    u.x = x; u.y = y; u.facing = facing; u.deployed = true;
    units.push(u);
  });
}

