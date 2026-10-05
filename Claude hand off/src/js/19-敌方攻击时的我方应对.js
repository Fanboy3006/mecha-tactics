/* ---------- 敌方攻击时的我方应对 ---------- */
function askGuard(att, w, def, g, counter = false){
  return new Promise(resolve => {
    const fT = forecast(att, w, def, null), fG = forecast(att, w, g, 'defend', {zone:'front'});
    $('#reactDlg').innerHTML = `<div class="eyebrow">${counter ? '进攻援护' : '援护防御'} · 本阶段剩 ${g.guardLeft} 次</div>
      <h2>${fullName(att)} 用【${w.name}】${counter ? '反击' : '攻击'} ${fullName(def)}</h2>
      <p class="small">${fullName(g)} 在援护范围内（移动力能赶到），可以代为承受这次${counter ? '反击' : '攻击（连同随后的援护攻击）'}，并自动进入防御姿态（不能反击）。</p>
      <div class="opts" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="opt"><h4>援护</h4><div class="take">${fullName(g)}（按正面）承受：命中 <b>${fG.hit}%</b>　伤害 <b>${fG.dmg}</b></div><p class="small">HP ${g.hp}/${g.maxHp}</p><button class="btn primary" data-g="1">让 ${g.pilot} 援护</button></div>
        <div class="opt"><h4>不援护</h4><div class="take">${fullName(def)}（${zname(fT.zone)}）承受：命中 <b>${fT.hit}%</b>　伤害 <b>${fT.dmg}</b></div><p class="small">${counter ? '' : '之后选择反击、防御或回避。'}</p><button class="btn" data-g="0">不援护</button></div>
      </div>`;
    $('#reactModal').hidden = false;
    $('#reactDlg').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { $('#reactModal').hidden = true; resolve(b.dataset.g === '1'); });
    $('#reactDlg').querySelector('[data-g="1"]').focus();
  });
}
function askReaction(att, w, def){
  return new Promise(resolve => {
    const fNone = forecast(att, w, def, null), fDef = forecast(att, w, def, 'defend'), fEva = forecast(att, w, def, 'evade');
    const cws = noCounterVs(att, w) ? [] : def.weapons.filter(cw => !wStatus(def,cw,{counter:true}) && canHit(def,cw,att));
    const cBtns = cws.length ? cws.map((cw,i) => {
      const f = forecast(def, cw, att, null, {defFacing: dirToward(att, def), counter:true});
      return `<button class="w" data-c="${i}"><div class="wn"><span>${cw.name}</span><span class="why ok">命中 ${f.hit}%</span></div>
        <div class="wf"><span>伤害 ${dmgTxt(f)}</span><span>暴击 ${f.crit}%</span>${cw.special === 'gamble' ? '<span>反击后传送</span>' : ''}</div></button>`;
    }).join('') : `<p class="small">没有射程内（或视线通畅）的武器，无法反击。</p>`;
    $('#reactDlg').innerHTML = `<div class="eyebrow">敌方攻击 · ${FIRE[w.fire]}</div>
      <h2>${miniPortrait(att)}${fullName(att)} 用【${w.name}】攻击 ${miniPortrait(def)}${fullName(def)}</h2>
      <p class="small">${fullName(def)}　HP ${def.hp}/${def.maxHp}　装甲 ${def.armor}　闪避 ${def.eva}</p>
      <div class="opts">
        <div class="opt"><h4>反击</h4><div class="take">${zname(fNone.zone)}受击：命中 <b>${fNone.hit}%</b>　伤害 <b>${fNone.dmg}</b></div>${cBtns}</div>
        <div class="opt"><h4>防御</h4><div class="take">承受：命中 <b>${fDef.hit}%</b>　伤害 <b>${fDef.dmg}</b></div><p class="small">伤害 −50%，在百分比减免阶段结算。</p><button class="btn" data-r="defend">防御</button></div>
        <div class="opt"><h4>回避</h4><div class="take">承受：命中 <b>${fEva.hit}%</b>　伤害 <b>${fEva.dmg}</b></div><p class="small">敌方命中率减半。</p><button class="btn" data-r="evade">回避</button></div>
      </div>`;
    $('#reactModal').hidden = false;
    const done = r => { $('#reactModal').hidden = true; resolve(r); };
    $('#reactDlg').querySelectorAll('[data-c]').forEach(b => b.onclick = () => done({reaction:'counter', weapon:cws[+b.dataset.c]}));
    $('#reactDlg').querySelectorAll('[data-r]').forEach(b => b.onclick = () => done({reaction:b.dataset.r, weapon:null}));
    const first = $('#reactDlg').querySelector('button'); if (first) first.focus();
  });
}

