/* ---------- 开局 ---------- */
function runOpen(){
  if (RUN && !RUN.over && RUN_BATTLE){ runBattleResume(); return; }   // 切走前正在打的那一战
  level = 'roguelike'; $('#levelSel').value = 'roguelike';
  if (RUN && !RUN.over){ runShow(); return; }
  runStartScreen();
}
function runHide(){ $('#runView').hidden = true; }
function runShow(){ $('#runView').hidden = false; runRender(); }
/* 确认框：不用浏览器自带的确认弹窗——claude.ai 页面和桌面应用里它会被拦截、直接当成「取消」，按钮就像没反应 */
async function ask(title, detail = '', yes = '确定'){
  return (await dlg(`<div class="eyebrow" style="color:#e9a23b">确认</div><h2>${title}</h2>${detail ? `<p>${detail}</p>` : ''}
    <div class="acts"><button class="btn primary" data-v="y">${yes}</button><button class="btn" data-v="n">取消</button></div>`)) === 'y';
}
function dlg(html, wide){
  return new Promise(res => {
    $('#endDlg').innerHTML = html; $('#endDlg').classList.toggle('wide', !!wide); $('#endModal').hidden = false;
    $('#endDlg').querySelectorAll('[data-v]').forEach(b => b.onclick = () => { $('#endModal').hidden = true; $('#endDlg').classList.remove('wide'); res(b.dataset.v); });
  });
}
async function runStartScreen(){
  audioScene('menu');
  $('#runView').hidden = false; $('#runView').innerHTML = '';
  const squads = [...(CMD_ENABLED ? [{id:'moon', name:'月之国分队', desc:'Feena 担任指挥官（不出场）：英雄无敌 3 式成长，战斗中可以下达【陨石召唤】，升级时学习二级技能。不送角色。'}] : []),   // v0.40.13 指挥官系统关闭（DLC）
    ...CLASSES.map(c => ({id:c, name:`${c}分队`, desc:`开局从${c}角色里选一名 Lv20（免费）。`})),
    ...FACTIONS.map(f => ({id:f, name:`${f}势力分队`, desc:`开局从${f}的角色里选一名 Lv20（免费）。`, fac:true}))];   // v0.26 势力分队
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">肉鸽模式 · 混沌迷宫</div><h2>选择分队</h2>
    <p class="small">各个平行宇宙被扭曲在一起，形成了混沌迷宫。在迷宫里招募来自不同宇宙的机师，穿过 3 层航区，击败最深处的敌人。</p>
    ${[...(CMD_ENABLED ? [['指挥官分队', squads.filter(q => q.id === 'moon')]] : []), ['职业分队', squads.filter(q => CLASSES.includes(q.id))], ['势力分队', squads.filter(q => q.fac)]].map(([h, qs]) => `<div class="fgroup"><i style="--fc:var(--accent)"></i>${h}</div>
    <div class="rcards">${qs.map(q => `<button class="rcard" style="--fc:${q.id === 'moon' ? '#9fb7d8' : q.fac ? (FACTION_COL[q.id] || 'var(--accent)') : 'var(--accent)'}" data-v="${q.id}"><b>${q.name}</b><small>${q.desc}</small></button>`).join('')}</div>`).join('')}
    <div class="acts"><button class="btn" data-v="cancel">返回</button></div>`, true);
  if (v === 'cancel'){ runHide(); startLevel('tut1'); return; }
  RUN = {runId:Date.now().toString(36) + Math.random().toString(36).slice(2,6), t0:Date.now(), events:[], squad:v, layer:1, lvl:1, exp:0, tickets:[], hope:8, he:20, dur:10, units:[], parts:[], relics:[], capBonus:0, promoDiscount:false, over:false, log:[], battles:0, seedBase:Date.now() & 0xffffff, cmd:null, erosion:null, erosionCleared:false, mods:null, layerPropBonus:0};
  if (v === 'moon'){ RUN.cmd = {lv:1, xp:0, atk:0, def:0, lead:0, know:0, skills:{}}; }
  else {
    const cands = recruitPool().filter(m => ticketOk(v, m));
    const sqName = CLASSES.includes(v) ? `${v}分队` : `${v}势力分队`;
    const m = await dlg(`<div class="eyebrow" style="color:var(--accent)">${sqName}</div><h2>选择开局的 Lv20 角色（免费）</h2>
      <p class="small">从全部${CLASSES.includes(v) ? v : v + '的'}角色里任选一名。</p>
      <div class="rcards">${cands.map(m => recCardHTML(m, 20, 0)).join('')}</div>`, true);
    RUN.units.push({mech:m, lv:20});
    if (CAP_CHARS.includes(m)) RUN.capBonus++;
  }
  rlog('run_start', {squad:v, version:GAME_VERSION, seed:RUN.seedBase, ua:navigator.userAgent.slice(0, 120)});
  runLog(`选择了${v === 'moon' ? '月之国分队（Feena 指挥）' : CLASSES.includes(v) ? v + '分队' : v + '势力分队'}`);
  await enterLayer(1);
  // 开局招募券：职业分队 2 张，月之国分队 3 张（随机分类），开局就可以用
  for (let i = 0; i < (v === 'moon' ? 3 : 2); i++) addTicket(v === 'moon' && i === 2 ? pick(FACTIONS) : pick(CLASSES), '开局');   // 月之国分队：2 张职业券 + 1 张势力券
  runRender();
  for (const t of [...RUN.tickets]) await useTicket(RUN.tickets.indexOf(t));
  runRender();
}
function recruitPool(){ return ALLY_T.filter(t => !t.commandOnly && TIER[t.mech] && !(RUN && RUN.cmd && t.mech === 'M1')).map(t => t.mech); }
function sample(arr, n, weight){
  const a = [...arr], out = [];
  while (a.length && out.length < n){
    const ws = a.map(x => weight ? weight(x) : 1), tot = ws.reduce((p,q) => p+q, 0);
    let x = Math.random() * tot, i = 0; while (x > ws[i]){ x -= ws[i]; i++; }
    out.push(a.splice(Math.min(i, a.length-1), 1)[0]);
  }
  return out;
}
function recCardHTML(m, lv, cost){
  const t = tplOf(m), tr = tierOf(m);
  return `<button class="rcard" style="--fc:${FACTION_COL[t.tags.势力] || '#4f95e0'}" data-v="${m}" ${cost > RUN.hope ? 'disabled' : ''}>
    <b>${t.pilot} <small>${t.mech}${t.mechName ? ' · ' + t.mechName : ''}</small></b>
    <small>${t.tags.势力} · ${t.tags.战斗分类} · <span class="rv-tier ${tr}">${TIER_NAME[tr]}</span> · Lv${lv}</small>
    <small>${ABIL[t.trait] ? '特技【' + ABIL[t.trait].name + '】' : ''}${CAP_CHARS.includes(m) ? ' · 晋升 Lv20 时出击上限 +1' : ''}</small>
    ${cost ? `<span class="cost">招募 ${cost} 希望</span>` : '<span class="cost">免费</span>'}</button>`;
}
/* 招募券：拿到哪个分类的券，就在该分类的全部角色里任选（花希望）。券可以先留着，随时在右侧使用。 */
function addTicket(cls, src){ RUN.tickets.push(cls); runLog(`${src}：获得【${ticketName(cls)}】`); }
async function useTicket(i){
  const cls = RUN.tickets[i]; if (cls == null) return;
  const pool = recruitPool().filter(m => ticketOk(cls, m) && !RUN.units.some(u => u.mech === m));
  const full = RUN.units.length >= 12;
  const owned = RUN.units.filter(u => ticketOk(cls, u.mech) && u.lv < 30);
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">${ticketName(cls)}</div><h2>招募或晋升（希望 ${RUN.hope}）</h2>
    <p class="small">在全部${cls}${CLASSES.includes(cls) ? '' : '势力的'}角色里任选一名招募（Lv10）；也可以用这张券给队里的${cls}${CLASSES.includes(cls) ? '' : '势力'}角色晋升（同样要花希望）。${full ? '<b style="color:var(--enemy)">队伍已满 12 人，先遣散再招募。</b>' : ''}</p>
    <div class="rcards">${pool.map(m => recCardHTML(m, 10, full ? 99 : recCost(m))).join('') || '<p class="small">这一类的角色都已经在队伍里了。</p>'}</div>
    ${owned.length ? `<div class="fgroup"><i style="--fc:var(--good)"></i>用这张券晋升</div><div class="rcards">${owned.map(u => { const t = tplOf(u.mech), to = u.lv === 10 ? 20 : 30, c = promoCost(u.mech, to); return `<button class="rcard" style="--fc:var(--good)" data-v="promo:${u.mech}" ${c > RUN.hope ? 'disabled' : ''}><b>${t.pilot} <small>${t.mech}</small></b><small>Lv${u.lv} → Lv${to}</small><span class="cost">晋升 ${c} 希望</span></button>`; }).join('')}</div>` : ''}
    <div class="acts"><button class="btn primary" data-v="keep">先留着</button><button class="btn" data-v="drop">丢弃这张券</button></div>`, true);
  if (v === 'keep') return;
  RUN.tickets.splice(i, 1);
  if (v === 'drop'){ runLog(`丢弃了【${ticketName(cls)}】`); return; }
  if (v.startsWith('promo:')){ runLog(`使用【${ticketName(cls)}】晋升`); runPromote(v.slice(6)); return; }
  RUN.hope -= recCost(v); RUN.units.push({mech:v, lv:10});
  runLog(`招募 ${tplOf(v).pilot}（${TIER_NAME[tierOf(v)]}，−${recCost(v)} 希望）`);
  relicPendingPromo();
}
/* v0.40.8 通往下一层的关口（出口、层底守军、终点迷宫之主）先整备（作者 10-08）：
   手上有招募券时，对话框里列出来，点了就用（招募 / 晋升），用完回到这个对话框；acts 是关口自己的按钮。 */
