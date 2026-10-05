# 机甲战棋 · 工作交接说明

本文件写给接手开发的人或 AI 代理（例如 DeepSeek harness）。读完它，再读 `docs/` 里的三份设计文档，就可以继续工作。

---

## 0. 一句话概括
一个浏览器里运行的战棋原型：超级机器人大战 AP 的骨架，加上朝向夹击、破防、视线、体积、分波刷敌、指挥官等新系统。未来要发展成"剧情模式 + 类明日方舟集成战略的肉鸽模式"。目前全部代码是**一个单文件 HTML**，原生 JS + Canvas，没有构建步骤，也没有依赖库。

## 1. 包内文件

| 路径 | 说明 |
|---|---|
| `src/index.html` | **可直接双击打开**的完整游戏（带 doctype、head 和基础样式） |
| `src/artifact-fragment.html` | 同一份代码的"片段版"：没有 `<html>/<head>/<body>`，是发布到 claude.ai Artifact 时用的格式。两份内容只差外层包装 |
| `docs/战棋规则设计.md` | **规则的唯一权威来源**：地形、移动、朝向、破防、武器、命中暴击、伤害管线、反击援护、全部我方单位数值 |
| `docs/教学关设计.md` | 关卡设计：教学 1–3、大规模防卫战、关卡层面的通用机制、测试记录 |
| `docs/游戏模式设计.md` | 剧情模式与肉鸽模式的框架（肉鸽模式还没有实现，只有设计） |
| `tests/*.js` | Playwright 自动化测试 / 模拟脚本（见第 8 节） |
| `art/` | **美术素材**：`mech-icons.js`（机体图标的唯一源文件）、`preview.html`（审素材的对照表页面）、`README.md`。详见 `art/README.md` |
| `tools/` | 开发工具：素材光栅化、**游戏画面渲染**、自检、冒烟测试、两份 HTML 的同步生成（见第 8.5 节） |

> 世界观设定文档（月球王国、角色背景、剧情）在作者的 Claude 项目里，没有放进本包。需要时向作者索取。注意：设定里有成人向内容，与游戏开发无关的部分不需要用到。

### 1.1 两份 HTML 的关系（重要）
`src/index.html` 的「游戏 CSS + 游戏标记 + 游戏脚本」**整段复制自** `src/artifact-fragment.html`。
规矩是：

- **只改 `src/artifact-fragment.html`**，然后跑 `node tools/build-src.mjs` 同步到 `index.html`；
- `art/mech-icons.js` 也是同样规矩：只改它，然后用 `build-src.mjs` 注入两份 HTML；
- HTML 里夹在 `ART:mech-icons BEGIN/END` 之间的代码是生成出来的，不要手改；
- `node tools/diff-src.mjs` 可以确认两份文件的主体是否逐字一致。

## 2. 运行
- 直接用浏览器打开 `src/index.html`。需要联网加载 Google Fonts；离线也能运行，只是字体会回退。
- 默认进入"教学 1 · 移动"。左上角「关卡」下拉菜单可以切换：教学 1/2/3、大规模防卫战（Lv20）、自由对战（随机地图）。
- 测试按钮：全队 +1 级 / 升到 Lv20 / 升到 Lv30。
- 页面暴露了调试接口 `window.__game`（见第 8 节）。

## 3. 代码结构地图（`src/artifact-fragment.html`，约 2400 行）
文件前约 250 行是 CSS 和 HTML 骨架，之后是一个 IIFE 里的全部 JS。按代码顺序：

