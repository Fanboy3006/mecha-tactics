/* ---------- 战斗计算 ---------- */
const buffSum = (u, k) => u.buffs.reduce((a,b) => a + (b[k] || 0), 0) + ((u.relicMods && u.relicMods[k]) || 0);   // v0.31 藏品的常驻加成也算进来
const TRAIT_LV = 10;
const hasTrait = (u, k) => !!u && u.trait === k && (u.lv >= TRAIT_LV || u.forceTrait);
const effArmor = u => Math.round(u.armor * (hasTrait(u,'steadfast') && !u.movedThisRound ? 1.3 : 1) * Math.max(0, 1 + (buffSum(u,'armorPct') + tfx(u,'armorPct'))/100));
const BREAK = {side:10, back:20};
const breakSum = u => (u.debuffs || []).reduce((a,b) => a + b.pct, 0);
const defMul = u => Math.max(0, 1 - breakSum(u)/100);
const gundamBonus = u => hasTrait(u,'gundam') ? Math.min(30, 10 * units.filter(e => e.side !== u.side && e.hp > 0 && distU(u, e) === 1).length) : 0;
const isSure = w => w.fire === 'map' || w.fire === 'passive';
function hitRate(att, w, def, reaction, baseHit, opts = {}){
  if (isSure(w)) return {hit:100, eva:0, sure:true, zone:null};
  const zone = opts.zone || zoneOf(att, def, opts);
  const ter = def.flying ? null : terrainOf(def);
  let eva = Math.max(0, def.eva - (def.dodgePen || 0)) + buffSum(def,'eva') + (def.moveEva || 0) + gundamBonus(def) + (ter ? ter.eva : 0) + tfx(def, 'eva', att, w, opts);
  eva = Math.max(0, eva - ZONE[zone].eva);
  if (w.special === 'funnel') eva = Math.round(eva / 2);
  const rage = (hasTrait(att,'hallelujah') && att.hp < att.maxHp/2 ? 20 : 0) + (hasTrait(att,'veda') && att.transformTurn === turn ? 30 : 0);
  let h = (baseHit ?? w.hit) - (RM() && att.side === 'enemy' ? RM().ecm : 0) + Math.round(((att.aim ?? 160) - 160) / 2) + (abilOn(att, 'mook') && def.key && tierOfEnemy(def.key) === '杂兵' ? 20 : 0) + buffSum(att,'hit') + rage + gundamBonus(att) + tfx(att, 'hit', def, w, opts) - eva - smokeHit(att, def);   // v0.40.11 烟雾弹（17b）
  if (reaction === 'evade') h *= .5;
  return {hit: clamp(Math.round(h),0,100), raw: Math.round(h), eva, zone};
}
function critRate(w, att, def, opts = {}){
  if (isSure(w)) return 0;
  const zone = att && def ? (opts.zone || zoneOf(att, def, opts)) : 'front';
  let over = 0;
  if (att && def && hasTrait(att,'overflowCrit')) over = Math.max(0, hitRate(att, w, def, opts.reaction, undefined, opts).raw - 100);
  const rage = att && hasTrait(att,'hallelujah') && att.hp < att.maxHp/2 ? 20 : 0;
  const extra = att && def ? tfx(att, 'crit', def, w, opts) + buffSum(att,'crit') + (hasTrait(att,'allIn') && hitRate(att, w, def, opts.reaction, undefined, opts).raw < 70 ? 30 : 0) : 0;
  return clamp(10 + (att && att.critBase || 0) + w.critMod + ZONE[zone].crit + over + rage + extra, 0, 100);
}
/* ---- 晋升档位（v0.24）----
   精锐 / 骨干 Lv30：原本 Lv20 解锁的武装提升一档 = 威力 ×1.3（辅助类武装的增益数值 ×1.5）。
   武装自己写了 Lv30 威力（upgrades 里的 power）时以那个为准，不再叠加。 */