async function passageDlg(head, acts){
  for (;;){
    const tk = RUN.tickets.length ? `<div class="fgroup"><i style="--fc:var(--accent)"></i>手上的招募券（希望 ${RUN.hope}）：出发前可以先用</div><div class="acts">${RUN.tickets.map((c, i) => `<button class="btn" data-v="t:${i}">${ticketName(c)}</button>`).join('')}</div>` : '';
    const v = await dlg(`${head}${tk}<div class="acts">${acts}</div>`);
    if (typeof v === 'string' && v.startsWith('t:')){ await useTicket(+v.slice(2)); runRender(); continue; }
    return v;
  }
}
/* 部队等级：作战和事件给经验，升级时获得希望（希望只从这里来） */
const LV_NEED = [0, 0, 8, 18, 30, 44, 60, 78, 98, 120, 144, 170];
const HOPE_PER_LV = 5;
async function gainExp(x, src){
  RUN.exp += x; runLog(`${src}：经验 +${x}`);
  while (RUN.lvl + 1 < LV_NEED.length && RUN.exp >= LV_NEED[RUN.lvl + 1]){
    RUN.lvl++; RUN.hope += HOPE_PER_LV;
    runLog(`部队升到 Lv${RUN.lvl}：希望 +${HOPE_PER_LV}`);
    await dlg(`<div class="eyebrow" style="color:var(--good)">部队升级</div><h2>部队 Lv${RUN.lvl}</h2><p>希望 +${HOPE_PER_LV}（现在 ${RUN.hope}）</p><div class="acts"><button class="btn primary" data-v="ok">好</button></div>`);
  }
}

