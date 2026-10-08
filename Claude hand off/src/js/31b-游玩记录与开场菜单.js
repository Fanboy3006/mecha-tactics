/* ---------- 肉鸽游玩记录（只记录肉鸽模式）----------
   每一局的事件都记在 RUN.events：本地浏览器里保留最近 20 局；
   在 claude.ai 里打开且有写入权限时，同时上传到这个页面的数据库 runlogs/<玩家>/runs/<局 id>，
   作者（页面所有者）能看到所有人的记录。没有权限或单独打开 html 时，用「下载」导出发回来。 */
const GAME_VERSION = 'v0.40.4';
document.querySelectorAll('.gv').forEach(e => { e.textContent = GAME_VERSION; });   // 顶栏和规则面板的版本号跟着 GAME_VERSION 走
const RLOG_KEY = 'mecha-tactics-runlogs';
function rlog(type, data){
  if (!RUN || !RUN.events) return;
  RUN.events.push({t:Math.round((Date.now() - RUN.t0)/1000), L:RUN.layer, type, ...data});
  rlogSaveLocal();
  if (['battle_end','run_end','note'].includes(type)) rlogFlush();
}
const runSummary = result => ({result, layer:RUN.layer, battles:RUN.battles, dur:RUN.dur, lvl:RUN.lvl, hope:RUN.hope, units:RUN.units.map(u => `${u.mech}:${u.lv}`).join(','), parts:RUN.parts.map(p => p.k).join(','), feena:RUN.cmd ? {lv:RUN.cmd.lv, skills:RUN.cmd.skills} : null, minutes:Math.round((Date.now() - RUN.t0)/60000)});
function rlogRecord(){ return RUN ? {id:RUN.runId, version:GAME_VERSION, squad:RUN.squad, startedAt:new Date(RUN.t0).toISOString(), over:!!RUN.over, events:RUN.events} : null; }
function rlogLoad(){ try { return JSON.parse(localStorage.getItem(RLOG_KEY) || '[]'); } catch(e){ return []; } }
function rlogSaveLocal(){
  const rec = rlogRecord(); if (!rec) return;
  try { const all = rlogLoad().filter(r => r.id !== rec.id); all.push(rec); localStorage.setItem(RLOG_KEY, JSON.stringify(all.slice(-20))); } catch(e){}
}
const RLOG_CLOUD = {state:'未连接', db:null, uid:null, tried:false, timer:null};
async function rlogCloud(){
  if (RLOG_CLOUD.tried) return RLOG_CLOUD.db;
  RLOG_CLOUD.tried = true;
  try {
    if (!window.claude || !window.claude.use){ RLOG_CLOUD.state = '本地模式（单独打开的 html 不能上传，请用下载）'; return null; }
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user){ RLOG_CLOUD.state = '没有云端权限（请用下载）'; return null; }
    const uid = await user.id();
    if (!uid){ RLOG_CLOUD.state = '未登录（请用下载）'; return null; }
    RLOG_CLOUD.db = db; RLOG_CLOUD.uid = uid; RLOG_CLOUD.state = '已连接，会自动上传';
    /* 父文档让 Claude 能列出玩家；顺便把本地存着的最近记录补传一次 */
    try {
      await db.doc(`runlogs/${uid}`).set({uid, updatedAt:new Date().toISOString()});
      for (const r of rlogLoad()) if (r && r.id) await db.doc(`runlogs/${uid}/runs/${r.id}`).set({...r, events:(r.events || []).slice(-1500), updatedAt:new Date().toISOString()});
      RLOG_CLOUD.state = '已连接，本地记录已补传';
    } catch(e){}
    return db;
  } catch(e){ RLOG_CLOUD.state = '没有云端权限（请用下载）'; return null; }
}
setTimeout(() => { rlogCloud(); }, 2000);   // 打开页面 2 秒后就连云端并补传本地记录
function rlogFlush(now){
  clearTimeout(RLOG_CLOUD.timer);
  RLOG_CLOUD.timer = setTimeout(async () => {
    const rec = rlogRecord(); if (!rec) return;
    const db = await rlogCloud(); if (!db) return;
    try {
      await db.doc(`runlogs/${RLOG_CLOUD.uid}`).set({uid:RLOG_CLOUD.uid, updatedAt:new Date().toISOString()});
      await db.doc(`runlogs/${RLOG_CLOUD.uid}/runs/${rec.id}`).set({...rec, events:rec.events.slice(-1500), updatedAt:new Date().toISOString()});
      RLOG_CLOUD.state = `已上传（${new Date().toLocaleTimeString()}）`;
    } catch(e){
      RLOG_CLOUD.state = e && e.code === 'invalid_argument' ? '你的权限不能上传（请用下载）' : `上传失败：${e && e.code || e}`;
      if (e && e.code === 'invalid_argument') RLOG_CLOUD.db = null;
    }
  }, now ? 50 : 1500);
}
function rlogText(rec){
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const lines = [`机甲战棋 肉鸽游玩记录 · ${rec.version} · 分队 ${rec.squad === 'moon' ? '月之国' : rec.squad} · 开始于 ${rec.startedAt}`, ''];
  for (const e of rec.events){
    const {t, L, type, ...d} = e;
    const body = type === 'log' ? d.text : type === 'note' ? `【玩家备注】${d.text}` : `<${type}> ${JSON.stringify(d)}`;
    lines.push(`[${fmt(t)}][${L === 4 ? '终' : 'L' + L}] ${body}`);
  }
  return lines.join('\n');
}
async function rlogDownload(kind){
  const recs = kind === 'all' ? rlogLoad() : [rlogRecord() || rlogLoad().slice(-1)[0]].filter(Boolean);
  if (!recs.length) return '还没有记录';
  const isJson = kind === 'all';
  const name = isJson ? `mecha-roguelike-all-${new Date().toISOString().slice(0,10)}.json` : `mecha-roguelike-${recs[0].startedAt.slice(0,10)}-${recs[0].id}.txt`;
  const data = isJson ? JSON.stringify(recs, null, 1) : rlogText(recs[0]) + '\n\n----- JSON -----\n' + JSON.stringify(recs[0]);
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl){ await dl.save({filename:name, data}); return '已下载'; }
  } catch(e){ if (e && e.code === 'declined') return '取消了下载'; }
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: isJson ? 'application/json' : 'text/plain'})); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return '已下载';
  } catch(e){}
  try { await navigator.clipboard.writeText(data); return '下载不可用，已复制到剪贴板'; } catch(e){ return '下载和复制都不可用'; }
}
async function openRunLogs(msg){
  await rlogCloud();
  const all = rlogLoad(), cur = rlogRecord();
  const rows = all.slice().reverse().map(r => { const end = r.events.find(e => e.type === 'run_end');
    return `<div class="rv-row"><span class="nm">${r.startedAt.slice(0,16).replace('T',' ')} · ${r.squad === 'moon' ? '月之国' : r.squad}分队<small>${end ? `${end.result} · 第 ${end.layer} 层 · ${end.battles} 场` : (cur && cur.id === r.id ? '进行中' : '未完成')} · ${r.events.length} 条</small></span></div>`; }).join('');
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">游玩记录 · 只记录肉鸽模式</div><h2>游玩记录</h2>
    <p class="small">自动记录每一步：移动、事件、招募、晋升、每场战斗的出击阵容、回合数、伤害、击破和结果。本地浏览器保留最近 20 局。<br>云端：<b>${RLOG_CLOUD.state}</b></p>
    ${msg ? `<p style="color:var(--good)">${msg}</p>` : ''}
    ${cur && !cur.over ? `<label class="small" for="rlNote">给这一局加备注（bug、手感、建议都可以，会和记录一起保存）</label>
      <textarea id="rlNote" rows="3" style="width:100%;box-sizing:border-box;background:var(--panel2);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:6px;font:inherit"></textarea>` : ''}
    <div class="rv-card" style="margin-top:8px;max-height:220px;overflow:auto">${rows || '<p class="small">还没有记录。</p>'}</div>
    <div class="acts">${cur && !cur.over ? '<button class="btn" data-v="note">保存备注</button>' : ''}
      <button class="btn primary" data-v="cur">下载本局（文本）</button><button class="btn" data-v="all">下载全部（JSON）</button>
      <button class="btn" data-v="clear">清空本地记录</button><button class="btn" data-v="close">关闭</button></div>`, true);
  if (v === 'note'){
    const t = (document.querySelector('#rlNote') || {}).value;
    if (t && t.trim()){ rlog('note', {text:t.trim()}); return openRunLogs('备注已保存'); }
    return openRunLogs();
  }
  if (v === 'cur' || v === 'all') return openRunLogs(await rlogDownload(v));
  if (v === 'clear'){ if (await ask('清空本地保存的游玩记录？', '云端的不受影响。', '清空')){ try { localStorage.removeItem(RLOG_KEY); } catch(e){} return openRunLogs('本地记录已清空'); } return openRunLogs(); }
}
window.addEventListener('error', e => { if (RUN && !RUN.over && RUN.events) rlog('error', {msg:String(e.message).slice(0, 200), at:`${e.lineno}:${e.colno}`}); });
window.addEventListener('unhandledrejection', e => { if (RUN && !RUN.over && RUN.events) rlog('error', {msg:String(e.reason && (e.reason.message || e.reason.code) || e.reason).slice(0, 200)}); });

document.querySelectorAll('#levelSel option').forEach(o => { const L = LEVELS[o.value]; if (L && L.code && !o.textContent.startsWith(L.code)) o.textContent = `${L.code} ${o.textContent}`; });
startLevel('roguelike');            // 默认入口：肉鸽模式（背后先准备好肉鸽开局，再盖一层模式选择）
/* 开场模式选择（作者 2026-10-05）：教学 / 肉鸽 / 剧情，推荐肉鸽 */
function goMode(v){ $('#levelSel').value = v; startLevel(v); }
async function titleScreen(){
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">机甲战棋 ${GAME_VERSION}</div><h2>选择模式</h2>
    <div class="acts" style="flex-direction:column;align-items:stretch;gap:8px">
      <button class="btn primary" data-v="challenge">战术挑战 · 每关一道题</button>
      <button class="btn" data-v="ruletest">规则试玩场 · 大众脸角色，每关只考一条规则</button>
      <button class="btn" data-v="roguelike" id="titleRun">肉鸽模式 · 混沌迷宫（关卡改造中）</button>
      <button class="btn" data-v="tut1">教学关 · 第一次玩从这里开始</button>
      <button class="btn" data-v="story">剧情模式（待施工）</button>
    </div><p class="small">之后随时可以在顶栏「关卡」菜单里切换模式。</p>`);
  /* 关卡列表子菜单：规则试玩场（05b）、战术挑战（05c） */
  const listMenu = async (title, note, stages) => {
    const ks = Object.keys(stages);
    const s = await dlg(`<h2>${title}</h2><p class="small">${note}</p>
      <div class="acts" style="flex-direction:column;align-items:stretch;gap:8px">
        ${ks.length ? ks.map(k => `<button class="btn" data-v="${k}">${stages[k].name}</button>`).join('') : '<p class="small">关卡对话正在做第一批，做好后会出现在这里。</p>'}
        <button class="btn" data-v="back">← 返回</button>
      </div>`);
    if (s === 'back') return titleScreen();
    return goMode(s);
  };
  if (v === 'ruletest') return listMenu('规则试玩场', '我方是只有基础属性的大众脸（每个职业一台，没有个人特技），每关只考一条规则，开场提示写着这关看什么。', RULE_STAGES);
  if (v === 'challenge') return listMenu('战术挑战', '手工关卡，每关一道题，开场提示写着这关考什么。', CHALLENGE_STAGES);
  if (v === 'story'){
    const s = await dlg(`<h2>剧情模式 · 待施工</h2><p class="small">剧本还没写。可以先玩这些原型关卡：</p>
      <div class="acts" style="flex-direction:column;align-items:stretch;gap:8px">
        <button class="btn" data-v="defense">大规模防卫战（Lv20）</button>
        <button class="btn" data-v="drill">弱点演习（Lv20）</button>
        <button class="btn" data-v="skirmish">自由对战 · 随机地图</button>
        <button class="btn" data-v="back">← 返回</button>
      </div>`);
    if (s === 'back') return titleScreen();
    return goMode(s);
  }
  goMode(v);
}
titleScreen();
requestAnimationFrame(draw);
