/* ---------- 武器与机体 ---------- */
const wp = o => Object.assign({range:[1,1], hit:100, critMod:0, stat:'射击', fire:'direct', dmgType:'物理', cd:0, uses:null, unlock:1, upgrades:[], afterMove:true, ignoreDef:false, special:null, power:0, desc:''}, o);
const ALLY_T = [
  {pilot:'雷萨', mech:'B1', short:'B1', trait:'portalTrait', portal:{range:7, cost:25}, tags:{势力:'影世界', 远近分类:'近战', 战斗分类:'近卫'}, hp:5000, armor:1000, eva:15, mov:5, melee:160, shoot:100, skill:140, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'近战斩击', power:3000, stat:'格斗', fire:'melee', range:[1,1]}),
    wp({name:'传送斩', stat:'格斗', fire:'melee', range:[1,4], critMod:-10, unlock:20, ignoreDef:true, special:'gamble', upgrades:[{lv:30, range:[1,Infinity], note:'Lv30 起射程变为全图'}],
        desc:'命中后 50% 造成 12000 伤害、50% 造成目标当前 HP 90% 的伤害；无视防御。无论是否命中都会传送到目标旁（击破时占据目标位置）。'}),
  ]},
  {pilot:'蕾卡', mech:'B2', short:'B2', trait:'moveEva', canFly:true, tags:{势力:'影世界', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4500, armor:0, eva:40, mov:7, melee:100, shoot:130, skill:150, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'直射炮', power:2000, fire:'direct', range:[1,5]}),
    wp({name:'曲射弹', power:1500, fire:'indirect', range:[2,7]}),
    wp({name:'影凤凰', power:5000, fire:'map', range:[1,4], unlock:20, afterMove:false, dmgType:'特殊',
        desc:'选 8 个方向之一，冲到第 5 格（必须是合法落点），攻击沿途 4 格内所有单位，包括友军。必中，不能被反击。'}),
  ]},
  {pilot:'Feena', mech:'M1', short:'M1', trait:'autoCast', command:'meteor', tags:{势力:'月球王国', 远近分类:'远程', 战斗分类:'辅助'}, hp:5000, armor:0, eva:30, mov:5, melee:90, shoot:130, skill:140, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'月光祝福', fire:'support', range:[0,4], afterMove:true, dmgType:'—',
        desc:'以自身为中心菱形 4 格内的友军（不含自己）闪避 +15、命中 +15，持续到下一个我方阶段开始，可叠加。'}),
    wp({name:'残月的余响', fire:'passive', special:'echo', power:2999, stat:'射击', range:[0,4], unlock:20,
        upgrades:[{lv:30, power:7999, note:'Lv30：威力 7999；所有非精锐友军都能延伸范围'}],
        desc:'被动。我方阶段 Feena 每次行动结束后自动释放，对范围内所有敌军造成物理伤害，必中。基础范围是自身 4 格；4 格内每个<b>月球王国</b>队友以自己为中心再延伸（Lv30 起改为月球王国队友 + 所有非精锐友军），延伸距离等于其已解锁武器的最大射程，不能接力。'}),
  ]},
  {pilot:'阿布拉德', mech:'M2', short:'M2', trait:'steadfast', tags:{势力:'月球王国', 远近分类:'近战', 战斗分类:'重装'}, hp:12000, armor:1500, eva:0, mov:4, melee:140, shoot:110, skill:100, flying:false, w:2, h:2, abilities:['guard'], weapons:[
    wp({name:'打桩臂', power:2800, stat:'格斗', fire:'melee'}),
    wp({name:'螺旋式打桩机', power:800, stat:'格斗', fire:'melee', hit:85, special:'multi', hits:10, step:10, ignoreDef:true, unlock:20,
        desc:'连续判定 10 段。首段命中 85，每段命中后 −10、未中后 +10。每段伤害 = 800 + 格斗×5÷10，无视一切伤害减免。'}),
  ]},
  {pilot:'Iris', mech:'M3', short:'M3', trait:'fieldAid', tags:{势力:'月球王国', 远近分类:'远程', 战斗分类:'辅助'}, hp:4000, armor:300, eva:20, mov:5, melee:80, shoot:120, skill:120, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'修理装置', fire:'heal', power:3000, range:[1,1], dmgType:'—',
        desc:'相邻的一台友军回复 3000 × 射击÷100 的 HP，不能对自己使用。'}),
    wp({name:'防身机枪', power:1200, fire:'direct', range:[1,2]}),
    wp({name:'月华再生', fire:'passive', special:'regen', range:[0,5], unlock:20, dmgType:'—',
        desc:'被动。我方阶段 Iris 每次行动结束后，自身 5 格内的全部友军（包括自己）回复最大 HP 的 10%。'}),
  ]},
  /* v0.26 新角色（作者设定：月球王国的「小太刀 Nagi」）。月球王国的狙击手：远处用月光狙击枪，被贴近时拔小太刀。数值和武装是 Claude 的第一版草案。 */
  {pilot:'小太刀 Nagi', mech:'M4', short:'M4', mechName:'朔夜', trait:'iaiSnipe', tags:{势力:'月球王国', 远近分类:'远程', 战斗分类:'狙击'}, hp:4200, armor:300, eva:25, mov:5, melee:150, shoot:165, skill:165, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'月光狙击枪', power:3000, fire:'direct', range:[3,8], hit:125, afterMove:false, dmgType:'光束'}),
    wp({name:'小太刀', power:2400, stat:'格斗', fire:'melee', critMod:15}),
    wp({name:'弦月·一闪', power:4200, fire:'direct', range:[4,10], hit:120, critMod:10, cd:2, unlock:20, afterMove:false, dmgType:'光束', special:'markBreak',
        desc:'命中后直接挂一层 −20% 破防（标记类）。'}),
  ]},
  {pilot:'刹那', mech:'CB1', short:'CB1', trait:'gundam', tags:{势力:'天人', 远近分类:'近战', 战斗分类:'近卫'}, hp:4800, armor:700, eva:30, mov:6, melee:170, shoot:120, skill:160, flying:false, w:1, h:1, abilities:['followUp'], weapons:[
    wp({name:'GN 剑（剑模式）', power:3000, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'GN 长短刃', power:2400, stat:'格斗', fire:'melee', critMod:20, dmgType:'光束'}),
    wp({name:'GN 剑（步枪模式）', power:1500, fire:'direct', range:[1,3], dmgType:'光束'}),
    wp({name:'七剑·TRANS-AM 乱舞', power:1200, stat:'格斗', fire:'melee', hit:95, special:'multi', hits:7, step:10, unlock:20, cd:2, dmgType:'光束',
        upgrades:[],
        desc:'连续 7 段判定，首段命中 95，命中后 −10、未中后 +10；每段 1200 + 格斗×5÷10，正常经过减免（装甲对多段很有效）。'}),
  ]},
  {pilot:'洛克昂', mech:'CB2', short:'CB2', trait:'overflowCrit', tags:{势力:'天人', 远近分类:'远程', 战斗分类:'狙击'}, hp:4000, armor:300, eva:10, mov:4, melee:80, shoot:160, skill:160, flying:false, w:1, h:1, abilities:['gnShield'], weapons:[
    wp({name:'GN 狙击步枪', power:3000, fire:'direct', range:[3,7], hit:130, afterMove:false, dmgType:'光束'}),
    wp({name:'GN 光束手枪', power:900, fire:'direct', range:[1,2], hit:130, dmgType:'光束', desc:'洛克昂唯一可以移动后使用的武器（自卫用）。'}),
    wp({name:'GN 导弹', power:1800, fire:'indirect', range:[2,5], hit:130, afterMove:false, uses:2}),
    wp({name:'TRANS-AM 狙击', power:3500, fire:'direct', range:[4,9], hit:130, afterMove:false, cd:2, unlock:20, special:'markBreak', dmgType:'光束',
        upgrades:[{lv:30, range:[4,12], again:true, note:'Lv30：射程 4–12，击破目标后可以再攻击一次（不能移动）'}],
        desc:'命中后直接挂一层背面破防（−20%），不管从哪个方向打。'}),
  ]},
  {pilot:'阿雷路亚', mech:'CB3', short:'CB3', trait:'hallelujah', canFly:true, tags:{势力:'天人', 远近分类:'近战', 战斗分类:'特种'}, hp:4500, armor:500, eva:25, mov:6, melee:140, shoot:130, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'GN 冲撞', power:1200, stat:'格斗', fire:'melee', special:'push', push:2,
        desc:'命中后把目标沿攻击方向推开 2 格。撞到单位、障碍或地图边缘时停下，双方各受 800 碰撞伤害；地面单位被推进裂谷直接坠毁。'}),
    wp({name:'GN 冲锋枪', power:1400, fire:'direct', range:[1,3]}),
  ]},
  {pilot:'提耶利亚', mech:'CB4', short:'CB4', trait:'veda', tags:{势力:'天人', 远近分类:'远程', 战斗分类:'重装'}, hp:6000, armor:1200, eva:0, mov:4, melee:120, shoot:150, skill:150, flying:false, w:1, h:1, abilities:[], transform:'nadleeh', weapons:[
    wp({name:'GN 火箭筒', power:2600, fire:'direct', range:[2,6], dmgType:'光束'}),
    wp({name:'GN 加农炮', power:1600, fire:'direct', range:[1,3], dmgType:'光束'}),
  ]},
  /* ================= v0.16 新势力 ================= */
  /* ---- 克莱因派（SEED） ---- */
  {pilot:'拉克丝', mech:'S1', short:'S1', mechName:'自由', trait:'seed', canFly:true, tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'特种'}, hp:5200, armor:700, eva:35, mov:6, melee:150, shoot:170, skill:180, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束军刀', power:2600, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'高能光束步枪', power:2200, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'电磁炮', power:2000, fire:'direct', range:[2,6]}),
    wp({name:'METEOR 全弹发射', power:2000, fire:'direct', range:[2,6], special:'lock', lockN:5, cd:2, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, lockN:8, disarm:true, note:'Lv30：最多锁定 8 台；被命中的目标「武装损坏」，下一个敌方阶段不能攻击'}],
        desc:'多重锁定：在射程内选择最多 5 台敌机（直射，需要视线），逐一攻击。目标不能反击，也不能选择防御或回避。'}),
    wp({name:'超级 DRAGOON', power:800, fire:'indirect', range:[2,8], special:'funnel', hits:16, cd:2, unlock:30, dmgType:'光束',
        desc:'浮游炮：发射后从 8 个随机方向攻击 16 次，目标闪避减半。不需要视线。Lv30 解锁。'}),
  ]},
  {pilot:'卡嘉莉', mech:'S2', short:'S2', mechName:'晓', trait:'orbLion', canFly:true, tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'重装'}, hp:7000, armor:1200, eva:10, mov:5, melee:130, shoot:140, skill:130, flying:false, w:1, h:1, abilities:['beamReflect'], weapons:[
    wp({name:'光束步枪', power:1700, fire:'direct', range:[1,4], dmgType:'光束'}),
    wp({name:'光束军刀', power:1900, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'DRAGOON', power:600, fire:'indirect', range:[2,6], special:'funnel', hits:16, cd:2, dmgType:'光束',
        desc:'浮游炮：发射后从 8 个随机方向攻击 16 次，目标闪避减半；每段按随机方向算正面 / 侧面 / 背面加成，不附加破防。不需要视线。'}),
    wp({name:'八咫之守', fire:'support', range:[0,3], buff:{beamRed:40}, cd:2, unlock:20, dmgType:'—',
        desc:'3 格内的其他友军光束减伤 40%，持续到下一个我方阶段开始。'}),
  ]},
  {pilot:'露娜玛丽亚', mech:'S3', short:'S3', mechName:'脉冲', trait:'erratic', canFly:true, tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4600, armor:400, eva:30, mov:7, melee:130, shoot:140, skill:130, flying:true, w:1, h:1, abilities:['coreSplit'], weapons:[
    wp({name:'光束步枪', power:1600, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'剑装·对舰刀', power:2600, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'炮装·高能光束炮', power:2800, fire:'direct', range:[2,7], afterMove:false, dmgType:'光束'}),
  ]},
  {pilot:'志保', mech:'S4', short:'S4', mechName:'DEEP Arms', trait:'focusFire', tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'狙击'}, hp:4200, armor:400, eva:15, mov:5, melee:90, shoot:160, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'双联光束炮', power:2800, fire:'direct', range:[2,7], hit:115, afterMove:false, dmgType:'光束'}),
    wp({name:'光束突击步枪', power:1400, fire:'direct', range:[1,4], dmgType:'光束'}),
    wp({name:'光束军刀', power:1400, stat:'格斗', fire:'melee', dmgType:'光束'}),
  ]},
  {pilot:'史黛拉', mech:'S5', short:'S5', mechName:'盖亚', trait:'extended', tags:{势力:'克莱因派', 远近分类:'近战', 战斗分类:'近卫'}, hp:4800, armor:600, eva:30, mov:6, melee:165, shoot:120, skill:140, flying:false, w:1, h:1, abilities:['beastMode'], weapons:[
    wp({name:'光束翼刃', power:2600, stat:'格斗', fire:'melee', critMod:10, dmgType:'光束'}),
    wp({name:'光束突击炮', power:1500, fire:'direct', range:[1,3], dmgType:'光束'}),
    wp({name:'毁灭·全方位炮击', power:5000, fire:'map', shape:'burst', rad:3, afterMove:false, cd:3, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, rad:4, note:'Lv30：半径 4'}], desc:'以自身为中心，3 格内的所有单位（包括友军）受到攻击。'}),
  ]},
  {pilot:'希尔妲', mech:'S6', short:'S6', mechName:'DOM', trait:'jetStream', tags:{势力:'克莱因派', 远近分类:'近战', 战斗分类:'近卫'}, hp:5500, armor:800, eva:20, mov:6, melee:150, shoot:130, skill:140, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束军刀', power:2300, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'巨型光束火箭筒', power:2400, fire:'direct', range:[2,5], dmgType:'光束'}),
  ]},
  {pilot:'阿莎琪', mech:'S7', short:'S7', mechName:'M1 异端', trait:'trio', tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'尖兵'}, hp:3800, armor:300, eva:30, mov:7, melee:110, shoot:125, skill:110, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束步枪', power:1400, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'光束军刀', power:1500, stat:'格斗', fire:'melee', dmgType:'光束'}),
  ]},
  {pilot:'茱莉', mech:'S8', short:'S8', mechName:'M1 异端', trait:'trio', tags:{势力:'克莱因派', 远近分类:'远程', 战斗分类:'辅助'}, hp:3800, armor:300, eva:25, mov:6, melee:100, shoot:130, skill:120, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束步枪', power:1400, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'光束军刀', power:1300, stat:'格斗', fire:'melee', dmgType:'光束'}),
  ]},
  /* ---- 预防者（高达 W） ---- */
  {pilot:'希罗', mech:'W1', short:'W1', mechName:'飞翼零式', trait:'zero', canFly:true, tags:{势力:'预防者', 远近分类:'远程', 战斗分类:'狙击'}, hp:5000, armor:600, eva:30, mov:7, melee:140, shoot:170, skill:170, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束军刀', power:2400, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'破坏步枪（单发）', power:3000, fire:'direct', range:[2,6], cd:1, dmgType:'光束'}),
    wp({name:'机枪', power:1000, fire:'direct', range:[1,2]}),
    wp({name:'双联破坏步枪', power:6500, fire:'map', shape:'line', len:9, afterMove:false, cd:3, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, width:3, note:'Lv30：光束宽 3 格'}], desc:'选 8 个方向之一，直线 9 格内的所有单位（包括友军）受到攻击。自己不移动。'}),
  ]},
  {pilot:'迪奥', mech:'W2', short:'W2', mechName:'死神', trait:'hyperJammer', tags:{势力:'预防者', 远近分类:'近战', 战斗分类:'近卫'}, hp:4600, armor:500, eva:35, mov:6, melee:165, shoot:110, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束镰刀', power:2900, stat:'格斗', fire:'melee', critMod:15, dmgType:'光束'}),
    wp({name:'头部火神炮', power:800, fire:'direct', range:[1,2]}),
    wp({name:'死神镰刀·斩首', power:2600, stat:'格斗', fire:'melee', special:'execute', exec:25, cd:2, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, exec:35, note:'Lv30：斩首线 35%'}], desc:'斩首：命中后如果目标剩余 HP 不超过最大 HP 的 25%，直接击破。'}),
  ]},
  {pilot:'特洛瓦', mech:'W3', short:'W3', mechName:'重武装', trait:'silentBlade', tags:{势力:'预防者', 远近分类:'远程', 战斗分类:'重装'}, hp:5600, armor:800, eva:25, mov:5, melee:110, shoot:165, skill:160, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'双联加特林', power:500, fire:'direct', range:[1,4], special:'multi', hits:8, step:5,
        desc:'连续 8 段判定，首段命中 100，命中后 −5、未中后 +5；每段 500 + 射击×5÷10，正常经过减免。'}),
    wp({name:'胸部加特林', power:1200, fire:'direct', range:[1,2]}),
    wp({name:'微型导弹', power:1600, fire:'indirect', range:[2,5], uses:3}),
    wp({name:'军刀', power:1200, stat:'格斗', fire:'melee'}),
    wp({name:'全弹发射', power:4000, fire:'map', shape:'burst', rad:3, iff:true, afterMove:false, uses:1, unlock:20,
        upgrades:[{lv:30, rad:4, note:'Lv30：半径 4'}], desc:'以自身为中心，3 格内的所有敌机受到攻击（敌我识别）。每场 1 次。'}),
  ]},
  {pilot:'卡托尔', mech:'W4', short:'W4', mechName:'沙漠', trait:'spaceHeart', tags:{势力:'预防者', 远近分类:'近战', 战斗分类:'辅助'}, hp:6000, armor:900, eva:20, mov:5, melee:140, shoot:120, skill:160, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'热能双刀', power:2500, stat:'格斗', fire:'melee'}),
    wp({name:'光束机枪', power:1300, fire:'direct', range:[1,3], dmgType:'光束'}),
    wp({name:'十字粉碎', power:3000, stat:'格斗', fire:'melee', critMod:10, cd:2}),
    wp({name:'马格纳克队支援', fire:'support', range:[0,4], buff:{hit:10, dmg:15}, cd:2, unlock:20, dmgType:'—',
        upgrades:[{lv:30, range:[0,6], note:'Lv30：范围 6'}], desc:'4 格内的其他友军命中 +10、伤害 +15%，持续到下一个我方阶段开始。'}),
  ]},
  {pilot:'五飞', mech:'W5', short:'W5', mechName:'双头龙', trait:'justice', tags:{势力:'预防者', 远近分类:'近战', 战斗分类:'近卫'}, hp:5200, armor:800, eva:25, mov:6, melee:170, shoot:110, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束偃月刀', power:2700, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'龙爪', power:2000, stat:'格斗', fire:'melee', range:[1,2], special:'pull', pull:1,
        desc:'命中后把目标向自己拉近 1 格（被挡住就不动）。'}),
    wp({name:'火焰喷射器', power:1500, fire:'direct', range:[1,2]}),
    wp({name:'双头龙·龙卷', power:1300, stat:'格斗', fire:'melee', hit:95, special:'multi', hits:6, step:10, cd:2, unlock:20, dmgType:'光束',
        desc:'连续 6 段判定，首段命中 95，命中后 −10、未中后 +10；每段 1300 + 格斗×5÷10。'}),
  ]},
  {pilot:'杰克斯', mech:'W6', short:'W6', mechName:'艾比安', trait:'lightning', canFly:true, tags:{势力:'预防者', 远近分类:'近战', 战斗分类:'特种'}, hp:5500, armor:700, eva:30, mov:7, melee:175, shoot:120, skill:175, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束剑', power:3200, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'热能鞭', power:1800, stat:'格斗', fire:'melee', range:[1,3], critMod:-10}),
    wp({name:'光束剑·横扫', power:4500, stat:'格斗', fire:'map', shape:'burst', rad:2, iff:true, cd:2, unlock:20, dmgType:'光束',
        desc:'以自身为中心，2 格内的所有敌机受到攻击（敌我识别）。可以移动后使用。'}),
  ]},
  {pilot:'诺茵', mech:'W7', short:'W7', mechName:'金牛座', trait:'hitAway', canFly:true, tags:{势力:'预防者', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4200, armor:300, eva:35, mov:8, melee:110, shoot:135, skill:140, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束步枪', power:1500, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'机炮', power:900, fire:'direct', range:[1,2]}),
  ]},
  /* ---- ATX 小队（机战 OG） ---- */
  {pilot:'响介', mech:'A1', short:'A1', mechName:'古铁', trait:'allIn', tags:{势力:'ATX', 远近分类:'近战', 战斗分类:'近卫'}, hp:6500, armor:1300, eva:5, mov:5, melee:170, shoot:120, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'三连机炮', power:1200, fire:'direct', range:[1,3]}),
    wp({name:'左轮打桩机', power:3200, stat:'格斗', fire:'melee', hit:90, critMod:10}),
    wp({name:'方形钢弹', power:2800, stat:'格斗', fire:'melee', range:[1,2], hit:85}),
    wp({name:'切札·全力冲刺', power:5500, stat:'格斗', fire:'map', iff:true, afterMove:false, cd:3, unlock:20,
        desc:'选 8 个方向之一，冲到第 5 格（必须是合法落点），攻击沿途 4 格内的敌机（敌我识别）。'}),
  ]},
  {pilot:'艾克赛琳', mech:'A2', short:'A2', mechName:'白骑士', trait:'lucky', canFly:true, tags:{势力:'ATX', 远近分类:'远程', 战斗分类:'狙击'}, hp:4200, armor:200, eva:35, mov:6, melee:90, shoot:160, skill:160, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'嚎叫发射器·光束', power:2400, fire:'direct', range:[2,7], dmgType:'光束'}),
    wp({name:'嚎叫发射器·实弹', power:2400, fire:'direct', range:[2,7], desc:'和光束模式同一把武器，打光束抗性高的敌人时切换到这个。'}),
    wp({name:'分裂导弹', power:1600, fire:'indirect', range:[2,6], uses:3}),
    wp({name:'嚎叫发射器·全开', power:2600, fire:'direct', range:[2,7], special:'lock', lockN:3, cd:2, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, lockN:4, note:'Lv30：最多锁定 4 台'}], desc:'多重锁定：在射程内选择最多 3 台敌机逐一攻击，目标不能反击、防御或回避。'}),
  ]},
  {pilot:'拉米亚', mech:'A3', short:'A3', mechName:'安杰尔格', trait:'wSeries', canFly:true, tags:{势力:'ATX', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4800, armor:500, eva:35, mov:7, melee:140, shoot:150, skill:170, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'牛舌步枪', power:2000, fire:'direct', range:[1,5], dmgType:'光束'}),
    wp({name:'幻影剑', power:2400, stat:'格斗', fire:'melee', critMod:10, dmgType:'光束'}),
    wp({name:'溅射破坏者', power:1800, fire:'direct', range:[1,4], special:'splash', cd:1, dmgType:'光束', desc:'溅射：与目标相邻的其他敌机受到本次伤害的 50%。'}),
    wp({name:'幻影凤凰', power:4800, fire:'direct', range:[2,6], critMod:20, cd:3, unlock:20, dmgType:'光束',
        upgrades:[{lv:30, again:true, note:'Lv30：击破目标后可以再攻击一次（不能移动）'}]}),
  ]},
  {pilot:'布鲁克林', mech:'A4', short:'A4', mechName:'古兰森三型', trait:'hotBlood', tags:{势力:'ATX', 远近分类:'近战', 战斗分类:'重装'}, hp:9000, armor:1500, eva:5, mov:5, melee:160, shoot:110, skill:130, flying:false, w:1, h:1, abilities:['guard'], weapons:[
    wp({name:'回旋拳', power:1800, fire:'direct', range:[1,3]}),
    wp({name:'计都罗睺剑', power:3000, stat:'格斗', fire:'melee'}),
  ]},
  {pilot:'库斯哈', mech:'A5', short:'A5', mechName:'龙虎王', trait:'juice', tags:{势力:'ATX', 远近分类:'远程', 战斗分类:'辅助'}, hp:6000, armor:800, eva:20, mov:5, melee:140, shoot:150, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'念动治愈', fire:'heal', power:2800, range:[1,2], dmgType:'—', desc:'2 格内的一台友军回复 2800 × 射击÷100 的 HP。'}),
    wp({name:'龙王破山剑', power:2800, stat:'格斗', fire:'melee'}),
    wp({name:'龙雷闪', power:1800, fire:'indirect', range:[2,6], dmgType:'特殊', desc:'念动力攻击，特殊伤害。'}),
  ]},
  /* ---- 秘银·乌鲁兹小队（全金属狂潮；v0.26 起势力名「米斯里尔」改为「秘银」） ---- */
  {pilot:'宗介', mech:'U7', short:'U7', mechName:'强弩', trait:'pro', shield:4000, shieldLv:20, shieldName:'λ 力场', lambdaAwaken:2, awakenSwap:{'单分子刀':'隔空 λ 拳', '散弹炮':'λ 驱动·散弹炮'}, tags:{势力:'秘银', 远近分类:'远程', 战斗分类:'特种'}, hp:5000, armor:700, eva:30, mov:6, melee:150, shoot:155, skill:170, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'散弹炮', power:1600, fire:'direct', range:[1,3], critMod:10}),
    wp({name:'单分子刀', power:2200, stat:'格斗', fire:'melee',
        awaken:{name:'λ 单分子刀', power:3400, dmgType:'特殊', lambda:true, desc:'λ 觉醒后的单分子刀：特殊伤害，0 CD。'}}),
    wp({name:'榴弹发射器', power:1400, fire:'indirect', range:[2,5], uses:4}),
    wp({name:'λ 驱动·散弹炮', power:5600, fire:'direct', range:[1,4], hit:90, cd:3, unlock:20, dmgType:'特殊', lambda:true,
        upgrades:[{lv:30, range:[1,6], note:'Lv30：射程 1–6'}], desc:'特殊伤害：无视光束 / 物理抗性，只会被护盾类效果抵消。'}),
    wp({name:'隔空 λ 拳', power:3600, stat:'格斗', fire:'melee', range:[1,3], cd:2, unlock:20, dmgType:'特殊', lambda:true,
        desc:'近战特殊攻击：隔着最多 3 格用 λ 力场打出的拳，不需要视线。特殊伤害，只会被护盾类效果抵消。'}),
  ]},
  {pilot:'克鲁兹', mech:'U6', short:'U6', mechName:'M9·狙击', trait:'longShot', tags:{势力:'秘银', 远近分类:'远程', 战斗分类:'狙击'}, hp:3800, armor:200, eva:20, mov:5, melee:90, shoot:175, skill:175, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'76mm 狙击炮', power:3200, fire:'direct', range:[3,9], hit:120, afterMove:false}),
    wp({name:'突击步枪', power:1300, fire:'direct', range:[1,4]}),
    wp({name:'单分子刀', power:1200, stat:'格斗', fire:'melee'}),
    wp({name:'超长距离狙击', power:4000, fire:'direct', range:[5,14], hit:120, critMod:10, afterMove:false, cd:2, unlock:20,
        upgrades:[{lv:30, again:true, note:'Lv30：击破目标后可以再攻击一次（不能移动）'}]}),
  ]},
  {pilot:'真织', mech:'U2', short:'U2', mechName:'M9·指挥', trait:'squadLead', tags:{势力:'秘银', 远近分类:'远程', 战斗分类:'辅助'}, hp:4800, armor:500, eva:25, mov:6, melee:120, shoot:145, skill:150, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'突击步枪', power:1400, fire:'direct', range:[1,4]}),
    wp({name:'导弹发射器', power:1800, fire:'indirect', range:[2,6], uses:4, special:'splash', desc:'溅射：与目标相邻的其他敌机受到本次伤害的 50%。'}),
    wp({name:'单分子刀', power:1400, stat:'格斗', fire:'melee'}),
  ]},
  {pilot:'克鲁佐', mech:'U1', short:'U1', mechName:'M9·猎鹰', trait:'falke', tags:{势力:'秘银', 远近分类:'近战', 战斗分类:'近卫'}, hp:5000, armor:600, eva:25, mov:6, melee:150, shoot:165, skill:170, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'狙击步枪', power:2800, fire:'direct', range:[2,8], hit:115}),
    wp({name:'单分子刀', power:2400, stat:'格斗', fire:'melee', critMod:10}),
    wp({name:'散弹枪', power:1300, fire:'direct', range:[1,2]}),
    wp({name:'精确连射', power:1800, fire:'direct', range:[2,8], special:'multi', hits:4, step:10, cd:2, unlock:20,
        desc:'连续 4 段判定，首段命中 100，命中后 −10、未中后 +10；每段 1800 + 射击×5÷10。'}),
  ]},
  {pilot:'杨', mech:'U8', short:'U8', mechName:'M9·侦察', trait:'ecs', tags:{势力:'秘银', 远近分类:'远程', 战斗分类:'尖兵'}, hp:4000, armor:300, eva:30, mov:7, melee:120, shoot:130, skill:130, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'突击步枪', power:1300, fire:'direct', range:[1,4]}),
    wp({name:'单分子刀', power:1500, stat:'格斗', fire:'melee'}),
    wp({name:'反坦克导弹', power:2200, fire:'indirect', range:[2,5], uses:2}),
  ]},
];
function cmdOnly(pilot, mech, mechName, faction, command){
  return {pilot, mech, short:mech, mechName, commandOnly:true, command, tags:{势力:faction, 远近分类:'—', 战斗分类:'指挥'}, hp:1, armor:0, eva:0, mov:0, melee:0, shoot:0, skill:0, flying:false, w:1, h:1, abilities:[], weapons:[]};
}
/* ---------- v0.24 晋升武装 ----------
   规则：普通档晋升只给属性 + 被动（PROMO_PASSIVE）；骨干和精锐 Lv20 多一个武装；
   Lv30 只有精锐再多一个、比 Lv20 武装更强的武装，同时精锐 / 骨干原本的 Lv20 武装提升一档（见 tierUp）。 */
