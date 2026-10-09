/* ---------- 绘制 ---------- */
const cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#mapWrap');
const dpr = Math.min(2, window.devicePixelRatio || 1);
function setMapSize(w, h, sc = 1){
  MW = w; MH = h; SC = sc;
  cv.width = MW*TS*dpr*SC; cv.height = MH*TS*dpr*SC; cv.style.width = MW*TS*SC + 'px'; cv.style.height = MH*TS*SC + 'px';
  ctx.setTransform(dpr*SC,0,0,dpr*SC,0,0);
  const v = document.querySelector('#mapSize'); if (v) v.textContent = `${MW}×${MH}`;
}
setMapSize(40, 40);

function buildTerrain(){
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = MW*TS*dpr*SC; terrainCanvas.height = MH*TS*dpr*SC;
  const g = terrainCanvas.getContext('2d'); g.setTransform(dpr*SC,0,0,dpr*SC,0,0);
  /* 美术 10-08：像素地块（Ninja Adventure CC0 + 自绘深渊）。素材还没加载完时先用下面的旧画法，加载完自动重画一次。 */
  if (MP && MP.ready()){ buildPixelTerrain(g); return; }
  if (MP && !MP._terrainWait){ MP._terrainWait = true; MP.onReady(() => { if (map && map.length) buildTerrain(); }); }
  const r = mulberry32(seed ^ 0x9e37);
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){
    const t = map[y][x], px = x*TS, py = y*TS;
    g.fillStyle = COL[t]; g.fillRect(px,py,TS,TS);
    if (t === 'plain' && r() < .3){ g.fillStyle = COL.plainDot; g.fillRect(px+4+r()*12, py+4+r()*12, 2, 2); }
    if (t === 'forest'){ g.fillStyle = COL.forestTree;
      for (const [ox,oy] of [[6,9],[14,7],[10,15]]){ g.beginPath(); g.moveTo(px+ox,py+oy-5); g.lineTo(px+ox+4,py+oy+3); g.lineTo(px+ox-4,py+oy+3); g.closePath(); g.fill(); } }
    if (t === 'mountain'){ g.fillStyle = COL.mountainPeak; g.beginPath(); g.moveTo(px+11,py+4); g.lineTo(px+19,py+18); g.lineTo(px+3,py+18); g.closePath(); g.fill(); }
    if (t === 'chasm'){ g.strokeStyle = COL.crack; g.lineWidth = 1; g.beginPath(); g.moveTo(px+3+r()*5,py+2); g.lineTo(px+8+r()*6,py+11); g.lineTo(px+4+r()*8,py+20); g.stroke(); }
    if (t === 'cliff'){ g.strokeStyle = COL.cliffEdge; g.lineWidth = 1.5; for (const o of [4, 10, 16]){ g.beginPath(); g.moveTo(px+o, py+2); g.lineTo(px+o+4, py+TS-2); g.stroke(); } g.strokeRect(px+1, py+1, TS-2, TS-2); }   // v0.34 绝壁：深色岩壁 + 斜纹
    if (t === 'abyss'){ g.strokeStyle = COL.abyssRing; g.lineWidth = 1.2; for (const rr of [3, 6, 9]){ g.beginPath(); g.arc(px+TS/2, py+TS/2, rr, 0, Math.PI*2); g.stroke(); } }   // v0.34 重力深渊：紫色同心圆
    if (t === 'water'){ g.strokeStyle = COL.wave; g.lineWidth = 1.2;
      for (const oy of [8,15]){ g.beginPath(); g.moveTo(px+4,py+oy); g.quadraticCurveTo(px+8,py+oy-3,px+11,py+oy); g.quadraticCurveTo(px+14,py+oy+3,px+18,py+oy); g.stroke(); } }
  }
}
/* ---------- 像素地块（美术 10-08） ----------
 * 每格 16px 的地块先拼到一张小画布上，再整张放大到地图尺寸（不平滑，保持像素颗粒）。
 * 裂谷 / 绝壁 / 水面按上下左右邻格自动拼边；2×2 的树林放一棵大树，2×2 的山放一块大岩。 */
