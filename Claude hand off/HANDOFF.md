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
| `art/` | **美术素材**（DSH 负责）：`mech-icons.js`（机体图标的唯一源文件）、`preview.html`（审素材的对照表页面）、`README.md`、`图标待办.md` |
| `audio/` | **音乐素材**（DSH 负责）：`score.js`（乐谱唯一源文件）、`mech-audio.js`（播放层）、`preview.html`（试听页）、`README.md` |
| `tools/` | 开发工具（DSH 写的）：素材光栅化、**游戏画面渲染**、自检、冒烟测试、两份 HTML 的同步生成（见第 8.5 节） |
| `../协作/` | **Claude 和 DSH 的协作文件**：协作日志、任务板、接口约定（见第 12 节） |

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

## 3. 代码结构地图（`src/artifact-fragment.html`，约 6000 行，其中约 1300 行是内联美术模块）
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

## 8. 测试
- 调试接口 `window.__game`（v0.18 新增 `templates`（全部单位模板，给 roster.mjs）、`art`（MechIcons）、`unitSprite`、`iconIdOf`、`levels`）：`units, S, onTile(x,y), onAction(name), endTurn, cheatLevel(n), forecast(att,w,def,reaction,opts), canHit, losClear, zoneOf, mapDirs, battle, finish, echoArea, pushUnit, walls, orderMeteor, resolveMeteors, CMD, setTurn(n)`。
- `tests/` 里的脚本都用 Playwright（`npm i playwright`，然后 `npx playwright install chromium`）：
  - `tut1_playthrough.js`：按参考路线通关教学 1；
  - `tut2_flank_bot.js`：优先背击的脚本打完教学 2 的 3 波；
  - `tut3_terrain_sim.js [mountain|air]`：教学 3，对比"山岩落地"和"一直在空中"两种打法，各跑 4 局；
  - `defense_bot.js`：贪心脚本打大规模防卫战，输出每回合的存活情况；
  - `keys_space.js` / `keys_esc.js`：空格快捷操作、Esc 撤回；
  - `editor.js`：关卡编辑器（刷地形、加敌人加波次、试打、原型关、导出）。
- 脚本用 `page.setContent()` 加载片段版，并补上 `[hidden]{display:none!important}`。
- 弹窗处理：`#reactModal`（`[data-c]` 反击 / `[data-r]` 防御回避 / `[data-g]` 援护）、`#endModal`（胜负和编队，`[data-cmd]` / `#btnForm`）、`#askModal`（结束回合确认）。
- 每次改动后至少跑一遍相关脚本，并检查控制台没有错误。

## 8.5 不需要浏览器的自检（`tools/`）
Playwright 需要联网安装；在装不了它的机器上（例如 npm 缓存目录不可写的沙箱），用这几个脚本也能做到基本验证：

| 命令 | 作用 |
|---|---|
| `node tools/check-art.mjs` | 素材模块全组合渲染、`makeSprite`、外描边、光照、预览页脚本语法、数据一致性、**两份 HTML 的内联脚本语法与接入点** |
| `node tools/boot-smoke.mjs` | **启动冒烟**：用最小 DOM / Canvas 替身在 Node 里真的把游戏跑起来——切换 5 个关卡（会自动点编队界面的「开始作战」）、跑 `draw()`、点单位刷面板、验证每个单位都拿到了图标 |
| `node tools/roster.mjs` | **角色池 × 图标覆盖率报告**：读 `window.__game.templates` 里的全部单位模板，按「势力 × 战斗分类」打覆盖表，列出缺图标 / 缺中文名 / 缺调色板的单位（缺项时非 0 退出）。角色池扩大后靠它盯进度 |
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
- **源文件在 `src/shell.html` + `src/css/` + `src/js/`**（需求单 #1，见 `src/README.md`）；fragment 和 index.html 是生成物，改完跑 `node tools/build-src.mjs`。
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
- 朝向、夹击（侧击 / 背击降闪避、无视部分装甲）；直射 / 曲射视线，以及空中目标特例；
- 体积；援护；推击；GN 墙；变身；骇入；陨石指挥官；
- 分波和回合上限；战前编队；
- 头像；攻击特效；空格 / Tab / Esc 快捷操作。