| 区块（代码里的注释标题） | 主要内容 |
|---|---|
| 常量 | `N=40`（格子 key 的行宽，`key = y*N + x`）、`TS=22`（逻辑格子像素）、`MW/MH`（当前地图宽高）、`SC`（小地图放大倍数）、`SPEED`（动画时长倍率）、`COL` 颜色 |
| 地形 `TER` | 平原、森林、山地、水域、裂谷：移动消耗、防御 %、闪避、`blockLOS`、`groundBlock`、`flyBlock`。`FIRE` 是攻击类型名，`ATTACK_FIRES` 是能主动攻击的类型 |
| 事件钩子 `Hooks` | `Hooks.on(event, fn, label)` / `Hooks.emit(event, ctx)`。现有事件：`phaseStart`、`turnEnd`、`actionEnd`、`strikeResolved`、`unitDestroyed`、`damageGenerated`。**新的被动、遗物、英雄技能都应该挂在这里** |
| 能力与减免管线 | `ABIL`（能力 / 特技的名字和描述）、`REDUCTIONS`（减免管线：stage 1 无效化 → stage 2 百分比 → stage 3 固定值，每条有 `applies(c)` 和 `apply(c)`） |
| 武器与机体 | `wp()` 武器默认值工厂、`ALLY_T`（我方模板）、`FORMS`（变身形态，纳德雷）、`DEBRIS_T`（陨石残骸）、`COMMANDS`（指挥技能）、`ENEMY_T`（敌方模板）、`ENEMY_LINEUP`（自由对战敌人） |
| 关卡 `LEVELS` | `tut1` / `tut2` / `tut3` / `defense` / `skirmish`，数据格式见第 5 节 |
| 状态 | 全局：`level, LV, waveIdx, deadline, walls, CMD, map, units, roster, turn, battleNo, over…`；UI 状态机 `S`（见第 6 节） |
| 体积与距离 | `tilesOf`、`occupant`、`distRect`（矩形间菱形距离）、`distU` |
| 朝向 | `FACE`、`ZONE`（正 / 侧 / 背的修正值）、`dirToward`、`zoneOf` |
| 地图生成 | `genMap`（自由对战随机图）、`placeUnits` |
| 移动 | `canStand`、`stepCost`、`reach`（Dijkstra，返回 `{x,y,d,face}`）、`moveUnit` |
| 视线 | `lineSteps`（超覆盖直线）、`losClear`（含"空中目标"特例） |
| 武器可用性 | `wStatus`（解锁 / 次数 / 冷却 / 移动后 / 反击等，返回原因字符串或 null）、`effRange`（含等级强化）、`maxReach`、`canHit` |
| 战斗计算 | `hitRate`、`critRate`、`damageCalc`（生成 → 减免管线）、`reduceOnly`（多段用）、`forecast`（预测，也给 AI 用）、`bestCounter`、`aiReaction` |
| 默认挂载的规则钩子 | CD 递减、buff / 破防 / 闪避疲劳清除、援护次数重置、破防施加、TRANS-AM 标记、推击、力场墙到期等 |
| 战斗执行 | `consume`、`teleport`、`strike`（单次攻击，含特效、多段、传送斩）、`destroy`、`battle`（攻击 + 反击）、`mapAttack`（影凤凰）、余响 / 再生 / 修理 / 推击 / 墙 / 变身 / 辅助 |
| 回合流程 | `fireTip`、`startPlayerPhase`、`endTurn`、`aiAct`（敌方 AI）、`checkEnd`、`victory`、`defeat`、`startBattle`（自由对战）、`spawnWave`、`updateLimit`、`showFormation`（战前编队）、陨石指挥、`startLevel`、`newCampaign` |
| 敌方攻击时的我方应对 | `askGuard`（援护弹窗）、`askReaction`（反击 / 防御 / 回避弹窗） |
| 绘制 | `setMapSize`、`buildTerrain`（地形预渲染到离屏 canvas）、`computeThreat`、`FX` 特效系统（`fx(type,…)`、`fxAttack`、`drawFX`）、`draw`（每帧）、`drawUnit`、`focusOn` |
| 面板 | 武器卡、HP 条、头像（原创徽章 + 本地上传，`localStorage`）、`unitCardHTML`、`actionHTML`（按 `S.mode` 渲染右侧指令面板）、`weaponUsable`、`refresh`、`log` |
| 输入 | `select`、`cancel`、`finish`（行动结束，触发特技 / 自动施放）、`onTile`（地图点击，按 `S.mode` 分派）、`onAction`（面板按钮）、键盘（空格 / Tab / Esc）、作弊升级 |