const tierUp = (u, w) => !!u && u.side === 'ally' && w.unlock === 20 && u.lv >= 30 && (TIER[u.mech] === 'S' || TIER[u.mech] === 'A') && !(w.upgrades || []).some(x => x.power != null);
const wPow = (u, w) => Math.round(wv(u, w, 'power') * (tierUp(u, w) ? 1.3 : 1) * taPowMul(u));   // v0.40.16 TRANS-AM 威力 ×1.3（17b）
/* ---------- v0.37 伤害公式（作者 2026-10-07 定） ----------
   伤害 =（武器威力 − 装甲）×（1 +（攻击能力值 − 防御值）/ 100），命中后最少 10 点。
   - 武器威力：武器 / 晋升强化 × 弱点或抗性 × 暴击（×2；零式 ×2.5；赌神 ×4）；
   - 装甲：effArmor × 破防，侧击 / 背击无视一部分；多段攻击每段都扣；
   - 攻击能力值：武器对应的属性（格斗 / 射击 / 觉醒，可以写成「格斗+觉醒」相加）× 大招倍率 statMul，再加特技、增益、藏品、压制杂兵、肉鸽；
   - 防御值：防御属性 + 地形、正面装甲、防御姿态、减伤类特技 / 增益（REDUCTIONS 里 stage 2 的 def），整体 × 破防；
   - 特殊伤害、无视防御：装甲和防御值都按 0；
   - 固定伤害（传送斩、余响、陨石等，useStat:false）：不加属性，也不算防御属性，只算场面上的防御加成；
   - 公式算完后：能量屏障（≤2500 无效）→ λ 力场（−3000）→ 护盾吸收。 */