**尚未实现，只有设计**：
- 肉鸽模式：大地图、行动力、追猎战、希望、藏品、零件、作战耐久、肉鸽指挥官；
- 剧情模式的奖励结算；
- 尖兵的地图资源；
- 特种的陷阱。


## 10.1 v0.16 新增（本次）
- **角色扩充到 34 人**：新增克莱因派（SEED，8 人）、预防者（高达 W，7 人）、ATX（机战 OG，5 人）、米斯里尔（全金属狂潮，5 人）4 个势力，共 25 人。（`commandOnly` 纯指挥官机制和 `cmdOnly()` 还保留在代码里，目前没有角色用。）完整数据见 `docs/角色与敌人一览.md`，该文档由游戏数据生成。
- **通用特技系统**：`TRAIT_FX` 表，可以声明 hit / eva / crit / dmg / red / armorPct，支持常数、函数和光环（aura）。个人特技和敌方能力共用这张表。
- **弱点 / 抗性**：
  - 敌人模板上的 `weak:{光束:30, 物理:-60, ...}`；
  - 正数在生成阶段增伤（`genMods`），负数在百分比阶段减免（REDUCTIONS 里的 `resist`）。
- **新伤害类型「特殊」**：只经过 `shield:true` 的减免条目，即能量屏障、λ 力场、护盾值。
- **护盾值**：模板字段 `shield / shieldLv / shieldName`，减免管线第 4 阶段吸收伤害，己方阶段开始时回满。
- **新武器机制**：
  - `special`：`lock`（多重锁定，UI 模式 `lock`）、`funnel`（浮游炮 16 段，随机方向，闪避减半）、`splash`、`pull`、`execute`；
  - 地图炮 `shape:'line'|'burst'` 和 `iff`（敌我识别）；
  - 升级字段通过 `wv(u, w, key)` 读取：`lockN / rad / width / exec / again / disarm`。
- **指挥技能框架**（`COMMANDS[].kind`，目前只有 Feena 的 meteor 在用，5 个新指挥技能随指挥官一起删掉了，`execCommand()` 里的分支保留）：
  - `area`（立即或延迟）；
  - `enemy`（指定敌机）；
  - `ally`（再动）；
  - `instant`（全体）。
- **侧击 / 背击**：取消破防 debuff，改为目标闪避 −10 / −20、无视 25% / 50% 装甲，只对这一击生效。破防只由标记类技能附加。
- **编队**：
  - 关卡字段 `maxDeploy / spots / rosterLv / defaultDeploy`；
  - `showFormation(done(picked))` 选出击机体和指挥官，`placeAllies()` 负责放到出击点；
  - 出击上限：防卫战 10 台，弱点演习 8 台，自由对战 8 台。
- **新关卡**：
  - 弱点演习（4 波 16 种新敌人）；
  - 40 个「角色试炼」：由 `TRIALS` 配置表 + `makeTrial()` 生成，关卡 id 为 `trial_<机体代号>`。
- **测试**：`tests/trials_run.js` + `tests/trial_bot_inpage.js`，用贪心机器人跑所有试炼关，检查报错和能否打完。

## 10.2 v0.17 肉鸽模式试作版
- 入口：关卡菜单 →「肉鸽模式（试作）」（`startLevel('roguelike')` → `runOpen()`）。设计见 `docs/肉鸽模式设计.md`。
- **代码**：脚本末尾的「肉鸽模式」一节。
  - 全局状态在 `RUN`；
  - 大地图：`genLayer` 生成，`runRender` / `mapSVG` 渲染到 `#runView`，覆盖整个页面；
  - 战斗：`runBattle(kind)` 动态生成 `LEVELS.run` 后调用 `startLevel('run')`；
  - 结算：`victory()` / `defeat()` 遇到 `LV.run` 时转给 `runBattleEnd(win)`；
  - 弹窗：统一用 `dlg(html)`（返回 Promise）。
