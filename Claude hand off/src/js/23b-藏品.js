/* ---------- 藏品 ---------- */
/* v0.31 藏品（设计见 docs/藏品设计 v0.1.md）。整局常驻，主要影响战斗；和零件（大地图道具）是两套。
   字段：
     cls     本件「自身加成」只给哪个职业（数组；省略 = 全队）
     mods    常驻增益，和 buffSum 同一套键：dmg / red / hit / eva / crit / armorPct（回避 +20 = eva +10）
     stat    开战时直接改出击机体：hpPct（HP%）、mov、range（射程，地图炮 / 被动 / 指挥 / 辅助类不算）、guard（援护防御次数）
     stack   叠层：{by:[按哪些职业的出击人数算], per:{每层增益}, max, to:[给哪些职业；省略 = 全队]}
     foe     敌方常驻减益（mods 键）；foeStack 同 stack，但加在敌人身上
     special 条件类 / 经济类，由各自的代码处理（第二、三批实现） */
const RELIC_PRICE = {普通:8, 稀有:12, 传说:16};
const R = (name, tier, o = {}) => ({name, tier, price:RELIC_PRICE[tier], ...o});
const RELICS = {
  // A. 职业专属
  g1:R('格斗框架·强化型','普通',{cls:['近卫'], stat:{hpPct:30}, mods:{armorPct:15}, desc:'近卫 HP +30%、装甲 +15%'}),
  g2:R('高输出光束军刀','稀有',{cls:['近卫'], mods:{dmg:25}, desc:'近卫伤害 +25%'}),
  g3:R('限制器解除','传说',{cls:['近卫'], mods:{dmg:40, crit:15, armorPct:-40}, desc:'近卫伤害 +40%、暴击 +15，但装甲 −40%'}),
  g4:R('突击编队','稀有',{stack:{by:['近卫'], per:{dmg:6}, max:5}, desc:'每有 1 名近卫出击，全队伤害 +6%（最多 5 层）'}),
  s1:R('轻量化骨架','普通',{cls:['尖兵'], stat:{mov:1}, mods:{eva:10}, desc:'尖兵移动 +1、回避 +20'}),
  s2:R('侦察兵的直觉','稀有',{cls:['尖兵'], stat:{range:1}, mods:{dmg:20}, desc:'尖兵伤害 +20%、射程 +1'}),
  s3:R('零装甲疾驰','传说',{cls:['尖兵'], stat:{mov:2, hpPct:-40}, mods:{eva:20}, desc:'尖兵移动 +2、回避 +40，但 HP −40%'}),
  s4:R('游击网络','稀有',{foeStack:{by:['尖兵'], per:{hit:-4}, max:5}, desc:'每有 1 名尖兵出击，敌方全体命中 −4（最多 5 层）'}),
  a1:R('冗余电源','普通',{cls:['指挥'], stat:{hpPct:30}, mods:{armorPct:15}, desc:'指挥 HP +30%、装甲 +15%'}),
  a2:R('战术数据链·扩展','稀有',{special:'auraDmg', desc:'指挥 3 格内的友军伤害 +10%（不叠加）'}),
  a3:R('过载广播','传说',{mods:{dmg:20}, special:'broadcast', desc:'全队伤害 +20%，但指挥自身 HP −50%'}),
  a4:R('后勤网','稀有',{special:'regenStack', desc:'每有 1 名指挥出击，全队每个我方阶段开始回复 3% 最大 HP（最多 5 层）'}),
  h1:R('加厚装甲','普通',{cls:['重装'], stat:{hpPct:30}, mods:{armorPct:20}, desc:'重装 HP +30%、装甲 +20%'}),
  h2:R('反应装甲','稀有',{cls:['重装'], mods:{red:15}, desc:'重装减伤 +15%'}),
  h3:R('移动要塞','传说',{cls:['重装'], stat:{mov:-2, guard:1}, mods:{dmg:50}, desc:'重装伤害 +50%、援护防御次数 +1，但移动 −2'}),
  h4:R('盾墙','稀有',{stack:{by:['重装'], per:{red:4}, max:5}, desc:'每有 1 名重装出击，全队减伤 +4%（最多 5 层）'}),
  n1:R('稳定支架','普通',{cls:['狙击'], stat:{hpPct:30}, mods:{armorPct:15}, desc:'狙击 HP +30%、装甲 +15%'}),
  n2:R('长管加速器','稀有',{cls:['狙击'], stat:{range:1}, mods:{dmg:20}, desc:'狙击伤害 +20%、射程 +1'}),
  n3:R('一发入魂','传说',{cls:['狙击'], stat:{hpPct:-40}, mods:{dmg:40, crit:20}, desc:'狙击伤害 +40%、暴击 +20，但 HP −40%'}),
  n4:R('交叉火力','稀有',{stack:{by:['狙击'], per:{hit:5}, max:5}, desc:'每有 1 名狙击出击，全队命中 +5（最多 5 层）'}),
  x1:R('模块化外装','普通',{cls:['特种'], stat:{hpPct:30}, mods:{armorPct:15}, desc:'特种 HP +30%、装甲 +15%'}),
  x2:R('破甲弹头','稀有',{special:'shred', desc:'特种攻击命中后，目标挂破防 10%（到下一个我方阶段）'}),
  x3:R('孤军作战','传说',{special:'loner', desc:'特种 3 格内没有其他友军时伤害 +60%，有友军时伤害 −10%'}),
  x4:R('渗透网络','稀有',{foeStack:{by:['特种'], per:{armorPct:-5}, max:5}, desc:'每有 1 名特种出击，敌方全体装甲 −5%（最多 5 层）'}),
  // B. 免费晋升
  t1:R('格斗教范','普通',{special:'promo', promo:'近卫', desc:'立即免费晋升 1 名近卫'}),
  t2:R('侦察教范','普通',{special:'promo', promo:'尖兵', desc:'立即免费晋升 1 名尖兵'}),
  t3:R('后勤教范','普通',{special:'promo', promo:'指挥', desc:'立即免费晋升 1 名指挥'}),
  t4:R('防御教范','普通',{special:'promo', promo:'重装', desc:'立即免费晋升 1 名重装'}),
  t5:R('射击教范','普通',{special:'promo', promo:'狙击', desc:'立即免费晋升 1 名狙击'}),
  t6:R('特战教范','普通',{special:'promo', promo:'特种', desc:'立即免费晋升 1 名特种'}),
  // C. 双职业协议
  p1:R('突击协议','普通',{stack:{by:['近卫','尖兵'], per:{dmg:5}, max:12, to:['近卫','尖兵']}, desc:'每有 1 名近卫或尖兵出击，近卫和尖兵伤害 +5%'}),
  p2:R('堡垒协议','普通',{stack:{by:['重装','指挥'], per:{red:4}, max:12, to:['重装','指挥']}, desc:'每有 1 名重装或指挥出击，重装和指挥减伤 +4%'}),
  p3:R('远程协议','普通',{stack:{by:['狙击','特种'], per:{hit:5, dmg:4}, max:12, to:['狙击','特种']}, desc:'每有 1 名狙击或特种出击，狙击和特种命中 +5、伤害 +4%'}),
  // D. 构筑规则
  b1:R('混编作战条例','传说',{special:'mixed', desc:'出击队伍里每有 1 个不同的职业，全队伤害 +8%'}),
  b2:R('孤狼','传说',{special:'lonewolf', desc:'出击 1–2 人时全队伤害 +50%、装甲 +30%；出击 4 人以上时全队伤害 −15%'}),
  b3:R('密集阵型','稀有',{special:'tight', desc:'每台我方机体 2 格内每有 1 名友军，伤害 +6%（最多 +24%）'}),
  b4:R('远距离射击理论','稀有',{special:'farshot', desc:'离目标每远 1 格，伤害 +3%（最多 +30%）'}),
  // E. 全队 / 敌方削弱（三档）
  e1:R('应急装甲板','普通',{mods:{armorPct:10}, desc:'全队装甲 +10%'}),
  e2:R('复合装甲','稀有',{mods:{armorPct:20}, desc:'全队装甲 +20%'}),
  e3:R('相转移装甲','传说',{mods:{armorPct:30}, desc:'全队装甲 +30%'}),
  e4:R('ECM 干扰器','普通',{foe:{hit:-5}, desc:'敌方全体命中 −5'}),
  e5:R('电子战吊舱','稀有',{foe:{hit:-10}, desc:'敌方全体命中 −10'}),
  e6:R('米诺夫斯基粒子散布器','传说',{foe:{hit:-15}, desc:'敌方全体命中 −15'}),
  e7:R('破甲情报','普通',{foe:{armorPct:-10}, desc:'敌方全体装甲 −10%'}),
  e8:R('弱点分析报告','稀有',{foe:{armorPct:-20}, desc:'敌方全体装甲 −20%'}),
  e9:R('λ 观测数据','传说',{foe:{armorPct:-30}, desc:'敌方全体装甲 −30%'}),
  // F. 经济 / 编制
  f1:R('黑市会员卡','稀有',{special:'discount', desc:'黑市价格 −30%（零件和藏品都算）'}),
  f2:R('战地回收协议','普通',{special:'salvage', desc:'每场战斗多 1 个补给箱，补给箱必定同时掉源碳结晶和零件'}),
  f3:R('源碳反应炉','传说',{special:'reactor', desc:'每持有 10 源碳结晶，全队伤害 +3%（最多 +30%）'}),
  f4:R('编制扩充令','传说',{special:'deploy', desc:'出击上限 +1'}),
};
const hasRelic = id => !!(RUN && RUN.relics && RUN.relics.includes(id));
const addMods = (to, m, k = 1) => { for (const [key, v] of Object.entries(m || {})) to[key] = (to[key] || 0) + v * k; };
const RANGE_SKIP = ['map', 'passive', 'command', 'support', 'heal', 'device'];
/* 开战时调用：给本场所有出击的我方机体算 relicMods、改属性。allies = 出击机体 */
function relicApplyAllies(allies){
  if (!RUN || !RUN.relics || !RUN.relics.length) return;
  const clsOf = u => u.tags && u.tags.战斗分类;
  const count = list => allies.filter(u => list.includes(clsOf(u))).length;
  for (const u of allies){
    const m = {}, c = clsOf(u);
    for (const id of RUN.relics){
      const r = RELICS[id]; if (!r) continue;
      const mine = !r.cls || r.cls.includes(c);
      if (r.mods && mine) addMods(m, r.mods);
      if (r.stat && mine){
        const s = r.stat;
        if (s.hpPct){ const k = 1 + s.hpPct / 100; u.maxHp = Math.max(1, Math.round(u.maxHp * k)); u.hp = Math.max(1, Math.round(u.hp * k)); }
        if (s.mov) u.mov = Math.max(1, u.mov + s.mov);
        if (s.range) u.weapons = u.weapons.map(w => RANGE_SKIP.includes(w.fire) ? w : {...w, range:[w.range[0], w.range[1] + s.range]});
        if (s.guard) u.guardBonus = (u.guardBonus || 0) + s.guard;
      }
      if (r.stack && (!r.stack.to || r.stack.to.includes(c))) addMods(m, r.stack.per, Math.min(r.stack.max, count(r.stack.by)));
    }
    u.relicMods = m;
  }
}
/* 敌人生成时调用（onSpawn）：敌方常驻减益 */
function relicApplyFoe(e, allies){
  if (!RUN || !RUN.relics || !RUN.relics.length) return;
  const count = list => allies.filter(u => list.includes(u.tags && u.tags.战斗分类)).length;
  const m = {};
  for (const id of RUN.relics){
    const r = RELICS[id]; if (!r) continue;
    if (r.foe) addMods(m, r.foe);
    if (r.foeStack) addMods(m, r.foeStack.per, Math.min(r.foeStack.max, count(r.foeStack.by)));
  }
  e.relicMods = m;
}
/* ---- 获取（v0.31 第二步）：三选一、掉落偏重、免费晋升、黑市价格、大地图卡片 ---- */
const relicFavCls = () => !RUN ? null : CLASSES.includes(RUN.squad) ? RUN.squad : RUN.squad === 'moon' ? '指挥' : null;   // 势力分队不偏重
const relicIsFav = (id, c) => { const r = RELICS[id]; return !!c && ((r.cls || []).includes(c) || (r.stack && r.stack.by.includes(c)) || (r.foeStack && r.foeStack.by.includes(c)) || r.promo === c); };
/* 从指定稀有度里挑 n 件没拿过的：每件 70% 从当前分队职业的藏品里出 */
function relicPick(tiers, n){
  const own = RUN.relics || [], pool = Object.keys(RELICS).filter(id => tiers.includes(RELICS[id].tier) && !own.includes(id)), out = [];
  const c = relicFavCls();
  while (out.length < n){
    const left = pool.filter(id => !out.includes(id)); if (!left.length) break;
    const fav = left.filter(id => relicIsFav(id, c));
    out.push(pick(fav.length && Math.random() < .7 ? fav : left));
  }
  return out;
}
const relicPrice = id => Math.round(RELICS[id].price * (hasRelic('f1') ? .7 : 1));
function relicPromo(cls){
  const u = RUN.units.filter(x => tplOf(x.mech).tags.战斗分类 === cls && x.lv < 30).sort((a, b) => b.lv - a.lv)[0];
  if (!u){ RUN.pendingPromo = [...(RUN.pendingPromo || []), cls]; runLog(`${cls}教范：队里没有能晋升的${cls}，招到人后自动使用`); return; }
  const to = u.lv === 10 ? 20 : 30; u.lv = to;
  runLog(`${tplOf(u.mech).pilot} 免费晋升到 Lv${to}（${cls}教范）`);
}
/* 招募之后调用：把还没用掉的教范用掉 */
function relicPendingPromo(){
  const left = [];
  for (const cls of RUN.pendingPromo || []){ if (RUN.units.some(x => tplOf(x.mech).tags.战斗分类 === cls && x.lv < 30)) relicPromo(cls); else left.push(cls); }
  RUN.pendingPromo = left;
}
function gainRelicRun(id, src){
  const r = RELICS[id]; if (!r || hasRelic(id)) return;
  RUN.relics = RUN.relics || []; RUN.relics.push(id);
  runLog(`获得藏品【${r.name}】（${src}）`); rlog('relic', {id, src});
  if (r.special === 'promo') relicPromo(r.promo);
}
const relicCardHtml = (id, v, extra = '') => { const r = RELICS[id]; return `<button class="rcard" style="--fc:${r.tier === '传说' ? 'var(--accent)' : r.tier === '稀有' ? '#9fb7d8' : 'var(--good)'}" data-v="${v}" ${extra}><b>${r.name}</b><small>${r.tier}${r.cls ? ' · ' + r.cls.join('/') : ''}</small><small>${r.desc}</small></button>`; };
/* 三选一，可以跳过 */
async function offerRelics(tiers, src){
  const ids = relicPick(tiers, 3); if (!ids.length) return;
  runShow();
  const v = await dlg(`<div class="eyebrow" style="color:var(--accent)">${src}</div><h2>选择一件藏品</h2>
    <div class="rcards">${ids.map(id => relicCardHtml(id, id)).join('')}</div>
    <div class="acts"><button class="btn" data-v="skip">都不要</button></div>`, true);
  if (v !== 'skip') gainRelicRun(v, src);
}
function relicsCard(){
  const own = RUN.relics || [];
  return `<div class="rv-card"><h3>藏品（${own.length}）</h3>${own.length ? own.map(id => { const r = RELICS[id]; return `<div class="rv-row"><span class="nm">${r.name}<small>${r.tier}</small><br><small style="margin-left:0">${r.desc}</small></span></div>`; }).join('') : '<p class="small">还没有。精英战、层底守军、黑市可以获得。</p>'}</div>`;
}
/* ---- 条件类（v0.31 第三步）---- */
const relicCls = u => u && u.tags && u.tags.战斗分类;
/* 伤害管线（genMods）里调用：按当场站位算的伤害加成，返回百分比 */
function relicDmg(att, def, w, o = {}){
  if (!att || att.side !== 'ally' || !RUN || !RUN.relics || !RUN.relics.length || !LV || !LV.run) return 0;
  const [ax, ay] = o.from || [att.x, att.y];
  const allies = units.filter(u => u.side === 'ally' && u.hp > 0 && u !== att);
  const near = r => allies.filter(u => distU(att, u, ax, ay) <= r).length;   // att 站在 (ax, ay) 时和 u 的距离
  let p = 0;
  if (hasRelic('a2') && allies.some(u => relicCls(u) === '指挥' && distU(att, u, ax, ay) <= 3)) p += 10;
  if (hasRelic('x3') && relicCls(att) === '特种') p += near(3) ? -10 : 60;
  if (hasRelic('b3')) p += Math.min(24, near(2) * 6);
  if (hasRelic('b4') && def) p += Math.min(30, distU(att, def, ax, ay) * 3);
  return p;
}
/* 开战时的整场加成：混编、孤狼、源碳反应炉、过载广播的代价 */
function relicBattleStart(allies){
  if (!RUN || !RUN.relics || !RUN.relics.length) return;
  const n = allies.length, kinds = new Set(allies.map(relicCls)).size;
  for (const u of allies){
    const m = u.relicMods = u.relicMods || {};
    if (hasRelic('b1')) m.dmg = (m.dmg || 0) + 8 * kinds;
    if (hasRelic('b2')){ if (n <= 2){ m.dmg = (m.dmg || 0) + 50; m.armorPct = (m.armorPct || 0) + 30; } else if (n >= 4) m.dmg = (m.dmg || 0) - 15; }
    if (hasRelic('f3')) m.dmg = (m.dmg || 0) + Math.min(30, Math.floor(RUN.he / 10) * 3);
    if (hasRelic('a3') && relicCls(u) === '指挥'){ u.maxHp = Math.max(1, Math.round(u.maxHp * .5)); u.hp = Math.min(u.hp, u.maxHp); }
  }
}
Hooks.on('strikeResolved', c => {
  if (!c.hit || !hasRelic('x2') || !LV || !LV.run || c.att.side !== 'ally' || relicCls(c.att) !== '特种' || c.def.hp <= 0) return;
  c.def.debuffs.push({pct:10, src:'破甲弹头'});
}, '藏品：破甲弹头');
Hooks.on('phaseStart', c => {
  if (c.side !== 'ally' || !hasRelic('a4') || !LV || !LV.run) return;
  const al = units.filter(u => u.side === 'ally' && u.hp > 0), k = Math.min(5, al.filter(u => relicCls(u) === '指挥').length);
  if (!k) return;
  al.forEach(u => { const h = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * .03 * k)); if (h > 0){ u.hp += h; addFloat(u, `+${h}`, '#9fe0b8'); } });
}, '藏品：后勤网');