## 4. 核心数据结构

### 4.1 单位对象（`makeUnit(template, side, x, y)` 生成）
模板字段：`pilot, mech, short`（地图上的短名）、`hp, armor, eva, mov, melee, shoot, skill, flying, w, h`、`tags{势力, 远近分类, 战斗分类}`、`abilities[]`（ABIL 的 key）、`trait`（个人特技 key，Lv10 解锁）、`weapons[]`，以及可选的：
- `canFly`：可以起飞 / 落地；
- `portal{range,cost}`：雷萨传送；
- `transform`：变身形态 key（如 `'nadleeh'`）；
- `command`：指挥技能 key（如 `'meteor'`）；
- `noEvade`：不回避、不防御；
- `chase`：AI 边打边往前压。

运行时字段：`side`（`'ally' | 'enemy' | 'neutral'`）、`lv, maxHp, hp, facing, moved, movedThisRound, acted, buffs[], debuffs[], dodgePen, moveEva, backlash, guardLeft, barrierLeft, stunned, transformed, forceTrait, wave…`。

### 4.2 武器（`wp({...})`）
`name, power, range[min,max], hit(默认100), critMod, stat('格斗'|'射击'), fire, dmgType('物理'|'光束'|'特殊'|'—'), cd, uses, unlock, upgrades[{lv, range?, note}], afterMove, ignoreDef, special, desc`。

- `fire` 的取值：`melee`、`direct`、`indirect`、`map`、`support`、`passive`、`heal`、`device`。
- `special` 的取值：
  - `gamble`：传送斩；
  - `multi`：多段攻击（配合 `hits`、`step` 字段）；
  - `echo`：残月的余响；
  - `regen`：月华再生；
  - `markBreak`：TRANS-AM 狙击；
  - `push`：推击（配合 `push` 字段）；
  - `trial`：骇入；
  - `wall`：力场墙（已改为变身指令触发）。

### 4.3 伤害流程（详见规则文档第 8 节）
`hitRate` → 命中判定 → `damageCalc`：先生成伤害，再按 stage 顺序走 `REDUCTIONS`。每条减免的数值都会先乘以破防系数 `defMul`；`ignoreDef` 的武器跳过整条管线。多段攻击用 `reduceOnly` 逐段减免。

## 5. 关卡数据格式（`LEVELS[id]`）
```js
{
  name, w, h, speed?,              // speed：动画倍率（大关卡用 .45）
  formation?: true,                // 开战前弹出编队（选指挥官）
  rows: ["....ffmm..", ...],       // 字符地图：. 平原 f 森林 m 山地 w 水域 c 裂谷
  allies: [{mech:'B1', x, y, facing, lv?, flying?, forceTrait?}],
  enemies?: [{t:'grunt', x, y, facing}],             // 不分波时用
  waves?: [{at?, lv?, limit?, label, tip?, enemies:[...]}], // 分波
  zone?: {x0,y0,x1,y1},            // 到达区域（reach 胜利条件用）
  victory: {type:'annihilate'} | {type:'reach', units:['B1','B2']},
  goalText, winText, summary,
  tips: [{on:'turn:1' | 'select:B1' | 'wave:2' | 'teleported' | 'fatigue', text}]
}
```
- `waves[].at`：第几回合的我方阶段开始时出现。如果当前敌人提前清空，下一波也会立刻出现。
- `waves[].limit`：回合上限。第 1 波表示"第 N 回合结束前必须清掉"；之后的波次是"出现时的回合 + N"。

## 6. UI 状态机 `S.mode`
`idle` → 点我方机体 → `moving` →（点格子或空格）→ `menu`
- `menu` 下可以进入：`weapon`、`pick`（空格快速选目标）、`portal`（传送）、`device`（变身选墙位置）。
- 选完武器后：`target` → `confirm` → 攻击 → `finish()` → `idle`。
- 其他武器类型对应的模式：地图炮 `mapdir` → `mapconfirm`；辅助 `support`；修理 `heal`；骇入 `hack`。
- 其他模式：`command`（指挥官下令）、`busy`（动画中）、`enemy`（敌方阶段）、`over`（结束）。
- `S.origin` 不为空表示"已移动但还没确定行动"，这时禁止结束回合。`S.teleported` 和 `S.noUndo` 表示有不可撤回的行动。
- 修改交互时，要同时改三个地方：`actionHTML()`（面板）、`onTile()`（地图点击）、`onAction()`（按钮），必要时还有键盘处理。

