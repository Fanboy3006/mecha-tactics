/* ---------- 肉鸽关底 Boss（关卡对话维护，作者 2026-10-08：「关底需要有特色、存在不同解法的 Boss」） ----------
   设计见 docs/肉鸽关底Boss设计.md。作者定：保留两个出口（Boss 战可选，靠奖励吸引）；不做「突破过关」；四个 Boss 都做。
   - 这里只写场地、站位、增援、目标（关卡对话的地盘）；Boss 自己的能力和数值归规则对话（需求单 #10）。
   - 每个 Boss 用的新模板（gatefort / beacon / pylon / twinA / twinB）由敌方设计对话加进 ENEMY_T（终点的 bluefish 已加，v0.41.7）。
     还没加的时候用 BOSS_FALLBACK 里的现有模板顶上，地图照样能打（测试用）；
     出口守军的关卡池只有在 Boss 模板到位（bossReady）以后才换成 Boss 战，之前继续用原来的随机守军关。
   - 31 里把 BOSS_STAGES 并进 STAGE_OVERRIDES；26 里出口守军优先抽 boss:true 且 bossReady 的关。
   - 敌人字段：lvAdd = 在本关等级上再加几级（Boss / 头目 +2，精锐 +1）；target = 斩首目标 ★；guardZone = 守卫型。 */
