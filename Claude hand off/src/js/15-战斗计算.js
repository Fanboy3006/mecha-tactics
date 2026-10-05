/* ---------- 战斗计算 ---------- */
const buffSum = (u, k) => u.buffs.reduce((a,b) => a + (b[k] || 0), 0);
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
  let h = (baseHit ?? w.hit) - (RM() && att.side === 'enemy' ? RM().ecm : 0) + buffSum(att,'hit') + rage + gundamBonus(att) + tfx(att, 'hit', def, w, opts) - eva;
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
  return clamp(10 + w.critMod + ZONE[zone].crit + over + rage + extra, 0, 100);
}
/* ---- 晋升档位（v0.24）----
   精锐 / 骨干 Lv30：原本 Lv20 解锁的武装提升一档 = 威力 ×1.3（辅助类武装的增益数值 ×1.5）。
   武装自己写了 Lv30 威力（upgrades 里的 power）时以那个为准，不再叠加。 */
const tierUp = (u, w) => !!u && u.side === 'ally' && w.unlock === 20 && u.lv >= 30 && (TIER[u.mech] === 'S' || TIER[u.mech] === 'A') && !(w.upgrades || []).some(x => x.power != null);
const wPow = (u, w) => Math.round(wv(u, w, 'power') * (tierUp(u, w) ? 1.3 : 1));
function damageCalc(att, w, def, {crit=false, reaction=null, preview=true, outcome='fixed', zone=null, counter=false} = {}){
  const c = {att, def, w, reaction, preview, crit, zone, counter, defMul: defMul(def), steps:[], nullified:false, reflect:0};
  if (w.special === 'gamble'){
    const fixed = Math.round(12000 * (tierUp(att, w) ? 1.3 : 1));
    c.dmg = outcome === 'fixed' ? fixed : Math.floor(def.hp * .9);
    c.steps.push(outcome === 'fixed' ? `生成：固定 ${fixed}` : `生成：当前 HP ${def.hp} × 90% = ${c.dmg}`);
  } else {
    const stat = w.stat === '格斗' ? att.melee : att.shoot;
    const pw = wPow(att, w);
    c.dmg = pw + stat*5;
    c.steps.push(`生成（${w.dmgType}）：${pw}${pw !== w.power ? `（晋升 / 强化，原 ${w.power}）` : ''} + ${w.stat}${stat}×5 = ${c.dmg}`);
  }
  if (crit){ const m = critMul(att); c.dmg = Math.round(c.dmg*m); c.steps.push(`暴击 ×${m} → ${c.dmg}`); }
  const gm = genMods(att, w, def, {zone, crit, counter});
  if (gm.pct){ c.dmg = Math.max(0, Math.round(c.dmg * (1 + gm.pct/100))); c.steps.push(`${gm.notes.join('、')} → ${c.dmg}`); }
  Hooks.emit('damageGenerated', c);
  if (w.ignoreDef){ c.steps.push('无视防御：跳过全部减免'); return c; }
  if (c.defMul < 1) c.steps.push(`破防：所有防御 ×${+c.defMul.toFixed(2)}`);
  const special = w.dmgType === '特殊';
  if (special) c.steps.push('特殊伤害：只经过护盾类效果');
  stages: for (const st of [1,2,3,4]){
    for (const r of REDUCTIONS){
      if (r.stage !== st || (special && !r.shield) || !r.applies(c)) continue;
      const note = r.apply(c);
      c.dmg = Math.max(0, Math.round(c.dmg));
      c.steps.push(`${r.name} ${note} → ${c.dmg}`);
      if (c.nullified) break stages;
    }
  }
  return c;
}
function reduceOnly(att, w, def, dmg, reaction, zone, preview, crit=false){
  if (w.ignoreDef) return dmg;
  const c = {att, def, w, reaction, preview, zone, crit, defMul: defMul(def), dmg, steps:[], nullified:false};
  stages: for (const st of [1,2,3,4]) for (const r of REDUCTIONS){
    if (r.stage !== st || (w.dmgType === '特殊' && !r.shield) || !r.applies(c)) continue;
    r.apply(c); c.dmg = Math.max(0, Math.round(c.dmg));
    if (c.nullified) break stages;
  }
  return c.dmg;
}
const FUNNEL_DIRS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
const funnelZone = (def, [dx,dy]) => { const [fx,fy] = FACE[def.facing], fw = dx*fx + dy*fy, sd = Math.abs(dx*fy - dy*fx); return fw > sd ? 'front' : (-fw > sd ? 'back' : 'side'); };
const FUNNEL_ZONES = def => FUNNEL_DIRS.map(d => funnelZone(def, d));
const multiPer = (att, w) => Math.round(wPow(att, w) + (w.stat === '格斗' ? att.melee : att.shoot) * 5 / 10);
function forecast(att, w, def, reaction, opts = {}){
  const {hit, zone} = hitRate(att,w,def,reaction,undefined,opts), crit = critRate(w,att,def,{...opts, reaction});
  if (w.special === 'funnel'){
    const per = multiPer(att, w), zs = FUNNEL_ZONES(def);
    const hs = zs.map(z => hitRate(att,w,def,reaction,undefined,{...opts, zone:z}).hit), cs = zs.map(z => critRate(w,att,def,{...opts, zone:z, reaction}));
    const avgH = hs.reduce((a,b) => a+b, 0)/8, avgC = cs.reduce((a,b) => a+b, 0)/8;
    const perR = reduceOnly(att, w, def, genApply(att, w, def, per, {counter:opts.counter}), reaction, null, true);
    const perC = reduceOnly(att, w, def, genApply(att, w, def, Math.round(per*critMul(att)), {crit:true, counter:opts.counter}), reaction, null, true, true);
    const expHits = w.hits * avgH/100, exp = expHits * (perR*(1-avgC/100) + perC*avgC/100);
    return {hit:Math.round(avgH), crit:Math.round(avgC), zone:null, multi:true, dmg:perR, hits:w.hits, expHits, exp,
      steps:[`每段生成：${w.power} + 射击${att.shoot}×5÷10 = ${per}`, `${w.hits} 段，每段从 8 个随机方向攻击（正面 1/8、侧面 6/8、背面 1/8），目标闪避减半`, `平均命中 ${Math.round(avgH)}%`, `每段经过减免后 ${perR}`, `期望命中 ${expHits.toFixed(1)} 段`]};
  }
  if (w.special === 'multi'){
    const per = multiPer(att, w);
    let dist = new Map([[w.hit, 1]]), expHits = 0;
    for (let i=0;i<w.hits;i++){
      const nd = new Map(), add = (k,v) => nd.set(k, (nd.get(k) || 0) + v);
      for (const [p,pr] of dist){
        const q = hitRate(att,w,def,reaction,p,opts).hit/100;
        expHits += pr*q;
        add(clamp(p - w.step, -100, 200), pr*q); add(clamp(p + w.step, -100, 200), pr*(1-q));
      }
      dist = nd;
    }
    const perR = reduceOnly(att, w, def, genApply(att, w, def, per, {zone, counter:opts.counter}), reaction, zone, true), perC = reduceOnly(att, w, def, genApply(att, w, def, Math.round(per*critMul(att)), {zone, crit:true, counter:opts.counter}), reaction, zone, true, true);
    const exp = expHits * (perR * (1 - crit/100) + perC * crit/100);
    return {hit, crit, zone, multi:true, dmg:perR, hits:w.hits, expHits, exp,
      steps:[`每段生成：${w.power} + ${w.stat}${w.stat === '格斗' ? att.melee : att.shoot}×5÷10 = ${per}`, `首段命中 ${hit}%，命中后 −${w.step}，未中后 +${w.step}`, w.ignoreDef ? '无视一切伤害减免' : `每段经过减免后 ${perR}`, `期望命中 ${expHits.toFixed(1)} 段`]};
  }
  if (w.special === 'gamble'){
    const a = damageCalc(att,w,def,{reaction,outcome:'fixed',zone}), b = damageCalc(att,w,def,{reaction,outcome:'pct',zone});
    return {hit, crit, zone, gamble:true, dmg:a.dmg, alt:b.dmg, steps:[...a.steps, '— 或 —', ...b.steps], exp: hit/100*(a.dmg+b.dmg)/2};
  }
  const n = damageCalc(att,w,def,{reaction, zone, counter:opts.counter}), c = damageCalc(att,w,def,{reaction, crit:true, zone, counter:opts.counter});
  return {hit, crit, zone, dmg:n.dmg, critDmg:c.dmg, steps:n.steps, exp: hit/100*((1-crit/100)*n.dmg + crit/100*c.dmg)};
}
const dmgTxt = f => f.multi ? `${f.hits} 段 × ${f.dmg}（期望约 ${Math.round(f.exp)}）` : f.gamble ? `${f.dmg} 或 ${f.alt}` : `${f.dmg}${f.crit > 0 ? `（暴击 ${f.critDmg}）` : ''}`;
function bestCounter(def, att){
  let best = null, bs = -1;
  for (const w of def.weapons){
    if (wStatus(def,w,{counter:true}) || !canHit(def,w,att)) continue;
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