## 7. 常见改动怎么做
- **加一个我方角色**：
  1. 在 `ALLY_T` 加模板；
  2. 需要新被动的话，在 `ABIL` 加描述，再用 `Hooks.on` 或在 `hitRate / critRate / REDUCTIONS / finish` 里接入，并用 `hasTrait(u,'key')` 判断（带 Lv10 门槛）；
  3. 在 `placeUnits` 的 `spots` 和需要的关卡 `allies` 里加入它；
  4. 更新 `docs/战棋规则设计.md` 第 11 节。
- **加一种武器效果**：
  1. 给武器加 `special`；
  2. 效果写在 `strikeResolved` 钩子里，或者写进 `strike()`；
  3. `weaponInner()` 里补显示，`forecast()` 里补预测。
- **加减免 / 增伤规则**：往 `REDUCTIONS` 里加一条，stage 2 是百分比，stage 3 是固定值，并记得乘 `c.defMul`。
- **加关卡**：在 `LEVELS` 加一项，在 `<select id="levelSel">` 加 option，在 `docs/教学关设计.md` 写设计和测试结果。
- **加敌人**：在 `ENEMY_T` 加模板。AI 在 `aiAct()`：它枚举可达格 × 武器 × 目标，用 `forecast().exp` 打分，会考虑朝向，`chase` 型敌人会往前压。
- **改规则数值**：先改设计文档，再改代码，两边保持一致。
- **加一个机体图标**：在 `art/mech-icons.js` 的 `BUILD` 里加一个函数（用 `core()` 画通用人型，再叠武器 / 头部装饰），在 `ICON_BY_MECH` 里登记机体名，
  然后跑 `node tools/render-art.mjs` 看对照表、`node tools/build-src.mjs` 同步进游戏。详见 `art/README.md`。
- **图标认不出来怎么办**：先看 `art/out/sheet-zoom22-*.png`（真机 22px 放大 6 倍）。小尺寸下细节会消失，
  所以区分度要落在**剪影**和**胸口核心颜色**（= 战斗分类色）上，而不是靠细节。

## 8. 测试
- 调试接口 `window.__game`：`units, S, onTile(x,y), onAction(name), endTurn, cheatLevel(n), forecast(att,w,def,reaction,opts), canHit, losClear, zoneOf, mapDirs, battle, finish, echoArea, pushUnit, walls, orderMeteor, resolveMeteors, CMD, setTurn(n)`。
- `tests/` 里的脚本都用 Playwright（`npm i playwright`，然后 `npx playwright install chromium`）：
  - `tut1_playthrough.js`：按参考路线通关教学 1；
  - `tut2_flank_bot.js`：优先背击的脚本打完教学 2 的 3 波；
  - `tut3_terrain_sim.js [mountain|air]`：教学 3，对比"山岩落地"和"一直在空中"两种打法，各跑 4 局；
  - `defense_bot.js`：贪心脚本打大规模防卫战，输出每回合的存活情况；
  - `keys_space.js` / `keys_esc.js`：空格快捷操作、Esc 撤回。
- 脚本用 `page.setContent()` 加载片段版，并补上 `[hidden]{display:none!important}`。
- 弹窗处理：`#reactModal`（`[data-c]` 反击 / `[data-r]` 防御回避 / `[data-g]` 援护）、`#endModal`（胜负和编队，`[data-cmd]` / `#btnForm`）、`#askModal`（结束回合确认）。
- 每次改动后至少跑一遍相关脚本，并检查控制台没有错误。

