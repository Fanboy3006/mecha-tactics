/* ---------- 面板 ---------- */
const rangeTxt = (u, w) => {
  if (w.fire === 'map') return w.shape === 'line' ? `8 方向直线 ${wv(u,w,'len')} 格${(wv(u,w,'width')||1) > 1 ? ` · 宽 ${wv(u,w,'width')}` : ''}` : w.shape === 'burst' ? `自身周围 ${wv(u,w,'rad')} 格` : '8 方向 · 第 5 格落点';
  if (w.fire === 'support' || w.fire === 'passive') return `自身 ${w.range[1]} 格`;
  if (w.fire === 'heal') return `${w.range[1]}`;
  if (w.fire === 'device') return `${w.range[0]}–${w.range[1]}`;
  const r = effRange(u, w);
  return r[1] === Infinity ? '全图' : (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`);
};
const useTxt = w => `${w.cd ? `CD ${w.cd}` : 'CD 0'} · ${w.uses == null ? '无限' : `次数 ${w.usesLeft}/${w.uses}`}`;
function weaponInner(u, w, note, ok){
  const locked = u.lv < w.unlock;
  return `<div class="wn"><span><span class="ft ${w.fire === 'map' ? 'map' : ''}">${FIRE[w.fire]}</span>${w.name}</span>${note ? `<span class="why ${ok ? 'ok' : ''}">${note}</span>` : ''}</div>
    <div class="wf ${locked ? 'lock' : ''}">${w.fire === 'device' ? '<span>骇入：下个敌方阶段无法行动</span>' : w.fire === 'support' ? `<span>${w.foe ? '敌机 ' : ''}${supportTxt(w, u)}</span>` : w.fire === 'heal' ? `<span>回复 ${healAmount(u, w)}</span>` : w.special === 'regen' ? `<span>回复 ${L30(u) ? 15 : 10}% 最大HP</span>` : `<span>${w.dmgType}</span><span title="攻击力 = 武器威力 ×（1 + 攻击能力值 / 100），即打 0 装甲、0 防御目标的不暴击伤害；威力 ${wPow(u, w)}，用 ${w.stat || '射击'}${w.statMul && w.statMul !== 1 ? ` ×${w.statMul}` : ''}">攻击力 ${w.special === 'gamble' ? '12000 / 90%HP' : (w.special === 'multi' || w.special === 'funnel') ? `${dispPow(u, w)} × ${w.hits} 段`  : dispPow(u, w)}</span>`}<span>射程 ${rangeTxt(u, w)}</span>${w.fire === 'support' || w.fire === 'heal' || w.fire === 'device' || w.special === 'regen' ? '' : `<span>命中 ${w.fire === 'map' || w.fire === 'passive' ? '必中' : w.hit}</span><span>暴击 ${isSure(w) ? '不暴击' : critRate(w) + '%'}</span>`}<span>${useTxt(w)}</span></div>
    <div class="wt">${[w.unlock > 1 ? `Lv${w.unlock} 解锁` : '', ...w.upgrades.filter(up => !(u.side === 'ally' && u.lv >= up.lv)).map(up => up.note), w.unlock === 20 && u.side === 'ally' && (TIER[u.mech] === 'S' || TIER[u.mech] === 'A') && !w.upgrades.some(x => x.power != null) ? `Lv30 晋升：${w.power ? '威力' : '效果'} ×${w.power ? '1.3' : '1.5'}${tierUp(u, w) ? '（已生效）' : ''}` : '', w.afterMove ? '' : '不能移动后使用', w.ignoreDef ? '无视防御' : '', w.desc].filter(Boolean).join(' · ')}</div>`;
}
function bar(lbl, v, m){
  const r = v/m;
  return `<div class="barrow"><span class="lbl">${lbl}</span><div class="track"><div class="fill ${r <= .25 ? 'low' : r <= .5 ? 'mid' : ''}" style="width:${Math.round(r*100)}%"></div></div><span class="num">${v}/${m}</span></div>`;
}
const FACTION_COL = {'影世界':'#8a6bd8', '月球王国':'#9fb7d8', '天人':'#4fc3a1', '克莱因派':'#e88fb4', '预防者':'#f2c14e', 'ATX':'#e9e7e2', '秘银':'#7d9a58'};   // 和 art/mech-icons.js 的 PAL 底色保持一致（v0.19 DSH 定稿）
const PT = {};
const ptKey = m => 'mecha-tactics-portrait-' + m;
function loadPortrait(m){
  if (m in PT) return PT[m];
  try { PT[m] = localStorage.getItem(ptKey(m)) || null; } catch(e){ PT[m] = null; }
  return PT[m];
}
function savePortrait(m, data){ PT[m] = data; try { if (data) localStorage.setItem(ptKey(m), data); else localStorage.removeItem(ptKey(m)); } catch(e){} }
const unitColor = u => u.side === 'enemy' ? '#d9564b' : (FACTION_COL[u.tags && u.tags.势力] || '#4f95e0');
function portraitHTML(u){
  const col = unitColor(u), mine = u.side === 'ally', img = mine ? loadPortrait(u.mech) : null;
  const glyph = mine ? [...u.pilot][0] : u.short;
  return `<div><button class="portrait ${mine ? '' : 'enemy'}" style="--pc:${col}" ${mine ? `data-pt="${u.mech}" title="点击上传自定义头像（只保存在你的浏览器里）"` : 'disabled'}>
      ${img ? `<img src="${img}" alt="${u.pilot}">` : `<span class="ring"></span><span class="glyph">${glyph}</span>`}
      <span class="code">${u.mech}</span>${mine ? '<span class="hint2">换图</span>' : ''}</button>
    ${img ? `<div class="pt-actions"><button data-ptclear="${u.mech}">恢复默认</button></div>` : ''}</div>`;
}
function miniPortrait(u){
  const col = unitColor(u), img = u.side === 'ally' ? loadPortrait(u.mech) : null;
  return `<span class="mini" style="--pc:${col}">${img ? `<img src="${img}" alt="">` : (u.side === 'ally' ? [...u.pilot][0] : u.short[0])}</span>`;
}
let ptTarget = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pt]'); if (b){ ptTarget = b.dataset.pt; $('#ptFile').value = ''; $('#ptFile').click(); return; }
  const c = e.target.closest('[data-ptclear]'); if (c){ savePortrait(c.dataset.ptclear, null); refresh(); }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'ptFile' || !e.target.files[0] || !ptTarget) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 144;
      const g = c.getContext('2d'), sc = Math.max(144/img.width, 144/img.height), w = img.width*sc, h = img.height*sc;
      g.drawImage(img, (144-w)/2, (144-h)/2, w, h);
      savePortrait(ptTarget, c.toDataURL('image/jpeg', .86)); refresh();
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(e.target.files[0]);
});
function weakHTML(u){
  if (!u.weak) return '';
  const e = Object.entries(u.weak), p = e.filter(([k,v]) => v > 0), n = e.filter(([k,v]) => v < 0);
  if (!e.length) return '<div class="wk">弱点：无（标准量产机）</div>';
  return `${p.length ? `<div class="wk">弱点：${p.map(([k,v]) => `<span class="p" title="${WEAK_DESC[k]}">${k} +${v}%</span>`).join('、')}</div>` : ''}${n.length ? `<div class="wk">抗性：${n.map(([k,v]) => `<span class="n" title="${WEAK_DESC[k]}">${k} ${v}%</span>`).join('、')}</div>` : ''}`;
}
function unitCardHTML(u){
  if (u && u.side === 'neutral') return `<h3>单位情报</h3><div class="u-head"><h2>陨石残骸</h2></div>${bar('HP',u.hp,u.maxHp)}<p class="small">挡住所有单位的移动和直射（不挡打向空中目标的直射）。双方都可以攻击它，HP 归零后消失。</p>`;
  if (!u) return `<h3>单位情报</h3><p class="hint">点击地图上的任意单位查看数据。机体脚下的地面环表示敌我（我方方形、敌方圆形），机体剪影按「战斗分类」区分，胸口核心的颜色就是分类色（近卫橙红、尖兵黄、指挥紫、重装蓝、狙击粉、特种青）。地面环边上的黄色三角是朝向，右上角白色小三角表示飞行，半透明表示隐身。</p>`;
  const ter = terrainOf(u);
  const st = [['移动',u.mov],['装甲', effArmor(u) !== u.armor ? `${effArmor(u)}（+30%）` : u.armor],['命中', u.aim ?? 160],['回避', u.noEvade ? '—' : `${100 + 2 * (Math.max(0, u.eva - (u.dodgePen || 0)) + (u.moveEva || 0))}${u.moveEva ? `（+${2 * u.moveEva}）` : ''}${u.dodgePen ? `（疲劳 −${2 * u.dodgePen}）` : ''}`],['朝向',FACE_ARROW[u.facing]],['体积',`${u.w}×${u.h}`],['格斗',u.melee],['射击',u.shoot],['防御',u.defense || 0],['觉醒',u.awaken ?? 100],['等级',u.lv]]
    .map(([k,v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const affixH = u.side === 'enemy' && LV && LV.affix ? `<div class="abil"><div><b>精英词缀【${LV.affix.name}】</b>${LV.affix.desc}</div></div>` : '';   // v0.34.2 词缀写进敌人面板
  const traitH = (u.trait ? `<div class="abil"><div style="${hasTrait(u, u.trait) ? '' : 'opacity:.55'}"><b>个人特技 · ${ABIL[u.trait].name}${hasTrait(u, u.trait) ? '' : `（Lv${TRAIT_LV} 解锁）`}</b>${ABIL[u.trait].desc}${hasTrait(u,'moveEva') && u.moveEva ? `（当前 +${u.moveEva}）` : ''}${hasTrait(u,'steadfast') && !u.movedThisRound ? '（生效中）' : ''}</div></div>` : '') + affixH;
  const abil = u.abilities.map(a => `<div><b>${ABIL[a].name}</b>${ABIL[a].desc}${a === 'barrier' ? `（剩 ${u.barrierLeft} 次）` : a === 'lambdaShield' ? `（本阶段剩 ${lsLeft(u)} 次，头顶紫色 λ）` : a === 'guard' ? `（本阶段剩 ${u.guardLeft} 次）` : a === 'dodgeFatigue' && u.dodgePen ? `（当前 −${u.dodgePen}）` : ''}</div>`).join('');
  return `<div class="uc-top">${portraitHTML(u)}<div><div class="u-head"><span class="sw ${u.side}"></span><h2>${u.side === 'ally' ? u.pilot : u.mech}</h2>${u.side === 'ally' ? `<span class="mech">${u.mech}${u.mechName ? ' · ' + u.mechName : ''}</span>` : ''}<span class="lv">Lv ${u.lv}</span>
      <span class="tag">${u.flying ? '飞行' : '地面'}</span>${u.transform ? `<span class="tag">${u.transformed ? FORMS[u.transform].name + '形态' : '德天使形态'}</span>` : ''}${u.stunned ? '<span class="tag" style="color:var(--enemy)">被骇入</span>' : ''}${u.disarmed ? '<span class="tag" style="color:var(--enemy)">武装损坏</span>' : ''}${hasStealth(u) ? '<span class="tag">隐形</span>' : ''}${u.side==='enemy' ? '<span class="tag">敌方</span>' : ''}${u.acted && u.side==='ally' ? '<span class="tag">已行动</span>' : ''}</div>
    ${Object.keys(u.tags).length ? `<div class="utags">${Object.entries(u.tags).map(([k,v]) => `<span><i>${k}</i>${v}</span>`).join('')}</div>` : ''}</div></div>
    ${bar('HP',u.hp,u.maxHp)}${u.lambdaAwaken && shieldOn(u) ? `<p class="small" style="color:#c9a8ff">${u.awakened ? 'λ 觉醒中：λ 武器 0 CD，单分子刀已升级' : `λ 力场被完全击破 ${u.shieldBreaks || 0}/${u.lambdaAwaken} 次后 λ 觉醒`}</p>` : ''}${shieldOn(u) ? bar(u.shieldName || '护盾', u.shieldHp, u.shield) : u.shield ? `<p class="small">${u.shieldName || '护盾'} ${u.shield}（Lv${u.shieldLv} 解锁）</p>` : ''}
    <dl class="stats">${st}</dl>
    ${weakHTML(u)}
    ${u.portal && hasTrait(u,'portalTrait') ? `<div class="where">反噬值 <b style="color:${u.backlash >= 100 ? 'var(--enemy)' : u.backlash >= 75 ? 'var(--accent)' : 'var(--fg)'}">${u.backlash}/100</b> · 传送 ${u.portal.range} 格，每次 +${u.portal.cost}</div>` : ''}${u.canFly ? `<div class="where">可以起飞 / 落地（移动前决定）</div>` : ''}
    <div class="where">所在：${u.flying ? '空中，不受地形加成' : `${ter.name}　防御 ${ter.def}%　闪避 +${ter.eva}`}</div>
    ${breakSum(u) ? `<div class="abil"><div><b style="color:var(--enemy)">破防 ×${u.debuffs.length}</b>所有防御 −${Math.min(100, breakSum(u))}%（到下一个我方阶段）</div></div>` : ''}
    ${traitH}
    ${u.buffs.length ? `<div class="abil">${u.buffs.map(b => `<div><b>${b.src}</b>${buffTxt(b)}（到下一个我方阶段）</div>`).join('')}</div>` : ''}
    ${abil ? `<div class="abil">${abil}</div>` : ''}
    <div class="wlist">${u.weapons.map(w => `<div class="w">${weaponInner(u, w)}</div>`).join('')}</div>`;
}
function actionHTML(){
  const u = S.sel;
  switch (S.mode){
    case 'idle': {
      const left = units.filter(x => x.side === 'ally' && !x.acted).length;
      return `<h3>指令</h3><p class="hint">点击我方机体开始行动。蓝色格是可移动范围，点击机体自身所在格表示原地行动。</p>
        <p class="small">本回合还可行动：${left} 台。全部行动完或随时可以点「结束回合」。</p>
        ${hangarHTML()}
        <p class="small kbd">⌨ ${left ? `Tab：切换光标${S.cursor ? `（当前：${fullName(S.cursor)}）` : ''}　空格：${S.cursor && !S.cursor.acted ? '选中光标所在机体' : '选中下一台未行动的机体'}` : '空格：结束回合（会先确认）'}</p>`;
    }
    case 'deploy':
      return `<h3>派出 · ${fullName(S.depUnit)}</h3><p class="hint">青色格是能放的部署格（出击点、前线中继周围；不能在敌方控制区里）。点一格派出，派出后当回合不能移动，可以攻击、可以选朝向。</p>
        <div class="acts"><button class="btn" data-a="deploy-cancel">取消</button></div>`;
    case 'moving':
      return `<h3>指令 · ${fullName(u)}</h3><p class="hint">⌨ 空格：原地行动。选择移动目的地（移动力 ${u.mov}${u.flying ? '，飞行中每格消耗 1' : ''}）。点自身格可原地行动。</p>
        <div class="acts">${moveExtras(u)}<button class="btn" data-a="cancel">取消</button></div>`;
    case 'portal':
      return `<h3>传送 · ${fullName(u)}</h3><p class="hint">紫色格是 7 格内可以传送到的空地，点击即传送。反噬值 ${u.backlash} → ${u.backlash + u.portal.cost}。</p>
        <div class="acts"><button class="btn" data-a="portal-back">返回</button></div>`;
    case 'menu': {
      const can = u.weapons.some(w => weaponUsable(u,w).ok);
      return `<h3>指令 · ${fullName(u)}</h3><p class="hint">${hasTrait(u,'autoCast') ? 'Feena 不能主动使用武器，选择待机即可。' : u.moved ? '已移动：标注「不能移动后使用」的武器不可用。' : '未移动：可使用全部已解锁武器。'}</p>
        <div class="acts">${hasTrait(u,'autoCast') ? '' : `<button class="btn primary" data-a="attack" ${can ? '' : 'disabled'}>攻击</button>`}<button class="btn" data-a="wait">待机</button>${canRelay(u) ? '<button class="btn" data-a="relay" title="在脚下插前线中继：周围 2 格成为部署格，插完本回合结束">插前线中继</button>' : ''}${canRetreat(u) ? '<button class="btn" data-a="retreat" title="在指挥机体 4 格内：撤回机库">撤回机库</button>' : ''}${S.teleported || S.noUndo ? '' : '<button class="btn" data-a="undo">取消移动</button>'}${u.transform && !u.transformed ? '<button class="btn" data-a="transform">脱装 · 纳德雷</button>' : ''}${canSwitchPick(u) ? `<button class="btn" data-a="feenaPick" title="Feena 只能携带一个技能；第 1 回合行动前可以切换">携带：${pickOf(u) === 'bless' ? '月光祝福' : '残月的余响'}（切换）</button>` : ''}</div>${S.teleported ? '<p class="small">已传送，不能取消。</p>' : ''}${S.noUndo && !S.teleported ? `<p class="small">${S.extraUsed ? 'DASH / 额外攻击：只能攻击或待机。' : S.owHit ? '路上挨了敌方压制射击，不能取消移动。' : '已经变身，不能取消移动。'}</p>` : ''}${u.canFly ? `<p class="small">${u.flying ? '飞行' : '地面'}状态。起飞 / 落地要在移动前决定。</p>` : ''}<p class="small">移动后需要先选择攻击或待机，才能结束回合。</p>
        <div class="facerow"><span class="small">朝向（W A S D 或点方向键）：橙色格子是这个朝向下能反击的范围${abilOn(u, 'overwatch') ? '（也是压制射击的射界）' : ''}，敌方阶段只能反击这里面的敌人。攻击时会自动转到能打到目标的方向并锁定</span><div class="facepad">${['up','left','right','down'].map(f => `<button data-face="${f}" class="${u.facing === f ? 'sel' : ''}" aria-label="朝${FACE_NAME[f]}">${FACE_ARROW[f]}</button>`).join('')}</div></div>
        <p class="small kbd">⌨ WASD：改变朝向　空格：${hasTrait(u,'autoCast') ? '待机' : S.atkList && S.atkList.length ? `攻击（${S.atkList.length} 个目标，红框标出）` : '待机（没有可攻击的目标）'}</p>
        ${can ? '' : '<p class="small">没有可用的武器或射程内没有目标。</p>'}${hasTrait(u,'autoCast') && autoWeapon(u) ? `<p class="small">待机后自动释放【${autoWeapon(u).name}】。${autoWeapon(u).fire === 'support' ? '绿色区域是作用范围。' : '紫色区域是余响的范围。'}</p>` : echoWeapon(u) ? '<p class="small">紫色区域是本次行动结束后「残月的余响」的范围。</p>' : ''}${regenWeapon(u) ? '<p class="small">绿框是本次行动结束后「月华再生」的回复范围。</p>' : ''}`;
    }
    case 'weapon':
      return `<h3>选择武器 · ${fullName(u)}</h3><div class="wlist">${u.weapons.map((w,i) => {
          const s = weaponUsable(u,w);
          return `<button class="w" data-w="${i}" ${s.ok ? '' : 'disabled'}>${weaponInner(u, w, s.note, s.ok)}</button>`;
        }).join('')}</div><div class="acts"><button class="btn" data-a="back-menu">返回</button></div>`;
    case 'target':
      return `<h3>选择目标 · ${S.weapon.name}</h3><p class="hint">红色是武器射程${S.weapon.fire === 'direct' ? '（直射还要视线通畅）' : ''}，闪烁框是可攻击的敌机，点击查看战斗预测。</p>
        <div class="acts"><button class="btn" data-a="back-weapon">换武器</button></div>`;
    case 'confirm': {
      const t = S.target, r = aiReaction(t, u, S.weapon);
      const mine = forecast(u, S.weapon, t, r.reaction);
      let theirs;
      if (r.reaction === 'counter'){
        const f = forecast(t, r.weapon, u, null, {defFacing: dirToward(u, t), counter:true});
        theirs = `<div class="nm">${miniPortrait(t)}${fullName(t)} · 反击【${r.weapon.name}】</div><div class="big">${f.hit}%<span class="zone ${f.zone}">${zname(f.zone)}</span></div>
          <div class="ln">伤害 ${dmgTxt(f)}</div><div class="ln">暴击率 ${f.crit}%</div>
          <details class="calc"><summary>伤害计算</summary><ol class="steps">${f.steps.map(s => `<li>${s}</li>`).join('')}</ol></details>`;
      } else theirs = `<div class="nm">${miniPortrait(t)}${fullName(t)} · 应对</div><div class="big">${r.reaction === 'defend' ? '防御' : r.reaction === 'evade' ? '回避' : '硬吃'}</div>
          <div class="ln">${r.reaction === 'defend' ? '伤害 −50%' : r.reaction === 'evade' ? '我方命中减半' : '不回避、不防御'}</div><div class="ln">没有可反击的武器</div>`;
      const kill = mine.gamble ? (mine.dmg >= t.hp ? '　· 命中且掷出 12000 即可击破' : '') : (mine.dmg >= t.hp ? '　· 命中即可击破' : '');
      return `<h3>战斗预测</h3><div class="fc">
          <div class="fcs ally"><div class="nm">${miniPortrait(u)}${fullName(u)} · 【${S.weapon.name}】</div><div class="big">${mine.multi ? (S.weapon.special === 'funnel' ? '平均 ' : '首段 ') : ''}${mine.hit}%${mine.zone ? `<span class="zone ${mine.zone}">${ZONE[mine.zone].name}</span>` : ''}</div>
            <div class="ln">伤害 ${dmgTxt(mine)}</div><div class="ln">暴击率 ${mine.crit}%</div>
            <details class="calc" open><summary>伤害计算</summary><ol class="steps">${mine.steps.map(s => `<li>${s}</li>`).join('')}</ol></details></div>
          <div class="fcs enemy">${theirs}</div></div>
        <p class="small">${mine.zone ? `从${ZONE[mine.zone].name}攻击：目标闪避 −${ZONE[mine.zone].eva}、暴击 +${ZONE[mine.zone].crit}${ZONE[mine.zone].pierce ? `，无视目标 ${ZONE[mine.zone].pierce}% 装甲` : ''}。攻击后 ${fullName(t)} 会转向你。<br>` : ''}${fullName(t)} HP ${t.hp}/${t.maxHp}${kill}${S.weapon.special === 'gamble' ? '<br>攻击后无论是否命中都会传送。' : ''}${S.weapon.special === 'push' ? `<br>命中后把目标向${FACE_NAME[dirToward(u, t)]}推开 ${S.weapon.push} 格。` : ''}</p>
        <p class="small kbd">⌨ 空格：确认攻击　Esc：撤回本次行动并取消选中</p>
        <div class="acts"><button class="btn primary" data-a="fire">确认攻击</button><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'mapdir': case 'mapconfirm': {
      const burst = S.weapon.shape === 'burst' || S.weapon.shape === 'box';   // box：不用方向键，直接点地图
      const pad = burst ? '' : DIR8.map((d,i) => {
        if (!d) return `<div class="mid">${u.short}</div>`;
        const dd = S.dirs.find(x => x.dx === d[0] && x.dy === d[1]);
        return `<button data-dir="${i}" ${dd.ok ? '' : 'disabled'} class="${S.dir === dd ? 'sel' : ''}" aria-label="方向 ${d[2]}">${d[2]}</button>`;
      }).join('');
      let detail = S.weapon.shape === 'box' ? `<p class="small">点击地图选择 ${S.weapon.size || 2}×${S.weapon.size || 2} 区域：点的格子就是区域左上角（橙色是可选范围）。</p>` : `<p class="small">选择方向，或直接点击地图上的橙色路径。${S.weapon.shape ? '' : '灰掉的方向第 5 格没有合法落点。'}</p>`;
      if (S.dir){
        const rows = S.dir.hit.map(t => {
          const f = forecast(u, S.weapon, t, null);
          return `<li><span class="${t.side}">${fullName(t)}${t.side === 'ally' ? '（友军）' : ''}</span><span>命中 ${f.hit}% · 伤害 ${dmgTxt(f)} / HP ${t.hp}</span></li>`;
        }).join('');
        if (S.weapon.smoke) return `<h3>${S.weapon.name}</h3><p class="small">烟雾覆盖 (${S.dir.box[0]}, ${S.dir.box[1]}) 起的 ${S.weapon.size}×${S.weapon.size}，持续 ${S.weapon.smoke} 回合；里面现在有 ${S.dir.hit.length} 台机体。从烟雾里开火或打烟雾里的目标，命中 −${SMOKE_HIT}。</p><div class="acts"><button class="btn primary" data-a="mapfire">放烟雾</button><button class="btn" data-a="back-weapon">换武器</button></div>`;   // v0.40.11
        const ff = S.dir.hit.some(t => t.side === 'ally');
        detail = `<p class="small">${S.dir.land ? `落点 (${S.dir.land[0]}, ${S.dir.land[1]})，沿途` : '范围内'} ${S.dir.hit.length} 个单位${S.weapon.iff ? '（敌我识别，只打敌机）' : ''}：</p>
          ${rows ? `<ul class="hitlist">${rows}</ul>` : '<p class="small">沿途没有单位。</p>'}
          ${ff ? '<p class="small warn">注意：路径上有友军，会被一起击中。</p>' : ''}
          <div class="acts"><button class="btn primary" data-a="mapfire">发射【${S.weapon.name}】</button></div>`;
      }
      return `<h3>地图炮 · ${S.weapon.name}</h3>${burst ? '' : `<div class="pad">${pad}</div>`}${detail}
        <div class="acts"><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'support': {
      const ts = supportTargets(u, S.weapon);
      const sw = S.weapon;
      return `<h3>${sw.name}</h3><p class="hint">${sw.foe ? '红' : '绿'}色是作用范围（菱形 ${effRange(u, sw)[1]} 格${sw.self ? '，包括自己' : '，不含自己'}）。效果：${sw.foe ? '敌机 ' : ''}${supportTxt(sw, u)}${sw.heal ? '' : '，持续到下一个我方阶段开始'}。</p>
        ${ts.length ? `<ul class="hitlist">${ts.map(a => `<li><span class="${a.side}">${fullName(a)}</span><span>${sw.heal ? `HP ${a.hp}/${a.maxHp}` : supportTxt(sw, u)}</span></li>`).join('')}</ul>` : `<p class="small">范围内没有${sw.foe ? '敌机' : '友军'}，施放后不会有效果。</p>`}
        <div class="acts"><button class="btn primary" data-a="cast">施放</button><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'device':
      return `<h3>脱装 · 纳德雷</h3><p class="hint">选择外装甲留下的位置：青色格是可选的墙中心，鼠标移上去会预览 3 格宽的 GN 墙（与你到中心的方向垂直）。<br>变身是单向的，本场不能变回去；变身后还可以用新武器攻击或待机。</p>
        <div class="acts"><button class="btn" data-a="back-menu">返回</button></div>`;
    case 'hack': {
      const ts = trialTargets(u, S.weapon);
      return `<h3>${S.weapon.name}</h3><p class="hint">选择要骇入的敌机：它在下一个敌方阶段不能行动，在此之前也不能反击、回避或防御。</p>
        <div class="wlist">${ts.map(t => `<button class="w" data-hack="${t.uid}"><div class="wn"><span>${fullName(t)}</span><span class="why ok">距离 ${distU(u,t)}</span></div><div class="wf"><span>HP ${t.hp}/${t.maxHp}</span></div></button>`).join('')}</div>
        <div class="acts"><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'pick': {
      const rows = S.atkList.map(t => {
        const w = bestWeaponFor(u, t), f = forecast(u, w, t, aiReaction(t, u, w).reaction);
        return `<button class="w ${t === S.pickSel ? 'sel' : ''}" data-pick="${t.uid}"><div class="wn"><span>${t === S.pickSel ? '▶ ' : ''}${miniPortrait(t)}${fullName(t)}${t === S.pickSel ? '（推荐）' : ''}</span><span class="why ok">${f.zone ? ZONE[f.zone].name + ' · ' : ''}命中 ${f.hit}%</span></div>
          <div class="wf"><span>【${w.name}】</span><span>伤害 ${dmgTxt(f)}</span><span>HP ${t.hp}/${t.maxHp}${(f.gamble ? false : f.dmg >= t.hp) ? ' · 可击破' : ''}</span></div></button>`;
      }).join('');
      return `<h3>攻击 · 选择目标</h3><p class="hint">红框是能打到的敌人。点击敌人（地图上或下面列表），会自动选用对它期望伤害最高的武器，在预测里还可以换。</p><p class="small kbd">⌨ 空格：选中推荐目标（▶，优先能击破的，其次期望伤害最高）　Tab / Shift+Tab：切换预选目标</p>
        <div class="wlist">${rows}</div><div class="acts"><button class="btn" data-a="back-menu">返回</button></div>`;
    }
    case 'heal': {
      const ts = healTargets(u, S.weapon), amt = healAmount(u, S.weapon);
      return `<h3>${S.weapon.name} · 回复 ${amt}</h3><p class="hint">选择要修理的友军（也可以直接点地图上的友军）。</p>
        <div class="wlist">${ts.map(t => `<button class="w" data-heal="${t.uid}"><div class="wn"><span>${fullName(t)}</span><span class="why ok">+${Math.min(amt, t.maxHp - t.hp)}</span></div><div class="wf"><span>HP ${t.hp}/${t.maxHp} → ${Math.min(t.maxHp, t.hp + amt)}</span></div></button>`).join('')}</div>
        <div class="acts"><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'command': {
      const k = COMMANDS[CMD.skill];
      const how = k.kind === 'area' ? '鼠标移到地图上预览 3×3 范围，点击下令。注意别把自己人留在里面。' : k.kind === 'enemy' ? '点击一台敌机下令。' : k.kind === 'ally' ? '点击一台已经行动过（灰色）的我方机体下令。' : '';
      return `<h3>指挥 · ${k.name}</h3><p class="hint">${k.desc}</p>${how ? `<p class="small">${how}</p>` : ''}
        <div class="acts">${k.kind === 'instant' ? '<button class="btn primary" data-a="cmd-go">下令</button>' : ''}<button class="btn" data-a="cmd-cancel">取消</button></div>`;
    }
    case 'lock': {
      const w = S.weapon, max = wv(u, w, 'lockN'), ts = targetsFor(u, w);
      const rows = ts.map(t => { const f = forecast(u, w, t, null), on = S.locks.includes(t);
        return `<button class="w ${on ? 'sel' : ''}" data-lock="${t.uid}"><div class="wn"><span>${on ? `【${S.locks.indexOf(t)+1}】` : ''}${miniPortrait(t)}${fullName(t)}</span><span class="why ok">${f.zone ? ZONE[f.zone].name + ' · ' : ''}命中 ${f.hit}%</span></div>
          <div class="wf"><span>伤害 ${dmgTxt(f)}</span><span>HP ${t.hp}/${t.maxHp}${f.dmg >= t.hp ? ' · 可击破' : ''}</span></div></button>`; }).join('');
      return `<h3>多重锁定 · ${w.name}</h3><p class="hint">点击地图上的敌机或下面的列表来锁定 / 取消，最多 ${max} 台（已锁定 ${S.locks.length}）。目标不能反击、防御或回避。</p>
        <div class="wlist">${rows || '<p class="small">射程内没有可锁定的敌机。</p>'}</div>
        <p class="small kbd">⌨ 空格：发射</p>
        <div class="acts"><button class="btn primary" data-a="lockfire" ${S.locks.length ? '' : 'disabled'}>发射（${S.locks.length} 个目标）</button><button class="btn" data-a="back-weapon">换武器</button></div>`;
    }
    case 'moving2': if (S.dash) return `<h3>DASH · ${fullName(u)}</h3><p class="hint">击破目标！可以再移动 3 格（蓝色格），然后再攻击一次；点自身或按空格原地攻击。</p>`;
      return `<h3>一击脱离 · ${fullName(u)}</h3><p class="hint">攻击完成。可以用剩下的移动力（${S.reachLeft}）继续移动：点蓝色格移动，或点自身 / 按空格原地待机。</p>
        <div class="acts"><button class="btn" data-a="wait">原地待机</button></div>`;
    case 'enemy': return `<h3>指令</h3><p class="hint">敌方行动中。敌机攻击我方时会弹出应对选择：反击、防御或回避。</p>`;
    case 'busy': return `<h3>指令</h3><p class="hint">战斗中…</p>`;
    case 'over': return `<h3>指令</h3><p class="hint">作战已结束。</p>`;
  }
  return '';
}
function canLand(u){ return tilesOf(u).every(([x,y]) => !TER[map[y][x]].groundBlock); }
function moveExtras(u){
  let h = '';
  if (u.portal && hasTrait(u,'portalTrait') && !u.moved) h += `<button class="btn" data-a="portal" ${u.backlash >= 100 ? 'disabled' : ''}>传送（反噬 ${u.backlash}/100）</button>`;
  if (u.canFly) h += `<button class="btn" data-a="fly" ${u.flying && !canLand(u) ? 'disabled title="下方地形无法降落"' : ''}>${u.flying ? '落地' : '起飞'}</button>`;
  return h;
}
function portalTiles(u){
  const out = [];
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++){
    const d = distRect(u.x,u.y,u.w,u.h,x,y,1,1);
    if (d >= 1 && d <= u.portal.range && canStand(u,x,y)) out.push({x,y});
  }
  return out;
}
function usableAttackWeapons(u){ return u.weapons.filter(w => ATTACK_FIRES.includes(w.fire) && !wStatus(u, w, {moved:u.moved})); }
function attackables(u){
  if (hasTrait(u,'autoCast')) return [];
  const ws = usableAttackWeapons(u).filter(w => w.special !== 'lock');
  return units.filter(e => (e.side === 'enemy' || (u.side === 'ally' && e.side === 'neutral')) && e.hp > 0 && ws.some(w => canHit(u, w, e)));   // v0.34.1 中立物（陨石残骸、补给箱）我方都能打，近战也算
}
function bestWeaponFor(u, t){
  let best = null, bs = -1;
  for (const w of usableAttackWeapons(u)) if (w.special !== 'lock' && canHit(u, w, t)){
    const f = forecast(u, w, t, aiReaction(t, u, w).reaction), sc = f.exp + (f.dmg >= t.hp ? 1e5 : 0);
    if (sc > bs){ bs = sc; best = w; }
  }
  return best;
}
function recommendTarget(u, list){
  let best = null, bs = -Infinity;
  for (const t of list){
    const w = bestWeaponFor(u, t); if (!w) continue;
    const f = forecast(u, w, t, aiReaction(t, u, w).reaction);
    const kill = !f.gamble && f.dmg >= t.hp;
    const sc = f.exp + (kill ? 50 * f.hit + 5000 : 0);
    if (sc > bs){ bs = sc; best = t; }
  }
  return best;
}
function enterPick(){
  S.mode = 'pick'; refresh();
  S.pickSel = recommendTarget(S.sel, S.atkList); refresh();
}
function choosePick(t){
  const u = S.sel, w = bestWeaponFor(u, t); if (!w) return;
  S.weapon = w; S.atkTiles = atkTilesFor(u, w); S.target = t; S.mode = 'confirm'; refresh();
}
function weaponUsable(u, w){
  const why = wStatus(u, w, {moved:u.moved});
  if (why) return {ok:false, note:why};
  if (w.fire === 'device'){ const n = trialTargets(u,w).length; return n ? {ok:true, note:`可骇入 ${n} 台`} : {ok:false, note:'射程内没有敌机'}; }
  if (w.fire === 'heal'){ const n = healTargets(u,w).length; return n ? {ok:true, note:`相邻友军 ${n} 台`} : {ok:false, note:'旁边没有友军'}; }
  if (w.fire === 'support'){ const n = supportTargets(u,w).length, who = w.foe ? '敌机' : '友军'; return {ok:true, note: n ? `范围内${who} ${n} 台` : `范围内没有${who}`}; }
  if (w.fire === 'map'){ const n = mapDirs(u, w).filter(d => d.ok).length; return n ? {ok:true, note:`可用方向 ${n} 个`} : {ok:false, note:'没有合法落点'}; }
  const n = targetsFor(u, w).length;
  return n ? {ok:true, note:`可攻击 ${n} 个目标`} : {ok:false, note: w.fire === 'direct' ? '射程内无目标或视线被挡' : '射程内无目标'};
}
function refresh(){
  S.atkList = S.sel && (S.mode === 'menu' || S.mode === 'pick') ? attackables(S.sel) : [];
  if (S.threat) S.threatSet = computeThreat();
  const focus = S.mode === 'confirm' ? S.target : (S.inspect || S.sel);
  $('#unitCard').innerHTML = unitCardHTML(focus && focus.hp > 0 ? focus : (S.sel || null));
  $('#actionCard').innerHTML = actionHTML();
  const busy = S.mode === 'enemy' || S.mode === 'busy';
  const allDone = S.mode === 'idle' && !units.some(u => u.side === 'ally' && !u.acted);
  const be = $('#btnEnd'); be.disabled = over || busy || midAction(); be.title = midAction() ? '有机体已经移动，先选择攻击或待机' : ''; be.classList.toggle('pulse', allDone);
  $('#btnRestart').disabled = busy;
  $('#btnRestart').textContent = LV && LV.run ? '撤退（判负）' : '重开本战';
  const bc = $('#btnCmd');
  bc.hidden = !CMD;
  if (CMD){
    const k = COMMANDS[CMD.skill], ready = turn >= CMD.readyTurn;
    bc.textContent = `指挥 · ${k.name}${ready ? '' : `（冷却至第 ${CMD.readyTurn} 回合）`}`;
    bc.disabled = !ready || S.mode !== 'idle' || over;
    bc.setAttribute('aria-pressed', String(S.mode === 'command'));
  }
  $('#btnLv1').disabled = busy; $('#btnLv20').disabled = busy; $('#btnLv30').disabled = busy;
}
function log(text, steps, cls){
  const li = document.createElement('li'); if (cls) li.className = cls;
  li.innerHTML = `<span class="t">T${turn}</span>${text}` + (steps ? `<details class="calc"><summary>计算过程</summary><ol class="steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol></details>` : '');
  const ol = $('#log'); ol.prepend(li);
  while (ol.children.length > 150) ol.lastChild.remove();
}

