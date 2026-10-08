/* ---------- v0.40 规则试玩场（作者 2026-10-08 定，规则对话维护） ----------
   作者：「需要先做出对应的试玩关卡和只有基础属性的我方大众脸角色，才能正式感受规则的合理性」。
   - 大众脸（GENERIC_T）：每个职业 1 台，没有个人特技、没有档位倍率，只有职业通用能力；
     数值取同职业现有角色的中位水平（v0.39 换算后），武器直接按新公式写（不走 convWeapons）；
     Lv20 大招只给近卫、狙击、重装各 1 把，用来试开场冷却。
   - 试玩关（RULE_STAGES）：每关只考一条规则，开场提示写「这关看什么」。
   - 大众脸不进肉鸽招募、不进角色一览，只在试玩场出现。角色对话重写武器时可以拿它当同职业基准。 */
const GENERIC_T = [
  {pilot:'演习兵', mech:'G1', short:'G1', mechName:'量产近卫', trait:null, tags:{势力:'演习', 远近分类:'近战', 战斗分类:'近卫'}, hp:5000, armor:700, eva:25, mov:6, melee:160, shoot:110, defense:95, awaken:100, flying:false, w:1, h:1, abilities:['dash','mook'], weapons:[
    wp({name:'光束剑', power:2100, stat:'格斗', fire:'melee', range:[1,2], dmgType:'光束'}),
    wp({name:'光束手枪', power:1300, fire:'direct', range:[1,3], dmgType:'光束'}),
    wp({name:'全力斩', power:3800, stat:'格斗', fire:'melee', range:[1,2], cd:2, unlock:20, dmgType:'光束', desc:'大众脸的大招（试开场冷却用）。'}),
  ]},
  {pilot:'演习兵', mech:'G2', short:'G2', mechName:'量产尖兵', trait:null, tags:{势力:'演习', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4200, armor:300, eva:35, mov:7, melee:110, shoot:135, defense:75, awaken:100, flying:false, w:1, h:1, abilities:['zocFree','relay'], weapons:[
    wp({name:'突击步枪', power:1500, fire:'direct', range:[1,5]}),
    wp({name:'战斗刀', power:1400, stat:'格斗', fire:'melee'}),
  ]},
  {pilot:'演习兵', mech:'G3', short:'G3', mechName:'量产狙击', trait:null, tags:{势力:'演习', 远近分类:'远程', 战斗分类:'狙击'}, hp:4000, armor:300, eva:15, mov:5, melee:90, shoot:165, defense:75, awaken:100, flying:false, w:1, h:1, abilities:['supportAtk','overwatch'], weapons:[
    wp({name:'狙击炮', power:2350, fire:'direct', range:[3,8], hit:120, afterMove:false}),
    wp({name:'自卫手枪', power:1150, fire:'direct', range:[1,3]}),
    wp({name:'贯通狙击', power:3800, fire:'direct', range:[3,10], hit:125, cd:2, unlock:20, afterMove:false, desc:'大众脸的大招（试开场冷却用）。'}),
  ]},
  {pilot:'演习兵', mech:'G4', short:'G4', mechName:'量产重装', trait:null, tags:{势力:'演习', 远近分类:'近战', 战斗分类:'重装'}, hp:9000, armor:1400, eva:5, mov:4, melee:140, shoot:120, defense:110, awaken:100, flying:false, w:1, h:1, abilities:['guard'], weapons:[
    wp({name:'打桩臂', power:2000, stat:'格斗', fire:'melee'}),
    wp({name:'机炮', power:1400, fire:'direct', range:[1,3]}),
    wp({name:'全弹齐射', power:3200, fire:'direct', range:[1,4], cd:2, unlock:20, desc:'大众脸的大招（试开场冷却用）。'}),
  ]},
  {pilot:'演习兵', mech:'G5', short:'G5', mechName:'量产指挥', trait:null, tags:{势力:'演习', 远近分类:'远程', 战斗分类:'指挥'}, hp:4800, armor:500, eva:25, mov:5, melee:110, shoot:135, defense:80, awaken:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'修理装置', fire:'heal', power:3200, range:[1,1], dmgType:'—', desc:'回复一台相邻友军的 HP。'}),
    wp({name:'步枪', power:1250, fire:'direct', range:[1,4]}),
  ]},
  {pilot:'演习兵', mech:'G6', short:'G6', mechName:'量产特种', trait:null, tags:{势力:'演习', 远近分类:'近战', 战斗分类:'特种'}, hp:4800, armor:500, eva:25, mov:6, melee:140, shoot:130, defense:85, awaken:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'冲撞', power:1150, stat:'格斗', fire:'melee', special:'push', push:2, desc:'命中后把目标沿攻击方向推开 2 格。撞到单位、障碍或地图边缘时停下，双方各受 800 碰撞伤害；地面单位被推进裂谷直接坠毁。'}),
    wp({name:'冲锋枪', power:1300, fire:'direct', range:[1,3]}),
  ]},
];
GENERIC_T.forEach(t => { t.v37 = true; t.weapons.forEach(w => { w.v37 = true; }); });
/* 关卡里按机体代号找模板：先找正式角色，再找大众脸 */
const allyTplOf = m => ALLY_T.find(t => t.mech === m) || GENERIC_T.find(t => t.mech === m);

