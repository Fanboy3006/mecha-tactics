/* ============================================================================
 *  关卡编辑器（v0.27，Claude 维护）
 * ----------------------------------------------------------------------------
 * 「关卡」菜单 → 工具 → 关卡编辑器。可以编辑肉鸽关卡（ISW-…）和原型关（教学、防卫战、弱点演习）：
 *   地形、各波敌人（种类 / 位置 / 朝向 / 等级）、波次到达回合、我方出击点或固定我方位置、词缀、名字、地图大小。
 * 编辑结果自动存在浏览器（localStorage: mecha-tactics-editor）；「试打」直接用编辑结果开一局；
 * 「导出」得到一段 JSON，交给 Claude 写进下面的 LEVEL_EDITS，之后所有人玩到的都是改过的版本。
 * ========================================================================== */
const ED_KEY = 'mecha-tactics-editor';
const ED_PROTO = ['tut1', 'tut2', 'tut3', 'defense', 'drill'];
const ED_TER = [['.', '平原'], ['f', '森林'], ['m', '山地'], ['w', '水域'], ['c', '裂谷'], ['x', '绝壁'], ['v', '重力深渊']];
const ED = {id:null, d:null, tool:'paint', ter:'.', etype:'grunt', elv:'', efacing:'left', wave:0, tp:24, drag:null, painting:false, dirty:false, testLv:20};
/* 改动先放在内存里（ED_ALL），同时尽量写进浏览器存储；浏览器存储被禁用时也能照常编辑、试打和导出，只是刷新后会丢 */
let ED_ALL = null, ED_SAVE_OK = true;
function edStore(){ if (ED_ALL) return ED_ALL; try { ED_ALL = JSON.parse(localStorage.getItem(ED_KEY) || '{}'); } catch(e){ ED_ALL = {}; } return ED_ALL; }
function edSaveStore(o){ ED_ALL = o; try { localStorage.setItem(ED_KEY, JSON.stringify(o)); ED_SAVE_OK = true; } catch(e){ ED_SAVE_OK = false; } return ED_SAVE_OK; }
const edClone = o => JSON.parse(JSON.stringify(o));
/* 把一个关卡读成编辑器的统一格式 */
function edLoad(id){
  const saved = edStore()[id];
  if (saved) return edClone(saved);
  if (STAGES[id]){
    const st = STAGES[id], b = buildStage(st);
    return {kind:'stage', id, name:st.name, w:b.W, h:b.H, rows:b.g.map(r => r.join('')),
      waves:b.waves.map(w => ({at:w.at, enemies:w.enemies.map(e => ({t:e.t, x:e.x, y:e.y, facing:e.facing || 'left', lv:e.lv}))})),
      spots:b.spots.map(s => [...s]), allies:null, affix:b.affix ? b.affix.name : null, baseLv:b.lv};
  }
  const L = LEVELS[id];
  const waves = L.waves ? L.waves.map(w => ({at:w.at ?? null, limit:w.limit, label:w.label, enemies:edClone(w.enemies || [])})) : [{at:null, enemies:edClone(L.enemies || [])}];
  return {kind:'level', id, name:L.name, w:L.w, h:L.h, rows:[...L.rows], waves, spots:L.spots ? edClone(L.spots) : null,
    allies:L.allies ? edClone(L.allies) : null, affix:null, baseLv:L.enemyLv || 1};
}
/* 编辑器格式 → 游戏用的覆盖数据（肉鸽关进 STAGE_OVERRIDES，原型关覆盖 LEVELS） */
function edToOverride(d){
  if (d.kind === 'stage') return {name:d.name, w:d.w, h:d.h, rows:d.rows, enemies:d.waves[0].enemies,
    waves:d.waves.slice(1).map(w => ({at:w.at, enemies:w.enemies})), spots:d.spots, affix:d.affix};
  const o = {name:d.name, w:d.w, h:d.h, rows:d.rows};
  if (LEVELS[d.id].waves) o.waveEnemies = d.waves.map(w => w.enemies); else o.enemies = d.waves[0].enemies;
  if (d.allies) o.allies = d.allies; if (d.spots) o.spots = d.spots;
  return o;
}
function applyLevelEdit(L, o){
  if (!L) return;
  for (const k of ['name', 'w', 'h', 'rows', 'enemies', 'allies', 'spots']) if (o[k] != null) L[k] = edClone(o[k]);
  if (o.waveEnemies && L.waves) o.waveEnemies.forEach((es, i) => { if (L.waves[i]) L.waves[i].enemies = edClone(es); else L.waves.push({limit:0, label:`第 ${i+1} 波`, enemies:edClone(es)}); });
}
function edCur(){ return ED.d; }
function edMark(){ ED.dirty = true; const s = edStore(); s[ED.id] = ED.d; edStatus(edSaveStore(s) ? '已自动保存到本机' : '这个浏览器不让保存：改动只在本次打开期间有效，记得先导出'); }
function edStatus(t){ const e = $('#edStatus'); if (e) e.textContent = t; }
function openEditor(){
  runHide(); $('#endModal').hidden = true; level = 'editor'; $('#levelSel').value = 'editor'; audioScene('menu');
  const v = $('#editView'); v.hidden = false;
  if (!ED.id) edSelect('ISW-1-N-1'); else edRender();
}
function closeEditor(){ $('#editView').hidden = true; }
function edSelect(id){ ED.id = id; ED.d = edLoad(id); ED.wave = 0; ED.dirty = false; edRender(); }
function edOptions(){
  const st = edStore(), mark = id => st[id] ? ' ✎' : '';
  const byLayer = {};
  for (const s of Object.values(STAGES)) (byLayer[s.layer] = byLayer[s.layer] || []).push(s);
  return Object.entries(byLayer).map(([L, ss]) => `<optgroup label="肉鸽 · 第 ${L} 层">${ss.sort((a,b) => a.code.localeCompare(b.code)).map(s => `<option value="${s.code}" ${s.code === ED.id ? 'selected' : ''}>${s.code} ${s.name}${mark(s.code)}</option>`).join('')}</optgroup>`).join('')
    + `<optgroup label="原型关">${ED_PROTO.map(id => `<option value="${id}" ${id === ED.id ? 'selected' : ''}>${LEVELS[id].code || id} ${LEVELS[id].name}${mark(id)}</option>`).join('')}</optgroup>`;
}
function edRender(){
  const d = ED.d, v = $('#editView');
  const etypes = Object.entries(ENEMY_T).map(([k, t]) => `<option value="${k}" ${k === ED.etype ? 'selected' : ''}>${t.mech}（${k}${t.w > 1 ? ` · ${t.w}×${t.h}` : ''}）</option>`).join('');
  const waveRows = d.waves.map((w, i) => `<div class="ed-wave ${i === ED.wave ? 'on' : ''}" data-wave="${i}">
      <b>第 ${i+1} 波</b><span>${w.enemies.length} 台</span>
      ${i === 0 ? '<span class="small">开局</span>' : d.kind === 'stage' ? `<label class="small">第 <input type="number" min="1" max="30" value="${w.at ?? ''}" data-at="${i}" style="width:44px"> 回合到达</label>` : `<span class="small">${w.limit ? `上限 ${w.limit} 回合` : ''}</span>`}
      ${i > 0 && d.kind === 'stage' ? `<button class="rv-btn" data-delwave="${i}">删除</button>` : ''}</div>`).join('');
  v.innerHTML = `<div class="rv-bar"><span class="ttl">关卡编辑器</span>
      <select id="edSel">${edOptions()}</select>
      <label class="small">名字 <input id="edName" value="${d.name.replace(/"/g, '&quot;')}" style="width:120px"></label>
      <label class="small">宽 <input id="edW" type="number" min="10" max="40" value="${d.w}" style="width:48px"></label>
      <label class="small">高 <input id="edH" type="number" min="8" max="40" value="${d.h}" style="width:48px"></label>
      ${d.kind === 'stage' ? `<label class="small">词缀 <select id="edAffix"><option value="">无</option>${AFFIXES.map(a => `<option ${a.name === d.affix ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>` : ''}
      <span style="flex:1"></span>
      <label class="small">试打我方 Lv <select id="edTestLv">${[10, 20, 30].map(n => `<option ${n === ED.testLv ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="rv-btn" id="edTest">▶ 试打</button><button class="rv-btn" id="edRevert">还原为原版</button><button class="rv-btn" id="edExport">导出全部改动</button><button class="rv-btn" id="edClose">关闭</button></div>
    <div class="ed-body">
      <div class="ed-side">
        <div class="rv-card"><h3>工具</h3>
          <div class="ed-tools">${[['paint', '刷地形'], ['enemy', '放敌人'], ['spot', d.allies ? '我方位置' : '出击点'], ['move', '移动'], ['erase', '删除']].map(([k, n]) => `<button class="rv-btn ${ED.tool === k ? 'on' : ''}" data-tool="${k}">${n}</button>`).join('')}</div>
          ${ED.tool === 'paint' ? `<div class="ed-tools">${ED_TER.map(([c, n]) => `<button class="rv-btn ${ED.ter === c ? 'on' : ''}" data-ter="${c}"><i class="ed-sw" style="background:${COL[TILE_CH[c]]}"></i>${n}</button>`).join('')}</div><p class="small">按住拖动可以连续刷。</p>` : ''}
          ${ED.tool === 'enemy' ? `<p><select id="edEtype" style="width:100%">${etypes}</select></p>
            <p class="small">等级 <input id="edElv" type="number" min="1" max="40" value="${ED.elv}" placeholder="${d.baseLv}" style="width:52px">（空 = 按关卡默认 Lv${d.baseLv}）　朝向 <select id="edEface">${[['left','←'],['right','→'],['up','↑'],['down','↓']].map(([k,n]) => `<option value="${k}" ${k === ED.efacing ? 'selected' : ''}>${n}</option>`).join('')}</select></p>
            <p class="small">放在当前选中的第 ${ED.wave + 1} 波。</p>` : ''}
          ${ED.tool === 'spot' ? `<p class="small">${d.allies ? '拖动 / 点击：把选中的我方机体移到这里。先点一台我方机体选中它。' : '点空格子加一个出击点，再点一次去掉。出击点就是编队时我方机体的落点（按顺序）。'}</p>` : ''}
          ${ED.tool === 'move' ? '<p class="small">按住敌人 / 出击点拖到新位置。</p>' : ''}
          ${ED.tool === 'erase' ? '<p class="small">点敌人或出击点删除。</p>' : ''}
        </div>
        <div class="rv-card"><h3>波次</h3>${waveRows}${d.kind === 'stage' ? '<button class="rv-btn" id="edAddWave">＋ 加一波</button>' : '<p class="small">原型关的波次数量和回合上限沿用原设计，这里只改每波的敌人。</p>'}</div>
        <div class="rv-card"><h3>说明</h3><p class="small">改动会自动保存在这个浏览器里（下拉菜单里带 ✎ 的就是改过的关）。改完点「导出全部改动」，把得到的文本交给 Claude，写进游戏后所有人玩到的都是你的版本。</p><p class="small" id="edStatus">${ED.dirty ? '已自动保存到本机' : edStore()[ED.id] ? '这一关在本机有改动' : '原版'}</p><p class="small" id="edHover"></p></div>
      </div>
      <div class="ed-map"><canvas id="edCv"></canvas></div>
    </div>`;
  edBind(); edDraw();
}
function edDraw(){
  const d = ED.d, cv = $('#edCv'); if (!cv) return;
  const wrapW = Math.max(300, (cv.parentElement.clientWidth || 800) - 8);
  ED.tp = Math.max(14, Math.min(34, Math.floor(wrapW / d.w)));
  const tp = ED.tp, dpr = window.devicePixelRatio || 1;
  cv.width = d.w * tp * dpr; cv.height = d.h * tp * dpr; cv.style.width = d.w * tp + 'px'; cv.style.height = d.h * tp + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++){ const c = (d.rows[y] || '')[x] || '.'; g.fillStyle = COL[TILE_CH[c] || 'plain']; g.fillRect(x*tp, y*tp, tp, tp);
    if (c === 'f'){ g.fillStyle = COL.forestTree; g.beginPath(); g.moveTo(x*tp+tp/2, y*tp+3); g.lineTo(x*tp+tp-4, y*tp+tp-4); g.lineTo(x*tp+4, y*tp+tp-4); g.fill(); }
    if (c === 'm'){ g.fillStyle = COL.mountainPeak; g.beginPath(); g.moveTo(x*tp+tp/2, y*tp+3); g.lineTo(x*tp+tp-2, y*tp+tp-3); g.lineTo(x*tp+2, y*tp+tp-3); g.fill(); } }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
  for (let x = 0; x <= d.w; x++){ g.beginPath(); g.moveTo(x*tp+.5, 0); g.lineTo(x*tp+.5, d.h*tp); g.stroke(); }
  for (let y = 0; y <= d.h; y++){ g.beginPath(); g.moveTo(0, y*tp+.5); g.lineTo(d.w*tp, y*tp+.5); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // 出击点 / 固定我方
  (d.spots || []).forEach(([x, y], i) => { g.fillStyle = 'rgba(79,149,224,.35)'; g.fillRect(x*tp+2, y*tp+2, tp-4, tp-4); g.strokeStyle = '#4f95e0'; g.lineWidth = 2; g.strokeRect(x*tp+2, y*tp+2, tp-4, tp-4); g.fillStyle = '#dfe9f6'; g.font = `700 ${Math.round(tp*.42)}px sans-serif`; g.fillText(String(i+1), x*tp+tp/2, y*tp+tp/2); });
  (d.allies || []).forEach((a, i) => { g.fillStyle = ED.sel === i ? 'rgba(92,192,138,.75)' : 'rgba(92,192,138,.45)'; g.fillRect(a.x*tp+2, a.y*tp+2, tp-4, tp-4); g.fillStyle = '#fff'; g.font = `700 ${Math.round(tp*.34)}px sans-serif`; g.fillText(a.mech, a.x*tp+tp/2, a.y*tp+tp/2); });
  // 敌人：当前波实心，其它波半透明
  d.waves.forEach((w, wi) => w.enemies.forEach(e => {
    const t = ENEMY_T[e.t] || {w:1, h:1, short:'?'}, cur = wi === ED.wave;
    g.globalAlpha = cur ? 1 : .35;
    g.fillStyle = cur ? '#d9564b' : '#8a3a33'; g.beginPath();
    if (t.w > 1) g.rect(e.x*tp+3, e.y*tp+3, t.w*tp-6, t.h*tp-6); else g.arc(e.x*tp+tp/2, e.y*tp+tp/2, tp/2-3, 0, Math.PI*2);
    g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(tp*(t.w > 1 ? .5 : .38))}px sans-serif`; g.fillText(t.short || e.t.slice(0, 2), e.x*tp+t.w*tp/2, e.y*tp+t.h*tp/2);
    if (!cur){ g.fillStyle = '#ffd38a'; g.font = `700 ${Math.round(tp*.3)}px sans-serif`; g.fillText(String(wi+1), e.x*tp+tp-5, e.y*tp+6); }
    if (e.lv && cur){ g.fillStyle = '#ffd38a'; g.font = `700 ${Math.round(tp*.28)}px sans-serif`; g.fillText(String(e.lv), e.x*tp+tp-6, e.y*tp+tp-5); }
    g.globalAlpha = 1;
  }));
}
function edHit(x, y){
  const d = ED.d;
  const w = d.waves[ED.wave];
  const ei = w.enemies.findIndex(e => { const t = ENEMY_T[e.t] || {w:1, h:1}; return x >= e.x && x < e.x + t.w && y >= e.y && y < e.y + t.h; });
  if (ei >= 0) return {kind:'enemy', i:ei};
  const si = (d.spots || []).findIndex(([a, b]) => a === x && b === y); if (si >= 0) return {kind:'spot', i:si};
  const ai = (d.allies || []).findIndex(a => a.x === x && a.y === y); if (ai >= 0) return {kind:'ally', i:ai};
  return null;
}
function edPaint(x, y){ const d = ED.d, r = d.rows[y]; if (!r || r[x] === ED.ter) return; d.rows[y] = r.slice(0, x) + ED.ter + r.slice(x + 1); }
function edResize(w, h){
  const d = ED.d; w = clamp(w|0, 10, 40); h = clamp(h|0, 8, 40);
  d.rows = [...Array(h)].map((_, y) => ((d.rows[y] || '') + '.'.repeat(w)).slice(0, w));
  d.w = w; d.h = h;
  d.waves.forEach(wv => wv.enemies = wv.enemies.filter(e => e.x < w && e.y < h));
  if (d.spots) d.spots = d.spots.filter(([x, y]) => x < w && y < h);
  if (d.allies) d.allies.forEach(a => { a.x = Math.min(a.x, w-1); a.y = Math.min(a.y, h-1); });
}
function edBind(){
  const v = $('#editView'), d = ED.d;
  $('#edSel').onchange = e => edSelect(e.target.value);
  $('#edName').onchange = e => { d.name = e.target.value; edMark(); };
  $('#edW').onchange = e => { edResize(+e.target.value, d.h); edMark(); edRender(); };
  $('#edH').onchange = e => { edResize(d.w, +e.target.value); edMark(); edRender(); };
  if ($('#edAffix')) $('#edAffix').onchange = e => { d.affix = e.target.value || null; edMark(); };
  $('#edTestLv').onchange = e => { ED.testLv = +e.target.value; };
  $('#edClose').onclick = () => { closeEditor(); startLevel('roguelike'); };
  $('#edRevert').onclick = async () => { if (await ask(`把 ${ED.id} 还原为原版？`, '会删除这一关在本机的改动。', '还原')){ const s = edStore(); delete s[ED.id]; edSaveStore(s); ED.d = null; edSelect(ED.id); } else edRender(); };
  $('#edExport').onclick = edExport;
  $('#edTest').onclick = edTest;
  if ($('#edAddWave')) $('#edAddWave').onclick = () => { d.waves.push({at:(d.waves[d.waves.length-1].at || 1) + 2, enemies:[]}); ED.wave = d.waves.length - 1; edMark(); edRender(); };
  if ($('#edEtype')) $('#edEtype').onchange = e => { ED.etype = e.target.value; };
  if ($('#edElv')) $('#edElv').onchange = e => { ED.elv = e.target.value; };
  if ($('#edEface')) $('#edEface').onchange = e => { ED.efacing = e.target.value; };
  v.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { ED.tool = b.dataset.tool; edRender(); });
  v.querySelectorAll('[data-ter]').forEach(b => b.onclick = () => { ED.ter = b.dataset.ter; edRender(); });
  v.querySelectorAll('[data-wave]').forEach(b => b.onclick = e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return; ED.wave = +b.dataset.wave; edRender(); });
  v.querySelectorAll('[data-at]').forEach(inp => inp.onchange = () => { d.waves[+inp.dataset.at].at = Math.max(1, +inp.value || 1); edMark(); });
  v.querySelectorAll('[data-delwave]').forEach(b => b.onclick = () => { d.waves.splice(+b.dataset.delwave, 1); ED.wave = 0; edMark(); edRender(); });
  const cv = $('#edCv');
  const cell = e => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / ED.tp), Math.floor((e.clientY - r.top) / ED.tp)]; };
  cv.onmousedown = e => {
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    const hit = edHit(x, y);
    if (ED.tool === 'paint'){ ED.painting = true; edPaint(x, y); edDraw(); }
    else if (ED.tool === 'enemy'){ if (!hit) { d.waves[ED.wave].enemies.push({t:ED.etype, x, y, facing:ED.efacing, ...(ED.elv ? {lv:+ED.elv} : {})}); edMark(); edRender(); } }
    else if (ED.tool === 'spot'){
      if (d.allies){ if (hit && hit.kind === 'ally'){ ED.sel = hit.i; ED.drag = hit; } else if (ED.sel != null){ d.allies[ED.sel].x = x; d.allies[ED.sel].y = y; edMark(); } edDraw(); }
      else { if (!d.spots) d.spots = []; if (hit && hit.kind === 'spot') d.spots.splice(hit.i, 1); else if (!hit) d.spots.push([x, y]); edMark(); edDraw(); }
    }
    else if (ED.tool === 'erase'){ if (hit && hit.kind === 'enemy') d.waves[ED.wave].enemies.splice(hit.i, 1); else if (hit && hit.kind === 'spot') d.spots.splice(hit.i, 1); else return; edMark(); edRender(); }
    else if (ED.tool === 'move'){ if (hit) ED.drag = hit; }
  };
  cv.onmousemove = e => {
    const [x, y] = cell(e); if (x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    const h = edHit(x, y), hv = $('#edHover');
    if (hv) hv.textContent = `(${x}, ${y}) ${({'.':'平原',f:'森林',m:'山地',w:'水域',c:'裂谷'})[(d.rows[y] || '')[x]] || ''}${h && h.kind === 'enemy' ? ' · ' + ENEMY_T[d.waves[ED.wave].enemies[h.i].t].mech : ''}`;
    if (ED.painting){ edPaint(x, y); edDraw(); }
    if (ED.drag){ const g = ED.drag; if (g.kind === 'enemy'){ const o = d.waves[ED.wave].enemies[g.i]; o.x = x; o.y = y; } else if (g.kind === 'spot') d.spots[g.i] = [x, y]; else if (g.kind === 'ally'){ d.allies[g.i].x = x; d.allies[g.i].y = y; } edDraw(); }
  };
  const up = () => { if (ED.painting || ED.drag){ ED.painting = false; ED.drag = null; edMark(); } };
  cv.onmouseup = up; cv.onmouseleave = up;
}
function edTest(){
  const d = ED.d, ov = edToOverride(d);
  let L;
  if (d.kind === 'stage'){
    const st = {...STAGES[d.id], ...ov}, b = buildStage(st), affix = b.affix;
    L = {code:d.id, name:`试打 · ${d.id} ${d.name}${affix ? ' · 【' + affix.name + '】' : ''}`, w:b.W, h:b.H, speed:.6, formation:true, noCmd:true, edit:true,
      rows:b.g.map(r => r.join('')), rosterList:ALLY_T.map(t => ({mech:t.mech, lv:ED.testLv})), maxDeploy:6, spots:b.spots, allyFacing:'right',
      defaultDeploy:['B1','CB1','M2','CB2','M3','S1'],
      waves:b.waves.map((w, i) => ({at:w.at, lv:b.lv, label:`第 ${i+1} 波`, enemies:w.enemies})),
      onSpawn:e => { if (affix) affix.fn(e); }, victory:{type:'annihilate'}, goalText:`击破全部 ${b.waves.length} 波敌军（编辑器试打）`, tips:[]};
  } else {
    const base = LEVELS[d.id];
    L = {...base, rows:[...base.rows], waves:base.waves ? base.waves.map(w => ({...w, enemies:edClone(w.enemies || [])})) : undefined,
      allies:base.allies ? edClone(base.allies) : undefined, enemies:base.enemies ? edClone(base.enemies) : undefined, spots:base.spots ? edClone(base.spots) : undefined};
    applyLevelEdit(L, ov);
    L.edit = true; L.name = `试打 · ${d.name}`;
    if (L.spots && !L.allies) L.rosterLv = ED.testLv;
  }
  LEVELS.edit = L; closeEditor(); startLevel('edit');
  log('编辑器试打：打完或想改的时候，在「关卡」菜单选「关卡编辑器」回到编辑器（改动都在）', null, 'sys');
}
async function edExport(){
  const all = edStore(), keys = Object.keys(all);
  if (!keys.length){ await dlg(`<h2>还没有改动</h2><p class="small">先改一关再导出。</p><div class="acts"><button class="btn primary" data-v="ok">好</button></div>`); edRender(); return; }
  const out = {}; keys.forEach(k => { out[k] = edToOverride(all[k]); });
  const text = JSON.stringify({version:GAME_VERSION, exportedAt:new Date().toISOString(), edits:out}, null, 1);
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">导出关卡改动</div><h2>${keys.length} 关：${keys.join('、')}</h2>
    <p class="small">把下面的文本（或下载的文件）交给 Claude，写进游戏后就固定下来了。</p>
    <textarea id="edOut" readonly style="width:100%;height:220px;font:12px/1.4 JetBrains Mono, monospace">${text.replace(/</g, '&lt;')}</textarea>
    <div class="acts"><button class="btn primary" data-v="dl">下载文件</button><button class="btn" data-v="copy">复制</button><button class="btn" data-v="ok">关闭</button></div>`, true);
  if (v === 'dl') edStatus(await saveFile(`mecha-level-edits-${new Date().toISOString().slice(0,10)}.json`, text, 'application/json'));
  if (v === 'copy'){ try { await navigator.clipboard.writeText(text); edStatus('已复制'); } catch(e){ edStatus('复制失败，请手动选中文本复制'); } }
  edRender();
}
async function saveFile(name, data, type){
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl){ await dl.save({filename:name, data}); return '已下载'; } } catch(e){ if (e && e.code === 'declined') return '取消了下载'; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return '已下载'; } catch(e){}
  try { await navigator.clipboard.writeText(data); return '下载不可用，已复制到剪贴板'; } catch(e){ return '下载和复制都不可用'; }
}
window.addEventListener('resize', () => { if (!$('#editView').hidden) edDraw(); });
/* 已经写进游戏的关卡改动（作者用编辑器导出、Claude 粘贴进 LEVEL_EDITS）：原型关在这里生效，肉鸽关在 STAGES 生成前已经并入 STAGE_OVERRIDES */
for (const [k, o] of Object.entries(LEVEL_EDITS)) if (LEVELS[k] && !k.startsWith('ISW-')) applyLevelEdit(LEVELS[k], o);