## 8.5 不需要浏览器的自检（`tools/`）
Playwright 需要联网安装；在装不了它的机器上（例如 npm 缓存目录不可写的沙箱），用这几个脚本也能做到基本验证：

| 命令 | 作用 |
|---|---|
| `node tools/check-art.mjs` | 素材模块全组合渲染、`makeSprite`、外描边、光照、预览页脚本语法、数据一致性、**两份 HTML 的内联脚本语法与接入点** |
| `node tools/boot-smoke.mjs` | **启动冒烟**：用最小 DOM / Canvas 替身在 Node 里真的把游戏跑起来——切换全部 5 个关卡、跑 `draw()`、点单位刷面板、验证每个单位都拿到了图标 |
| `node tools/roster.mjs` | **角色池 × 图标覆盖率报告**：读游戏的全部单位模板，按「势力 × 战斗分类」打覆盖表，列出缺图标 / 缺中文名 / 缺调色板的单位（缺项时非 0 退出）。角色池扩大后靠它盯进度 |
| `node tools/render-game.mjs` | **用游戏自己的 `draw()` 把画面渲染成 PNG**（`art/out/game-*.png`）。看不到画面时用这个代替截图 |
| `node tools/zoom-png.mjs <png> <x> <y> <w> <h> <倍数>` | 裁剪 + 最近邻放大一张 PNG，用来放大检查画面局部 |
| `node tools/render-art.mjs` | 把机体图标渲染成 PNG 对照表（`art/out/`），包括「真机 22px 放大 6 倍」的版本 |
| `node tools/build-src.mjs` | 把 `art/mech-icons.js` 注入两份 HTML，并把 fragment 的主体同步到 `index.html`。改完代码必跑 |
| `node tools/diff-src.mjs` | 确认两份 HTML 的游戏主体逐字一致 |
| `node tools/fix-names.mjs [--apply]` | 修复「解压导致乱码」的文件名（先解码验证再改名；不加 `--apply` 只预演） |

### 看不到画面时怎么办（重要）
本机沙箱里 **headless 浏览器起不来**：Chrome 的 mojo 需要命名管道，被沙箱拒绝；
`npm` 的缓存目录在工作区外写不进去，所以 Playwright 也装不上。这种情况下：

- `tools/lib/canvas2d.mjs` 是一份**能真正出像素的 Canvas 2D 实现**（Node 端），
  `tools/render-game.mjs` 拿它顶替浏览器，把游戏自己的 `draw()` 跑成 PNG。
  这是检查画面**最可靠**的办法——它读的就是游戏的真实绘制代码。
- 已知差异：canvas 上的**文字不会渲染**（要内嵌中文字体），所以导出的画面里没有网格坐标数字、
  浮动伤害数字和「撤离区」标签；虚线按实线画。HTML/CSS 界面（顶栏、右侧面板）也不在渲染范围内。
- `boot-smoke.mjs` 里的 Canvas 替身把所有绘制调用当 no-op，所以它只能抓「运行时报错 / 接口对不上」，
  **抓不到画得好不好看**——画面要用 `render-game.mjs` 或真浏览器看。

## 9. 开发约定
- 界面文字、日志、设计文档全部用中文。
- 改代码时，建议用"精确字符串替换 + 断言字符串存在"的方式（之前一直这样做），避免误改。
- 规则先写进设计文档，再改代码。文档和代码不一致时，以作者最新的口头决定为准，并同步修正文档。
- 数值都是暂定。改平衡时，在《教学关设计》里记录测试结果。
- 头像只能使用原创徽章或玩家本地上传的图片，不要内嵌网络上的角色图（版权）。
- 角色名字借用了《高达 00》等作品（洛克昂、刹那、阿雷路亚、提耶利亚），也借用了 Feena 等名字。仅供私下使用；公开发布前需要替换成原创名字。

