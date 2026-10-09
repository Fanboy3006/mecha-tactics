/* ---------- 角色试炼：每个角色一关，由下面这张配置表生成 ---------- */
// e：敌人（Lv20）；mates：同行的队友；hurt：队友开局只剩一半 HP；feat：地形特征；hint：这一关想让你试的东西
const TRIALS = {
  B1:{e:['grunt','grunt','artillery','fortress'], hint:'用「传送」越过敌阵直接贴到炮击机身边；Lv20 的传送斩适合对付高 HP 的重装要塞；Lv30 解锁「影界·万刃归一」，传送进敌阵中心再发动。'},
  B2:{e:['hound','hound','drone','drone','fighter'], feat:'forest', hint:'少走几步，把剩余移动力转成闪避（游刃有余）；Lv20 影凤凰是特殊伤害，一次贯穿一排。'},
  M1:{e:['grunt','grunt','raider','raider','shield'], mates:['M2','M4'], hint:'Feena 不能主动攻击，待机后自动施放携带的技能。<b>只能带一个</b>：第 1 回合在指令面板切换「月光祝福」（Lv20 起加防御、暴击）或「残月的余响」。余响的范围 = 自身 4 格 + 4 格内月球王国队友<b>此刻实际打得到的格子</b>：先让阿布拉德、Nagi 摆好位置和朝向，Feena 最后行动。'},
  M2:{e:['raider','raider','berserker','grunt'], mates:['M3'], hint:'原地不动时装甲 +30%、援护次数 +1；Lv20「铁壁领域」不动时控制区扩大到 2 格，敌人很难绕过他去打 Iris。Lv20 螺旋式打桩机无视减免。'},
  M4:{e:['grunt','grunt','hound','raider','artillery'], mates:['M2'], feat:'ridge', hint:'月光狙击枪会连射：每命中一次下一枪命中再 −70，直到被闪避（Lv20「残心」−55）。站着不动时直射命中 +15（居合）。山脊后面的敌人用月影迫击炮（曲射 3–9）打。'},
  M3:{e:['grunt','artillery','hound'], mates:['M2','B1'], hurt:true, hint:'队友开局只剩一半 HP。修理时对方防御 +15（战地急救）；Lv20 修理射程 1–2，月华再生每次行动后群体回复。'},
  M5:{e:['grunt','grunt','raider','artillery','turret'], mates:['M2','M4'], hint:'牵引锚（射程 2–5）把后排的炮击机、固定炮台拉到阿布拉德身边，被拉的敌人防御 −20（拘束），再让 Nagi 连射收掉。Lv20 重力网：点地图选 2×2 区域，命中的敌人移动力 −2。'},
  CB1:{e:['hound','hound','grunt','grunt','raider'], hint:'被敌人包围时「我就是高达」命中和闪避都会上升；击破后还能原地再砍一次（连斩）。Lv30 解锁「GN 剑 III·量子跃迁斩」。'},
  CB2:{e:['artillery','turret','grunt','sniper'], feat:'ridge', hint:'所有武器都不能移动后使用：先站好位置再开火。命中溢出的部分会转成暴击。'},
  CB3:{e:['grunt','shield','bomber','grunt'], feat:'chasm', hint:'GN 冲撞会把目标推开 2 格，推进裂谷直接坠毁，撞到别人双方都受伤。Lv20 被动「超兵反射」：闪避 +15。'},
  CB4:{e:['raider','raider','grunt','hound'], hint:'脱装变成纳德雷时，外装甲会变成一道 GN 墙挡住敌人；Lv20 Trial System 可以骇入敌机；本体 Lv20 还解锁「GN 加农炮·高压全弹」。'},
  S1:{e:['drone','drone','grunt','grunt','fighter','hound','swarm'], hint:'敌人分散。Lv20 METEOR 全弹发射可以一次锁定 5 台，目标不能反击；被围住或掉血后 SEED 觉醒。Lv30 解锁浮游炮「超级 DRAGOON」。'},
  S2:{e:['phase','phase','sniper','jammer'], mates:['S7'], hint:'这批敌人全用光束武器。晓的光束反射装甲会把一部分伤害弹回去；DRAGOON 浮游炮从 8 个方向打 16 段，敌人闪避减半。'},
  S3:{e:['grunt','grunt','grunt','berserker','regen'], hint:'手感不稳：命中低一点、暴击高很多。Lv20 解锁被动「全功率炮装」（光束伤害 +20%）和核心分离，第一次被击破时会复活。'},
  S4:{e:['grunt','grunt','grunt','tank'], mates:['S6'], cluster:true, hint:'敌人挤在一起。先让希尔妲打一下，志保再打同一个目标，「集火」伤害 +20%；Lv20 被动「热能过载」：打 4 格以外的目标伤害 +20%。'},
  S5:{e:['raider','raider','hound','hound','swarm','swarm'], feat:'forest', hint:'兽形态走森林不减速。被打得越多，下一次攻击越痛（强化人）。Lv20 毁灭模式会无差别轰炸周围 3 格，注意别靠近友军。'},
  S6:{e:['grunt','captain','grunt','beetle'], mates:['S7','S8'], hint:'先让两台 M1 贴住目标，希尔妲再打：每有 1 台友军相邻，伤害 +15%（喷射气流）。Lv20 被动「喷射气流·连携」：2 格内友军伤害 +10%。'},
  S7:{e:['grunt','grunt','fighter','sniper','jammer'], mates:['S8','S3'], hint:'两台 M1 彼此在 3 格内时命中和闪避都上升，别分开走。Lv20 被动「压制火力」：3 格内敌机命中 −10。'},
  S8:{e:['grunt','grunt','fighter','sniper','jammer'], mates:['S7','S3'], hint:'M1 二人组一起行动。Lv20 被动「战术数据链」：4 格内友军命中 +10、暴击 +5。'},
  W1:{e:['grunt','grunt','grunt','swarm','swarm'], hint:'ZERO 系统让暴击倍率变成 ×1.5。Lv20 双联破坏步枪是 9 格直线地图炮（会误伤友军），Lv30 光束宽 3 格，并解锁只打敌人的「零式·旋转破坏步枪」。'},
  W2:{e:['sniper','sniper','artillery','stealth','turret'], feat:'ridge', hint:'超级干扰器：3 格外的敌人选不中迪奥，被迪奥砍也不能反击。Lv20 斩首能直接收掉残血敌人。'},
  W3:{e:['swarm','swarm','swarm','swarm','drone','drone','raider'], hint:'蜂群无人机闪避很高但怕多段：双联加特林一次 8 段。Lv20 全弹发射敌我识别，周围 3 格的敌人一次清掉。'},
  W4:{e:['grunt','grunt','raider','berserker'], mates:['W5','W1'], hint:'宇宙之心给周围友军闪避加成；Lv20 马格纳克队支援给全队命中和伤害。'},
  W5:{e:['sniper','artillery','grunt','captain'], hint:'龙爪可以把敌人拉到身边。目标周围 2 格没有别的敌人时，正义让伤害 +25%：先把它们拆开再打。'},
  W6:{e:['raider','raider','raider','hound','hound'], hint:'移动 3 格以上再近战，暴击 +30（闪电伯爵）。Lv20 光束剑·横扫可以移动后使用，冲进人堆再扫。'},
  W7:{e:['fighter','fighter','drone','grunt','artillery'], hint:'一击脱离：攻击之后还能用剩下的移动力撤走。先近身打、再退回安全区。Lv20 被动「编队牵制」：3 格内敌机闪避 −10。'},
  A1:{e:['beetle','tank','grunt','shield'], hint:'命中率低于 70% 时暴击 +30：打桩机命中不高，但一旦暴击就很痛。Lv20 切札是冲刺型地图炮。'},
  A2:{e:['beamcoat','beamcoat','phase','phase','fighter'], hint:'光束涂层机抗光束、相转移装甲机抗实弹：按目标切换嚎叫发射器的光束 / 实弹模式。每个阶段第一次被打时闪避 +30（天然）。'},
  A3:{e:['grunt','grunt','grunt','hound','hound','stealth'], cluster:true, hint:'溅射破坏者会波及相邻敌机。W 系列被侧击、背击时装甲不会被无视。'},
  A4:{e:['berserker','raider','grunt','tank'], mates:['A5'], hint:'每回合第一次主动攻击伤害 +25%（热血）；替库斯哈援护挡刀。Lv20 被动「暗剑杀之心」：近战伤害 +20%、暴击 +10。'},
  A5:{e:['mirror','phase','beamcoat','grunt'], mates:['A1','A4'], hurt:true, hint:'修理量 +50%，但饮料太难喝，喝完闪避 −10。龙雷闪是特殊伤害，无视光束 / 物理抗性。Lv20 被动「念动共鸣」：每个我方阶段开始时 3 格内友军回复 10%。'},
  U7:{e:['venom','mirror','beamcoat','phase','skyfort'], hint:'Lv20 解锁λ力场护盾（4000，每个己方阶段回满），同时解锁隔空 λ 拳。λ 力场被完全击破 2 次后「λ 觉醒」：所有 λ 武器 0 CD，单分子刀升级为 λ 单分子刀（特殊伤害）。λ 驱动·散弹炮是特殊伤害，只会被护盾类效果抵消；λ 试作机和空中要塞都有护盾。Lv30 解锁「λ 驱动·极限放出」。'},
  U6:{e:['sniper','artillery','turret','captain'], wide:true, hint:'目标距离 6 格以上时命中、暴击 +20（狙击之王）。Lv20 超长距离狙击射程 5–14。'},
  U2:{e:['grunt','grunt','grunt','grunt','jammer'], mates:['U6','U1'], cluster:true, hint:'小队长光环让队友暴击 +10；导弹发射器会溅射。Lv20 被动「ECM 干扰」：4 格内敌机命中 −10。'},
  U1:{e:['grunt','beetle','captain','regen'], mates:['U2'], hint:'侧击 / 背击时伤害 +20%（冷血）：先让梅丽莎·毛把敌人的注意力引过去，再绕到侧面或背后。'},
  U8:{e:['sniper','artillery','funnel','grunt'], mates:['U6'], hint:'这一回合还没开火时，3 格外的敌人选不中杨（ECS）。Lv20 被动「激光引导」：自己和 3 格内友军命中 +10。'},
};
function makeTrial(t){
  const cfg = TRIALS[t.mech] || {e:['grunt','grunt','artillery']}, W = cfg.wide ? 30 : 24, H = 14;
  const r = mulberry32([...t.mech].reduce((a,c) => a*31 + c.charCodeAt(0), 7));
  const g = [...Array(H)].map(() => Array(W).fill('.'));
  for (let i=0;i<5;i++){ const cx = ri(r,8,W-3), cy = ri(r,1,H-2); for (let y=cy-1;y<=cy+1;y++) for (let x=cx-1;x<=cx;x++) if (y>=0&&y<H&&x>=0&&x<W && r()<.8) g[y][x] = 'f'; }
  if (cfg.feat === 'forest') for (let y=0;y<H;y++) for (let x=6;x<W;x++) if (r() < .3) g[y][x] = 'f';
  if (cfg.feat === 'ridge') for (let y=3;y<=10;y++) if (y !== 6 && y !== 7) g[y][10] = 'm';
  if (cfg.feat === 'chasm') for (let y=2;y<=11;y++){ g[y][15] = 'c'; g[y][16] = 'c'; }
  const heroAt = [3,7], mateAt = [[4,5],[4,9],[2,5],[2,9]];
  const slots = cfg.cluster ? [[14,6],[15,7],[14,8],[16,6],[16,8],[13,7],[17,7],[15,5]]
    : [[cfg.wide ? 24 : 17,7],[14,3],[14,11],[19,2],[19,11],[21,5],[21,9],[12,7],[17,4],[17,10]];
  let bigSlot = 0;
  const enemies = cfg.e.map((k,i) => {
    const big = ENEMY_T[k].w > 1, [x,y] = big ? [[W-3,1],[W-3,10]][bigSlot++ % 2] : slots[i % slots.length];
    return {t:k, x, y, facing:'left'};
  });
  const clear = (x,y,w=1,h=1) => { for (let j=0;j<h;j++) for (let k=0;k<w;k++) if (g[y+j] && g[y+j][x+k]) g[y+j][x+k] = '.'; };
  enemies.forEach(e => clear(e.x, e.y, ENEMY_T[e.t].w, ENEMY_T[e.t].h));
  const allies = [];
  if (cfg.cmd) allies.push({mech:t.mech, x:0, y:0, lv:20});
  else allies.push({mech:t.mech, x:heroAt[0], y:heroAt[1], facing:'right', lv:20});
  (cfg.mates || []).forEach((m,i) => { const [x,y] = cfg.cmd && i === 0 ? heroAt : mateAt[(cfg.cmd ? i-1 : i) % 4]; allies.push({mech:m, x, y, facing:'right', lv:20}); });
  allies.forEach(a => { const tt = ALLY_T.find(q => q.mech === a.mech); clear(a.x, a.y, tt.w, tt.h); });
  const lv20 = t.weapons.filter(w => w.unlock >= 20), ab = t.abilities.filter(a => ABIL[a]);
  const intro = `<b>${t.pilot} · ${t.mech}${t.mechName ? `（${t.mechName}）` : ''}</b>　${t.tags.势力} · ${t.tags.战斗分类}<br>` +
    (t.commandOnly ? `指挥技能【${COMMANDS[t.command].name}】${COMMANDS[t.command].desc}` :
      `个人特技【${ABIL[t.trait].name}】${ABIL[t.trait].desc}` + ab.map(a => `<br>能力【${ABIL[a].name}】${ABIL[a].desc}`).join('') +
      (t.shield ? `<br>${t.shieldName || '护盾'}：${t.shield}${t.shieldLv > 1 ? `（Lv${t.shieldLv}）` : ''}，每个己方阶段回满` : '') +
      (lv20.length ? `<br>Lv20+：${lv20.map(w => `【${w.name}】`).join('')}` : '')) +
    `<br><br>${cfg.hint || ''}<br><br><span class="small">按「Lv30」可以把全队升到 30 级试强化效果。</span>`;
  return {
    code:`CT-${t.mech}`, name:`机体展示 · ${t.pilot}（${t.mech}）`, w:W, h:H, speed:.6, enemyLv:1, trial:true,
    rows:g.map(row => row.join('')), allies, enemies, presetCmd: cfg.cmd ? t.mech : null,
    afterStart: cfg.hurt ? () => { units.filter(u => u.side === 'ally' && u.mech !== t.mech).forEach(u => { u.hp = Math.round(u.maxHp/2); }); refresh(); } : null,
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:`${t.pilot} 的试炼完成。`,
    summary:cfg.hint || '', tips:[{on:'turn:1', text:intro}],
  };
}
ALLY_T.forEach(t => { LEVELS['trial_' + t.mech] = makeTrial(t); });
/* 机体展示模式：按势力分组，每台机体一关（Lv20，敌人 Lv1） */
for (const f of [...new Set(ALLY_T.map(t => t.tags.势力))]){
  const og = document.createElement('optgroup'); og.label = `机体展示 · ${f}`;
  ALLY_T.filter(t => t.tags.势力 === f).forEach(t => { const o = document.createElement('option'); o.value = 'trial_' + t.mech; o.textContent = `${t.pilot}（${t.mech} · ${t.tags.战斗分类}）`; og.appendChild(o); });
  $('#levelSel').insertBefore(og, $('#levelSel optgroup[label="工具"]'));
}