const STAT_KEY = {格斗:'melee', 射击:'shoot', 觉醒:'awaken', 防御:'defense'};
const statNames = w => String(w.stat || '射击').split('+');
const statVal = (u, k) => STAT_KEY[k] === 'awaken' ? awakenOf(u) : (u[STAT_KEY[k]] ?? 100);   // v0.41.4 克莱因派：觉醒值在战斗中成长（17b）
const atkStat = (u, w) => Math.round(statNames(w).reduce((a, k) => a + statVal(u, k), 0) * (w.statMul || 1));
/* 面板上显示的攻击力：对 0 装甲、0 防御目标的不暴击伤害 */
const dispPow = (u, w, power = wPow(u, w)) => Math.round(power * (1 + atkStat(u, w) / 100));
function dmgCore(att, w, def, o = {}){
  const c = {att, def, w, reaction:o.reaction || null, preview:o.preview !== false, crit:!!o.crit, zone:o.zone || null, counter:!!o.counter, defMul:defMul(def), steps:[], nullified:false, reflect:0};
  const special = w.dmgType === '特殊', ign = !!w.ignoreDef, useStat = o.useStat !== false;
  /* 武器威力 */
  let W = o.power;
  const wn = [`${o.powerNote || '威力'} ${o.power}`];
  const wk = weakList(def, w, {zone:c.zone, crit:c.crit, counter:c.counter});
  if (wk.length){
    const pos = wk.filter(([k,v]) => v > 0).reduce((a,[k,v]) => a + v, 0), neg = wk.filter(([k,v]) => v < 0).reduce((a,[k,v]) => a + v, 0) * (ign ? 0 : c.defMul);
    const v = Math.max(-95, pos + neg);
    if (v){ W *= 1 + v/100; wn.push(`${wk.map(([k,x]) => `${x > 0 ? '弱点' : '抗性'}·${k} ${x > 0 ? '+' : ''}${x}%`).join('、')}`); }
  }
  if (c.crit){ const x = o.critX ? o.critX + (att ? buffSum(att,'critX') : 0) : critMul(att); W *= x; wn.push(`暴击 ×${x}`); }
  W = Math.round(W);
  /* 装甲 */
  let A = 0;
  if (!special && !ign){
    const base = effArmor(def), pr = c.zone && !hasTrait(def,'wSeries') ? ZONE[c.zone].pierce : 0;
    A = Math.round(base * c.defMul * (1 - pr/100));
    if (A !== def.armor) wn.push(`装甲 ${def.armor} → ${A}${pr ? `（${ZONE[c.zone].name}无视 ${pr}%）` : ''}${c.defMul < 1 ? '（破防）' : ''}`);
  }
  /* 攻击能力值 */
  const g = genMods(att, w, def, {zone:c.zone, crit:c.crit, counter:c.counter});
  const st = useStat && att ? atkStat(att, w) : 0;
  const atk = st + g.pct;
  const an = useStat && att ? [`${statNames(w).map(k => `${k} ${statVal(att, k)}`).join(' + ')}${w.statMul && w.statMul !== 1 ? ` ×${w.statMul}` : ''}`] : [];
  an.push(...g.notes);
  /* 防御值 */
  let D = 0; const dn = [];
  if (!special && !ign){
    if (useStat && def.defense){ D += def.defense; dn.push(`防御 ${def.defense}`); }
    for (const r of REDUCTIONS){
      if (r.stage !== 2 || !r.applies(c)) continue;
      const v = r.def(c); if (!v) continue;
      D += v; dn.push(`${r.name} ${v < 0 ? "−" + (-v) : "+" + v}`);   // v0.40.11 负数显示成 −20（交接第 3 条）
      if (r.id === 'beamReflect' && (w.fire === 'direct' || w.fire === 'melee')) c.reflectPts = v;
    }
    if (c.defMul < 1 && D){ D = Math.round(D * c.defMul); dn.push(`破防 ×${+c.defMul.toFixed(2)}`); }
  }
  const coef = 1 + (atk - D) / 100, base = Math.max(0, W - A);
  c.dmg = Math.max(10, Math.round(base * coef));
  c.steps.push(`威力 ${W}${A ? ` − 装甲 ${A}` : ''} = ${base}${wn.length > 1 ? `（${wn.join('，')}）` : ''}`);
  c.steps.push(`×（1 +（攻击 ${atk} − 防御 ${D}）/ 100）= ×${+coef.toFixed(2)}${an.length || dn.length ? `（攻击：${an.join('、') || '0'}；防御：${dn.join('、') || '0'}）` : ''}`);
  c.steps.push(`= ${c.dmg}${base * coef < 10 ? '（命中后最少 10）' : ''}`);
  if (c.reflectPts) c.reflect = Math.round(base * c.reflectPts / 100 / 2);
  Hooks.emit('damageGenerated', c);
  if (ign){ c.steps.push('无视防御：不经过屏障 / 力场 / 护盾'); return c; }
  for (const stg of [1,3,4]) for (const r of REDUCTIONS){
    if (r.stage !== stg || !r.applies(c)) continue;
    const note = r.apply(c); c.dmg = Math.max(0, Math.round(c.dmg));
    c.steps.push(`${r.name} ${note} → ${c.dmg}`);
    if (c.nullified) return c;
  }
  return c;
}
function damageCalc(att, w, def, {crit=false, critX=0, reaction=null, preview=true, outcome='fixed', zone=null, counter=false} = {}){
  if (w.special === 'gamble'){
    const fixed = Math.round(12000 * (tierUp(att, w) ? 1.3 : 1));
    const p = outcome === 'fixed' ? fixed : Math.floor(def.hp * .9);
    return dmgCore(att, w, def, {power:p, powerNote: outcome === 'fixed' ? '固定' : `当前 HP ${def.hp} × 90%`, useStat:false, crit, critX, reaction, preview, zone, counter});
  }
  return dmgCore(att, w, def, {power:wPow(att, w), crit, critX, reaction, preview, zone, counter});
}
/* 多段攻击每段、固定伤害都走这里：power 是这一段的威力；固定伤害（余响、陨石）不传 useStat */
function reduceOnly(att, w, def, power, reaction, zone, preview, crit=false, o = {}){
  return dmgCore(att, w, def, {power, reaction, zone, preview, crit, critX:o.critX, counter:o.counter, useStat:!!o.useStat}).dmg;
}
const perHit = (att, w, def, o) => reduceOnly(att, w, def, wPow(att, w), o.reaction, o.zone, o.preview, o.crit, {useStat:true, critX:o.critX, counter:o.counter});
const FUNNEL_DIRS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const funnelZone = (def, [dx,dy]) => { const [fx,fy] = FACE[def.facing], fw = dx*fx + dy*fy, sd = Math.abs(dx*fy - dy*fx); return fw > sd ? 'front' : (-fw > sd ? 'back' : 'side'); };
const FUNNEL_ZONES = def => FUNNEL_DIRS.map(d => funnelZone(def, d));
const multiPer = (att, w) => wPow(att, w);   // v0.37 每段威力就是武器威力（属性在公式的攻击能力值里）
function forecast(att, w, def, reaction, opts = {}){
  if (w.lockHits) w = lockStrikeW(w);   // v0.41.1 锁定 + 多段：按多段预测（17b）
  const {hit, zone} = hitRate(att,w,def,reaction,undefined,opts), crit = critRate(w,att,def,{...opts, reaction});
  if (w.special === 'funnel'){
    const per = multiPer(att, w), zs = FUNNEL_ZONES(def);
    const hs = zs.map(z => hitRate(att,w,def,reaction,undefined,{...opts, zone:z}).hit), cs = zs.map(z => critRate(w,att,def,{...opts, zone:z, reaction}));
    const avgH = hs.reduce((a,b) => a+b, 0)/8, avgC = cs.reduce((a,b) => a+b, 0)/8;
    const perR = perHit(att, w, def, {reaction, counter:opts.counter}), perC = perHit(att, w, def, {reaction, counter:opts.counter, crit:true});
    const expHits = w.hits * avgH/100, exp = expHits * (perR*(1-avgC/100) + perC*avgC/100);
    return {hit:Math.round(avgH), crit:Math.round(avgC), zone:null, multi:true, dmg:perR, hits:w.hits, expHits, exp,
      steps:[`每段威力 ${per}，攻击能力 ${atkStat(att, w)}`, `${w.hits} 段，每段从 8 个随机方向攻击（正面 1/8、侧面 6/8、背面 1/8），目标闪避减半`, `平均命中 ${Math.round(avgH)}%`, `每段经过减免后 ${perR}`, `期望命中 ${expHits.toFixed(1)} 段`]};
  }
  if (w.special === 'chain'){   // v0.40.10 连射（Nagi）：每命中一次下一枪命中再 −step，直到被闪避
    const step = chainStepOf(att, w);
    let p = w.hit, alive = 1, expHits = 0, maxN = 0;
    for (let i=0;i<CHAIN_MAX;i++){ const q = hitRate(att,w,def,reaction,p,opts).hit/100; if (q <= 0) break; alive *= q; expHits += alive; maxN = i + 1; p -= step; }
    const perR = perHit(att, w, def, {reaction, zone, counter:opts.counter}), perC = perHit(att, w, def, {reaction, zone, counter:opts.counter, crit:true});
    const exp = expHits * (perR * (1 - crit/100) + perC * crit/100);
    return {hit, crit, zone, multi:true, dmg:perR, hits:`连射 ≤${maxN}`, expHits, exp,
      steps:[`每枪威力 ${wPow(att, w)}，攻击能力 ${atkStat(att, w)}`, `首枪命中 ${hit}%，每命中一次下一枪命中 −${step}，被闪避就停`, `每枪经过减免后 ${perR}`, `期望命中 ${expHits.toFixed(1)} 枪`]};
  }
  if (w.special === 'multi'){
    const per = multiPer(att, w);
    let dist = new Map([[w.hit, 1]]), expHits = 0;
    const nh = w.hitsMax ? Math.round((w.hits + w.hitsMax) / 2) : w.hits;   // v0.40.17 段数随机（左轮打桩机 12–16）：按平均段数估
    for (let i=0;i<nh;i++){
      const nd = new Map(), add = (k,v) => nd.set(k, (nd.get(k) || 0) + v);
      for (const [p,pr] of dist){
        const q = hitRate(att,w,def,reaction,p,opts).hit/100;
        expHits += pr*q;
        add(clamp(p - w.step, -100, 200), pr*q); add(clamp(p + w.step, -100, 200), pr*(1-q));
      }
      dist = nd;
    }
    const perR = perHit(att, w, def, {reaction, zone, counter:opts.counter}), perC = perHit(att, w, def, {reaction, zone, counter:opts.counter, crit:true});
    const exp = expHits * (perR * (1 - crit/100) + perC * crit/100);
    return {hit, crit, zone, multi:true, dmg:perR, hits:w.hitsMax ? `${w.hits}–${w.hitsMax}` : w.hits, expHits, exp,
      steps:[`每段威力 ${per}，攻击能力 ${atkStat(att, w)}（每段都扣装甲）`, `首段命中 ${hit}%，命中后 −${w.step}，未中后 +${w.step}`, w.ignoreDef ? '无视一切伤害减免' : `每段经过减免后 ${perR}`, `期望命中 ${expHits.toFixed(1)} 段`]};
  }
  if (w.special === 'gamble'){
    const a = damageCalc(att,w,def,{reaction,outcome:'fixed',zone}), b = damageCalc(att,w,def,{reaction,outcome:'pct',zone});
    return {hit, crit, zone, gamble:true, dmg:a.dmg, alt:b.dmg, steps:[...a.steps, '— 或 —', ...b.steps], exp: hit/100*(a.dmg+b.dmg)/2};
  }
  const n = damageCalc(att,w,def,{reaction, zone, counter:opts.counter}), c = damageCalc(att,w,def,{reaction, crit:true, zone, counter:opts.counter});
  const god = hasTrait(att,'gambler') ? damageCalc(att,w,def,{reaction, crit:true, critX:4, zone, counter:opts.counter}).dmg : 0;   // 赌神：未命中时 50% 变成 ×4 暴击
  return {hit, crit, zone, dmg:n.dmg, critDmg:c.dmg, godDmg:god, steps:n.steps, exp: hit/100*((1-crit/100)*n.dmg + crit/100*c.dmg) + (god ? (1-hit/100)*.5*god : 0)};
}
const dmgTxt = f => f.multi ? `${f.hits} 段 × ${f.dmg}（期望约 ${Math.round(f.exp)}）` : f.gamble ? `${f.dmg} 或 ${f.alt}` : `${f.dmg}${f.crit > 0 ? `（暴击 ${f.critDmg}）` : ''}${f.godDmg ? `（赌神 ${f.godDmg}）` : ''}`;
function bestCounter(def, att){
  let best = null, bs = -1;
  for (const w of def.weapons){
    if (wStatus(def,w,{counter:true}) || !canHit(def,w,att,def.x,def.y,def.facing)) continue;   // v0.38 反击只能用当前朝向
    const s = forecast(def,w,att,null,{counter:true}).exp;
    if (s > bs){ bs = s; best = w; }
  }
  return best;
}
function aiReaction(def, att, w){
  if (def.stunned) return {reaction:null, weapon:null};
  if (w && w.special === 'lock') return {reaction:null, weapon:null};
  const cw = def.disarmed || noCounterVs(att, w) ? null : bestCounter(def, att);
  if (cw) return {reaction:'counter', weapon:cw};
  if (def.noEvade) return {reaction:null, weapon:null};
  return {reaction: def.hp/def.maxHp < .5 ? 'defend' : 'evade', weapon:null};
}

