/* ---------- 移动与节点 ---------- */
let runBusy = false;
async function runClickNode(k){
  if (runBusy || RUN.over) return;
  if (k === RUN.cur && RUN.map.nodes[k].type === 'shop' && RUN.usingPart == null){ runBusy = true; await nodeShop(); runBusy = false; runRender(); return; }
  if (RUN.usingPart != null){
    const p = RUN.parts[RUN.usingPart];
    if (!partTargets(p).includes(k)) return;
    const P = PARTS[p.k];
    p.uses--; if (p.uses <= 0) RUN.parts.splice(RUN.usingPart, 1);
    RUN.usingPart = null;
    runLog(`使用【${P.name}】`);
    if (P.move === 'fly') await gainExp(3, '老妈的融雪');
    if (P.move === 'shop' || P.move === 'any') RUN.revealed.add(k);
    await arrive(k, false);
    return;
  }
  const d = moveDist().get(k);
  if (!d || d > RUN.prop) return;
  RUN.prop -= d;
  if (d > 1) runLog(`跳过中间格，直接前往（−${d} 推进剂）`);
  await arrive(k, true);
}
async function arrive(k, paid){
  runBusy = true;
  rlog('move', {from:RUN.cur, to:k, node:RUN.map.nodes[k].type, prop:RUN.prop, paid});
  RUN.prev = RUN.cur; RUN.cur = k; RUN.visited.add(k);
  RUN.parts.forEach(p => { if (p.k === 'wave') p.value = Math.max(0, p.value + Math.floor(Math.random()*7) - 2); });
  runRender();
  await resolveNode(k);
  runBusy = false;
  if (RUN.over || !RUN.map) return;
  runRender();
  if (RUN.prop <= 0) await runChase();
}
async function resolveNode(k){
  const n = RUN.map.nodes[k];
  if (n.type === 'tunnel'){
    const other = RUN.map.tunnels.find(t => t !== k);
    if (other != null && !n.justTele){
      const v = await dlg(`<div class="eyebrow">废弃隧道</div><h2>穿过隧道？</h2><p>隧道另一端在 (${other % GCOLS + 1}, ${((other / GCOLS) | 0) + 1})，传送不消耗推进剂。</p><div class="acts"><button class="btn primary" data-v="go">传送</button><button class="btn" data-v="no">留在这里</button></div>`);
      if (v === 'go'){ RUN.revealed.add(other); RUN.prev = k; RUN.cur = other; RUN.visited.add(other); runLog('穿过废弃隧道'); }
    }
    return;
  }
  if (n.type === 'empty' || (n.cleared && !['exit','guard','shop'].includes(n.type))) return;
  switch (n.type){
    case 'battle': case 'elite': case 'source': case 'guard': await runBattle(n.type, n.stage); return;
    case 'exit': {
      const v = await dlg(`<div class="eyebrow" style="color:var(--good)">出口</div><h2>进入第 ${RUN.layer + 1 === 4 ? '终点' : (RUN.layer + 1) + ' 层'}？</h2><p class="small">没有守军，直接前往下一层。本层还没探索的节点会留在身后。</p><div class="acts"><button class="btn primary" data-v="go">前进</button><button class="btn" data-v="no">再看看</button></div>`);
      if (v === 'go') await enterLayer(RUN.layer + 1);
      return;
    }
    case 'shop': await nodeShop(); return;
    case 'rest': {
      const v = await dlg(`<div class="eyebrow" style="color:var(--good)">休整</div><h2>选择一项</h2><div class="acts"><button class="btn primary" data-v="dur">作战耐久 +2</button><button class="btn" data-v="promo">下次晋升 −1 希望</button></div>`);
      if (v === 'dur'){ RUN.dur += 2; runLog('休整：作战耐久 +2'); } else { RUN.promoDiscount = true; runLog('休整：下次晋升 −1 希望'); }
      emptyNode(n); return;
    }
    case 'recruit': {
      emptyNode(n); const a = pick(CLASSES), b = pick(FACTIONS);
      const c = await dlg(`<div class="eyebrow" style="color:var(--accent)">招募站</div><h2>选一张招募券</h2><p class="small">职业券在同一战斗分类里任选；势力券在同一势力里任选。都可以用来给同类队员晋升。</p>
        <div class="acts"><button class="btn primary" data-v="${a}">${ticketName(a)}</button><button class="btn" data-v="${b}">${ticketName(b)}</button></div>`);
      addTicket(c, '招募站'); await useTicket(RUN.tickets.length - 1); return;
    }
    case 'relay': {
      for (const kk in RUN.map.nodes) if (gdist(+kk, k) <= 2) RUN.revealed.add(+kk);
      emptyNode(n); runLog('中继站：揭开周围 2 格'); return;
    }
    case 'supply': {
      RUN.prop = Math.min(propMax() + 1, RUN.prop + 1);
      for (const kk in RUN.map.nodes) if (gdist(+kk, k) <= 4) RUN.revealed.add(+kk);
      emptyNode(n); runLog('瞭望站：推进剂 +1，揭开周围 4 格');
      await dlg(`<div class="eyebrow" style="color:#ffd166">瞭望站</div><h2>视野大开</h2><p>揭开周围 4 格的节点，推进剂 +1。</p><div class="acts"><button class="btn primary" data-v="ok">好</button></div>`); return;
    }
    case 'treasure': { emptyNode(n); RUN.he += 2; runLog('遗迹：氦三 +2'); await givePart(pick(Object.keys(PARTS)), '遗迹'); return; }
    case 'event': emptyNode(n); await runEvent(); return;
  }
}
function emptyNode(n){ n.cleared = true; n.type = 'empty'; n.stage = null; }
async function givePart(k, src){
  const cap = RUN.partCap || 4, P = PARTS[k];
  if (RUN.parts.length >= cap){
    const v = await dlg(`<div class="eyebrow">${src}</div><h2>获得零件【${P.name}】</h2><p>${P.kind}：${P.desc}</p><p class="small">零件箱已满（${cap}）。</p><div class="acts"><button class="btn" data-v="drop">放弃</button>${RUN.parts.map((p,i) => `<button class="btn" data-v="${i}">换掉 ${PARTS[p.k].name}</button>`).join('')}</div>`);
    if (v === 'drop') return;
    RUN.parts[+v] = newPart(k);
  } else {
    RUN.parts.push(newPart(k));
    await dlg(`<div class="eyebrow">${src}</div><h2>获得零件【${P.name}】</h2><p>${P.kind}：${P.desc}</p><div class="acts"><button class="btn primary" data-v="ok">收下</button></div>`);
  }
  runLog(`获得零件【${P.name}】`);
}
async function nodeShop(){
  for (;;){
    if (!RUN.shopStock || RUN.shopStock.layer !== RUN.layer || RUN.shopStock.k !== RUN.cur) RUN.shopStock = {layer:RUN.layer, k:RUN.cur, items:sample(Object.keys(PARTS), 4)};
    const st = RUN.shopStock.items, cap = RUN.partCap || 4;
    const sellables = RUN.parts.map((p,i) => ({p, i, price: PARTS[p.k].kind === '自然物' ? p.value : 2}));
    const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">黑市</div><h2>氦三 ${RUN.he} · 零件箱 ${RUN.parts.length} / ${cap}</h2>
      <div class="rcards">${st.map((k, i) => `<button class="rcard" style="--fc:var(--accent)" data-v="buy${i}" ${PARTS[k].price > RUN.he || RUN.parts.length >= cap ? 'disabled' : ''}><b>${PARTS[k].name}</b><small>${PARTS[k].kind}：${PARTS[k].desc}</small><span class="cost">${PARTS[k].price} 氦三</span></button>`).join('') || '<p class="small">卖完了。</p>'}</div>
      <p class="small">出售：自然物按估价卖出，其他零件 2 氦三。</p>
      <div class="acts">${sellables.map(s => `<button class="btn" data-v="sell${s.i}">卖 ${PARTS[s.p.k].name}（+${s.price}）</button>`).join('')}
        <button class="btn" data-v="rent" ${RUN.he < 6 ? 'disabled' : ''}>空间租赁：零件箱 +1（6 氦三）</button>
        <button class="btn primary" data-v="leave">离开</button></div>`, true);
    if (v === 'leave') return;
    if (v.startsWith('buy')){ const i = +v.slice(3), k = st[i]; RUN.he -= PARTS[k].price; RUN.parts.push(newPart(k)); st.splice(i, 1); runLog(`黑市买入【${PARTS[k].name}】`); }
    else if (v.startsWith('sell')) runSellPart(+v.slice(4), true);
    else if (v === 'rent'){ RUN.he -= 6; RUN.partCap = (RUN.partCap || 4) + 1; runLog('空间租赁：零件箱 +1'); }
    runRender();
  }
}
function runSellPart(i, quiet){
  const p = RUN.parts[i]; if (!p) return;
  const price = PARTS[p.k].kind === '自然物' ? p.value : 2;
  RUN.he += price; RUN.parts.splice(i, 1); runLog(`卖出【${PARTS[p.k].name}】+${price} 氦三`);
  if (!quiet) runRender();
}
const EVENTS = [
  {title:'漂流的补给舱', text:'一只来自别的宇宙的补给舱卡在迷宫的裂缝里。', opts:[['推进剂 +3', () => { RUN.prop += 3; }], ['经验 +5', () => gainExp(5, '补给舱')]]},
  {title:'平行宇宙的回声', text:'裂缝里传来另一个世界的声音，伸手就能抓到些什么，但会被反噬。', opts:[['作战耐久 −1，获得随机零件', async () => { RUN.dur--; await givePart(pick(Object.keys(PARTS)), '回声'); }], ['离开', () => {}]]},
  {title:'迷路的机师', text:'一名来自其他宇宙的机师在迷宫里迷了路。', opts:[['免费招募一名普通档角色', async () => { const pool = recruitPool().filter(m => tierOf(m) === 'B' && !RUN.units.some(u => u.mech === m)); if (pool.length && RUN.units.length < 12){ const m = pick(pool); RUN.units.push({mech:m, lv:10}); runLog(`${tplOf(m).pilot} 加入了队伍`); } }], ['给他指路，氦三 +3', () => { RUN.he += 3; }]]},
  {title:'扭曲的时钟', text:'这里的时间流速不对劲。', opts:[['推进剂 −2，经验 +10', () => { RUN.prop = Math.max(0, RUN.prop - 2); return gainExp(10, '扭曲的时钟'); }], ['离开', () => {}]]},
  {title:'黑箱', text:'一个上了锁的黑箱。', opts:[['花 3 氦三打开', async () => { if (RUN.he < 3) return; RUN.he -= 3; if (Math.random() < .5){ await gainExp(6, '黑箱'); } else await givePart(pick(['wheel','limb','spring','engine','exo']), '黑箱'); }], ['不碰它', () => {}]]},
];
async function runEvent(){
  const e = pick(EVENTS);
  const v = await dlg(`<div class="eyebrow" style="color:#c9a8ff">事件</div><h2>${e.title}</h2><p>${e.text}</p><div class="acts">${e.opts.map((o,i) => `<button class="btn ${i ? '' : 'primary'}" data-v="${i}">${o[0]}</button>`).join('')}</div>`);
  runLog(`事件「${e.title}」：${e.opts[+v][0]}`);
  await e.opts[+v][1]();
}

