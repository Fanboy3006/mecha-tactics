/* ---------- 战术挑战（关卡对话维护，统筹 10-08 建脚手架） ----------
   作者 10-08：规则试玩场「基本达到设计预期」，肉鸽暂停；下一步做手工关卡。
   做法沿用规则试玩场（05b）：小地图、每关一道题、开场提示写「这关考什么」。
   - 关卡写进下面的 CHALLENGE_STAGES，键名用 ch_ 开头（例如 ch_01），code 用 CH-01 这样的编号；
   - 字段和 LEVELS 一样：name, w, h, rows（可以用 05b 的 rtRows(w, h, marks) 生成）, allies:[{mech, x, y, facing, lv}]
     （mech 可以是正式角色代号，也可以是大众脸 G1–G6）或者 formation + rosterList + spots + hangar + maxDeploy（要机库时），
     enemies:[{t, x, y, facing, lv?, guardZone?}], waves, zone, victory, goalText, winText, summary, tips:[{on:'turn:1', text}]；
   - 敌人可以写 guardZone:N（守卫型：我方进入 N 格内才启动，v0.40.3 接线）；
   - 敌人模板和数值归规则对话，这里只决定放什么、放哪、朝哪、几级、几波。
   - 写完跑 tests/challenge.js（打开每一关、检查站位和报错）。
   下面的登记代码不用改：开场菜单「战术挑战」和顶栏关卡菜单会自动列出所有关卡。 */