- **关卡字段**：`rosterList`（按等级生成出击候选）、`noCmd`（编队里不显示指挥官选择）、`afterStart`（开局后挂词缀、侵蚀场，并设置 Feena 指挥官）。
- **战斗修正**：`RM()` 返回本场的肉鸽修正，接在 `genMods`、`softRed`、`hitRate`、`effRange` 和两个 Hooks（过载自损、击破计数）上。
- **测试**：`tests/run_bot.js` + `tests/run_bot_inpage.js`，跑一整局。可以加参数让作战耐久变成 999，方便跑完全程。

## 10.3 肉鸽游玩记录
- **代码**：肉鸽模块之后的「肉鸽游玩记录」一节。
  - `rlog(type, data)` 把事件写进 `RUN.events`；`runLog()` 写的文字记录也会同步进来。
  - 本地存在 localStorage，键名 `mecha-tactics-runlogs`。
  - 云端在 artifact 的 db 里：`runlogs/<uid>/runs/<runId>`。
- **发布时的 capabilities**：`db`（规则：`runlogs` 只有 owner 可读写；`runlogs/{self}` 是 interact 级）、`user`、`downloads`。
- **单独打开的 html**：没有 `window.claude`，只能本地保存和下载，下载走 Blob 链接，失败时退回复制到剪贴板。

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
6. **代码结构**：单文件约 6000 行（其中约 1300 行是内联的美术素材模块），继续扩展时建议拆成模块（数据 / 规则 / AI / 渲染 / UI）。拆分后要保留 `window.__game` 测试接口。

## 10.6 v0.18：合并 DSH 的美术表现层
- DSH 在 v0.15 上做的美术表现层，已由 Claude 移植进 v0.17，版本号升为 v0.18。具体内容是：
  - 23 个原创矢量图标；
  - 机体精灵比格子大，按行序互相遮挡；
  - 地面环加投影；
  - 统一光照和外描边；
  - 「机体名 / 网格」开关；
  - 多段条、徽记、光罩、连线、地块修饰这些组件。
- 合并时顺带做的修正：
  - **缺图标的回退路径**用了未定义的 `BAR_H`，会报错。改成：先借用同战斗分类的原型剪影（`stockIcon()`），敌方按体积借用；
  - **护盾**：光罩只在 `u.shieldHp > 0` 时显示（`u.shield` 是上限）；血条前面多一段青色护盾条；
  - **隐身**：`hasStealth(u)` 的单位半透明；
  - **选目标标记**：▶ 和锁定序号移到机体之后绘制，不会被精灵盖住；
  - **`mech-icons.js`**：新增 4 套势力配色（克莱因派 / 预防者 / ATX / 米斯里尔）；去掉「医疗」分类色，M3 改为辅助；
  - **工具**：`roster.mjs` 改读 `__game.templates`；`boot-smoke.mjs` 和 `render-game.mjs` 会自动通过编队界面。
- 验证（都通过，且没有控制台错误）：
  - DSH 的自检：`check-art`、`boot-smoke`、`roster`；
  - Claude 的浏览器测试：教学 1–3、按键、防卫战、肉鸽整局、34 个试玩关。
- 还缺 41 个专属图标，清单见 `art/图标待办.md`。

## 10.7 v0.19 / v0.20：音频
- **v0.19（DSH）**：
  - `audio/mech-audio.js`（`MechAudio`）：用 Web Audio 现场合成；8 首 cue、9 个音效；由 `build-src` 注入（`AUDIO BEGIN/END`）；
  - `audio/preview.html` 试听页；`tools/check-audio.mjs` 自检；
  - ATX / 米斯里尔配色定稿；`git init`。
- **v0.20（Claude）**：
  - 游戏里接上了切歌和音效（fragment 末尾「音频接线」一节）；
  - 顶栏「声音」按钮 / M 键静音；
  - `__game.sound`；测试 `tests/audio_cues.js`。
  - 细节见 `../协作/接口约定.md` 第 4 节。