const BOSS_FALLBACK = {gatefort:'fortress', beacon:'skyfort', pylon:'turret', twinA:'berserker', twinB:'artillery'};
const bk = k => ENEMY_T[k] ? k : (BOSS_FALLBACK[k] || k);
const bossReady = st => !!(st && st.bossKeys && st.bossKeys.every(k => ENEMY_T[k]));
const BOSS_STAGES = {
  /* 第 1 层「铁闸」——考朝向。闸门要塞（2×2、不动、正面装甲、敌方阶段结束转向最近的我方）堵在绝壁墙唯一的闸口里。
     墙北面贴着地图边有一条 2 行的森林小路绕到背后；南面是裂谷，只有飞行能过。墙后两台炮击机（曲射，最小射程 3）。
     解法：① 两队一前一后夹击，它一回合只能转向一边；② 一台皮厚的当诱饵把它的正面引开，其余从另一边打背；③ 正面硬打。 */
  'ISW-1-G-1':{boss:true, bossKeys:['gatefort'], name:'铁闸', affix:null, obj:'targets', w:24, h:14,
    rows:rtRows(24, 14, [['x',0,0,24,1], ['x',0,13,24,1], ['x',12,3,2,3], ['x',12,8,2,3], ['c',12,11,2,2],
      ['f',9,1,7,2], ['m',8,4,1,1], ['m',8,9,1,1], ['f',4,10,2,2], ['f',5,3,2,1], ['f',18,2,2,2], ['f',18,10,2,2], ['m',21,6,1,2]]),
    spots:[[1,5],[1,8],[3,3],[3,10]],
    enemies:[
      {t:bk('gatefort'), x:12, y:6, facing:'left', lvAdd:2, target:true},
      {t:'artillery', x:16, y:4, facing:'left', lvAdd:1}, {t:'artillery', x:16, y:9, facing:'left', lvAdd:1},
      {t:'grunt', x:9, y:5, facing:'left'}, {t:'grunt', x:9, y:8, facing:'left'}, {t:'hound', x:17, y:7, facing:'left'}],
    desc:'<b>关底 Boss：闸门要塞</b><br>要塞堵在墙上唯一的闸口里，<b>不会移动</b>。它有<b>正面装甲</b>（正面挨打伤害 −50%），每个敌方阶段结束时会<b>转身面向最近的我方机体</b>。击破它（★）就过关。<br><br>· 墙北边贴着地图边有一条森林小路，可以绕到它背后；南边是裂谷，只有飞行机能飞过去。<br>· 墙后面有两台炮击机：曲射，最小射程 3，贴上去它就打不到你。<br>· 它一回合只能面向一边：从两边同时打，或者先让一台皮厚的站在一边把它的正面引过去。'},

  /* 第 2 层「灯塔」——考分兵。灯塔（空中要塞改，飞行，不动）悬在右侧裂谷环中央，地面近战够不着。
     三条战线尽头各一座供能塔：每座存活的塔让灯塔受到的伤害 −30%（特殊伤害不吃）。
     解法：① 三条线分兵拆塔再集火；② 只拆近的一两座然后爆发；③ 特殊伤害直接打。 */
  'ISW-2-G-1':{boss:true, bossKeys:['beacon','pylon'], name:'灯塔', affix:null, obj:'targets', w:28, h:16,
    rows:rtRows(28, 16, [['x',0,0,28,1], ['x',0,15,28,1], ['x',6,5,15,2], ['x',6,9,15,2], ['c',21,4,6,8],
      ['f',8,2,2,2], ['f',8,12,2,2], ['m',13,1,1,2], ['m',13,13,1,2], ['w',11,7,3,2], ['f',2,3,2,1], ['f',2,12,2,1]]),
    spots:[[1,2],[1,7],[1,12],[3,9]],
    enemies:[
      {t:bk('beacon'), x:23, y:7, facing:'left', lvAdd:2, target:true},
      {t:bk('pylon'), x:20, y:2, facing:'left', lvAdd:1}, {t:bk('pylon'), x:20, y:7, facing:'left', lvAdd:1}, {t:bk('pylon'), x:20, y:13, facing:'left', lvAdd:1},
      {t:'grunt', x:17, y:1, facing:'left', guardZone:4}, {t:'grunt', x:17, y:4, facing:'left', guardZone:4},
      {t:'sniper', x:19, y:8, facing:'left', guardZone:6, lvAdd:1}, {t:'shield', x:16, y:7, facing:'left', guardZone:3, lvAdd:1},
      {t:'raider', x:17, y:11, facing:'left', guardZone:4}, {t:'artillery', x:18, y:14, facing:'left', guardZone:5, lvAdd:1}],
    desc:'<b>关底 Boss：灯塔</b><br>灯塔悬在右边裂谷环的正中，<b>地面近战够不着</b>，只能用远程、曲射或飞行机打。击破它（★）就过关。<br><br>· 三条战线尽头各有一座<b>供能塔</b>：每座还在的塔，让灯塔受到的伤害 <b>−30%</b>（三座都在就是 −90%）。<b>特殊伤害</b>不吃这个减伤。<br>· 每条线上都有守卫型敌人，不靠近不动。中线有敌方狙击，走进射界会挨一发。<br>· 可以三条线分兵各拆一座，也可以只拆近的一两座然后全力爆发。机库和前线中继能帮你把人送到另一条线。'},

  /* 第 3 层「双子」——考同步。双子机 A（近战冲锋，移动 6）开局在中段迎面冲来；B（曲射炮台，不动）在右上高台上。
     一台被击破后，另一台撑到下一个敌方阶段开始就把它复活（50% HP）。高台只有一条坡道，坡道口有敌方狙击和盾卫。
     解法：① 分两队，同一回合两边一起收掉；② 都压到残血再一口气解决；③ 把 A 引到 B 旁边，用范围攻击一起打。 */
  'ISW-3-G-1':{boss:true, bossKeys:['twinA','twinB'], name:'双子', affix:null, obj:'targets', w:26, h:16,
    rows:rtRows(26, 16, [['x',0,0,26,1], ['x',0,15,26,1], ['x',18,1,1,6], ['x',18,6,4,1], ['x',24,6,2,1], ['m',20,2,4,1], ['m',19,4,2,1],
      ['f',7,2,3,2], ['f',7,11,3,2], ['m',11,6,1,3], ['w',13,11,4,2], ['f',15,3,2,2], ['m',22,10,1,2], ['f',2,6,2,1]]),
    spots:[[1,4],[1,7],[1,10],[3,7]],
    enemies:[
      {t:bk('twinA'), x:14, y:8, facing:'left', lvAdd:2, target:true},
      {t:bk('twinB'), x:22, y:3, facing:'left', lvAdd:2, target:true},
      {t:'sniper', x:24, y:9, facing:'left', guardZone:6, lvAdd:1}, {t:'shield', x:22, y:7, facing:'left', guardZone:3, lvAdd:1}, {t:'shield', x:23, y:8, facing:'left', guardZone:3, lvAdd:1},
      {t:'hound', x:15, y:6, facing:'left'}, {t:'hound', x:15, y:10, facing:'left'}],
    desc:'<b>关底 Boss：双子</b><br>两台都是 ★，<b>都击破</b>才过关。<br><br>· <b>双子链接</b>：一台被击破后，另一台如果撑到<b>下一个敌方阶段开始</b>，就会把它复活（50% HP）。所以要在<b>同一个我方回合</b>里把两台都收掉。<br>· 双子 A 是近战，会一直冲最近的我方机体；双子 B 是曲射炮台（最小射程 3），蹲在右上高台上不动。<br>· 高台只有右下一条坡道，坡道口有盾卫，旁边还有敌方狙击盯着。飞行机、尖兵的前线中继可以帮你绕过去。<br>· A 只追最近的目标：也可以把它引到 B 附近，用范围攻击一起打。'},

  /* 终点「蓝色大肥鱼」——作者 10-09 定，取代原来的迷宫之主（敌方对话写了第一版场地，关卡对话可以随意改）。
     大肥鱼（3×3）从左边缘出发，每个敌方阶段向右走 2 格，不看地形和控制区，路线上的单位敌我不分直接碾碎；右边缘碰到地图边 = 失败。
     HP、装甲、防御都极高；走完后对身边 2 格放周身冲击。行为在 17c（ai:'lane'），模板在 04 的 ENEMY_T.bluefish。
     鱼道（第 7–9 行）整条保持平原。解法（作者定）：纯数值硬打；无视防御 / 特殊伤害 / 按比例的伤害特别有效。 */
  'ISW-4-F-1':{boss:true, bossKeys:['bluefish'], name:'蓝色大肥鱼', affix:null, obj:'targets', w:30, h:18,
    rows:rtRows(30, 18, [['x',0,0,30,1], ['x',0,17,30,1],
      ['f',6,3,3,2], ['f',6,13,3,2], ['m',11,4,1,2], ['m',11,12,1,2], ['f',15,2,2,2], ['f',15,14,2,2], ['c',17,5,2,1], ['c',17,12,2,1],
      ['m',20,4,2,1], ['m',20,13,2,1], ['w',24,2,3,2], ['w',24,14,3,2]]),
    spots:[[2,3],[2,13],[5,1],[5,15],[9,2],[9,14]],
    enemies:[
      {t:'bluefish', x:0, y:7, facing:'right', lvAdd:2, target:true},
      {t:'grunt', x:10, y:8, facing:'left'}, {t:'grunt', x:19, y:7, facing:'left'},
      {t:'shield', x:13, y:5, facing:'left', lvAdd:1}, {t:'shield', x:13, y:11, facing:'left', lvAdd:1},
      {t:'berserker', x:18, y:3, facing:'left', lvAdd:2}, {t:'venom', x:18, y:13, facing:'left', lvAdd:2},
      {t:'sniper', x:27, y:4, facing:'left', guardZone:6, lvAdd:1}, {t:'sniper', x:27, y:12, facing:'left', guardZone:6, lvAdd:1}],
    waves:[{at:3, enemies:[{t:'funnel', x:27, y:2, facing:'left'}, {t:'captain', x:27, y:14, facing:'left'}]},
           {at:6, enemies:[{t:'skyfort', x:25, y:1, facing:'left'}, {t:'venom', x:27, y:15, facing:'left'}]}],
    desc:'<b>最终 Boss：蓝色大肥鱼</b><br>击破大肥鱼（★）就通关；它的右边缘碰到地图右边（蓝色<b>终点</b>线）就<b>失败</b>。<br><br>· 它每个敌方阶段向右走 <b>2 格</b>（淡蓝色是下一步要走的格子），<b>不看地形和控制区</b>，路线上的单位<b>敌我不分直接碾碎</b>——别站在鱼道上，敌人挡路也会被它压扁。<br>· HP、装甲、防御都<b>极高</b>，普通武器只能刮一点。<b>无视防御</b>、<b>特殊伤害</b>、<b>按比例的伤害</b>（斩首、传送斩等）特别有效；练度够也可以硬打。<br>· 走完后对身边 <b>2 格</b>内的我方机体放一次周身冲击（必中）。打完就退开，别一直贴着。<br>· 它不能被拉、推；眩晕能让它停一回合。'},
};
