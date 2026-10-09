/* ---------- 战斗执行 ---------- */
function consume(w){ if (w.usesLeft != null) w.usesLeft--; if (w.cd > 0) w.cdLeft = w.cd + 1; }
function teleport(u, target, killedTiles){
  let dest = null;
  if (killedTiles) dest = pick(killedTiles);
  else {
    for (let d=1; d<=2*N && !dest; d++){
      const cand = [];
      for (let y=0;y<MH;y++) for (let x=0;x<MW;x++)
        if (distRect(x,y,u.w,u.h,target.x,target.y,target.w,target.h) === d && canStand(u,x,y)) cand.push([x,y]);
      if (cand.length) dest = pick(cand);
    }
  }
  if (dest){ fx('warp', {b:cpx(u), dur:300}); u.x = dest[0]; u.y = dest[1]; fx('warp', {b:cpx(u), out:true, dur:360}); log(`${fullName(u)} 传送至 (${dest[0]}, ${dest[1]})${killedTiles ? '，占据目标原位置' : ''}`, null, u.side); }
}
async function strike(att, w, def, reaction, {skipConsume=false, zone=null, counter=false} = {}){
  if (!skipConsume) consume(w);
  const after = () => {
    att.firedTurn = turn;
    if (!counter){ att.hotTurn = turn; if (hasTrait(att,'extended')) att.extStack = 0; }
    if (hasTrait(def,'extended')) def.extStack = Math.min(3, (def.extStack || 0) + 1);
    if (!isSure(w) && hasTrait(def,'lucky')) def.luckyPhase = phaseNo;
    if (!def.hitLog || def.hitLog.turn !== turn) def.hitLog = {turn, by:new Set()};
    def.hitLog.by.add(att.uid);
  };
  if (!isSure(w) && !counter) att.facing = pickFace(att, w, def);   // v0.38 主动攻击转向并锁定；反击 / 压制射击不转身
  const zo = zone ? {zone, counter} : {counter};
  const {hit, zone:z} = hitRate(att,w,def,reaction,undefined,zo);
  const cr0 = critRate(w,att,def,{...zo, reaction});
  const head = `${fullName(att)}【${w.name}】→ ${fullName(def)}（${z ? ZONE[z].name + ' · ' : ''}命中 ${hit}%）`;
  const turnDef = () => { if (!isSure(w) && def.hp > 0 && def.abilities.includes('frontArmor')) def.facing = dirToward(def, att); };   // v0.38 被打的一方不再自动转身（朝向是自己定的防守决策）；只有正面装甲机（教学 2 的铁壁）还会转身
  let killedTiles = null;
  await fxAttack(att, w, def);
  if (w.special === 'funnel'){
    const per = multiPer(att, w), rolls = [];
    let total = 0, nh = 0;
    for (let i=0;i<w.hits;i++){
      const zz = funnelZone(def, pick(FUNNEL_DIRS)), q = hitRate(att,w,def,reaction,undefined,{zone:zz, counter}).hit;
      const hitR = Math.random()*100 < q, god = !hitR && gamblerProc(att);
      if (hitR || god){
        const cr = god || Math.random()*100 < critRate(w,att,def,{zone:zz, reaction}), d = perHit(att, w, def, {reaction, preview:false, crit:cr, critX: god ? 4 : 0, counter});
        total += d; nh++; rolls.push(`第 ${i+1} 段（${ZONE[zz].name} ${q}%）${god ? '未中 → 赌神：暴击 ×4' : '命中'} ${d}${cr && !god ? ' 暴击' : ''}`);
      } else rolls.push(`第 ${i+1} 段（${ZONE[zz].name} ${q}%）未中`);
    }
    def.hp = Math.max(0, def.hp - total);
    if (nh){ for (let j=0;j<Math.min(nh,6);j++){ fx('beam', {a:[cpx(def)[0] + (Math.random()-.5)*TS*5, cpx(def)[1] + (Math.random()-.5)*TS*5], b:cpx(def), color:'#9ff3ff', dur:180}); await sleep(50); } fx('burst', {b:cpx(def), seed:Math.random()}); }
    else fx('miss', {b:cpx(def), dur:350});
    addFloat(def, nh ? `${nh}×  ${total}` : 'MISS', nh ? '#ffffff' : '#c9d3dd');
    log(`${fullName(att)}【${w.name}】→ ${fullName(def)}：浮游炮 ${w.hits} 段命中 ${nh} 段，伤害 ${total}`, rolls, att.side);
    after();
    Hooks.emit('strikeResolved', {att, def, w, hit:nh > 0, dmg:total, zone:null, counter});
    if (def.hp <= 0) destroy(def, att); else turnDef();
    await sleep(520); return;
  }
  if (w.special === 'multi'){
    const per = multiPer(att, w), rolls = [];
    let p = w.hit, total = 0, nh = 0;
    for (let i=0;i<w.hits;i++){
      const q = hitRate(att,w,def,reaction,p,zo).hit;
      const hitR = Math.random()*100 < q, god = !hitR && gamblerProc(att);
      if (hitR || god){
        const cr = god || Math.random()*100 < cr0, d = perHit(att, w, def, {reaction, zone:z, preview:false, crit:cr, critX: god ? 4 : 0, counter});
        total += d; nh++; rolls.push(`第 ${i+1} 段（${q}%）${god ? '未中 → 赌神：暴击 ×4' : '命中'} ${d}${cr && !god ? ' 暴击' : ''}`); p -= w.step;
      } else { rolls.push(`第 ${i+1} 段（${q}%）未中`); p += w.step; }
    }
    def.hp = Math.max(0, def.hp - total);
    if (nh){ for (let j=0;j<Math.min(nh,4);j++){ fx('slash', {b:cpx(def), color:'#9ff3ff', dur:160}); await sleep(70); } fx('burst', {b:cpx(def), seed:Math.random()}); }
    else fx('miss', {b:cpx(def), dur:350});
    addFloat(def, nh ? `${nh}×  ${total}` : 'MISS', nh ? '#ffffff' : '#c9d3dd');
    log(`${fullName(att)}【${w.name}】→ ${fullName(def)}（${ZONE[z].name}）：${w.hits} 段命中 ${nh} 段，伤害 ${total}${w.ignoreDef ? '（无视减免）' : ''}`, rolls, att.side);
    after();
    Hooks.emit('strikeResolved', {att, def, w, hit:nh > 0, dmg:total, zone:z, counter});
    if (def.hp <= 0) destroy(def, att); else turnDef();
    await sleep(520); return;
  }
  if (w.special === 'chain'){   // v0.40.10 Nagi 连射：命中后再开一枪，每命中一次下一枪命中修正再 −chainStep，直到被闪避
    const step = chainStepOf(att, w), rolls = [];
    let p = w.hit, total = 0, nh = 0;
    for (let i = 0; i < CHAIN_MAX && def.hp - total > 0; i++){
      const q = hitRate(att,w,def,reaction,p,zo).hit;
      if (Math.random()*100 < q){
        const cr = Math.random()*100 < cr0, d = perHit(att, w, def, {reaction, zone:z, preview:false, crit:cr, counter});
        total += d; nh++; rolls.push(`第 ${i+1} 枪（${q}%）命中 ${d}${cr ? ' 暴击' : ''}`); p -= step;
      } else { rolls.push(`第 ${i+1} 枪（${q}%）被闪避`); break; }
    }
    def.hp = Math.max(0, def.hp - total);
    if (nh){ for (let j=0;j<Math.min(nh,4);j++){ fx('beam', {a:cpx(att), b:cpx(def), color:'#c9e6ff', dur:160}); await sleep(80); } fx('burst', {b:cpx(def), seed:Math.random()}); }
    else fx('miss', {b:cpx(def), dur:350});
    addFloat(def, nh ? `${nh}×  ${total}` : 'MISS', nh ? '#ffffff' : '#c9d3dd');
    log(`${fullName(att)}【${w.name}】→ ${fullName(def)}（${ZONE[z].name}）：连射命中 ${nh} 枪，伤害 ${total}`, rolls, att.side);
    after();
    Hooks.emit('strikeResolved', {att, def, w, hit:nh > 0, dmg:total, zone:z, counter});
    if (def.hp <= 0) destroy(def, att); else turnDef();
    await sleep(520); return;
  }
  const missed = Math.random()*100 >= hit, godHit = missed && gamblerProc(att);   // v0.37 赌神：未命中的攻击 50% 改为命中并暴击（×4）
  if (missed && !godHit){
    fx('miss', {b:cpx(def), dur:350});
    addFloat(def, 'MISS', '#c9d3dd');
    log(`${head} 被回避`, null, att.side);
    after();
    Hooks.emit('strikeResolved', {att, def, w, hit:false, zone:z, counter});
  } else {
    const isCrit = godHit || Math.random()*100 < cr0;
    const outcome = Math.random() < .5 ? 'fixed' : 'pct';
    const c = damageCalc(att, w, def, {crit:isCrit, critX: godHit ? 4 : 0, reaction, preview:false, outcome, zone:z, counter});
    if (godHit) c.steps.unshift('未命中 → 赌神：改为命中，暴击威力 ×4');
    def.hp = Math.max(0, def.hp - c.dmg);
    if (w.special === 'execute' && def.hp > 0 && def.hp <= def.maxHp * wv(att, w, 'exec') / 100){ def.hp = 0; c.steps.push(`斩首：剩余 HP 不超过 ${wv(att, w, 'exec')}%，直接击破`); }
    fx(c.nullified ? 'spark' : 'burst', {b:cpx(def), crit:isCrit, seed:Math.random(), dur: isCrit ? 480 : 380});
    addFloat(def, c.nullified ? '无效' : String(c.dmg), isCrit ? '#e9a23b' : '#ffffff');
    log(`${head} ${godHit ? '赌神！' : isCrit ? '暴击！' : '命中'} 伤害 ${c.dmg}`, c.steps, att.side);
    after();
    Hooks.emit('strikeResolved', {att, def, w, hit:true, crit:isCrit, dmg:c.dmg, zone:z, counter});
    if (def.hp <= 0){ killedTiles = tilesOf(def); destroy(def, att); }
    if (c.reflect > 0 && att.hp > 0){
      att.hp = Math.max(0, att.hp - c.reflect); addFloat(att, String(c.reflect), '#ffd38a');
      log(`${fullName(def)} 的光束反射装甲把 ${c.reflect} 伤害反射给 ${fullName(att)}`, null, def.side);
      if (att.hp <= 0) destroy(att, def);
    }
  }
  if (w.special === 'gamble' && att.hp > 0){ await sleep(300); teleport(att, def, killedTiles); if (def.hp > 0) att.facing = dirToward(att, def); refresh(); }
  turnDef();
  await sleep(460);
}
function destroy(u, by){
  if (!units.includes(u)) return;
  if (abilOn(u,'coreSplit') && !u.coreUsed && canStand(u, u.x, u.y, true)){
    u.coreUsed = true; u.hp = Math.round(u.maxHp * .3); u.debuffs = [];
    addFloat(u, '核心分离', '#9fe0b8'); log(`${fullName(u)}【核心分离】换上备用部件，以 ${u.hp} HP 继续战斗`, null, u.side);
    return;
  }
  units = units.filter(x => x !== u);
  log(`${fullName(u)} 被击破`, null, 'sys');
  Hooks.emit('unitDestroyed', {unit:u, by});
}
async function battle(att, w, def, reaction, cw, {guard=false} = {}){
  if (reaction === 'defend' && !guard) log(`${fullName(def)} 选择防御`, null, def.side);
  if (reaction === 'evade') log(`${fullName(def)} 选择回避`, null, def.side);
  await strike(att, w, def, reaction, guard ? {zone:'front'} : {});
  if (def.hp > 0 && att.hp > 0 && reaction === 'counter' && cw){
    if (!wStatus(def,cw,{counter:true}) && canHit(def,cw,att,def.x,def.y,def.facing)){
      // v0.25 进攻援护：我方攻击后被反击时，相邻的进攻援护机体可以代为承受
      const g = att.side === 'ally' ? units.find(m => m !== att && m.side === 'ally' && m.hp > 0 && abilOn(m,'guardAtk') && m.guardLeft > 0 && guardReach(m, att)) : null;
      if (g && await askGuard(def, cw, att, g, true)){
        g.guardLeft--;
        log(`${fullName(g)} 进攻援护：代 ${fullName(att)} 承受反击（本阶段剩 ${g.guardLeft} 次）`, null, 'ally');
        await strike(def, cw, g, 'defend', {counter:true, zone:'front'});
      } else await strike(def, cw, att, null, {counter:true});
    }
    else log(`${fullName(def)} 无法反击（射程或视线不足）`, null, def.side);
  }
  refresh();
  checkEnd();
}
async function mapAttack(u, w, dir){
  consume(w);
  if (w.smoke){ placeSmoke(u, w, dir); refresh(); return; }   // v0.40.11 烟雾弹（17b）：不造成伤害
  log(`${fullName(u)}【${w.name}】${dir.burst ? '向周围' : dir.box ? `对 (${dir.box[0]}, ${dir.box[1]}) 起的 ${w.size}×${w.size} 区域` : `向 ${dir.arrow} `}发动${dir.land ? `，冲向 (${dir.land[0]}, ${dir.land[1]})` : ''}`, null, 'ally');
  const targets = dir.hit.slice();
  const from = cpx(u);
  if (dir.land){
    moveUnit(u, ...dir.land);
    fx('dash', {a:from, b:cpx(u), dur:420}); u.moved = true;
  } else {
    S.echoFlash = {set:new Set(dir.path.map(([x,y]) => y*N+x)), t0:performance.now()};
    fx('pulse', {b:from, r:TS*3, color:'#ffd38a', dur:500});
  }
  if (!dir.burst) u.facing = dir.dx && !dir.dy ? (dir.dx > 0 ? 'right' : 'left') : (dir.dy > 0 ? 'down' : 'up');
  refresh(); await sleep(350);
  for (const t of targets){ if (t.hp > 0) await strike(u, w, t, null, {skipConsume:true}); }
  if (!targets.length) log('沿途没有单位', null, 'ally');
  refresh();
  checkEnd();
}