/* 地图小工具：先铺平原，再按 [字符, x, y, 宽, 高] 盖地形 */
function rtRows(w, h, marks = []){
  const g = [...Array(h)].map(() => Array(w).fill('.'));
  for (const [c, x, y, mw = 1, mh = 1] of marks) for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) if (g[y+j] && g[y+j][x+i] != null) g[y+j][x+i] = c;
  return g.map(r => r.join(''));
}
const RT_BASE = {speed:.6, enemyLv:5, ruleTest:true};
const RULE_STAGES = {
  rt_zoc:{...RT_BASE, code:'RT-1', name:'规则试玩 1 · 控制区（ZOC）', w:22, h:11,
    rows:rtRows(22, 11, [['x',0,0,22,2], ['x',0,9,22,2], ['f',6,3,2,2], ['f',6,6,2,2]]),
    allies:[{mech:'G1', x:3, y:4, facing:'right', lv:10}, {mech:'G2', x:3, y:6, facing:'right', lv:10}],
    enemies:[{t:'grunt', x:12, y:2, facing:'left'}, {t:'grunt', x:12, y:4, facing:'left'}, {t:'grunt', x:12, y:6, facing:'left'}, {t:'grunt', x:12, y:8, facing:'left'}],
    zone:{x0:19, y0:2, x1:21, y1:8},
    victory:{type:'reach', units:['G2']},
    goalText:'尖兵 G2 进入右侧撤离区（G2 被击破即失败）',
    winText:'尖兵穿过了敌人的控制区。',
    summary:'这一关看：控制区——走进敌人上下左右相邻的格子就得停下；尖兵「渗透」可以无视。',
    tips:[{on:'turn:1', text:'<b>这关看什么：控制区（ZOC）</b><br>敌人上下左右相邻的格子是它的控制区。走进去就要停下，剩下的移动力作废。四台量产机隔一格排成一列，中间的缝两边都是控制区，普通机体钻不过去。<br><br>选中机体后，移动范围里<b>画红框的格子</b>就是控制区。<br><br>近卫 G1 只能走到敌人身边停下打；尖兵 G2 有「渗透」，可以直接从缝里钻过去。目标：把 G2 送进右边的撤离区。<br><br>可以留意：起点已经在控制区里的机体可以正常离开。'}],
  },
  rt_formula:{...RT_BASE, code:'RT-2', name:'规则试玩 2 · 伤害公式（装甲 / 防御）', w:22, h:12,
    rows:rtRows(22, 12, [['f',9,2,3,3], ['m',9,8,3,2], ['f',15,5,2,2]]),
    allies:[{mech:'G1', x:4, y:4, facing:'right', lv:10}, {mech:'G4', x:4, y:6, facing:'right', lv:10}, {mech:'G3', x:2, y:5, facing:'right', lv:10}],
    enemies:[{t:'grunt', x:13, y:5, facing:'left'}, {t:'raider', x:13, y:7, facing:'left'}, {t:'shield', x:17, y:4, facing:'left'}, {t:'shield', x:17, y:7, facing:'left'}, {t:'grunt', x:10, y:3, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'试完了伤害公式。',
    summary:'这一关看：伤害 =（威力 − 装甲）×（1 +（攻击 − 防御）/ 100）；高装甲目标、地形防御、暴击 ×2。',
    tips:[{on:'turn:1', text:'<b>这关看什么：伤害公式</b><br>伤害 =（武器威力 − 目标装甲）×（1 +（攻击能力值 − 目标防御值）/ 100），命中后最少 10。<br><br>· <b>装甲是减法</b>：量产机装甲 350，盾卫装甲 600。威力低的武器打盾卫掉得特别多，多段攻击每段都扣装甲。<br>· <b>防御是比例</b>：森林 +10、山地 +20，站进去吃的伤害会变少。森林里那台量产机就是例子。<br>· <b>暴击是威力 ×2</b>，所以暴击对高装甲目标特别有用。<br><br>战斗预测里点开「计算过程」可以看到每一项。可以比较近卫、重装、狙击打同一个目标的差别。'}],
  },
  rt_facing:{...RT_BASE, code:'RT-3', name:'规则试玩 3 · 朝向与背击', w:22, h:12,
    rows:rtRows(22, 12, [['m',10,0,1,4], ['m',10,8,1,4], ['f',14,4,2,1], ['f',14,7,2,1]]),
    allies:[{mech:'G1', x:4, y:4, facing:'right', lv:10}, {mech:'G2', x:4, y:7, facing:'right', lv:10}, {mech:'G6', x:3, y:6, facing:'right', lv:10}],
    enemies:[{t:'grunt', x:15, y:5, facing:'left'}, {t:'grunt', x:15, y:6, facing:'left'}, {t:'raider', x:18, y:3, facing:'down'}, {t:'raider', x:18, y:8, facing:'up'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'试完了朝向。',
    summary:'这一关看：反击只打朝向范围内的敌人；被打不转身；背击既有加成又不会被反击。',
    tips:[{on:'turn:1', text:'<b>这关看什么：朝向</b><br>· 每台机体的攻击范围跟着朝向走：近战 = 前方和两侧，远程 = 只有前方。<br>· 敌方回合只能反击<b>当前朝向范围里</b>的敌人；被打的一方<b>不会转身</b>。<br>· 所以绕到背后打：背击加成（闪避 −20、暴击 +25、无视 50% 装甲），而且它反击不了你。<br><br>点一下敌人能看到它的朝向范围（红色）；选中自己的机体，移动后橙色格子是你这个朝向下能反击的范围，W A S D 可以改朝向。<br><br>特种 G6 的「冲撞」能把敌人推开 2 格，可以把它推到队友的背后位置。'}],
  },
  rt_overwatch:{...RT_BASE, code:'RT-4', name:'规则试玩 4 · 压制射击（敌我双方）', w:24, h:12,
    rows:rtRows(24, 12, [['m',11,0,2,3], ['m',11,9,2,3], ['f',6,5,2,2]]),
    allies:[{mech:'G3', x:3, y:5, facing:'right', lv:10}, {mech:'G1', x:5, y:3, facing:'right', lv:10}, {mech:'G4', x:5, y:8, facing:'right', lv:10}],
    enemies:[{t:'sniper', x:21, y:5, facing:'left'}, {t:'sniper', x:21, y:7, facing:'left'}, {t:'raider', x:16, y:3, facing:'left'}, {t:'raider', x:16, y:8, facing:'left'}, {t:'grunt', x:17, y:6, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'试完了压制射击。',
    summary:'这一关看：狙击的压制射击——对方回合第一个走进射界的机体挨一发；敌方狙击也会。',
    tips:[{on:'turn:1', text:'<b>这关看什么：压制射击</b><br>· 你的狙击 G3：移动后定好朝向，亮黄色格子是射界。敌方回合第一个走进来的敌人挨一发（每个敌方阶段 1 次，它不能反击，打完继续走）。<br>· <b>敌方狙击也会</b>：选中你的机体时，移动范围里<b>橙红色</b>的格子是敌方狙击的射界。走进去会在半路挨一发，而且挨打后不能取消移动。<br>· 每台狙击每个阶段只打 1 次：可以先让皮厚的重装 G4 走进去吸掉这一发，再让别人过去。'}],
  },
  rt_deploy:{...RT_BASE, code:'RT-5', name:'规则试玩 5 · 机库、部署、前线中继、撤回', w:26, h:14, formation:true, hangar:true, maxDeploy:3, allyFacing:'right',
    rows:rtRows(26, 14, [['m',12,0,1,5], ['m',12,9,1,5], ['f',17,3,2,2], ['f',17,9,2,2]]),
    rosterList:[{mech:'G1', lv:10}, {mech:'G2', lv:10}, {mech:'G5', lv:10}, {mech:'G3', lv:10}, {mech:'G4', lv:10}, {mech:'W2', lv:10}],
    defaultDeploy:['G2','G5','G1'],
    spots:[[1,4],[1,8],[3,6]],
    enemies:[{t:'grunt', x:20, y:4, facing:'left'}, {t:'grunt', x:20, y:9, facing:'left'}, {t:'raider', x:22, y:6, facing:'left'}, {t:'sniper', x:24, y:7, facing:'left'}, {t:'shield', x:22, y:2, facing:'left'}, {t:'grunt', x:23, y:11, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机（场上最多 3 台，其余在机库）', winText:'试完了机库和部署。',
    summary:'这一关看：同时在场上限、从机库派出、尖兵前线中继、指挥 4 格内撤回、迪奥全图部署。',
    tips:[{on:'turn:1', text:'<b>这关看什么：机库与部署</b><br>· 场上最多 3 台，其余在<b>机库</b>（指令面板里）。派出只能放在<b>部署格</b>（青色框）上，<b>派出当回合不能移动，但可以攻击</b>。<br>· <b>前线中继</b>：尖兵 G2 移动后可以在脚下插一个，周围 2 格变成部署格，后面的人就能直接在前线出击。<br>· <b>撤回</b>：在指挥 G5 的 4 格内，可以把机体撤回机库，腾出名额换人。<br>· <b>全图部署</b>（试玩）：机库里的迪奥 W2 可以派到地图上任意空格（敌方控制区除外）。<br>· 场上一台都没有就算输，机库里有人也一样。'}],
  },
  rt_startcd:{...RT_BASE, code:'RT-6', name:'规则试玩 6 · 开场冷却', w:24, h:12, formation:true, hangar:true, maxDeploy:2, allyFacing:'right', enemyLv:12,
    rows:rtRows(24, 12, [['f',10,3,2,2], ['f',10,7,2,2], ['m',15,5,1,2]]),
    rosterList:[{mech:'G1', lv:20}, {mech:'G3', lv:20}, {mech:'G4', lv:20}],
    defaultDeploy:['G1','G3'],
    spots:[[1,3],[1,7],[4,5]],
    enemies:[{t:'captain', x:20, y:5, facing:'left'}, {t:'shield', x:17, y:4, facing:'left'}, {t:'shield', x:17, y:7, facing:'left'}, {t:'grunt', x:14, y:3, facing:'left'}, {t:'grunt', x:14, y:8, facing:'left'}, {t:'raider', x:19, y:9, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'试完了开场冷却。',
    summary:'这一关看：大招（Lv20 解锁的武器）上场后 3 个回合不能用；从这台机体上场那回合算。',
    tips:[{on:'turn:1', text:'<b>这关看什么：开场冷却</b>（代替原来的「气力解锁武装」）<br>· 大招（Lv20 / Lv30 解锁的武器）默认<b>开场冷却 3 回合</b>：第 1 回合上场的，武器卡上写「第 4 回合可用」。<br>· 从<b>上场</b>那回合开始算：重装 G4 在机库里，等第 2、3 回合再派出，它的冷却从派出那回合重新算。<br>· 普通武器不受影响。以后会有各种减冷却的机制（击破减冷却、技能、藏品），具体数值作者会再调。<br><br>这关敌人等级高一点，前几回合只能靠普通武器顶住。'}],
  },
};
Object.assign(LEVELS, RULE_STAGES);
{
  const og = document.createElement('optgroup'); og.label = '规则试玩场（大众脸 · 每关一条规则）';
  for (const [k, L] of Object.entries(RULE_STAGES)){ const o = document.createElement('option'); o.value = k; o.textContent = L.name; og.appendChild(o); }
  const sel = document.querySelector('#levelSel'), anchor = sel.querySelector('optgroup[label="工具"]');
  sel.insertBefore(og, anchor);   // 放在「剧情模式」之后、「机体展示」之前（机体展示由 06 插在「工具」前面，06 在本文件之后运行）
}
