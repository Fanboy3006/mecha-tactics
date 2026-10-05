/* ---------- 渲染 ---------- */
function runRender(){
  audioScene('map');
  if (!RUN){ return; }
  const v = $('#runView'); v.hidden = false;
  const cmdTxt = RUN.cmd ? `Feena Lv${RUN.cmd.lv}` : '—';
  const bar = `<div class="rv-bar"><span class="ttl">混沌迷宫</span>
    <span class="rv-chip">层<b>${RUN.layer === 4 ? '终点' : RUN.layer + ' / 3'}</b></span>
    ${RUN.map ? `<span class="rv-chip ${RUN.prop <= 2 ? 'warn' : ''}">推进剂<b>${RUN.prop} / ${propMax()}</b></span>` : ''}
    <span class="rv-chip">部队<b>Lv${RUN.lvl}</b> <small>${RUN.exp} / ${LV_NEED[RUN.lvl + 1] ?? '—'}</small></span>
    <span class="rv-chip">希望<b>${RUN.hope}</b></span><span class="rv-chip">源碳结晶<b>${RUN.he}</b></span>
    <span class="rv-chip ${RUN.dur <= 3 ? 'warn' : ''}">作战耐久<b>${RUN.dur}</b></span>
    <span class="rv-chip">出击上限<b>${deployCap()}</b></span>
    <span class="rv-chip">分队<b>${RUN.squad === 'moon' ? '月之国' : RUN.squad}</b></span>
    <span class="rv-chip">指挥官<b>${cmdTxt}</b></span>
    ${RUN.erosion ? `<span class="rv-chip" style="border-color:#ff5ec4">侵蚀场<b style="color:${RUN.erosionCleared ? 'var(--good)' : '#ff5ec4'}">${EROSIONS[RUN.erosion].name}${RUN.erosionCleared ? '（已解除）' : ''}</b></span>` : ''}
    <span style="flex:1"></span><button class="rv-btn" id="rvLogs">游玩记录</button><button class="rv-btn" id="rvQuit">放弃本局</button></div>`;
  v.innerHTML = bar + `<div class="rv-main"><div class="rv-map">${RUN.map ? mapSVG() : '<p>终点</p>'}
      <div class="rv-legend">${Object.entries(NODE).filter(([k]) => k !== 'start').map(([k,n]) => `<span><b style="color:${n.col}">${n.icon}</b> ${n.name}</span>`).join('')}</div>
      <p class="small">点击高亮的节点移动：走几格就消耗几点推进剂，可以跳过中间格直接走到后面（中间格不触发，标着 −n 的是需要的推进剂）。推进剂用完时还没走到出口，会触发追击战。</p></div>
    <div class="rv-side">${nodeCard()}${ticketCard()}${teamCard()}${partsCard()}${relicsCard()}${RUN.cmd ? cmdCard() : ''}${logCard()}</div></div>`;
  v.querySelectorAll('[data-node]').forEach(el => el.onclick = () => runClickNode(+el.dataset.node));
  v.querySelectorAll('[data-promo]').forEach(b => b.onclick = () => runPromote(b.dataset.promo));
  v.querySelectorAll('[data-ticket]').forEach(b => b.onclick = async () => { if (runBusy) return; runBusy = true; await useTicket(+b.dataset.ticket); runBusy = false; runRender(); });
  v.querySelectorAll('[data-fire]').forEach(b => b.onclick = async () => { if (await ask(`遣散 ${tplOf(b.dataset.fire).pilot}？`, '遣散后这名角色离开本局队伍。', '遣散')){ RUN.units = RUN.units.filter(u => u.mech !== b.dataset.fire); } runRender(); });
  v.querySelectorAll('[data-usepart]').forEach(b => b.onclick = () => { const i = +b.dataset.usepart; RUN.usingPart = RUN.usingPart === i ? null : i; runRender(); });
  v.querySelectorAll('[data-sellpart]').forEach(b => b.onclick = () => runSellPart(+b.dataset.sellpart));
  const lb = $('#rvLogs'); if (lb) lb.onclick = () => openRunLogs();
  const q = $('#rvQuit'); if (q) q.onclick = async () => { if (await ask('放弃本局？', '本局会直接结束，结算到当前为止的进度。', '放弃本局')) runGameOver('放弃了本局'); else runRender(); };
}
function mapSVG(){
  const N = RUN.map.nodes, CS = 74, pad = 14, kn = knownSet();
  const tg = new Set(RUN.usingPart != null ? partTargets(RUN.parts[RUN.usingPart]) : moveTargets());
  const md = RUN.usingPart == null && RUN.prop > 0 ? moveDist() : new Map();
  let edges = '', cells = '';
  for (const k in N){
    const n = N[k], x = pad + n.c*CS + CS/2, y = pad + n.r*CS + CS/2;
    for (const m of nbrs(+k)) if (m > +k && N[m]){ const o = N[m]; const vis = kn.has(+k) || kn.has(m); edges += `<line x1="${x}" y1="${y}" x2="${pad + o.c*CS + CS/2}" y2="${pad + o.r*CS + CS/2}" stroke="${vis ? '#3a4a5e' : '#222b36'}" stroke-width="3"/>`; }
  }
  for (const k in N){
    const n = N[k], x = pad + n.c*CS, y = pad + n.r*CS, known = kn.has(+k), showT = known || skLv('侦察') >= 2;
    const t = NODE[n.type], here = +k === RUN.cur, can = tg.has(+k);
    const fill = known ? (n.cleared ? '#1d2530' : '#243041') : '#161c24';
    cells += `<g data-node="${k}" style="cursor:${can ? 'pointer' : 'default'}">
      <rect x="${x+8}" y="${y+8}" width="${CS-16}" height="${CS-16}" rx="8" fill="${fill}" stroke="${here ? '#ffffff' : can ? 'var(--accent)' : known ? '#3a4a5e' : '#222b36'}" stroke-width="${here || can ? 3 : 1.5}" ${can ? 'stroke-dasharray="6 3"' : ''}/>
      <text x="${x+CS/2}" y="${y+CS/2+2}" text-anchor="middle" font-size="22" fill="${showT ? t.col : '#3a4a5e'}" font-family="system-ui">${showT ? t.icon : '?'}</text>
      <text x="${x+CS/2}" y="${y+CS-14}" text-anchor="middle" font-size="10" fill="#8a99ab">${showT ? t.name : ''}</text>
      ${showT && n.stage ? `<text x="${x+14}" y="${y+22}" font-size="9" fill="#8a99ab" font-family="monospace">${n.stage}</text>` : ''}
      ${here ? `<circle cx="${x+18}" cy="${y+18}" r="6" fill="#4f95e0" stroke="#fff" stroke-width="2"/>` : ''}
      ${can && RUN.usingPart == null && md.get(+k) > 1 ? `<text x="${x+CS-14}" y="${y+22}" text-anchor="end" font-size="11" font-weight="700" fill="var(--accent)">−${md.get(+k)}</text>` : ''}</g>`;
  }
  return `<svg viewBox="0 0 ${GCOLS*CS + pad*2} ${GROWS*CS + pad*2}" style="width:100%;max-width:560px;height:auto;max-height:60vh">${edges}${cells}</svg>`;
}
function nodeCard(){
  if (!RUN.map) return '';
  const n = RUN.map.nodes[RUN.cur];
  const using = RUN.usingPart != null ? RUN.parts[RUN.usingPart] : null;
  return `<div class="rv-card"><h3>当前位置</h3><div><b style="color:${NODE[n.type].col}">${NODE[n.type].icon} ${NODE[n.type].name}</b>${n.stage ? ` <small style="color:var(--muted)">${n.stage} ${STAGES[n.stage].name}</small>` : ''}</div>
    ${using ? `<p class="small" style="color:var(--accent)">正在使用【${PARTS[using.k].name}】：点击地图上高亮的节点。再点一次零件取消。</p>` : `<p class="small">高亮虚线框是可以前往的节点。</p>`}
    ${n.type === 'shop' ? '<button class="rv-btn" data-node="' + RUN.cur + '">进入黑市</button>' : ''}</div>`;
}
function teamCard(){
  const rows = RUN.units.map(u => {
    const t = tplOf(u.mech), tr = tierOf(u.mech), nxt = u.lv === 10 ? 20 : u.lv === 20 ? 30 : null, c = nxt ? promoCost(u.mech, nxt) : 0;
    return `<div class="rv-row"><span class="rv-tier ${tr}">${TIER_NAME[tr]}</span><span class="nm">${t.pilot}<small>${t.mech} · ${t.tags.战斗分类}</small></span><b style="font-family:var(--font-m)">Lv${u.lv}</b>
      ${nxt ? `<button class="rv-btn" data-promo="${u.mech}" ${c > RUN.hope ? 'disabled' : ''} title="${CAP_CHARS.includes(u.mech) && nxt === 20 ? '晋升后出击上限 +1' : ''}">→Lv${nxt}（${c}）</button>` : ''}
      <button class="rv-btn" data-fire="${u.mech}" title="遣散">×</button></div>`;
  }).join('');
  return `<div class="rv-card"><h3>队伍（${RUN.units.length} / 12）· 出击上限 ${deployCap()}</h3>${rows || '<p class="small">还没有角色。</p>'}
    <p class="small">招募价格：精锐 5，骨干 3，普通免费。晋升价格：精锐 3 / 4，骨干 2 / 3，普通 1 / 2 希望${RUN.promoDiscount ? '（下次晋升 −1）' : ''}。出击上限：初始 3 人，部队每升 3 级 +1。</p></div>`;
}
function ticketCard(){
  if (!RUN.tickets.length) return '';
  return `<div class="rv-card"><h3>招募券（${RUN.tickets.length}）</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${RUN.tickets.map((c,i) => `<button class="rv-btn" data-ticket="${i}">${ticketName(c)}</button>`).join('')}</div>
    <p class="small">点击使用：在该分类的全部角色里任选一名（花希望）。</p></div>`;
}
function partsCard(){
  const cap = RUN.partCap || 8;
  const rows = RUN.parts.map((p, i) => { const P = PARTS[p.k];
    return `<div class="rv-row"><span class="nm">${P.name}<small>${P.kind}${p.uses != null ? ` · 剩 ${p.uses} 次` : ''}${p.value != null ? ` · 估价 ${p.value}` : ''}</small><br><small style="margin:0">${P.desc}</small></span>
      ${P.move ? `<button class="rv-btn ${RUN.usingPart === i ? 'on' : ''}" data-usepart="${i}" ${RUN.map ? '' : 'disabled'}>使用</button>` : ''}</div>`; }).join('');
  return `<div class="rv-card"><h3>零件箱（${RUN.parts.length} / ${cap}）</h3>${rows || '<p class="small">空。</p>'}</div>`;
}
function cmdCard(){
  const c = RUN.cmd, need = XP_NEED[c.lv] || 99;
  return `<div class="rv-card"><h3>指挥官 Feena · Lv${c.lv}（经验 ${c.xp} / ${need}）</h3>
    <div class="small">攻击 ${c.atk}（伤害 +${c.atk*2}%）· 防御 ${c.def}（减伤 ${c.def*2}%）· 统率 ${c.lead}（陨石伤害 +${c.lead*5}%）· 知识 ${c.know}（陨石冷却 −${Math.floor(c.know/3)}）</div>
    ${Object.entries(c.skills).map(([k,l]) => `<div class="rv-row"><span class="nm">${k} <small>${['','初级','中级','高级'][l]}</small><br><small style="margin:0">${SKILLS[k].desc[l-1]}</small></span></div>`).join('') || '<p class="small">还没有二级技能。</p>'}</div>`;
}
function logCard(){ return `<div class="rv-card"><h3>记录</h3><div class="small" style="max-height:160px;overflow:auto">${RUN.log.slice(-12).reverse().map(l => `<div>${l}</div>`).join('')}</div></div>`; }
function runLog(t){ RUN.log.push(`[${RUN.layer === 4 ? '终' : RUN.layer}] ${t}`); rlog('log', {text:t}); }