function autoWeapon(u){
  if (!hasTrait(u,'autoCast')) return echoWeapon(u);
  const ws = u.weapons.filter(w => u.lv >= w.unlock && !cdBlocked(u, w) && pickAllows(u, w));   // v0.40.10 Feena 只能携带一个技能
  return ws[ws.length - 1] || null;
}
/* 余响类：取已解锁、冷却好了的序号最大的一把（Lv30 满月·月蚀冷却中时退回残月的余响） */
function echoWeapon(u){ return u.weapons.filter(w => w.special === 'echo' && u.lv >= w.unlock && !cdBlocked(u, w) && pickAllows(u, w)).pop() || null; }
function echoArea(u){
  const w = echoWeapon(u); if (!w) return null;
  const set = new Set(), helpers = [];
  const addAround = (src, r) => {
    if (r === Infinity){ for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) set.add(y*N+x); return; }
    for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) if (distRect(src.x,src.y,src.w,src.h,x,y,1,1) <= r) set.add(y*N+x);
  };
  addAround(u, w.range[1]);
  const canExt = a => inFaction(a, '月球王国') || (u.lv >= 30 && TIER[a.mech] !== 'S');   // v0.24：Lv30 起非精锐也能延伸
  /* v0.40.10（作者 10-08）：队友的延伸 = 它当前位置、当前朝向下实际打得到的格子（任意一把已解锁的近战 / 直射 / 曲射武器，冷却中也算），
     队友打不到的地方余响也打不到。 */
  for (const a of units) if (a !== u && a.side === u.side && a.hp > 0 && canExt(a) && distU(u, a) <= w.range[1]){
    const ts = attackTilesOf(a); helpers.push({a, r:ts.size}); for (const k of ts) set.add(k);
  }
  return {w, set, helpers};
}
const inArea = (set, t) => tilesOf(t).some(([x,y]) => set.has(y*N+x));
async function echoRelease(u){
  const ar = echoArea(u); if (!ar || u.hp <= 0) return;
  const foes = units.filter(e => e.side === 'enemy' && e.hp > 0 && inArea(ar.set, e));
  const ext = ar.helpers.map(h => `${fullName(h.a)} +${h.r} 格`).join('，');
  if (ar.w.cd) consume(ar.w);
  log(`${fullName(u)}【${ar.w.name}】自动释放${ext ? `（延伸：${ext}）` : ''}，范围内敌军 ${foes.length} 台`, null, 'ally');
  S.echoFlash = {set: ar.set, t0: performance.now()};
  fx('pulse', {b:cpx(u), r:TS*6, color:'#c9a8ff', dur:600});
  await sleep(350);
  for (const e of foes) if (e.hp > 0) await strike(u, ar.w, e, null, {skipConsume:true});
  refresh(); checkEnd();
}
function regenWeapon(u){ return u.weapons.find(w => w.special === 'regen' && u.lv >= w.unlock); }
async function regenRelease(u){
  const w = regenWeapon(u); if (!w || u.hp <= 0) return;
  const ts = units.filter(a => a.side === u.side && a.hp > 0 && distU(u, a) <= w.range[1]);
  const parts = [];
  const pct = L30(u) ? .15 : .1;   // v0.24：Lv30 起 15%
  ts.forEach(a => { const amt = Math.min(Math.round(a.maxHp*pct), a.maxHp - a.hp); if (amt > 0){ a.hp += amt; addFloat(a, `+${amt}`, '#9fe0b8'); parts.push(`${fullName(a)} +${amt}`); } });
  log(`${fullName(u)}【${w.name}】${parts.length ? parts.join('，') : '范围内友军都是满血'}`, null, 'ally');
  refresh(); await sleep(400);
}
const healAmount = (u, w) => Math.round(w.power * u.shoot / 100 * (hasTrait(u,'juice') ? 1.5 : 1));
function healTargets(u, w){ const rg = effRange(u, w); return units.filter(a => a !== u && a.side === u.side && a.hp > 0 && distU(u, a) >= rg[0] && distU(u, a) <= rg[1]); }   // v0.40.10 修理射程可以随等级升级
function doHeal(u, w, t){
  consume(w);
  const amt = Math.min(healAmount(u, w), t.maxHp - t.hp);
  t.hp += amt;
  if (hasTrait(u,'juice')){ t.buffs.push({src:'特制健康饮料', eva:-10}); log(`${fullName(t)} 喝下了特制健康饮料……闪避 −10（到下一个我方阶段）`, null, 'ally'); }
  fx('heal', {b:cpx(t), dur:600});
  addFloat(t, `+${amt}`, '#9fe0b8');
  if (hasTrait(u,'fieldAid')){ t.buffs.push({src:'战地急救', def:15}); log(`${fullName(t)} 防御 +15（到下一个我方阶段）`, null, 'ally'); }
  log(`${fullName(u)}【${w.name}】${fullName(t)} 回复 ${amt} HP（${t.hp}/${t.maxHp}）`, null, 'ally');
}
function pushUnit(att, def, n){
  const d = dirToward(att, def), [dx,dy] = FACE[d];
  for (let i=0; i<n; i++){
    const nx = def.x + dx, ny = def.y + dy, tiles = tilesOf(def, nx, ny);
    if (tiles.some(([x,y]) => !inb(x,y))){ collide(def, null, '地图边缘'); return; }
    if (!def.flying && tiles.some(([x,y]) => TER[map[y][x]].groundBlock && !walls.has(y*N+x))){
      def.x = nx; def.y = ny; def.hp = 0;
      addFloat(def, '坠落', '#ff6b5e'); log(`${fullName(def)} 被推进裂谷，坠毁`, null, 'sys');
      destroy(def, att); return;
    }
    const blockU = tiles.map(([x,y]) => occupant(x,y)).find(o => o && o !== def);
    if (blockU){ collide(def, blockU, fullName(blockU)); return; }
    if (tiles.some(([x,y]) => walls.has(y*N+x))){ collide(def, null, '力场壁'); return; }
    if (!canStand(def, nx, ny)){ collide(def, null, '障碍'); return; }
    def.x = nx; def.y = ny;
    if (i === n-1) log(`${fullName(def)} 被推开 ${n} 格`, null, att.side);
  }
}
function pullUnit(att, def, n){
  const [dx,dy] = FACE[dirToward(def, att)];
  let moved = 0;
  for (let i=0; i<n; i++){
    if (distU(att, def) <= 1) break;
    const nx = def.x + dx, ny = def.y + dy;
    if (!canStand(def, nx, ny)) break;
    def.x = nx; def.y = ny; moved++;
  }
  if (moved) log(`${fullName(def)} 被拉近 ${moved} 格`, null, att.side);
}
function collide(u, other, what){
  const hit = x => { x.hp = Math.max(0, x.hp - 800); addFloat(x, '800', '#ffb38a'); if (x.hp <= 0) destroy(x, null); };
  log(`${fullName(u)} 撞上${what}，${other ? '双方' : ''}受到 800 碰撞伤害`, null, 'sys');
  hit(u); if (other) hit(other);
}
function wallTiles(u, cx, cy){
  const d = dirToward(u, {x:cx, y:cy, w:1, h:1}), [fx,fy] = FACE[d], px = -fy, py = fx;
  return [[cx,cy],[cx+px,cy+py],[cx-px,cy-py]].filter(([x,y]) => inb(x,y) && !occupant(x,y) && !walls.has(y*N+x) && !TER[map[y][x]].groundBlock);
}
function trialTargets(u, w){ return units.filter(e => e.side !== u.side && e.hp > 0 && distU(u, e) >= w.range[0] && distU(u, e) <= w.range[1] && !e.stunned); }
function wallCenters(u, w){
  const out = [];
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){
    const d = distRect(u.x,u.y,u.w,u.h,x,y,1,1);
    if (d >= w.range[0] && d <= w.range[1] && !occupant(x,y) && !walls.has(y*N+x) && !TER[map[y][x]].groundBlock) out.push({x,y});
  }
  return out;
}
function placeWall(u, w, cx, cy){
  consume(w);
  const ts = wallTiles(u, cx, cy);
  ts.forEach(([x,y]) => walls.set(y*N+x, turn + 2));
  log(`${fullName(u)}【${w.name}】展开力场壁（${ts.length} 格），持续到第 ${turn + 2} 回合我方阶段开始`, null, 'ally');
}
function transformUnit(u, cx, cy){
  const f = FORMS[u.transform];
  const ts = wallTiles(u, cx, cy);
  ts.forEach(([x,y]) => walls.set(y*N+x, turn + 2));
  u.transformed = true; u.transformTurn = turn;
  u.armor = f.armor; u.eva = f.eva; u.mov = f.mov;
  u.weapons = f.weapons.map(w => ({...w, usesLeft:w.uses, cdLeft:0}));
  log(`${fullName(u)} 脱装，变身为【${f.name}】：外装甲在前方化为 GN 墙（${ts.length} 格，持续到第 ${turn + 2} 回合我方阶段开始），换装光束剑和光束手枪`, null, 'ally');
}
function supportTargets(u, w){
  const r = effRange(u, w)[1];
  return units.filter(a => a.hp > 0 && (w.foe ? (a.side !== u.side && a.side !== 'neutral') : (a.side === u.side && (a !== u || w.self))) && distU(u, a) <= r);
}
const BUFF_NAME = {hit:'命中', eva:'闪避', crit:'暴击', dmg:'伤害', red:'减伤', physRed:'物理减伤', beamRed:'光束减伤', armorPct:'装甲', def:'防御', mov:'移动', critX:'暴击倍率'};
const BUFF_PCT = ['dmg','red','physRed','beamRed','armorPct'];
const buffTxt = b => Object.entries(b).filter(([k]) => BUFF_NAME[k]).map(([k,v]) => BUFF_PCT.includes(k) && k !== 'dmg' && k !== 'armorPct' ? `${BUFF_NAME[k]} ${v}%` : `${BUFF_NAME[k]} ${v > 0 ? '+' : ''}${v}${BUFF_PCT.includes(k) ? '%' : ''}`).join('、');
const supBuff = (u, w) => { const b = wv(u, w, 'buff') || {eva:15, hit:15}; /* v0.40.10 增益可以随等级升级（月光祝福） */ return tierUp(u, w) ? Object.fromEntries(Object.entries(b).map(([k,v]) => [k, Math.round(v * 1.5)])) : b; };
const supportTxt = (w, u) => w.heal ? `回复最大 HP 的 ${u && tierUp(u, w) ? Math.round(w.heal * 1.5) : w.heal}%` : buffTxt(u ? supBuff(u, w) : (w.buff || {eva:15, hit:15}));
function castSupport(u, w){
  consume(w);
  const ts = supportTargets(u, w);
  fx('pulse', {b:cpx(u), r:TS*(effRange(u, w)[1] + .5), color: w.foe ? '#ff9a8a' : '#9fe0b8', dur:520});
  if (w.heal){
    const parts = [];
    const hp = tierUp(u, w) ? w.heal * 1.5 : w.heal;
    ts.forEach(a => { const amt = Math.min(Math.round(a.maxHp * hp/100), a.maxHp - a.hp); if (amt > 0){ a.hp += amt; addFloat(a, `+${amt}`, '#9fe0b8'); parts.push(`${fullName(a)} +${amt}`); } });
    log(`${fullName(u)}【${w.name}】${parts.length ? parts.join('，') : '范围内友军都是满血'}`, null, u.side);
    return;
  }
  const b = supBuff(u, w);
  ts.forEach(a => { a.buffs.push({src:w.name, ...b}); addFloat(a, w.foe ? '↓' : '↑', w.foe ? '#ff9a8a' : '#9fe0b8'); });
  log(`${fullName(u)}【${w.name}】${ts.length ? ts.map(fullName).join('、') + ' ' + buffTxt(b) : w.foe ? '范围内没有敌机' : '范围内没有友军'}`, null, u.side);
}

