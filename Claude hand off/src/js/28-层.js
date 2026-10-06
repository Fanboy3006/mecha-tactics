/* ---------- 层 ---------- */
async function enterLayer(n){
  RUN.layer = n; RUN.layerBattles = 0;
  if (n === 4){ RUN.map = null; runRender(); await runFinal(); return; }
  RUN.map = genLayer(n, RUN.seedBase + n * 101);
  RUN.cur = RUN.map.start; RUN.prev = RUN.cur;
  RUN.visited = new Set([RUN.cur]); RUN.revealed = new Set();
  RUN.erosion = n >= 2 ? pick(Object.keys(EROSIONS)) : null; RUN.erosionCleared = false;
  RUN.layerPropBonus = RUN.chased ? -2 : 0; RUN.chased = false;
  RUN.prop = propMax();
  const he = [0,3,6,10][skLv('理财')]; if (he){ RUN.he += he; runLog(`理财：源碳结晶 +${he}`); }
  runLog(`进入第 ${n} 层航区${RUN.erosion ? `，侵蚀场【${EROSIONS[RUN.erosion].name}】生效` : ''}`);
  runRender();
  if (RUN.erosion) await dlg(`<div class="eyebrow" style="color:#ff5ec4">第 ${n} 层 · 侵蚀场</div><h2>${EROSIONS[RUN.erosion].name}</h2><p>${EROSIONS[RUN.erosion].desc}</p><p class="small">找到本层的侵蚀源（✹）并击败守卫，就能解除。</p><div class="acts"><button class="btn primary" data-v="ok">知道了</button></div>`);
}
const knownSet = () => {
  const s = new Set(), R = sightR();
  for (const v of RUN.visited) for (const k in RUN.map.nodes) if (gdist(+k, v) <= R) s.add(+k);
  for (const k of RUN.revealed) s.add(k);
  return s;
};
const typeVisible = k => knownSet().has(k) || (skLv('侦察') >= 2);
function moveDist(){
  const N = RUN.map.nodes, d = new Map([[RUN.cur, 0]]), q = [RUN.cur];
  while (q.length){ const k = q.shift(); if (d.get(k) >= RUN.prop) continue; for (const n of nbrs(k)) if (N[n] && !d.has(n)){ d.set(n, d.get(k) + 1); q.push(n); } }
  return d;
}
function moveTargets(){
  if (!RUN.map || RUN.prop <= 0) return [];
  return [...moveDist()].filter(([k, d]) => d >= 1).map(([k]) => k);
}
function partTargets(p){
  const N = RUN.map.nodes, cur = RUN.cur, all = Object.keys(N).map(Number).filter(k => k !== cur), kn = knownSet();
  const c0 = cur % GCOLS, r0 = (cur / GCOLS) | 0;
  const line = n => all.filter(k => { const c = k % GCOLS, r = (k / GCOLS) | 0; return (c === c0 || r === r0) && gdist(k, cur) <= n && gdist(k, cur) >= 2; });
  const ring = () => all.filter(k => cheb(k, cur) === 1);
  switch (PARTS[p.k].move){
    case 'line2': return line(2);
    case 'line3': return line(3);
    case 'ring': return ring();
    case 'ringline': return [...new Set([...ring(), ...line(2)])];
    case 'step': return nbrs(cur).filter(k => N[k]);
    case 'known': return all.filter(k => kn.has(k));
    case 'any': return all;
    case 'fly': return all.filter(k => kn.has(k) && gdist(k, cur) <= 3 && !['battle','elite','guard','source'].includes(N[k].type));
    case 'shop': return all.filter(k => N[k].type === 'shop');
  }
  return [];
}