## 10.8 v0.23：模式划分与默认入口
- 「关卡」下拉菜单分三类：★ 肉鸽模式（推荐）/ 剧情模式（待施工，放原型关卡）/ 机体展示（原「角色试炼」，按势力分组）。
- 打开页面默认进入肉鸽（文件末尾 `startLevel('roguelike')`）。
- **肉鸽进行中切换模式**：`#levelSel.onchange` 把正在打的那一战存进 `RUN_BATTLE`，包括 `level / LV / units / map / roster / turn / walls / CMD / 波次 / 日志` 等；切回时 `runOpen()` 调 `runBattleResume()` 原样恢复。肉鸽对话框开着时不让切。
- `startLevel()` 开头会关掉上一个模式留下的对话框。
- 测试：`tests/mode_switch.js`（7 项断言）。`keys_esc`、`tut1_playthrough`、`audio_cues` 改成先选教学 1。
- GitHub：公开仓库 `fanboy3006/mecha-tactics`，从 v0.22 开始推送（全新历史，不含 `图片库` 和作者邮箱）。这个会话不能建 Release，所以试玩下载走仓库里的 `index.html`。

## 10.9 v0.27：关卡编辑器
- 入口：「关卡」菜单最下面「工具 → 关卡编辑器」（`level = 'editor'`，`#editView`）。可编辑**全部肉鸽关（ISW-…）和原型关**（教学 1–3、防卫战、弱点演习）。
- 工具：刷地形 / 放敌人（模板、等级、朝向，放进当前选中的波次）/ 出击点 / 移动 / 删除；波次面板可加波、删波、改「第几回合到达」；可改名字、宽高、词缀。
- 存储：`edStore()` → localStorage `ED_KEY`，浏览器不让存时退回内存 `ED_ALL`（状态栏会提示先导出）。
- **▶ 试打**：`edTest()` 用当前编辑结果生成 `LEVELS.edit`，`startLevel('edit')`；我方全员可选，等级用「试打我方 Lv」。打完「回编辑器」。
- **导出**：`edExport()` → `{version, exportedAt, edits:{关卡号: override}}`（下载或复制）。
- **写进游戏（Claude 做）**：把导出的 `edits` 原样贴进 fragment 里的 `const LEVEL_EDITS = {...}`。
  - ISW 关：在 `NAME_A` 之前合并进 `STAGE_OVERRIDES`（`rows/enemies/waves/spots/affix/name/w/h`）；
  - 原型关：编辑器模块末尾 `applyLevelEdit(LEVELS[id], o)`（`rows/enemies/allies/spots/waveEnemies`）。
  - 贴完跑 `tests/editor.js` 和相关关卡的测试，再更新 `docs/肉鸽关卡表.md`（`gen_stage_table.js`）。
- `__game.editor` → `{ED, store}`；测试 `tests/editor.js`。

## 12. 协作（Claude ↔ DSH）
- **2026-10-06 起分三条 Claude 对话（规则 / 角色设计 / 关卡设计），地盘划分见 `../协作/分工与派活指南.md` 第 1.5 节。**
- **2026-10-05 起的分工和 DeepSeek 派活流程见 `../协作/分工与派活指南.md`**（直接编程交给 DeepSeek，Claude 写需求单、审改动）。
见 `C:\DSH-机战\协作\`：
- `协作日志.md`：每次交付都记一条；
- `任务板.md`：分工和进行中的任务；
- `接口约定.md`：游戏暴露给美术、音乐和工具的字段与接口。

开工前先读日志。

## 13. 路线决定（作者 2026-10-04）
- **网页版的定位**：规则原型 + 活的规则书。
  - DSH 做的美术和音乐，是为了让作者自己试玩时更愿意玩下去；不要求能带到正式版，可以继续做。
- **最终目标**：迁移到 Unity，上 Steam。
- **切换标准**：肉鸽完全可玩、作者自己愿意玩，就全部转入 Unity 迁移。
  - 在那之前还缺的主要机制：装备插槽、藏品掉落（以及局外成长、结局、难度）。
- **对照用例**：作者已同意。网页版要准备一套「同样输入 → 同样输出」的用例，作为 Unity 版的验收标准：
  - 关卡编号 → 地形与敌人；
  - 固定随机种子 → 伤害、命中与战斗结果。
- **原创世界观、剧本与美术**：等朋友试玩觉得好玩后，作者再重写。
  - **肉鸽完成之前不动这方面内容**，所以借用的角色名和机制暂时保留，不算返工风险。
