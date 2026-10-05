/* ---------- 体积与距离 ---------- */
function tilesOf(u, x=u.x, y=u.y){ const o = []; for (let j=0;j<u.h;j++) for (let i=0;i<u.w;i++) o.push([x+i, y+j]); return o; }
function occupant(x,y){ return units.find(u => u.hp > 0 && x >= u.x && x < u.x+u.w && y >= u.y && y < u.y+u.h); }
function distRect(ax,ay,aw,ah,bx,by,bw,bh){
  const dx = Math.max(0, bx-(ax+aw-1), ax-(bx+bw-1)), dy = Math.max(0, by-(ay+ah-1), ay-(by+bh-1));
  return dx + dy;
}
const distU = (a, b, ax=a.x, ay=a.y) => distRect(ax,ay,a.w,a.h,b.x,b.y,b.w,b.h);
