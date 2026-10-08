/* ---------- 肉鸽关底 Boss（关卡对话维护，作者 2026-10-08：「关底需要有特色、存在不同解法的 Boss」） ----------
   设计见 docs/肉鸽关底Boss设计.md。作者定：保留两个出口（Boss 战可选，靠奖励吸引）；不做「突破过关」；四个 Boss 都做。
   - 这里只写场地、站位、增援、目标（关卡对话的地盘）；Boss 自己的能力和数值归规则对话（需求单 #10）。
   - 每个 Boss 用的新模板（gatefort / beacon / pylon / twinA / twinB / mazelord）由规则对话加进 ENEMY_T。
     还没加的时候用 BOSS_FALLBACK 里的现有模板顶上，地图照样能打（测试用）；
     出口守军的关卡池只有在 Boss 模板到位（bossReady）以后才换成 Boss 战，之前继续用原来的随机守军关。
   - 31 里把 BOSS_STAGES 并进 STAGE_OVERRIDES；26 里出口守军优先抽 boss:true 且 bossReady 的关。
   - 敌人字段：lvAdd = 在本关等级上再加几级（Boss / 头目 +2，精锐 +1）；target = 斩首目标 ★；guardZone = 守卫型。 */
const BOSS_FALLBACK = {gatefort:'fortress', beacon:'skyfort', pylon:'turret', twinA:'berserker', twinB:'artillery', mazelord:'flagship'};
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

  /* 终点「迷宫之主」——考节奏。指挥舰（3×3，飞行）停在右侧停机坪。HP > 50% 时有屏障、不动；≤ 50% 屏障失效、开始前进，主炮先画预警线再发射。
     解法：① 尖兵从侧线插中继、精锐前线出场，第 1 阶段就压上去；② 守住中线，等它第 2 阶段自己过来；③ 第 2 阶段躲预警线，或让重装援护硬吃换输出。 */
  'ISW-4-F-1':{boss:true, bossKeys:['mazelord'], name:'迷宫之主', affix:null, obj:'targets', w:30, h:18,
    rows:rtRows(30, 18, [['x',0,0,30,1], ['x',0,17,30,1], ['x',7,5,13,2], ['x',7,11,13,2], ['m',20,5,1,1], ['m',20,12,1,1],
      ['f',9,2,3,2], ['f',9,14,3,2], ['w',12,8,3,2], ['m',16,7,1,1], ['m',16,10,1,1], ['f',2,4,2,1], ['f',2,13,2,1], ['f',23,1,2,2], ['f',23,15,2,2]]),
    spots:[[1,2],[1,8],[1,14],[3,6],[3,11]],
    enemies:[
      {t:bk('mazelord'), x:25, y:7, facing:'left', lvAdd:2, target:true},
      {t:'captain', x:21, y:8, facing:'left', lvAdd:2}, {t:'sniper', x:21, y:2, facing:'left', lvAdd:1}, {t:'sniper', x:21, y:15, facing:'left', lvAdd:1},
      {t:'shield', x:19, y:8, facing:'left', lvAdd:1}, {t:'shield', x:19, y:9, facing:'left', lvAdd:1}, {t:'venom', x:22, y:12, facing:'left', lvAdd:2}],
    waves:[{at:3, enemies:[{t:'funnel', x:27, y:3, facing:'left'}, {t:'berserker', x:27, y:13, facing:'left'}]},
           {at:5, enemies:[{t:'skyfort', x:26, y:2, facing:'left'}, {t:'venom', x:27, y:14, facing:'left'}]}],
    desc:'<b>最终 Boss：迷宫之主</b><br>击破指挥舰（★）就通关。<br><br>· <b>第 1 阶段</b>（HP 一半以上）：有能量屏障（低威力的攻击无效，只挡几次），停在右边停机坪不动，第 3、5 回合会叫来增援。<br>· <b>第 2 阶段</b>（HP 一半以下）：屏障失效、开始往前压；主炮会先在地上画出一条<b>预警线</b>，下个敌方阶段发射。<br>· 三条战线汇合到停机坪。可以让尖兵从上下侧线插中继、让精锐直接在前线出场，也可以守住中线等它自己过来。'},
};