const CH_BASE = {speed:.6, enemyLv:5, challenge:true};
const CHALLENGE_STAGES = {
  /* CH-01 隘口：控制区 + 重装封路 + 我方压制射击。左边是我方阵地，中间一条 3 格宽、9 格长的走廊，敌人每回合从右边刷新。
     两台重装要抢在敌人之前站到走廊出口上下两格（开局在后面，走过去要 2 回合），中间那格就是两边的控制区，地面敌人钻不过来。
     走廊外侧是裂谷（地面过不去、飞行能飞过），战斗机会从上下飞过来骚扰后排，交给狙击和近卫。 */
  ch_01:{...CH_BASE, code:'CH-01', name:'战术挑战 1 · 隘口', w:26, h:13,
    rows:rtRows(26, 13, [['x',0,0,26,1], ['x',0,12,26,1], ['c',9,1,9,2], ['x',9,3,9,2], ['x',9,8,9,2], ['c',9,10,9,2],
      ['f',5,1,2,2], ['f',5,10,2,2], ['m',7,3,1,1], ['m',7,9,1,1], ['f',20,2,2,2], ['f',21,9,2,2], ['m',23,5,1,2]]),
    allies:[{mech:'G4', x:3, y:3, facing:'right', lv:10}, {mech:'G4', x:3, y:9, facing:'right', lv:10}, {mech:'G1', x:4, y:6, facing:'right', lv:10},
      {mech:'G3', x:1, y:6, facing:'right', lv:10}, {mech:'G5', x:2, y:5, facing:'right', lv:10}],
    enemies:[{t:'grunt', x:20, y:5, facing:'left'}, {t:'grunt', x:20, y:7, facing:'left'}, {t:'raider', x:22, y:6, facing:'left'}, {t:'hound', x:19, y:3, facing:'left'}, {t:'hound', x:19, y:9, facing:'left'}],
    respawn:{every:1, lv:5, list:t => ({2:['raider','grunt','fighter'], 3:['raider','grunt','artillery'], 4:['beetle','raider','fighter'], 5:['raider','grunt','artillery'], 6:['raider','hound','fighter']})[t] || ['raider','grunt','hound']},
    breach:{x0:0, y0:0, x1:3, y1:12},
    victory:{type:'survive', turns:6}, goalText:'坚守 6 回合；地面敌人冲进最左边 4 列（我方阵地）就失败', winText:'隘口守住了。',
    summary:'这一关考：控制区封路。两台重装抢到走廊出口一上一下站好，中间那格两边都是控制区，地面敌人只能一台一台地挤进来；飞过裂谷的战斗机交给后排。',
    tips:[{on:'turn:1', text:'<b>这关考什么：用控制区封住隘口</b><br>敌人每回合从右边刷出来，撑过 6 回合就赢。<b>任何一台地面敌人在敌方回合结束时站进最左边 4 列（我方阵地），就算失败</b>。<br><br>· 走廊 3 格宽。两台重装 G4 赶到出口的<b>上下两格</b>（走过去要 2 回合，敌人的突击兵也差不多这时候到），中间那格同时是两台的<b>控制区</b>，敌人走进去就得停下，<b>钻不过来</b>。<br>· 走廊上下是裂谷：地面过不去，但<b>战斗机能飞过来</b>（第 2、4、6 回合各来一台），它会直扑后排。<br>· 走廊又长又直，正对着狙击 G3 的射界：每个敌方阶段，第一个走进来的敌人先挨一发<b>压制射击</b>。<br>· 敌人卡在缺口里时，近卫 G1 从后面伸剑补刀（光束剑射程 2）。<br>· 第 3、5 回合会来炮击机，曲射能越过前排打到后面；重装掉血了就让指挥 G5 修理。<br><br>反过来试试：让重装离开出口，看看敌人涌进开阔地会怎样。'},
      {on:'turn:4', text:'甲虫型重机来了：<b>正面装甲</b>，正面挨打伤害减半。它卡在缺口里时，可以等它转向，或者干脆让重装顶着、集中火力打别的。'}],
  },
  /* CH-02 背后：三台高装甲守卫面朝左边守着正面通道；上下各有一条森林小路绕到它们背后。 */
  ch_02:{...CH_BASE, code:'CH-02', name:'战术挑战 2 · 背后', w:24, h:13,
    rows:rtRows(24, 13, [['x',0,0,24,1], ['x',0,12,24,1], ['x',9,3,10,1], ['x',9,9,10,1], ['x',9,1,2,2], ['x',9,10,2,2],
      ['f',11,1,6,2], ['f',11,10,6,2], ['m',13,5,1,1], ['m',13,7,1,1], ['f',20,2,2,2], ['f',20,9,2,2]]),
    allies:[{mech:'G1', x:3, y:5, facing:'right', lv:10}, {mech:'G2', x:3, y:7, facing:'right', lv:10}, {mech:'G6', x:4, y:6, facing:'right', lv:10},
      {mech:'G4', x:2, y:6, facing:'right', lv:10}, {mech:'G3', x:1, y:4, facing:'right', lv:10}],
    enemies:[{t:'beetle', x:16, y:5, facing:'left', guardZone:3}, {t:'beetle', x:16, y:7, facing:'left', guardZone:3},
      {t:'tank', x:17, y:5, facing:'left', guardZone:3, lv:3}, {t:'sniper', x:18, y:8, facing:'left', guardZone:4},
      {t:'grunt', x:12, y:4, facing:'left'}, {t:'grunt', x:12, y:8, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'从背后打穿了防线。',
    summary:'这一关考：朝向和背击。甲虫型重机有正面装甲、重型坦克装甲 2000，从正面几乎打不动；绕到背后打，伤害翻几倍，而且它们反击不了。',
    tips:[{on:'turn:1', text:'<b>这关考什么：绕到背后</b><br>正面通道里守着两台<b>甲虫型重机</b>（正面装甲：正面挨打伤害 −50%）和一台<b>重型坦克</b>（装甲 2000），后面还有一台敌方狙击盯着通道。它们是<b>守卫型</b>：你进到 3–4 格以内才会动。<br><br>· 先在战斗预测里看看从正面打它们是多少，再看从背后打是多少。<br>· 上下各有一条森林小路，绕过去要两回合左右。<b>背击</b>无视 50% 装甲、闪避 −20，而且它背后打不到你。<br>· 它们醒了以后会转身，所以最好几台一起到位，同一回合集中打背后。<br>· 特种 G6 的冲撞能把敌人推开 2 格；尖兵 G2 无视控制区，可以从缝里钻到后面。'}],
  },
  /* CH-03 狙击守口：唯一的通道是一条 2 格宽、12 格长的直路，尽头两台敌方狙击朝左盯着。 */
  ch_03:{...CH_BASE, code:'CH-03', name:'战术挑战 3 · 狙击守口', w:26, h:12,
    rows:rtRows(26, 12, [['x',0,0,26,1], ['x',0,11,26,1], ['x',7,1,12,4], ['x',7,7,12,4],
      ['f',2,2,2,2], ['f',2,8,2,2], ['f',21,2,2,2], ['f',21,8,2,2], ['m',23,5,1,2]]),
    allies:[{mech:'G4', x:5, y:5, facing:'right', lv:10}, {mech:'G1', x:4, y:6, facing:'right', lv:10}, {mech:'G6', x:3, y:5, facing:'right', lv:10},
      {mech:'G3', x:2, y:6, facing:'right', lv:10}, {mech:'G5', x:1, y:5, facing:'right', lv:10}],
    enemies:[{t:'sniper', x:24, y:4, facing:'left', guardZone:6}, {t:'sniper', x:24, y:7, facing:'left', guardZone:6},
      {t:'shield', x:20, y:5, facing:'left', guardZone:3}, {t:'shield', x:20, y:6, facing:'left', guardZone:3},
      {t:'grunt', x:22, y:3, facing:'left'}, {t:'grunt', x:22, y:8, facing:'left'}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'狙击被拔掉了。',
    summary:'这一关考：敌方压制射击。每台敌方狙击每个我方阶段只打第一个走进射界的机体，让重装先进去把这两发吃掉，后面的人再冲。',
    tips:[{on:'turn:1', text:'<b>这关考什么：敌方压制射击</b><br>唯一的路是一条又长又直的通道，尽头两台敌方狙击朝左盯着它。选中机体时，<b>橙红色</b>格子是敌方射界：走进去会在半路挨一发，而且挨打后不能取消移动。<br><br>· 每台狙击<b>每个我方阶段只打 1 次</b>，打的是第一个走进来的。<br>· 所以让皮最厚的重装 G4 <b>先走</b>进射界，把两发都吃掉，再让近卫和特种冲过去。<br>· 通道出口有两台盾卫堵着（控制区），特种 G6 的冲撞可以把它们推开。<br>· 你的狙击 G3 射程 3–8，比敌方狙击（4–9）短，对射不划算。'}],
  },
  /* CH-04 前线中继：出击点在最左边，斩首目标在 25 格外的据点里，7 回合内要拿下（尖兵 3 回合跑到据点前插中继，主力第 4 回合出场）。场上最多 3 台。 */
  ch_04:{...CH_BASE, code:'CH-04', name:'战术挑战 4 · 前线中继', w:30, h:12, formation:true, hangar:true, maxDeploy:3, allyFacing:'right',
    rows:rtRows(30, 12, [['x',0,0,30,1], ['x',0,11,30,1], ['w',9,1,3,6], ['w',9,8,3,3], ['f',14,3,3,2], ['f',14,8,3,2], ['m',18,5,1,2],
      ['x',13,1,1,2], ['x',13,9,1,2], ['x',24,2,6,1], ['x',24,9,6,1], ['x',24,3,1,1], ['x',24,8,1,1], ['f',27,3,2,1], ['f',27,8,2,1]]),
    rosterList:[{mech:'G2', lv:10}, {mech:'G1', lv:10}, {mech:'G6', lv:10}, {mech:'G3', lv:10}, {mech:'G4', lv:10}, {mech:'G5', lv:10}],
    defaultDeploy:['G2','G5','G3'],
    spots:[[1,4],[1,6]],
    waves:[{lv:5, limit:7, label:'击破据点里的指挥官机', enemies:[
      {t:'captain', x:27, y:5, facing:'left', target:true, guardZone:5},
      {t:'shield', x:25, y:4, facing:'left', guardZone:3}, {t:'shield', x:25, y:7, facing:'left', guardZone:3},
      {t:'grunt', x:16, y:6, facing:'left'}, {t:'hound', x:20, y:3, facing:'left'}, {t:'hound', x:20, y:8, facing:'left'}]}],
    victory:{type:'targets'}, goalText:'斩首：第 7 回合结束前击破 ★ 指挥官机', winText:'从前线中继出场，斩首成功。',
    summary:'这一关考：前线中继和机库。出击点在最左边，主力走过去要四五回合；尖兵先插中继，主力直接在前线出场。',
    tips:[{on:'turn:1', text:'<b>这关考什么：前线中继</b><br>★ 指挥官机在 25 格外的据点里，<b>第 7 回合结束前</b>击破它才算赢。场上最多 3 台，其余在机库。<br><br>· 慢慢走过去来不及。尖兵 G2 移动力 7、无视控制区：先冲到据点附近，移动后<b>插下前线中继</b>，周围 2 格就成了部署格。<br>· 派出的机体当回合不能移动，但<b>可以攻击</b>：近卫 G1、特种 G6 落在中继旁边就能直接开打。<br>· 场上满 3 台就派不出人：首发别全带上，或者在指挥 G5 的 4 格内把人<b>撤回</b>腾名额。<br>· 中继不能放在敌方控制区里，插的位置别贴着盾卫。'}],
  },
  /* CH-05 三面来敌：中央阵地，敌人分 5 波轮流从西、东北、东南三个入口进来。场上最多 4 台。 */
  ch_05:{...CH_BASE, code:'CH-05', name:'战术挑战 5 · 三面来敌', w:24, h:16, formation:true, hangar:true, maxDeploy:4, allyFacing:'right',
    rows:rtRows(24, 16, [['x',0,0,14,3], ['x',0,3,8,3], ['x',18,3,6,10], ['x',0,10,8,3], ['x',0,13,14,3],
      ['f',10,4,2,2], ['f',10,10,2,2], ['m',14,7,1,2], ['f',2,6,2,1], ['f',4,9,2,1], ['f',17,1,2,1], ['m',21,1,1,1], ['f',17,14,2,1], ['m',21,14,1,1]]),
    rosterList:[{mech:'G4', lv:10}, {mech:'G1', lv:10}, {mech:'G3', lv:10}, {mech:'G5', lv:10}, {mech:'G6', lv:10}, {mech:'G2', lv:10}],
    defaultDeploy:['G4','G1','G3','G5'],
    spots:[[11,6],[11,8],[13,6]],
    waves:[
      {lv:5, label:'西面', enemies:[{t:'grunt', x:1, y:7, facing:'right'}, {t:'grunt', x:1, y:8, facing:'right'}, {t:'raider', x:3, y:6, facing:'right'}]},
      {at:2, lv:5, label:'东北', tip:'east1', enemies:[{t:'hound', x:20, y:1, facing:'left'}, {t:'hound', x:22, y:2, facing:'left'}, {t:'fighter', x:21, y:0, facing:'down'}]},
      {at:3, lv:5, label:'东南', tip:'east2', enemies:[{t:'shield', x:19, y:13, facing:'left'}, {t:'grunt', x:21, y:14, facing:'left'}, {t:'artillery', x:22, y:15, facing:'left'}]},
      {at:4, lv:5, label:'西面第二批', enemies:[{t:'berserker', x:1, y:8, facing:'right'}, {t:'raider', x:2, y:6, facing:'right'}, {t:'raider', x:2, y:9, facing:'right'}]},
      {at:5, lv:5, label:'东北和东南', enemies:[{t:'sniper', x:22, y:1, facing:'left'}, {t:'grunt', x:19, y:0, facing:'down'}, {t:'beetle', x:20, y:14, facing:'up'}, {t:'hound', x:22, y:13, facing:'left'}]},
    ],
    victory:{type:'annihilate'}, goalText:'击退全部 5 波敌人', winText:'三个方向都守住了。',
    summary:'这一关考：多方向防守和换人。敌人轮流从三个入口进来，朝向一次只能顾一边，场上最多 4 台，机库里的人要换着上。',
    tips:[{on:'turn:1', text:'<b>这关考什么：多方向防守</b><br>你在中央阵地，三个入口：<b>西面</b>（左边走廊）、<b>东北</b>（右上）、<b>东南</b>（右下）。敌人分 5 波轮流进来，顶上会显示下一波什么时候到。<br><br>· 攻击范围跟着朝向走，背后谁都打不到：一台机体只能顾一个方向，别让人背对着下一个入口。<br>· 狙击的压制射击也只盯朝向那一边：每回合想好它朝哪。<br>· 场上最多 4 台。指挥 G5 4 格内可以把人<b>撤回</b>机库，换机库里的人上；派出的当回合不能移动，但可以攻击。<br>· 第 1 波从西面来。'},
      {on:'east1', text:'<b>东北</b>来敌了，其中有战斗机（飞行）。西面还没打完的话，想想谁转身、谁留下。'},
      {on:'east2', text:'<b>东南</b>来敌：盾卫在前、炮击机在后。炮击机是曲射，最小射程 3，贴上去它就打不到你。'}],
  },
  /* CH-06 守卫阵地：三条战线各有一组守卫型敌人，不靠近就不动。从哪一组开口子由玩家决定。 */
  ch_06:{...CH_BASE, code:'CH-06', name:'战术挑战 6 · 守卫阵地', w:26, h:14,
    rows:rtRows(26, 14, [['x',0,0,26,1], ['x',0,13,26,1], ['x',13,5,13,1], ['x',13,9,13,1], ['m',13,4,1,1], ['m',13,10,1,1],
      ['f',8,2,2,2], ['f',8,10,2,2], ['m',9,6,1,2], ['f',16,1,1,2], ['f',16,11,1,2], ['f',23,6,2,3]]),
    allies:[{mech:'G1', x:3, y:5, facing:'right', lv:10}, {mech:'G4', x:4, y:7, facing:'right', lv:10}, {mech:'G2', x:3, y:9, facing:'right', lv:10},
      {mech:'G3', x:1, y:6, facing:'right', lv:10}, {mech:'G6', x:2, y:8, facing:'right', lv:10}, {mech:'G5', x:1, y:4, facing:'right', lv:10}],
    enemies:[
      {t:'sniper', x:22, y:3, facing:'left', guardZone:5}, {t:'grunt', x:18, y:2, facing:'left', guardZone:4}, {t:'grunt', x:18, y:4, facing:'left', guardZone:4},
      {t:'captain', x:21, y:7, facing:'left', guardZone:4}, {t:'shield', x:18, y:6, facing:'left', guardZone:4}, {t:'shield', x:18, y:8, facing:'left', guardZone:4},
      {t:'artillery', x:22, y:11, facing:'left', guardZone:5}, {t:'raider', x:18, y:10, facing:'left', guardZone:4}, {t:'raider', x:18, y:12, facing:'left', guardZone:4}],
    victory:{type:'annihilate'}, goalText:'击破全部敌机', winText:'阵地一组一组地拆掉了。',
    summary:'这一关考：守卫型敌人。三组敌人各守一条战线，你进到它们几格以内才会动；先拆哪一组、一次惊动几组，由你决定。',
    tips:[{on:'turn:1', text:'<b>这关考什么：挑开口子</b><br>右边三条战线各有一组<b>守卫型</b>敌人，你进到 4–5 格以内它们才会动，不靠近就一直站着。<br><br>· <b>北线</b>：敌方狙击 + 2 台量产机。狙击会压制射击，进它射界前先想好谁去吃这一发。<br>· <b>中线</b>：指挥官机（光环强化周围）+ 2 台盾卫。<br>· <b>南线</b>：炮击机 + 2 台突击兵。炮击机是曲射，<b>醒了以后能越过墙打到中线</b>。<br><br>· 战线之间是绝壁，挡视线也挡飞行。一次只惊动一组最稳；从中线开口子容易把上下两组一起叫醒。<br>· 守卫醒了才会转身，<b>第一下</b>可以挑它们朝向外的位置打。'}],
  },
};
Object.assign(LEVELS, CHALLENGE_STAGES);
/* 防线（关卡字段 breach:{x0,y0,x1,y1}）：敌方阶段结束时，有地面敌人站在这个矩形里就失败。飞行敌人不算。
   用在坚守关：不然只要有人活着就算赢，堵不堵路都一样。（画面上暂时没有标出来，靠开场提示说明） */
Hooks.on('turnEnd', () => {
  if (over || !LV || !LV.breach) return;
  const z = LV.breach, e = units.find(u => u.side === 'enemy' && u.hp > 0 && !u.flying && tilesOf(u).some(([x, y]) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1));
  if (e) defeat(`${fullName(e)} 冲进了我方阵地，防线被突破。`);
}, '战术挑战：防线被突破就失败');
{
  const og = document.createElement('optgroup'); og.label = '战术挑战（每关一道题）';
  for (const [k, L] of Object.entries(CHALLENGE_STAGES)){ const o = document.createElement('option'); o.value = k; o.textContent = L.name; og.appendChild(o); }
  if (og.children.length){ const sel = document.querySelector('#levelSel'); sel.insertBefore(og, sel.querySelector('optgroup[label="工具"]')); }
}