## 10. 当前进度
**已实现**：
- 三个教学关、大规模防卫战、自由对战；
- 9 台我方机体，含个人特技（Lv10）、Lv20 大招、Lv30 强化；
- 朝向、夹击、破防；直射 / 曲射视线，以及空中目标特例；
- 体积；援护；推击；GN 墙；变身；骇入；陨石指挥官；
- 分波和回合上限；战前编队；
- 头像；攻击特效；空格 / Tab / Esc 快捷操作；
- **美术：地图单位图标（23 个原创矢量图标）+ 表现层改造**
  - 图标覆盖全部我方机体、纳德雷形态、全部敌方机体、陨石残骸；
  - 三层识别：地面标记形状分敌我、剪影分战斗分类、胸口核心颜色 = 分类色；
  - 表现层：机体精灵比格子大（约 1.55 格宽）、按行序互相遮挡、地面环形占位 + 投影、
    机体带暗色外描边、统一光轴的两段硬边赛璐璐明暗、SD 比例（大头 + 发光眼睛 + 粗四肢）；
  - 按显示尺寸自动降细节（LOD）；
  - 顶栏新增「机体名」和「网格」两个开关（默认都关）；
  - `tools/render-game.mjs` 可以在没有浏览器的情况下把游戏画面渲染成 PNG。

**尚未实现，只有设计**：
- 肉鸽模式：大地图、行动力、追猎战、希望、藏品、零件、作战耐久、肉鸽指挥官；
- 剧情模式的奖励结算；
- 尖兵的地图资源；
- 特种的陷阱。

## 11. 已知问题与待办
1. **多段攻击的战斗预测**没有考虑能量屏障的次数上限：打重装要塞时预测显示每段 0，实际只有前 3 段被吃掉。
2. **敌方 AI**：
   - 不会躲避陨石预警；
   - 不会使用地图炮或特殊能力；
   - 只会贪心打分。
3. **平衡**：
   - 雷萨的传送斩有 50% 概率打出"当前 HP 90%"，对 Boss 过强，可能需要 Boss 专属的比例伤害上限；
   - 大规模防卫战靠真人试玩来调；
   - 余响削弱后的强度待观察。
4. **待作者决定的设计**：
   - 雷萨的背景改成类似阿克塞尔，特技会重做，并会获得"月球王国"标签；
   - 阿雷路亚的 Lv20 / Lv30 方向（候选：拉拽型 GN 尾部钳爪）；
   - 陨石的冷却 / 次数，以及 AI 是否躲避；
   - 装甲要不要加保底伤害；
   - 属性和成长公式。
5. 剧情模式"机体被击破降低作战后奖励"还没有实现。
6. **代码结构**：单文件约 3700 行（其中约 1200 行是内联的美术素材模块），继续扩展时建议拆成模块（数据 / 规则 / AI / 渲染 / UI）。拆分后要保留 `window.__game` 测试接口。
7. **美术（待办）**：
   - 机体图标 + 表现层已完成。**下一步最该做的是地形**：`buildTerrain()` 还是程序化色块
     （平原 / 森林 / 山地 / 水域 / 裂谷），地形占画面绝大部分面积，而且是现在最弱的一环 ——
     平坦的纯色方块 + 生硬的方格边界。可以加：每格色调扰动、边界柔化、成簇的树 / 岩石、
     裂谷的深度渐变与岩壁、水岸高光。
   - 再往后：战斗特效（现在是 `FX` 系统画的线和圆）、势力徽章与 UI 皮肤、标题 / 结局界面。
   - **画风天花板**：矢量路线能做到「整洁、统一、可读」，但到不了《SD 高达 G 世纪》那种手绘 /
     3D 渲染质感。那条路要么用 Blender 建模渲染成 2D 精灵，要么委托画师。规格建议见
     `docs/美术后续建议.md`。
   - 头像：`图片库/` 里有 9 张角色图，但都是**有版权的作品图**，所以没有接入；
     游戏的约定是「只用原创徽章或玩家本地导入」，要接入需要先定版权口径。
   - 22px 的格子仍然偏小。现在机体精灵已经放大到约 1.55 格，但如果还想再进一步，
     可以考虑**加地图缩放档位**（现在 `SC` 是自动算的，最大 1.7）。见 `docs/美术后续建议.md`。
