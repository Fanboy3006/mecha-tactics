/* ---------- 地图生成 ---------- */
const GCOLS = 6, GROWS = 4;
const NODE = {
  start:{name:'起点', icon:'◎', col:'#8a99ab'},
  empty:{name:'空节点', icon:'·', col:'#56606b'},
  battle:{name:'作战', icon:'⚔', col:'#d9564b'},
  elite:{name:'精英作战', icon:'☠', col:'#ff7a6b'},
  event:{name:'事件', icon:'？', col:'#c9a8ff'},
  shop:{name:'黑市', icon:'¥', col:'#e9a23b'},
  rest:{name:'休整', icon:'✚', col:'#5cc08a'},
  recruit:{name:'招募站', icon:'☺', col:'#8ec5ff'},
  relay:{name:'中继站', icon:'⌖', col:'#9fe0b8'},
  tunnel:{name:'废弃隧道', icon:'◐', col:'#b39ddb'},
  supply:{name:'瞭望站', icon:'⌖', col:'#ffd166'},
  treasure:{name:'遗迹', icon:'◆', col:'#ffd166'},
  source:{name:'侵蚀源', icon:'✹', col:'#ff5ec4'},
  exit:{name:'出口（无守军）', icon:'⇒', col:'#5cc08a'},
  guard:{name:'出口（有守军）', icon:'⇛', col:'#ff7a6b'},
};
const cid = (c, r) => r * GCOLS + c;
function genLayer(layer, seed){
  for (let tries = 0; tries < 200; tries++){
    const r = mulberry32(seed + tries * 7919);
    const has = new Set(), start = cid(0, ri(r, 1, 2));
    for (let row=0; row<GROWS; row++) for (let c=0; c<GCOLS; c++) if (r() < .78) has.add(cid(c,row));
    has.add(start);
    // 连通性
    const seen = new Set([start]), q = [start];
    while (q.length){ const k = q.shift(); for (const n of nbrs(k)) if (has.has(n) && !seen.has(n)){ seen.add(n); q.push(n); } }
    const cells = [...seen];
    const far = cells.filter(k => k % GCOLS >= GCOLS - 2);
    if (cells.length < 15 || far.length < 2) continue;
    const dist = bfsDist(start, seen);
    if (Math.max(...far.map(k => dist.get(k))) < 5) continue;
    // 分配类型
    const T = new Map(); T.set(start, 'start');
    far.sort((a,b) => dist.get(b) - dist.get(a));
    T.set(far[0], 'guard'); T.set(far[1], 'exit');
    const free = cells.filter(k => !T.has(k));
    const shuffle = a => { for (let i=a.length-1;i>0;i--){ const j = Math.floor(r()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };
    shuffle(free);
    const deadEnds = free.filter(k => nbrs(k).filter(n => seen.has(n)).length === 1);
    const put = (type, n, pool = free) => { for (let i=0; i<n; i++){ const k = pool.find(x => !T.has(x)); if (k != null) T.set(k, type); } };
    // 先保证作战数量，再放功能节点，剩下的都是空节点
    put('battle', 4, free.filter(k => !deadEnds.includes(k)));
    put('elite', 1, free.filter(k => dist.get(k) >= 3));
    if (layer >= 2) put('source', 1, free.filter(k => dist.get(k) >= 3));
    put('shop', 1); put('event', 2); put('supply', 2);
    put('empty', 2);
    if (deadEnds.some(k => !T.has(k))) put('treasure', 1, deadEnds);
    put('rest', 1); put('recruit', 1);
    const tun = free.filter(k => !T.has(k));
    if (tun.length >= 2){ const a = tun.find(k => k % GCOLS <= 1), b = tun.find(k => k % GCOLS >= GCOLS - 2); if (a != null && b != null){ T.set(a, 'tunnel'); T.set(b, 'tunnel'); } }
    for (const k of cells) if (!T.has(k)) T.set(k, 'empty');
    const nodes = {};
    for (const k of cells) nodes[k] = {k, c:k % GCOLS, r:(k / GCOLS) | 0, type:T.get(k), cleared:k === start};
    nodes[start].type = 'empty';
    for (const kind of ['battle','elite','guard','source']){
      const all = stagesOf(layer, kind), bs = all.filter(bossReady), pool = shuffle((kind === 'guard' && bs.length ? bs : all.filter(x => !x.boss)).map(x => x.code)); let i = 0;   // 出口守军：Boss 模板到位后只抽关底 Boss 战（30c）
      for (const k of cells) if (nodes[k].type === kind && pool.length) nodes[k].stage = pool[i++ % pool.length];
    }
    const tunnels = cells.filter(k => T.get(k) === 'tunnel');
    return {nodes, start, tunnels, seed};
  }
  throw new Error('layer gen failed');
}
function nbrs(k){ const c = k % GCOLS, r = (k / GCOLS) | 0, o = []; if (c > 0) o.push(k-1); if (c < GCOLS-1) o.push(k+1); if (r > 0) o.push(k-GCOLS); if (r < GROWS-1) o.push(k+GCOLS); return o; }
function bfsDist(s, set){ const d = new Map([[s,0]]), q = [s]; while (q.length){ const k = q.shift(); for (const n of nbrs(k)) if (set.has(n) && !d.has(n)){ d.set(n, d.get(k)+1); q.push(n); } } return d; }
const gdist = (a, b) => Math.abs(a % GCOLS - b % GCOLS) + Math.abs(((a / GCOLS) | 0) - ((b / GCOLS) | 0));
const cheb = (a, b) => Math.max(Math.abs(a % GCOLS - b % GCOLS), Math.abs(((a / GCOLS) | 0) - ((b / GCOLS) | 0)));