const PROMO_WEAPONS = {
  B1:[wp({name:'影界·万刃归一', power:9000, stat:'格斗', fire:'map', shape:'burst', rad:3, iff:true, afterMove:false, cd:4, unlock:30, dmgType:'特殊',
      desc:'以自身为中心 3 格内的所有敌机受到特殊伤害（不伤友军）。配合「传送」先跳进敌阵中心再发动。'})],
  CB1:[wp({name:'GN 剑 III·量子跃迁斩', power:7500, stat:'格斗', fire:'melee', range:[1,5], hit:110, cd:3, unlock:30, dmgType:'光束', again:true, noCounter:true,
      desc:'量子化跃迁到 5 格内的目标面前斩击，目标不能反击；击破后可以原地再攻击一次。'})],
  W1:[wp({name:'零式·旋转破坏步枪', power:9500, fire:'map', shape:'burst', rad:4, iff:true, afterMove:false, cd:4, unlock:30, dmgType:'光束',
      desc:'展开双联破坏步枪原地旋转扫射：以自身为中心 4 格内的所有敌机受到攻击（不伤友军）。'})],
  U7:[wp({name:'λ 驱动·极限放出', power:9000, fire:'direct', range:[1,5], hit:95, cd:3, unlock:30, dmgType:'特殊', lambda:true,
      desc:'把 λ 驱动器的输出推到极限的一击。特殊伤害；λ 觉醒后冷却变为 0。'})],
  M1:[wp({name:'满月·月蚀', fire:'passive', special:'echo', power:11999, stat:'射击', range:[0,4], cd:3, unlock:30, dmgType:'特殊',
      desc:'被动，冷却 3 回合。冷却好时代替残月的余响自动释放：范围和延伸规则相同，威力 11999 的特殊伤害（只会被护盾类效果抵消）。'})],
  CB4:[wp({name:'GN 加农炮·高压全弹', power:5500, fire:'map', shape:'line', len:8, afterMove:false, cd:3, unlock:20, dmgType:'光束',
      desc:'把 GN 加农炮和火箭筒的输出全部集中，选 8 个方向之一，直线 8 格内的所有单位（包括友军）受到攻击。'})],
};
ALLY_T.forEach(t => {
  if (PROMO_WEAPONS[t.mech]) t.weapons.push(...PROMO_WEAPONS[t.mech]);
  if (PROMO_PASSIVE[t.mech]) t.abilities.push(PROMO_PASSIVE[t.mech]);
  /* v0.25 分类通用机制：近卫 DASH、狙击援护攻击、重装援护防御；卡嘉莉的援护防御在我方阶段也能用 */
  const cls = t.tags.战斗分类, add = k => { if (!t.abilities.includes(k)) t.abilities.push(k); };
  if (cls === '近卫') add('dash');
  if (cls === '狙击') add('supportAtk');
  if (cls === '重装') add('guard');
  if (t.mech === 'S2') add('guardAtk');
});
const FORMS = {
  /* icon：这个变身形态用哪个图标（tools/roster.mjs 也读这个字段来对账）。 */
  nadleeh:{name:'纳德雷', icon:'CB4N', armor:300, eva:35, mov:6, weapons:[
    wp({name:'GN 光束剑', power:2200, stat:'格斗', fire:'melee', dmgType:'光束'}),
    wp({name:'GN 光束手枪', power:1400, fire:'direct', range:[1,3], dmgType:'光束'}),
    wp({name:'Trial System', fire:'device', special:'trial', range:[1,4], cd:3, unlock:20, dmgType:'—',
        desc:'骇入 4 格内的一台敌机：它在下一个敌方阶段不能行动，在此之前也不能反击、不能回避或防御。'}),
  ]},
};
const DEBRIS_T = {pilot:'', mech:'陨石残骸', short:'岩', noEvade:true, hp:1000, armor:0, eva:0, mov:0, melee:0, shoot:0, skill:0, flying:false, w:1, h:1, abilities:[], weapons:[]};
const COMMANDS = {
  meteor:{name:'陨石召唤', kind:'area', cd:3, delay:2, size:3, dmg:7999,
    desc:'指定一个 3×3 区域，2 回合后的我方阶段开始时陨石落下：对区域内敌我所有单位造成 7999 物理伤害（必中，不暴击，会经过减免），区域内的空格生成 HP 1000 的陨石残骸。冷却 3 回合。'},
};
const ENEMY_SUPPORT = ['sniper', 'funnel'];   // v0.25：会援护攻击的敌方机型
const ENEMY_T = {
  flagship:{pilot:'敌将', mech:'指挥舰', short:'旗舰', weak:{近战:30, 曲射:-30}, noEvade:true, hp:40000, armor:1200, eva:0, mov:3, melee:100, shoot:150, skill:150, flying:true, w:3, h:3, abilities:['barrier'], weapons:[
    wp({name:'主炮', power:3000, fire:'direct', range:[2,8], cd:1, dmgType:'光束'}),
    wp({name:'对空机枪', power:1600, fire:'direct', range:[1,3]}),
    wp({name:'舰载导弹', power:2200, fire:'indirect', range:[3,9], cd:2}),
  ]},
  hound:{pilot:'敌兵', mech:'猎犬', short:'猎', weak:{光束:30}, hp:3000, armor:200, eva:10, mov:5, melee:90, shoot:100, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'猎枪', power:500, fire:'direct', range:[1,3]}),
  ]},
  drone:{pilot:'敌兵', mech:'无人机', short:'机', weak:{范围:50}, hp:2000, armor:100, eva:25, mov:7, melee:60, shoot:90, skill:100, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'机枪', power:450, fire:'direct', range:[1,2]}),
  ]},
  ironwall:{pilot:'敌兵', mech:'铁壁', short:'铁', weak:{多段:30}, noEvade:true, hp:9950, armor:800, eva:0, mov:0, melee:120, shoot:80, skill:100, flying:false, w:1, h:1, abilities:['frontArmor'], weapons:[]},
  raider:{pilot:'敌兵', mech:'突击兵', short:'突', weak:{多段:30}, hp:3000, armor:300, eva:10, mov:6, melee:110, shoot:90, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'突刺', power:1000, stat:'格斗', fire:'melee'}),
  ]},
  turret:{pilot:'敌兵', mech:'固定炮台', short:'台', weak:{光束:30}, noEvade:true, hp:3500, armor:400, eva:0, mov:0, melee:60, shoot:110, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'迫击炮', power:1000, fire:'indirect', range:[3,7]}),
  ]},
  shield:{pilot:'敌兵', mech:'盾卫', short:'盾', weak:{背面:30}, hp:6000, armor:600, eva:5, mov:3, melee:110, shoot:80, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'盾击', power:1000, stat:'格斗', fire:'melee'}),
  ]},
  pursuer:{pilot:'敌兵', mech:'追击炮车', short:'追', weak:{范围:30}, chase:true, hp:9000, armor:900, eva:0, mov:3, melee:80, shoot:100, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'追踪炮', power:2200, fire:'indirect', range:[2,6]}),
  ]},
  fighter:{pilot:'敌兵', mech:'战斗机', short:'战', weak:{直射:20, 曲射:-30}, hp:2600, armor:150, eva:30, mov:6, melee:90, shoot:110, skill:110, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'机炮', power:1200, fire:'direct', range:[1,2]}),
    wp({name:'空对地导弹', power:1500, fire:'indirect', range:[2,4], uses:4}),
  ]},
  grunt:{pilot:'敌兵', mech:'量产机', short:'量', weak:{}, hp:3600, armor:350, eva:10, mov:5, melee:110, shoot:100, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'格斗斧', power:1400, stat:'格斗', fire:'melee'}),
    wp({name:'突击步枪', power:1200, fire:'direct', range:[1,4]}),
  ]},
  artillery:{pilot:'敌兵', mech:'炮击机', short:'炮', weak:{近战:40}, hp:4200, armor:450, eva:5, mov:3, melee:80, shoot:120, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'近防机枪', power:900, fire:'direct', range:[1,2]}),
    wp({name:'榴弹炮', power:2000, fire:'indirect', range:[3,7], cd:1}),
  ]},
  fortress:{pilot:'敌将', mech:'重装要塞', short:'要塞', weak:{光束:30, 物理:-20}, hp:15000, armor:800, eva:0, mov:3, melee:130, shoot:130, skill:120, flying:false, w:2, h:2, abilities:['barrier'], weapons:[
    wp({name:'重拳', power:2200, stat:'格斗', fire:'melee'}),
    wp({name:'主炮', power:2500, fire:'direct', range:[2,6], cd:1}),
  ]},
  /* ---- v0.16 新敌人：每种都有不同的弱点 / 抗性 / 能力 ---- */
  beamcoat:{pilot:'敌兵', mech:'光束涂层机', short:'涂', weak:{物理:30, 光束:-60}, hp:4000, armor:400, eva:10, mov:5, melee:110, shoot:100, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'实弹步枪', power:1300, fire:'direct', range:[1,4]}),
    wp({name:'格斗刀', power:1300, stat:'格斗', fire:'melee'}),
  ]},
  phase:{pilot:'敌兵', mech:'相转移装甲机', short:'相', weak:{光束:40, 物理:-60}, hp:4200, armor:300, eva:15, mov:5, melee:110, shoot:110, skill:100, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'光束步枪', power:1400, fire:'direct', range:[1,4], dmgType:'光束'}),
    wp({name:'光束军刀', power:1500, stat:'格斗', fire:'melee', dmgType:'光束'}),
  ]},
  stealth:{pilot:'敌兵', mech:'隐形侦察机', short:'隐', weak:{范围:50}, hp:2600, armor:100, eva:30, mov:6, melee:80, shoot:120, skill:110, flying:false, w:1, h:1, abilities:['stealth'], weapons:[
    wp({name:'狙击枪', power:1500, fire:'direct', range:[2,6]}),
  ]},
  swarm:{pilot:'敌兵', mech:'蜂群无人机', short:'蜂', weak:{范围:100, 多段:50}, hp:1400, armor:0, eva:45, mov:7, melee:60, shoot:90, skill:100, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'微型机枪', power:600, fire:'direct', range:[1,2]}),
  ]},
  beetle:{pilot:'敌兵', mech:'甲虫型重机', short:'甲', weak:{背面:40}, noEvade:true, hp:7000, armor:900, eva:0, mov:4, melee:130, shoot:80, skill:100, flying:false, w:1, h:1, abilities:['frontArmor'], weapons:[
    wp({name:'角撞', power:1800, stat:'格斗', fire:'melee'}),
  ]},
  sniper:{pilot:'敌兵', mech:'狙击机', short:'狙', weak:{近战:50}, hp:3200, armor:200, eva:10, mov:4, melee:70, shoot:130, skill:120, flying:false, w:1, h:1, abilities:[], weapons:[
    wp({name:'长程光束炮', power:2200, fire:'direct', range:[4,9], hit:110, afterMove:false, dmgType:'光束'}),
  ]},
  bomber:{pilot:'敌兵', mech:'自爆机', short:'爆', weak:{曲射:30}, hp:3000, armor:200, eva:15, mov:6, melee:100, shoot:80, skill:100, flying:false, w:1, h:1, abilities:['selfDestruct'], weapons:[
    wp({name:'撞击', power:800, stat:'格斗', fire:'melee'}),
  ]},
  mirror:{pilot:'敌兵', mech:'镜面装甲机', short:'镜', weak:{近战:40}, hp:4500, armor:500, eva:10, mov:4, melee:110, shoot:110, skill:100, flying:false, w:1, h:1, abilities:['beamReflect'], weapons:[
    wp({name:'实弹炮', power:1500, fire:'direct', range:[1,5]}),
  ]},
  regen:{pilot:'敌兵', mech:'自修复机', short:'生', weak:{暴击:50}, hp:6000, armor:400, eva:10, mov:4, melee:120, shoot:100, skill:100, flying:false, w:1, h:1, abilities:['regen'], weapons:[
    wp({name:'熔断爪', power:1600, stat:'格斗', fire:'melee'}),
    wp({name:'散弹', power:1200, fire:'direct', range:[1,3]}),
  ]},
  tank:{pilot:'敌将', mech:'重型坦克', short:'坦', weak:{曲射:50, 背面:20, 直射:-30}, noEvade:true, hp:14000, armor:2000, eva:0, mov:3, melee:100, shoot:130, skill:110, flying:false, w:2, h:2, abilities:[], weapons:[
    wp({name:'主炮', power:2400, fire:'direct', range:[2,7], cd:1}),
    wp({name:'同轴机枪', power:1000, fire:'direct', range:[1,2]}),
  ]},
  jammer:{pilot:'敌兵', mech:'电子战机', short:'扰', weak:{光束:30}, hp:2800, armor:150, eva:20, mov:5, melee:70, shoot:100, skill:120, flying:false, w:1, h:1, abilities:['jamAura'], weapons:[
    wp({name:'电磁脉冲', power:900, fire:'direct', range:[1,3]}),
  ]},
  captain:{pilot:'敌将', mech:'指挥官机', short:'指', weak:{背面:40}, hp:5500, armor:600, eva:15, mov:5, melee:120, shoot:120, skill:120, flying:false, w:1, h:1, abilities:['commandAura'], weapons:[
    wp({name:'光束步枪', power:1500, fire:'direct', range:[1,4], dmgType:'光束'}),
    wp({name:'光束军刀', power:1700, stat:'格斗', fire:'melee', dmgType:'光束'}),
  ]},
  funnel:{pilot:'敌兵', mech:'浮游炮母机', short:'浮', weak:{近战:60, 直射:-30}, hp:4800, armor:300, eva:20, mov:4, melee:70, shoot:130, skill:120, flying:true, w:1, h:1, abilities:[], weapons:[
    wp({name:'浮游炮', power:250, fire:'indirect', range:[3,8], special:'funnel', hits:16, cd:1, dmgType:'光束'}),
  ]},
  berserker:{pilot:'敌兵', mech:'狂战士', short:'狂', weak:{反击:50}, hp:4500, armor:300, eva:15, mov:6, melee:130, shoot:80, skill:100, flying:false, w:1, h:1, abilities:['berserk'], weapons:[
    wp({name:'双斧', power:2000, stat:'格斗', fire:'melee'}),
  ]},
  skyfort:{pilot:'敌将', mech:'空中要塞', short:'空', weak:{直射:30, 曲射:-50}, shield:5000, shieldName:'力场护盾', noEvade:true, hp:16000, armor:1000, eva:0, mov:3, melee:80, shoot:140, skill:120, flying:true, w:2, h:2, abilities:[], weapons:[
    wp({name:'光束炮', power:2600, fire:'direct', range:[2,7], dmgType:'光束'}),
    wp({name:'对空机枪', power:1200, fire:'direct', range:[1,3]}),
  ]},
  venom:{pilot:'敌将', mech:'λ 试作机', short:'λ', weak:{多段:30}, hp:6000, armor:500, eva:25, mov:6, melee:140, shoot:140, skill:140, flying:false, w:1, h:1, abilities:['lambdaShield'], weapons:[
    wp({name:'λ 加农炮', power:2400, fire:'direct', range:[2,5], dmgType:'特殊'}),
    wp({name:'单分子刀', power:2000, stat:'格斗', fire:'melee'}),
  ]},
};
const ENEMY_POOL = ['grunt','fighter','artillery','hound','raider','drone','shield','beamcoat','phase','stealth','swarm','beetle','sniper','bomber','mirror','regen','jammer','captain','funnel','berserker','venom'];
const ENEMY_BOSS = ['fortress','tank','skyfort'];