const MP = (typeof MechPixel !== 'undefined') ? MechPixel : null;
function buildPixelTerrain(g){
  const T = 16, A = MP.img.__atlas, atl = MP.data.atl, cols = MP.data.cols;
  const off = document.createElement('canvas'); off.width = MW*T; off.height = MH*T;
  const o = off.getContext('2d'); o.imageSmoothingEnabled = false;
  const put = (name, x, y) => {
    const e = atl[name]; if (!e) return;
    const [i0, w, h] = e;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++){
      const idx = i0 + j*w + i;
      o.drawImage(A, (idx % cols)*T, Math.floor(idx / cols)*T, T, T, (x+i)*T, (y+j)*T, T, T);
    }
  };
  const at = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? null : map[y][x];
  const same = (x, y, t) => { const v = at(x, y); return v === null || v === t; };
  const r = mulberry32(seed ^ 0x51a7);
  const GR = ['grass0','grass0','grass0','grass1','grass2','grass3','grass4','grass5'];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) put(GR[Math.floor(r()*GR.length)], x, y);
  const big = new Set();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++){
    const t = map[y][x];
    if (t === 'chasm'){
      const W = same(x-1,y,t), E = same(x+1,y,t), N = same(x,y-1,t), S2 = same(x,y+1,t);
      put('hole' + (!W ? 0 : !E ? 3 : 1 + (x&1)) + (!N ? 0 : !S2 ? 3 : 1 + (y&1)), x, y);
    } else if (t === 'cliff'){
      const W = same(x-1,y,t), E = same(x+1,y,t), N = same(x,y-1,t), S2 = same(x,y+1,t);
      put('cliff' + ((!W && !E) ? 0 : !W ? 1 : !E ? 3 : 2) + (!N ? 0 : !S2 ? 2 : 1), x, y);
    } else if (t === 'water'){
      const W = same(x-1,y,t), E = same(x+1,y,t), N = same(x,y-1,t), S2 = same(x,y+1,t);
      if (!W && !E && !N && !S2) put('water39', x, y);
      else if (!W && !E) put('water3' + (!N ? 6 : !S2 ? 8 : 7), x, y);
      else if (!N && !S2) put('water' + (!W ? 0 : !E ? 2 : 1) + '9', x, y);
      else put('water' + (!W ? 0 : !E ? 2 : 1) + (!N ? 6 : !S2 ? 8 : 7), x, y);
    } else if (t === 'abyss') put('abyss' + ((x + y) & 1), x, y);
    else if (t === 'mountain') put('dirt', x, y);
  }
  // 树和岩石最后画（会盖到上一行一点点）
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++){
    const t = map[y][x]; if ((t !== 'forest' && t !== 'mountain') || big.has(y*MW+x)) continue;
    if (at(x+1,y) === t && at(x,y+1) === t && at(x+1,y+1) === t && !big.has(y*MW+x+1)){
      put(t === 'forest' ? (((x + y) & 1) ? 'treeA' : 'treeB') : 'boulder', x, y);
      [0, 1, MW, MW+1].forEach(d => big.add(y*MW + x + d));
    } else put(t === 'forest' ? 'bush' : ((x*7 + y*3) % 3 ? 'rock' : 'rockB'), x, y);
  }
  g.imageSmoothingEnabled = false;
  g.drawImage(off, 0, 0, MW*TS, MH*TS);
}
/* 网格线和坐标数字：调试用，默认关闭（DSH 表现层）。 */
function drawGrid(){
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (let i=0;i<=MW;i++){ ctx.beginPath(); ctx.moveTo(i*TS+.5,0); ctx.lineTo(i*TS+.5,MH*TS); ctx.stroke(); }
  for (let i=0;i<=MH;i++){ ctx.beginPath(); ctx.moveTo(0,i*TS+.5); ctx.lineTo(MW*TS,i*TS+.5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(223,231,239,.35)'; ctx.font = '9px JetBrains Mono, monospace';
  for (let i=0;i<MW;i+=5) ctx.fillText(String(i), i*TS+2, 9);
  for (let i=5;i<MH;i+=5) ctx.fillText(String(i), 2, i*TS+9);
}
function computeThreat(){
  const s = new Set();
  for (const e of units.filter(u => u.side === 'enemy')){
    let mr = 0; e.weapons.forEach(w => { if (!wStatus(e,w,{counter:true})) mr = Math.max(mr, w.range[1]); });
    for (const t of reach(e)) for (const [fx,fy] of tilesOf(e,t.x,t.y))
      for (let dy=-mr; dy<=mr; dy++) for (let dx=-mr+Math.abs(dy); dx<=mr-Math.abs(dy); dx++){
        const x = fx+dx, y = fy+dy; if (inb(x,y)) s.add(y*N+x);
      }
  }
  return s;
}
const FX = [];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cpx = u => [(u.x + u.w/2)*TS, (u.y + u.h/2)*TS];
function fx(type, o = {}){
  if (reduceMotion) return Promise.resolve();
  const dur = (o.dur || 300) * SPEED;
  FX.push({type, ...o, dur, t0: performance.now()});
  return new Promise(r => setTimeout(r, dur));
}
function fxAttack(att, w, def){
  const a = cpx(att), b = cpx(def);
  if (w.fire === 'melee' || w.fire === 'map') return fx('slash', {b, color: w.dmgType === '光束' ? '#9ff3ff' : '#fff2c4', dur:240});
  if (w.fire === 'indirect') return fx('arc', {a, b, dur:440});
  if (w.fire === 'passive') return fx('pulse', {b, r:TS*1.2, color:'#c9a8ff', dur:260});
  if (w.dmgType === '光束') return fx('beam', {a, b, color:'#7fe7ff', dur:260});
  return fx('tracer', {a, b, dur:300});
}
const arcS = (x, y, r, a, b) => ctx.arc(x, y, Math.max(0, r), a, b);
function drawFX(now){
  for (let i = FX.length-1; i >= 0; i--){
    const f = FX[i], k = (now - f.t0) / f.dur;
    if (k >= 1){ FX.splice(i,1); continue; }
    ctx.save();
    if (f.type === 'beam'){
      ctx.globalAlpha = 1 - k*0.6; ctx.strokeStyle = f.color; ctx.lineCap = 'round';
      ctx.shadowColor = f.color; ctx.shadowBlur = 10;
      ctx.lineWidth = 5*(1-k) + 1; ctx.beginPath(); ctx.moveTo(...f.a); ctx.lineTo(...f.b); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(...f.a); ctx.lineTo(...f.b); ctx.stroke();
    } else if (f.type === 'tracer'){
      ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let j=0;j<3;j++){
        const t = Math.min(1, Math.max(0, k*1.4 - j*0.18)); if (t <= 0 || t >= 1) continue;
        const x = f.a[0] + (f.b[0]-f.a[0])*t, y = f.a[1] + (f.b[1]-f.a[1])*t, t2 = Math.max(0, t - .08);
        ctx.beginPath(); ctx.moveTo(f.a[0] + (f.b[0]-f.a[0])*t2, f.a[1] + (f.b[1]-f.a[1])*t2); ctx.lineTo(x, y); ctx.stroke();
      }
    } else if (f.type === 'arc'){
      const h = Math.max(40, Math.hypot(f.b[0]-f.a[0], f.b[1]-f.a[1]) * .45);
      const pt = t => [f.a[0] + (f.b[0]-f.a[0])*t, f.a[1] + (f.b[1]-f.a[1])*t - h*4*t*(1-t)];
      ctx.strokeStyle = 'rgba(255,200,120,.55)'; ctx.lineWidth = 2; ctx.setLineDash([3,4]); ctx.beginPath();
      for (let t=Math.max(0,k-.35); t<=k; t+=.02){ const [x,y] = pt(t); t === Math.max(0,k-.35) ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
      ctx.stroke(); ctx.setLineDash([]);
      const [x,y] = pt(k); ctx.fillStyle = '#ffd38a'; ctx.shadowColor = '#ffb04a'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2); ctx.fill();
    } else if (f.type === 'slash'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.shadowColor = f.color; ctx.shadowBlur = 8;
      const r = TS*0.8, st = -2.4 + k*1.2;
      ctx.beginPath(); arcS(f.b[0], f.b[1], r, st, st + 2.2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); arcS(f.b[0]+3, f.b[1]-2, r*.7, st+.4, st + 2.4); ctx.stroke();
    } else if (f.type === 'burst'){
      const r = (f.big ? TS*1.8 : TS*0.9) * (0.3 + k);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = f.crit ? 'rgba(255,190,80,.55)' : 'rgba(255,140,60,.45)';
      ctx.beginPath(); arcS(f.b[0], f.b[1], r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff1c9'; ctx.lineWidth = 2; ctx.beginPath(); arcS(f.b[0], f.b[1], r*.75, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#ffe0a8';
      for (let j=0;j<8;j++){ const an = j*Math.PI/4 + (f.seed||0), d = r*1.15; ctx.fillRect(f.b[0] + Math.cos(an)*d - 1.5, f.b[1] + Math.sin(an)*d - 1.5, 3, 3); }
    } else if (f.type === 'spark'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#8fe1ff'; ctx.lineWidth = 2;
      ctx.beginPath(); arcS(f.b[0], f.b[1], TS*0.7 + k*6, 0, Math.PI*2); ctx.stroke();
    } else if (f.type === 'miss'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#c9d3dd'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(f.b[0] - TS*0.9, f.b[1] - TS*0.3 + k*4); ctx.lineTo(f.b[0] + TS*0.9, f.b[1] - TS*0.6 + k*4); ctx.stroke(); ctx.setLineDash([]);
    } else if (f.type === 'heal'){
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#9fe0b8'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center';
      for (let j=0;j<4;j++) ctx.fillText('+', f.b[0] - 8 + j*5, f.b[1] + 6 - k*18 - (j%2)*5);
      ctx.strokeStyle = 'rgba(159,224,184,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); arcS(f.b[0], f.b[1], TS*0.6 + k*6, 0, Math.PI*2); ctx.stroke();
    } else if (f.type === 'pulse'){
      ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      ctx.beginPath(); arcS(f.b[0], f.b[1], f.r * k + 4, 0, Math.PI*2); ctx.stroke();
    } else if (f.type === 'warp'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#a07bff'; ctx.shadowBlur = 10;
      ctx.beginPath(); arcS(f.b[0], f.b[1], TS*(f.out ? 0.2 + k : 1.2 - k), 0, Math.PI*2); ctx.stroke();
    } else if (f.type === 'dash'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#b28cff'; ctx.lineWidth = TS*0.6*(1-k); ctx.lineCap = 'round'; ctx.shadowColor = '#b28cff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(...f.a); ctx.lineTo(...f.b); ctx.stroke();
    } else if (f.type === 'meteor'){
      if (k < .6){
        const t = k/.6, sx = f.b[0] + 220, sy = f.b[1] - 300, x = sx + (f.b[0]-sx)*t, y = sy + (f.b[1]-sy)*t;
        ctx.strokeStyle = 'rgba(255,170,90,.7)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 40, y - 55); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = '#ffdca8'; ctx.shadowColor = '#ff8a3c'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI*2); ctx.fill();
      } else {
        const t = (k-.6)/.4; ctx.globalAlpha = 1 - t; ctx.fillStyle = 'rgba(255,150,70,.55)';
        ctx.beginPath(); arcS(f.b[0], f.b[1], TS*(1 + t*2.2), 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff1c9'; ctx.lineWidth = 3; ctx.beginPath(); arcS(f.b[0], f.b[1], TS*(0.8 + t*2.6), 0, Math.PI*2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function addFloat(u, text, color){ if (color === '#9fe0b8' && text[0] === '+') snd('heal');   // 回复类数字都走这里，顺便出回复音效
  floats.push({x:u.x*TS+u.w*TS/2, y:u.y*TS, text, color, t0:performance.now()}); }
/* v0.38 朝向范围：当前朝向下，能用来反击 / 压制射击的武器打得到的格子 */
const covCache = new Map();   // v0.39.4 改成多份缓存：移动时要同时画几台敌方狙击的射界
function coverCells(u){
  const k = `${u.uid}|${u.x},${u.y}|${u.facing}|${u.lv}|${turn}|${units.length}`;
  if (covCache.has(k)) return covCache.get(k);
  const ws = u.weapons.filter(w => u.lv >= (w.unlock || 1) && ATTACK_FIRES.includes(w.fire) && !isSure(w) && !wStatus(u, w, {counter:true}));
  const out = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++){
    if (tilesOf(u).some(([a, b]) => a === x && b === y)) continue;
    const dummy = {x, y, w:1, h:1, flying:false, side:'neutral', abilities:[]};
    if (ws.some(w => canHit(u, w, dummy, u.x, u.y, u.facing))) out.push({x, y});
  }
  if (covCache.size > 60) covCache.clear();
  covCache.set(k, out);
  return out;
}
function drawCover(u, color){
  const cs = coverCells(u); if (!cs.length) return;
  ctx.fillStyle = color; for (const t of cs) ctx.fillRect(t.x*TS+1, t.y*TS+1, TS-1, TS-1);
}
/* v0.40 前线中继：三脚架 + 天线 + 顶灯，外面一圈慢慢扩散的信号环（原来是青色菱形，看不出是什么） */
function drawRelay(r, now){
  const cx = r.x*TS + TS/2, by = r.y*TS + TS - 2, top = r.y*TS + 3, k = ((now || 0) % 1600) / 1600;
  ctx.save();
  ctx.strokeStyle = 'rgba(127,230,255,' + (0.7 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, top + 2, 3 + k * TS * 0.7, 0, Math.PI * 2); ctx.stroke();
  ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1016'; ctx.lineWidth = 4;
  const legs = [[cx - TS*0.32, by], [cx + TS*0.32, by], [cx, by - 2]];
  for (const [x, y] of legs){ ctx.beginPath(); ctx.moveTo(cx, top + 6); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx, top + 2); ctx.lineTo(cx, by - 3); ctx.stroke();
  ctx.strokeStyle = '#9fb4c6'; ctx.lineWidth = 2;
  for (const [x, y] of legs){ ctx.beginPath(); ctx.moveTo(cx, top + 6); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.strokeStyle = '#d7e3ee'; ctx.beginPath(); ctx.moveTo(cx, top + 2); ctx.lineTo(cx, by - 3); ctx.stroke();
  ctx.fillStyle = '#7fe6ff'; ctx.strokeStyle = '#0b1016'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, top + 2, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function fillTiles(list, color){ ctx.fillStyle = color; for (const t of list) ctx.fillRect(t.x*TS+1, t.y*TS+1, TS-1, TS-1); }
function draw(now){
  ctx.clearRect(0,0,MW*TS,MH*TS);
  if (terrainCanvas) ctx.drawImage(terrainCanvas, 0, 0, MW*TS, MH*TS);
  if (S.grid) drawGrid();
  if (LV && LV.zone){
    const z = LV.zone;
    ctx.fillStyle = 'rgba(92,192,138,.20)'; ctx.fillRect(z.x0*TS, z.y0*TS, (z.x1-z.x0+1)*TS, (z.y1-z.y0+1)*TS);
    ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(120,220,160,.9)'; ctx.lineWidth = 2;
    ctx.strokeRect(z.x0*TS+1, z.y0*TS+1, (z.x1-z.x0+1)*TS-2, (z.y1-z.y0+1)*TS-2); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,240,190,.95)'; ctx.font = '700 12px "Noto Sans SC", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('撤离区', (z.x0 + (z.x1-z.x0+1)/2)*TS, z.y0*TS + 16); ctx.textAlign = 'start';
  }
  if (LV && LV.breach){   // v0.40.5 防线（需求单 #9，关卡字段 breach）：敌方阶段结束时有地面敌人站在里面就判负
    const z = LV.breach;
    ctx.fillStyle = 'rgba(224,90,79,.16)'; ctx.fillRect(z.x0*TS, z.y0*TS, (z.x1-z.x0+1)*TS, (z.y1-z.y0+1)*TS);
    ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(240,110,95,.9)'; ctx.lineWidth = 2;
    ctx.strokeRect(z.x0*TS+1, z.y0*TS+1, (z.x1-z.x0+1)*TS-2, (z.y1-z.y0+1)*TS-2); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,170,160,.95)'; ctx.font = '700 12px "Noto Sans SC", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('防线', (z.x0 + (z.x1-z.x0+1)/2)*TS, z.y0*TS + 16); ctx.textAlign = 'start';
  }
  if (CMD){
    for (const m of CMD.pending){
      ctx.setLineDash([4,3]); ctx.strokeStyle = 'rgba(255,120,90,.95)'; ctx.lineWidth = 2;
      const xs = m.cells.map(c => c[0]), ys = m.cells.map(c => c[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      ctx.fillStyle = 'rgba(255,120,90,.16)'; ctx.fillRect(x0*TS, y0*TS, (x1-x0+1)*TS, (y1-y0+1)*TS);
      ctx.strokeRect(x0*TS+1, y0*TS+1, (x1-x0+1)*TS-2, (y1-y0+1)*TS-2); ctx.setLineDash([]);
      ctx.fillStyle = '#ffd0c0'; ctx.font = '700 12px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`☄${m.land - turn}`, (x0 + (x1-x0+1)/2)*TS, (y0 + (y1-y0+1)/2)*TS + 4); ctx.textAlign = 'start';
    }
    if (S.mode === 'command' && S.hover && COMMANDS[CMD.skill].kind === 'area'){
      ctx.fillStyle = 'rgba(255,120,90,.35)';
      for (const [x,y] of cmdCells(S.hover.x, S.hover.y)) ctx.fillRect(x*TS+1, y*TS+1, TS-1, TS-1);
    }
  }
  drawTileDecor();                       // 第 2 层：地块修饰（力场墙等）
  if (S.mode === 'device'){
    ctx.fillStyle = 'rgba(110,220,255,.22)'; for (const t of S.devTiles) ctx.fillRect(t.x*TS+1, t.y*TS+1, TS-1, TS-1);
    if (S.hover && S.devTiles.some(t => t.x === S.hover.x && t.y === S.hover.y)){
      ctx.fillStyle = 'rgba(110,220,255,.65)'; for (const [x,y] of wallTiles(S.sel, S.hover.x, S.hover.y)) ctx.fillRect(x*TS+1, y*TS+1, TS-1, TS-1);
    }
  }
  if (S.mode === 'portal'){ ctx.fillStyle = 'rgba(170,120,240,.42)'; for (const t of S.portalTiles) ctx.fillRect(t.x*TS+1, t.y*TS+1, TS-1, TS-1); }
  if (S.threat && S.threatSet){
    ctx.fillStyle = 'rgba(233,162,59,.13)'; ctx.strokeStyle = COL.threat; ctx.lineWidth = 1.5;
    for (const k of S.threatSet){
      const x = k%N, y = (k/N)|0, px = x*TS, py = y*TS;
      ctx.fillRect(px,py,TS,TS);
      ctx.beginPath();
      if (y===0 || !S.threatSet.has(k-N)){ ctx.moveTo(px,py); ctx.lineTo(px+TS,py); }
      if (y===MH-1 || !S.threatSet.has(k+N)){ ctx.moveTo(px,py+TS); ctx.lineTo(px+TS,py+TS); }
      if (x===0 || !S.threatSet.has(k-1)){ ctx.moveTo(px,py); ctx.lineTo(px,py+TS); }
      if (x===MW-1 || !S.threatSet.has(k+1)){ ctx.moveTo(px+TS,py); ctx.lineTo(px+TS,py+TS); }
      ctx.stroke();
    }
  }
  if (hangarOn()){
    if (S.mode === 'deploy') fillTiles(S.depTiles, 'rgba(127,230,255,.35)');
    else if (S.mode === 'idle' && HANGAR.length){ ctx.strokeStyle = 'rgba(127,230,255,.45)'; ctx.lineWidth = 1; for (const k of baseDeploySet()){ const x = k % N, y = (k / N) | 0; ctx.strokeRect(x*TS+2.5, y*TS+2.5, TS-5, TS-5); } }
    for (const r of RELAYS.values()) drawRelay(r, now);
  }
  if (S.sel && ['menu','weapon','pick'].includes(S.mode)) drawCover(S.sel, abilOn(S.sel, 'overwatch') ? 'rgba(255,211,107,.22)' : 'rgba(233,162,59,.14)');
  else if (S.mode === 'idle' && S.inspect && S.inspect.hp > 0 && S.inspect.side !== 'neutral') drawCover(S.inspect, S.inspect.side === 'enemy' ? 'rgba(224,90,79,.13)' : 'rgba(233,162,59,.14)');
  if (S.mode === 'moving' || S.mode === 'moving2'){
    fillTiles(S.reach, COL.move);
    ctx.strokeStyle = 'rgba(224,90,79,.85)'; ctx.lineWidth = 1.5;   // v0.36 控制区：走到这里就得停
    for (const t of S.reach) if (t.zoc) ctx.strokeRect(t.x*TS+3.5, t.y*TS+3.5, TS-7, TS-7);
    if (S.sel) for (const s of watchers(S.sel)) drawCover(s, 'rgba(255,110,60,.26)');   // v0.39.4 敌方压制射击的射界：走进去会挨一发
  }
  if (S.mode === 'target' || S.mode === 'confirm' || S.mode === 'lock') fillTiles(S.atkTiles, COL.atk);
  if (S.mode === 'mapdir' || S.mode === 'mapconfirm'){
    for (const d of S.dirs){
      if (!d.ok) continue;
      const active = S.dir === d;
      if (S.mode === 'mapconfirm' && !active) continue;
      ctx.fillStyle = active ? 'rgba(233,162,59,.6)' : COL.map;
      for (const [x,y] of d.path) if (inb(x,y)) ctx.fillRect(x*TS+1, y*TS+1, TS-1, TS-1);
      if (d.land){ ctx.strokeStyle = '#e9a23b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(d.land[0]*TS+TS/2, d.land[1]*TS+TS/2, TS/2-3, 0, Math.PI*2); ctx.stroke(); }
    }
  }
  if (S.sel && S.mode === 'menu' && hasTrait(S.sel,'autoCast') && autoWeapon(S.sel) && autoWeapon(S.sel).fire === 'support'){
    ctx.fillStyle = 'rgba(92,192,138,.28)';
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){ const d = distRect(S.sel.x,S.sel.y,1,1,x,y,1,1); if (d >= 1 && d <= autoWeapon(S.sel).range[1]) ctx.fillRect(x*TS+1,y*TS+1,TS-1,TS-1); }
  }
  if (S.mode === 'support'){
    ctx.fillStyle = S.weapon.foe ? 'rgba(224,90,79,.30)' : 'rgba(92,192,138,.32)';
    const rr = effRange(S.sel, S.weapon)[1];
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){ const d = distRect(S.sel.x,S.sel.y,1,1,x,y,1,1); if (d >= (S.weapon.self ? 0 : 1) && d <= rr) ctx.fillRect(x*TS+1,y*TS+1,TS-1,TS-1); }
  }
  if (S.mode === 'heal'){
    ctx.fillStyle = 'rgba(92,192,138,.38)';
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){ const d = distRect(S.sel.x,S.sel.y,1,1,x,y,1,1); if (d >= 1 && d <= S.weapon.range[1]) ctx.fillRect(x*TS+1,y*TS+1,TS-1,TS-1); }
  }
  if (S.sel && ['menu','weapon','heal'].includes(S.mode) && regenWeapon(S.sel)){
    ctx.strokeStyle = 'rgba(92,192,138,.75)'; ctx.lineWidth = 1;
    const r = regenWeapon(S.sel).range[1];
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) if (distRect(S.sel.x,S.sel.y,1,1,x,y,1,1) <= r) ctx.strokeRect(x*TS+3.5,y*TS+3.5,TS-7,TS-7);
  }
  if (S.sel && ['menu','weapon','support'].includes(S.mode) && echoWeapon(S.sel)){
    const ar = echoArea(S.sel);
    ctx.fillStyle = 'rgba(170,120,235,.22)';
    for (const k of ar.set) ctx.fillRect((k%N)*TS, ((k/N)|0)*TS, TS, TS);
  }
  drawSmoke(ctx);   // v0.40.11 烟雾弹（17b）
  if (S.echoFlash){
    const age = (now - S.echoFlash.t0)/1000;
    if (age > 1.2) S.echoFlash = null;
    else { ctx.fillStyle = `rgba(190,140,255,${.45*(1-age/1.2)})`; for (const k of S.echoFlash.set) ctx.fillRect((k%N)*TS, ((k/N)|0)*TS, TS, TS); }
  }
  for (const u of units) if (u.side !== 'neutral') drawUnitGround(u);
  for (const u of units) if (u.side === 'neutral') drawUnitGround(u);
  drawUnitLinks();                       // 第 4 层附加：单位之间的连线
  /* 格子级的框选提示画在机体下面，机体才不会被线切过 */
  if ((S.mode === 'menu' || S.mode === 'pick') && S.atkList && S.atkList.length){
    const pulse = 1 + Math.sin(now/180), strong = S.mode === 'pick';
    ctx.strokeStyle = strong ? '#ff7a6b' : 'rgba(255,122,107,.75)'; ctx.lineWidth = strong ? 3 : 1.5;
    for (const e of S.atkList){
      if (strong){ ctx.fillStyle = 'rgba(255,90,70,.18)'; ctx.fillRect(e.x*TS, e.y*TS, e.w*TS, e.h*TS); }
      ctx.strokeRect(e.x*TS-pulse, e.y*TS-pulse, e.w*TS+pulse*2, e.h*TS+pulse*2);
    }
    if (strong && S.pickSel && S.atkList.includes(S.pickSel)){
      const e = S.pickSel; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.strokeRect(e.x*TS-pulse-2, e.y*TS-pulse-2, e.w*TS+pulse*2+4, e.h*TS+pulse*2+4);
    }
  }
  if (S.mode === 'target' || S.mode === 'confirm'){
    ctx.strokeStyle = '#ffd38a'; ctx.lineWidth = 2;
    const pulse = 1 + Math.sin(now/180);
    for (const e of targetsFor(S.sel, S.weapon)) ctx.strokeRect(e.x*TS-pulse, e.y*TS-pulse, e.w*TS+pulse*2, e.h*TS+pulse*2);
  }
  if (S.mode === 'lock'){
    const pulse = 1 + Math.sin(now/180);
    for (const e of targetsFor(S.sel, S.weapon)){
      const on = S.locks.includes(e);
      ctx.strokeStyle = on ? '#ffffff' : '#ffd38a'; ctx.lineWidth = on ? 3 : 2;
      ctx.strokeRect(e.x*TS-pulse, e.y*TS-pulse, e.w*TS+pulse*2, e.h*TS+pulse*2);
    }
  }
  if (S.target && S.mode === 'confirm'){ ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(S.target.x*TS+1, S.target.y*TS+1, S.target.w*TS-2, S.target.h*TS-2); }
  if (S.cursor && !S.sel && units.includes(S.cursor)){ const c = S.cursor, pl = 2 + Math.sin(now/150)*1.5; ctx.setLineDash([5,3]); ctx.strokeStyle = '#ffd38a'; ctx.lineWidth = 2; ctx.strokeRect(c.x*TS-pl, c.y*TS-pl, c.w*TS+pl*2, c.h*TS+pl*2); ctx.setLineDash([]); }
  if (S.sel){ ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(S.sel.x*TS+1, S.sel.y*TS+1, S.sel.w*TS-2, S.sel.h*TS-2); }
  if (S.hover){ ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.strokeRect(S.hover.x*TS+.5, S.hover.y*TS+.5, TS-1, TS-1); }

  /* 第二趟：机体精灵。按「脚印下沿」排序，这样前面的会盖住后面的 */
  const order = units.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.x - b.x);
  for (const u of order) drawUnitSprite(u);
  /* 第 7 层：机体附加（光罩 / 屏障 / 光环） */
  for (const u of order) drawUnitAura(u);
  /* 第三趟：状态标记，永远在最上层 */
  for (const u of order) drawUnitStatus(u);
  drawPickMarks();                       // 选目标的 ▶ 和锁定序号也要压在机体上面
  drawFX(now);
  for (let i = floats.length-1; i >= 0; i--){
    const f = floats[i], age = (now - f.t0)/1000;
    if (age > 1.1){ floats.splice(i,1); continue; }
    ctx.globalAlpha = 1 - Math.max(0, age-0.6)/0.5;
    ctx.font = '700 14px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText(f.text, f.x, f.y - age*18); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - age*18);
    ctx.globalAlpha = 1; ctx.textAlign = 'start';
  }
  requestAnimationFrame(draw);
}
/* ---------- 机体图标（原创矢量素材） · 表现层 ----------
 * 几何数据来自内联的 MechIcons 模块，源文件是 art/mech-icons.js
 * （用 tools/build-src.mjs 注入，不要直接改 HTML 里那一段）。
 *
 * 表现方式（参考 SD 高达 G 世纪的读法）：
 *   1. 机体精灵**比它占的格子大**：1×1 的机体画成约 1.7 格宽、1.9 格高，
 *      底部对齐格子下沿、水平居中，允许盖住相邻格 —— 这样才有「站在格子上」的
 *      立体感，而不是被塞进一格色块里。按行号排序绘制，前面的挡住后面的。
 *   2. 占位不用填充底板，改用**地面标记**：我方是压扁的方形、敌方是圆形（沿用
 *      「我方方块、敌方圆形」的读法），底下垫一层柔和的投影椭圆。
 *   3. 精灵、地面标记、状态标记分三趟画：地面 → 机体（按行序）→ 状态（永远在最上）。
 *
 * 每个「图标 + 调色板 + 占地 + 细节等级」组合只离屏渲染一次，之后每帧 drawImage。
 */
const SPR_MUL = {1: 1.55, 2: 1.3, 3: 1.2};  // 精灵宽度 = 占地宽 × 该系数（格）
const SPR_HEADROOM = 0.08;                   // 精灵上方额外留白（占精灵宽的比例）
const SPR_RES = 88;                          // 精灵宽度的离屏像素
const SPR_OUTLINE = '#05070d';               // 机体外描边（重叠时也分得开）
const spriteCache = new Map();
const MI = (typeof MechIcons !== 'undefined') ? MechIcons : null;

function iconIdOf(u){
  if (!MI) return null;
  if (u.side === 'neutral') return u.chest ? 'chest' : 'debris';   // v0.40 补给箱有自己的图标
  // 变身形态：图标写在 FORMS 的 icon 字段上，不在这里硬编码
  if (u.transformed && u.transform){
    const f = FORMS[u.transform];
    return (f && f.icon) || (MI.ICON_BY_MECH[u.mech] || null);
  }
  return MI.ICON_BY_MECH[u.mech] || stockIcon(u);
}
/* 还没画专属图标的机体：先借用同「战斗分类」的原型剪影（配色仍按自己的势力）。
   这和 art/README 9.4「地图只负责认出定位」的约定一致。tools/roster.mjs 照样会把它们列为缺图标。 */
const STOCK_BY_ROLE = {近卫:'B1', 尖兵:'B2', 指挥:'M1', 重装:'M2', 狙击:'CB2', 特种:'CB3'};
function stockIcon(u){
  if (u.side === 'ally') return STOCK_BY_ROLE[roleOf(u)] || 'B1';
  const fp = Math.max(u.w || 1, u.h || 1);
  if (fp >= 3) return 'flagship';
  if (fp === 2) return 'fortress';
  return u.flying ? 'fighter' : 'grunt';
}
/* 势力 → 调色板；分类 → 胸口核心色。两个都从单位自己的 tags 读，
   所以**加新角色 / 新势力不用改这里的代码**，只要在 MechIcons 里补调色板。 */
function palKeyOf(u){
  if (u.side === 'neutral') return 'rock';
  if (u.side === 'enemy') return 'enemy';
  if (u.acted) return 'acted';
  return MI.FACTION_PAL[u.tags && u.tags.势力] || 'cb';
}
function roleOf(u){ return (u.tags && u.tags.战斗分类) || null; }
/* 精灵的几何参数：以「逻辑像素」为单位，乘以 SC 就是屏幕尺寸 */
function spriteSpec(u){
  const pi = pixelInfo(u);
  if (pi) return {fp: Math.max(u.w, u.h), box: pi.s * pi.unit, h: pi.s * pi.unit, pixel: true};
  const fp = Math.max(u.w, u.h);
  const box = TS * fp * (SPR_MUL[fp] || 1.3);            // 精灵宽度 = 图标盒边长
  return {fp, box, h: box * (1 + SPR_HEADROOM)};         // 画布比宽度高一点，留头顶余量
}
/* 精灵在画布上的落点（左上角），脚底正好落在格子下沿 */
function spriteRect(u){
  const px = u.x*TS, py = u.y*TS, W = u.w*TS, H = u.h*TS;
  const pi = pixelInfo(u);
  if (pi){ const w = pi.cw * pi.unit, h = pi.ch * pi.unit; return {x: px + W/2 - w/2, y: py + H - h, w, h}; }
  const sp = spriteSpec(u);
  return {x: px + (W - sp.box)/2, y: py + H - sp.h, w: sp.box, h: sp.h};
}
function unitSprite(u){
  const pi = pixelInfo(u);
  if (pi) return pixelSprite(u, pi);
  if (!MI) return null;
  const id = iconIdOf(u);
  if (!id) return null;
  const pal = palKeyOf(u), role = roleOf(u), sp = spriteSpec(u);
  // 实际显示尺寸 = 精灵宽 × 地图缩放；用它决定细节等级
  const size = sp.box * SC;
  const lod = size <= 26 ? 's' : size <= 46 ? 'm' : 'l';
  const key = id + '|' + pal + '|' + role + '|' + sp.fp + '|' + lod;
  let spr = spriteCache.get(key);
  if (!spr){
    spr = MI.makeSprite(id, {
      pal, plate: 'none', role, size, lod,
      headroom: SPR_HEADROOM, outline: SPR_OUTLINE,
    }, Math.round(SPR_RES * sp.fp * (SPR_MUL[sp.fp] || 1.2)));
    spriteCache.set(key, spr);
  }
  return spr;
}
/* ---------- 像素画精灵（美术 10-08：Q 版像素，接近机战 A） ----------
 * 素材在 art/mech-icons.js 末尾的 MechPixel 段（art/pixel/build_pixel.py 生成）。
 *   精锐 24px（带动态招牌特效）、骨干 20px（阿布拉德坦克 32px）、其余我方按「势力头 × 职业机身」16px、地面 1×1 敌人 16px；
 *   飞行敌人、2×2 以上的敌人、2×2 的普通档、中立物体暂时还用原来的矢量图标。
 * 朝向直接画在机体上：朝下 = 正面，朝上 = 背面，左右 = 侧面（朝左镜像）。
 * 1 个精灵像素 ≈ PX_TARGET 个逻辑像素，按设备像素取整，保证颗粒锐利。 */
const PX_TARGET = TS * 1.25 / 16;   // 16px 的精灵约占 1.25 格
const PX_PAD = 8;                   // 精锐特效留的边（精灵像素）
const PX_FAC = {影世界:'ying', 月球王国:'moon', 天人:'cb', 克莱因派:'clyne', 预防者:'prev', ATX:'atx', 秘银:'mith', 演习:'drill'};
const PX_CLS = {近卫:'guard', 尖兵:'striker', 指挥:'command', 重装:'heavy', 狙击:'sniper', 特种:'special'};
function pixelKey(u){
  if (!MP || !MP.ready()) return null;
  const S = MP.data.spr;
  if (u.side === 'neutral') return null;
  if (u.side === 'enemy') return (u.w === 1 && u.h === 1 && !u.flying) ? 'enemy_grunt' : null;
  if (u.transformed && u.transform){ const f = FORMS[u.transform]; return f && S[f.icon] ? f.icon : null; }
  if (S[u.mech]) return u.mech;
  if (u.w > 1) return null;
  const k = PX_FAC[u.tags && u.tags.势力] + '_' + PX_CLS[roleOf(u)];
  return S[k] ? k : null;
}
function pixelInfo(u){
  const key = pixelKey(u); if (!key) return null;
  const d = MP.data.spr[key], s = d.s, k = Math.max(1, Math.round(PX_TARGET * SC * dpr));
  const pad = d.fx ? PX_PAD : 0;
  return {key, d, s, k, unit: k / (SC * dpr), pad, cw: s + pad*2, ch: s + pad + 1};
}
const pxGray = new Map();
function pixelSprite(u, pi){
  const now = performance.now();
  const dir = u.facing || 'down', view = dir === 'down' ? 0 : dir === 'up' ? 2 : 1, flip = dir === 'left';
  const still = reduceMotion || u.acted;
  const bob = still ? 0 : Math.floor((now + u.uid*137) / 480) % 2;
  const fx = pi.d.fx && !u.acted && !reduceMotion;
  const ck = pi.key + '|' + view + flip + '|' + pi.k + '|' + bob + (u.acted ? 'a' : '');
  if (!fx && pxGray.has(ck)) return pxGray.get(ck);
  const c = (fx && u._pxc && u._pxc.width === pi.cw*pi.k && u._pxc.height === pi.ch*pi.k) ? u._pxc : document.createElement('canvas');
  c.width = pi.cw*pi.k; c.height = pi.ch*pi.k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(pi.k, 0, 0, pi.k, 0, 0);
  const x = pi.pad, y = pi.pad + 1 - bob, img = MP.img[pi.key], s = pi.s;
  if (fx) pixelFX(g, pi.d.fx, dir, x, y, s, now, false);
  if (flip){ g.save(); g.translate(x*2 + s, 0); g.scale(-1, 1); g.drawImage(img, view*s, 0, s, s, x, y, s, s); g.restore(); }
  else g.drawImage(img, view*s, 0, s, s, x, y, s, s);
  if (fx) pixelFX(g, pi.d.fx, dir, x, y, s, now, true);
  if (u.acted){   // 已行动：去色压暗
    g.setTransform(1, 0, 0, 1, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height), p = im.data;
    for (let i = 0; i < p.length; i += 4){ const v = (p[i]*.3 + p[i+1]*.55 + p[i+2]*.15) * .62; p[i] = p[i+1] = p[i+2] = v; }
    g.putImageData(im, 0, 0);
  }
  if (fx) u._pxc = c; else pxGray.set(ck, c);
  return c;
}
/* 精锐的招牌特效（在精灵像素坐标里画）。front=false 画在机体后面，true 画在前面。 */
function pixelFX(g, id, dir, x, y, S0, now, front){
  const P = (c, a, b, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(a), Math.round(b), w, h); };
  const cx = x + 12, cy = y + 12, t = now / 1000;
  if (id === 'rasa'){
    for (let i = 0; i < 6; i++){
      const a = t*1.4 + i*Math.PI/3, ex = cx + Math.cos(a)*14, ey = cy + Math.sin(a)*7 - 2;
      if ((Math.sin(a) > 0) !== front) continue;
      P('#2a1840', ex-1, ey-1, 3, 3); P('#ff4fd0', ex, ey-1, 1, 3); P('#ffd9f4', ex, ey-1);
    }
  }
  if (id === 'feena' && !front){
    const hx = cx + (dir === 'right' ? -2 : dir === 'left' ? 2 : 0), hy = y + 6;
    for (let a = -2.3; a <= 2.3; a += .07){
      const ox = hx + Math.cos(a - Math.PI/2)*9, oy = hy + Math.sin(a - Math.PI/2)*9;
      P('#fff7c9', ox, oy);
    }
    for (let i = 0; i < 4; i++){ const k = (t*0.6 + i/4) % 1; P(`rgba(220,240,255,${1-k})`, x + 3 + i*6, y + 22 - k*20); }
  }
  if (id === 'setsuna' && !front){
    for (let i = 0; i < 10; i++){ const k = (t*0.9 + i/10) % 1;
      const sx = cx + (dir === 'right' ? -7 : dir === 'left' ? 7 : (i%2 ? -4 : 4)) + Math.sin(i*1.7 + t*3)*2;
      P(i%3 ? '#7dff9a' : '#d6ffe2', sx, y + 14 - k*16); }
  }
  if (id === 'lacus'){
    for (let i = 0; i < 4; i++){
      const a = t*1.1 + i*Math.PI/2, ex = cx + Math.cos(a)*15, ey = cy - 4 + Math.sin(a)*8;
      if ((Math.sin(a) > 0) !== front) continue;
      P('#141622', ex-1, ey-2, 3, 5); P('#ffb6d6', ex, ey-1, 1, 3); P('#ffffff', ex, ey-1);
    }
  }
  if (id === 'heero' && front && (t % 1.6) < .4){
    const fx0 = dir === 'down' ? x + 20 : dir === 'right' ? x + 24 : dir === 'left' ? x - 1 : null, fy = dir === 'down' ? y + 1 : y + 13;
    if (fx0 !== null){ P('#ffffff', fx0 - 1, fy, 3, 1); P('#ffffff', fx0, fy - 1, 1, 3); }
  }
  if (id === 'kyosuke' && (dir === 'up') === front){
    const fl = Math.floor(now / 70) % 3;
    const xs = (dir === 'down' || dir === 'up') ? [x+3, x+19] : dir === 'right' ? [x+4] : [x+18];
    for (const fx0 of xs){ P('#ffe066', fx0, y + 9, 2, 1 + fl); P('#ff8a3d', fx0, y + 10 + fl, 2, 1); }
  }
  if (id === 'sousuke' && front){
    const p = (Math.sin(t*2.4) + 1) / 2, R = 13 + p;
    g.globalAlpha = .45 + p*.4;
    for (let i = 0; i < 6; i++){
      const a0 = i*Math.PI/3 + Math.PI/6, a1 = a0 + Math.PI/3;
      for (let s2 = 0; s2 <= 1; s2 += .05) P('#ffe9a8', cx + Math.cos(a0)*R*(1-s2) + Math.cos(a1)*R*s2, cy + 1 + (Math.sin(a0)*R*(1-s2) + Math.sin(a1)*R*s2)*.8);
    }
    g.globalAlpha = 1;
  }
}
/* 圆角矩形路径（不依赖 ctx.roundRect） */
function rrectPath(g, x, y, w, h, r){
  r = Math.max(0, Math.min(r, Math.min(w, h)/2));
  g.beginPath();
  if (!r){ g.rect(x, y, w, h); return; }
  g.moveTo(x+r, y);
  g.lineTo(x+w-r, y); g.arcTo(x+w, y, x+w, y+r, r);
  g.lineTo(x+w, y+h-r); g.arcTo(x+w, y+h, x+w-r, y+h, r);
  g.lineTo(x+r, y+h); g.arcTo(x, y+h, x, y+h-r, r);
  g.lineTo(x, y+r); g.arcTo(x, y, x+r, y, r);
  g.closePath();
}
/* 占位标记的底色：我方按势力、敌方红、中立灰、已行动灰 */
function groundColor(u){
  if (u.side === 'neutral') return '#9b8d7e';
  if (u.acted && u.side === 'ally') return COL.acted;
  if (u.side === 'enemy') return COL.enemy;
  return FACTION_COL[u.tags && u.tags.势力] || COL.ally;
}

/* 地面标记的几何：机体站在上面，标记压在「脚」的位置 */
function groundGeom(u){
  const px = u.x*TS, py = u.y*TS, W = u.w*TS, H = u.h*TS;
  const gw = W * 0.98, gh = H * 0.40;
  return {px, py, W, H, cx: px + W/2, gw, gh, gx: px + (W - gw)/2, gy: py + H - gh*0.62};
}

/* ---- 第一趟：地面（投影 + 占位标记），在所有机体之下 ---- */
function drawUnitGround(u){
  const {px, py, W, H, cx, gw, gh, gx, gy} = groundGeom(u);
  const col = groundColor(u);

  /* 投影：几层递减的椭圆冒充软阴影 */
  for (let i = 3; i >= 1; i--){
    ctx.globalAlpha = 0.055 + 0.035*i;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx + H*0.05*i, gy + gh*0.5 + gh*0.16*i, (gw/2)*(1 + i*0.16), (gh/2)*(1 + i*0.26), 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* 占位标记：我方压扁的方形、敌方圆形 */
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  if (u.side === 'enemy' && u.w === 1){
    ctx.beginPath(); ctx.ellipse(cx, gy + gh/2, gw/2, gh/2, 0, 0, Math.PI*2); ctx.stroke();
  } else {
    rrectPath(ctx, gx, gy, gw, gh, Math.min(gw, gh)*0.34); ctx.stroke();
  }
  /* 内侧淡填充，让「占了哪一格」更明确 */
  ctx.globalAlpha = 0.16; ctx.fillStyle = col;
  if (u.side === 'enemy' && u.w === 1){
    ctx.beginPath(); ctx.ellipse(cx, gy + gh/2, gw/2, gh/2, 0, 0, Math.PI*2); ctx.fill();
  } else {
    rrectPath(ctx, gx, gy, gw, gh, Math.min(gw, gh)*0.34); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---- 第二趟：机体精灵（按行序，前面的挡住后面的） ---- */
function drawUnitSprite(u){
  const r = spriteRect(u), spr = unitSprite(u);
  if (spr){
    if (u.hidden || hasStealth(u)){      // 隐蔽 / 虚影 / 隐身（ECS、超级干扰器等）：半透明
      ctx.save(); ctx.globalAlpha = 0.42;
      ctx.drawImage(spr, r.x, r.y, r.w, r.h);
      ctx.restore();
    } else {
      ctx.drawImage(spr, r.x, r.y, r.w, r.h);
    }
    return;
  }
  /* 没有对应图标时退回简单的色块，至少还能玩 */
  const px = u.x*TS, py = u.y*TS, W = u.w*TS, H = u.h*TS;
  ctx.fillStyle = u.acted ? COL.acted : (u.side === 'ally' ? COL.ally : COL.enemy);
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1;
  ctx.beginPath();
  if (u.side === 'ally' || u.w > 1) ctx.rect(px+2, py+2, W-4, H-6);   // 原来写的 BAR_H 没有定义，走到这里会报错
  else ctx.arc(px+TS/2, py+TS/2-1, TS/2-2.5, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
}

/* ---- 第三趟：状态标记（永远画在最上层，不被机体挡住） ---- */
function drawUnitStatus(u){
  const px = u.x*TS, py = u.y*TS, W = u.w*TS, H = u.h*TS;

  /* 朝向：机体比格子大，画在格子里会被挡住，所以画到**地面标记的朝向那一边**上，
     并且在状态这一趟（最上层）绘制，永远不会被机体压住。 */
  { const g0 = groundGeom(u), {cx, gy, gh, gx, gw} = g0;
    const [fx,fy] = FACE[u.facing];
    const s = Math.max(3.8, TS*0.22);
    // 标在圆环圆周的四个方位上
    let px2, py2;
    if (fx === 1)       { px2 = gx + gw; py2 = gy + gh/2; }
    else if (fx === -1) { px2 = gx;      py2 = gy + gh/2; }
    else if (fy === 1)  { px2 = cx;      py2 = gy + gh; }
    else                { px2 = cx;      py2 = gy; }
    ctx.fillStyle = '#ffe9b8'; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px2 + fx*s*0.7, py2 + fy*s*0.7);
    ctx.lineTo(px2 - fx*s*0.45 + fy*s*0.85, py2 - fy*s*0.45 + fx*s*0.85);
    ctx.lineTo(px2 - fx*s*0.45 - fy*s*0.85, py2 - fy*s*0.45 - fx*s*0.85);
    ctx.closePath(); ctx.fill(); ctx.stroke(); }

  /* HP 条：放在机体头顶上方（地面标记在脚下，机体在中间，三者不打架）。
     用 segBar 画，所以装甲层 / 护盾值这类「多段血条」以后只要多传一段即可 —— 
     只传一段时和原来的单条 HP 条长得一模一样。 */
  const sp = spriteSpec(u);
  const spriteTop = py + H - sp.h;
  const barW = Math.max(W * 0.92, TS * 0.8), barX = px + W/2 - barW/2, barY = spriteTop + 1;
  const r = u.hp/u.maxHp;
  const segs = [{ratio: r, color: r > .5 ? '#5cc08a' : r > .25 ? '#e9a23b' : '#d9564b'}];
  if (u.shield) segs.unshift({ratio: (u.shieldHp || 0) / u.shield, color: '#7fe6ff'});   // 护盾值（U7 的 λ 力场等）
  // 机制接进来时往前面插段：装甲层、护盾值……例如
  //   if (u.shieldHp > 0) segs.unshift({ratio: u.shieldHp/u.shieldMax, color:'#7fe6ff'});
  ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(barX-1, barY-1, barW+2, 5);
  segBar(barX, barY, barW, 3, segs);

  /* 蓄力 / 充能进度：贴着血条下面一条细线，没有该状态就不画 */
  if (u.charge != null){
    const cw = barW * 0.72, cx0 = px + W/2 - cw/2, cy0 = barY + 5;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx0, cy0, cw, 2);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(cx0, cy0, cw * Math.max(0, Math.min(1, u.charge)), 2);
  }

  /* 增益 / 减益徽记：堆在机体头顶上方一排，没有就不画 */
  if (u.badgeList && u.badgeList.length) badgeRow(px + W/2, spriteTop - 10, u.badgeList, 5);

  /* 机体名（可选，默认关闭：会盖住机体） */
  if (S.names){
    const t = u.transformed ? 'NAD' : u.short;
    ctx.font = '700 9px "Noto Sans SC", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(t).width + 7, cxm = px + W/2, cym = py + H - 12;
    ctx.fillStyle = 'rgba(6,9,14,.82)';
    rrectPath(ctx, cxm-w/2, cym-6, w, 12, 3); ctx.fill();
    ctx.fillStyle = '#e8eef6'; ctx.fillText(t, cxm, cym);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  /* 破防层数 */
  if (breakSum(u)){
    ctx.fillStyle = '#ff6b5e'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.font = '700 9px "Noto Sans SC", sans-serif'; ctx.lineWidth = 2;
    ctx.strokeText('破' + u.debuffs.length, px+1, py+9); ctx.fillText('破' + u.debuffs.length, px+1, py+9);
  }
  /* 飞行标记（右上角白色小三角，加描边才看得清） */
  if (u.flying){
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px+W-8,py+1); ctx.lineTo(px+W-1,py+1); ctx.lineTo(px+W-4.5,py+6); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  /* 被骇入 */
  if (u.stunned){ ctx.strokeStyle = '#c9a8ff'; ctx.lineWidth = 2; ctx.strokeRect(px+1, py+1, W-2, H-2); }
}

/* ============================================================================
 *  可视层与可复用标记组件
 * ----------------------------------------------------------------------------
 * 角色池和机制还会继续膨胀（新势力、护盾、标记、地面改造、羁绊连线……），所以把
 * 绘制顺序固化成一份**明确的层表**。加新机制时是「往某一层里加一个组件」，
 * 而不是回头改 draw()。层序（从下到上）：
 *
 *   1  地形        地形预渲染位图（buildTerrain）
 *   1b 网格        调试开关，默认关（drawGrid）
 *   2  地块修饰    墙 / 地雷 / 力场 / 区域效果……（drawTileDecor）
 *   3  范围提示    移动范围、攻击范围、威胁范围、地图炮路径、撤离区、陨石预警
 *   4  单位地面    投影 + 占位环 + 单位之间的连线（drawUnitGround / drawUnitLinks）
 *   5  格子框选    选中框、目标框、光标框（画在机体下面，机体才不会被线切过）
 *   6  机体        机体精灵，按脚印下沿排序，前面的挡住后面的（drawUnitSprite）
 *   7  机体附加    包住机体的光罩 / 屏障 / 光环（drawUnitAura）
 *   8  单位状态    多段血条、蓄力条、增益减益徽记、朝向、飞行、破译、机体名（drawUnitStatus）
 *   9  特效        FX 系统
 *   10 浮动数字    伤害 / 回复数字
 *
 * 组件（都设计成「没有对应状态时什么都不画」，不会影响现有画面）：
 *   segBar()      多段条：HP / 装甲层 / 护盾值可以一条条叠着画
 *   badgeRow()    增益减益徽记堆叠（带溢出计数）
 *   auraRing()    包住机体的光罩 / 光环
 *   unitLink()    单位之间的连线（羁绊、锁定、治疗链）
 *   tileDecor()   地块修饰的统一样式入口
 * ======================================================================== */

/* 多段条：把 [{ratio,color}] 从左到右依次画出来，用细缝分隔。
 * 只传一段时和原来的单条 HP 条完全一样。 */
function segBar(x, y, w, h, segs){
  const n = segs.length;
  if (!n) return;
  const gap = n > 1 ? 1 : 0;
  const each = (w - gap * (n - 1)) / n;
  let cx = x;
  for (let i = 0; i < n; i++){
    const s = segs[i];
    ctx.fillStyle = s.back || 'rgba(0,0,0,.55)';
    ctx.fillRect(cx, y, each, h);
    if (s.ratio > 0){
      ctx.fillStyle = s.color;
      ctx.fillRect(cx, y, each * Math.max(0, Math.min(1, s.ratio)), h);
    }
    cx += each + gap;
  }
}

/* 增益 / 减益徽记：一排小方块（最多 max 个，多的显示 +N）。
 * badges = [{color, glyph?}]，glyph 是 1 个字符（可以不传） */
function badgeRow(cx, y, badges, max){
  if (!badges || !badges.length) return;
  max = max || 5;
  const s = 8, gap = 2;
  const show = badges.slice(0, max);
  const over = badges.length - show.length;
  const totalW = show.length * s + (show.length - 1) * gap + (over > 0 ? s + gap : 0);
  let x = cx - totalW / 2;
  for (const b of show){
    ctx.fillStyle = 'rgba(6,9,14,.82)';
    rrectPath(ctx, x - 1, y - 1, s + 2, s + 2, 2); ctx.fill();
    ctx.fillStyle = b.color;
    rrectPath(ctx, x, y, s, s, 2); ctx.fill();
    if (b.glyph){
      ctx.fillStyle = 'rgba(0,0,0,.75)';
      ctx.font = '700 7px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.glyph, x + s/2, y + s/2 + 0.5);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
    x += s + gap;
  }
  if (over > 0){
    ctx.fillStyle = 'rgba(6,9,14,.82)';
    rrectPath(ctx, x - 1, y - 1, s + 2, s + 2, 2); ctx.fill();
    ctx.fillStyle = '#cfd8e4';
    ctx.font = '700 7px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+' + over, x + s/2, y + s/2 + 0.5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }
}

/* 包住机体的光罩 / 光环。kind 决定形状与配色，现在先支持 'shield' 一种。 */
function auraRing(u, kind, color){
  const g0 = groundGeom(u), sp = spriteSpec(u);
  const cx = g0.cx, cy = g0.py + g0.H - sp.h * 0.46;
  const rx = sp.box * 0.46, ry = sp.h * 0.42;
  ctx.save();
  ctx.globalAlpha = 0.20; ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

/* 单位之间的连线（羁绊 / 锁定 / 治疗链）。画在地面层，压在机体下面。 */
function unitLink(a, b, o){
  o = o || {};
  const c1 = [a.x*TS + a.w*TS/2, a.y*TS + a.h*TS - TS*0.18];
  const c2 = [b.x*TS + b.w*TS/2, b.y*TS + b.h*TS - TS*0.18];
  ctx.save();
  ctx.globalAlpha = o.alpha == null ? 0.7 : o.alpha;
  ctx.strokeStyle = o.color || '#ffd38a';
  ctx.lineWidth = o.width || 2;
  if (o.dashed) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  if (o.curved !== false){
    const mx = (c1[0] + c2[0]) / 2, my = (c1[1] + c2[1]) / 2 - Math.hypot(c2[0]-c1[0], c2[1]-c1[1]) * 0.12;
    ctx.moveTo(c1[0], c1[1]); ctx.quadraticCurveTo(mx, my, c2[0], c2[1]);
  } else {
    ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* 地块修饰：墙 / 地雷 / 力场 / 区域效果……
 * 现在只有「力场墙」一种，样式和原来完全一致；新机制往这里加分支即可。 */
function tileDecor(k, kind){
  const x = k % N, y = (k / N) | 0, px = x*TS, py = y*TS;
  if (kind === 'wall'){
    ctx.fillStyle = 'rgba(110,220,255,.55)'; ctx.fillRect(px+1, py+1, TS-2, TS-2);
    ctx.strokeStyle = 'rgba(200,245,255,.95)'; ctx.lineWidth = 1.5; ctx.strokeRect(px+2.5, py+2.5, TS-5, TS-5);
  }
}

/* ---- 第 2 层：地块修饰（所有墙一起画） ---- */
function drawTileDecor(){
  if (walls.size) for (const [k] of walls) tileDecor(k, 'wall');
}

/* ---- 第 4 层附加：单位之间的连线 ---- */
function drawUnitLinks(){
  for (const l of unitLinks){
    const a = units.find(u => u === l.a || u.mech === l.a);
    const b = units.find(u => u === l.b || u.mech === l.b);
    if (a && b && a.hp > 0 && b.hp > 0) unitLink(a, b, l);
  }
}

/* ---- 第 7 层：机体附加（光罩 / 光环） ---- */
function drawUnitAura(u){
  /* u.shield 是护盾上限，u.shieldHp 才是剩余值；打空后光罩消失，己方阶段开始回满时再出现 */
  if (u.shield > 0 && u.shieldHp > 0) auraRing(u, 'shield', u.shieldColor || '#7fe6ff');
}

/* 单位之间的连线列表。机制接进来时往这里 push：
   unitLinks.push({a: 单位A, b: 单位B, color:'#ffd38a', dashed:true}) */
const unitLinks = [];

function drawPickMarks(){
  if (S.mode === 'pick' && S.pickSel && S.atkList && S.atkList.includes(S.pickSel)){
    const e = S.pickSel; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3; ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.strokeText('▶', e.x*TS-11, e.y*TS+e.h*TS/2+4); ctx.fillText('▶', e.x*TS-11, e.y*TS+e.h*TS/2+4);
  }
  if (S.mode === 'lock' && S.locks) for (const e of S.locks){
    const t = String(S.locks.indexOf(e)+1); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3; ctx.font = '700 10px JetBrains Mono, monospace';
    ctx.strokeText(t, e.x*TS+e.w*TS-7, e.y*TS+9); ctx.fillText(t, e.x*TS+e.w*TS-7, e.y*TS+9);
  }
}
function focusOn(u, smooth=true){
  if (!u) return;
  wrap.scrollTo({left:u.x*TS*SC - wrap.clientWidth/2, top:u.y*TS*SC - wrap.clientHeight/2, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'});
}

