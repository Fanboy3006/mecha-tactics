# 机甲战棋 · 本地 Claude Code 开工说明

本地 Claude Code 每次启动都会自动读这份文件。作者 10-10 起在本地用 Claude Code 接 DeepSeek API 干活，以节省 Opus 用量；本文件由统筹对话维护。
**开工第一件事**：先问作者「这次是哪个对话」，没说就当作「规则」。然后读下表里对应的开工文档，再读 `协作/任务板.md`。

## 1. 项目是什么
- 单文件 HTML 战棋游戏（世界观来自作者的「月球王国」设定），作者在浏览器里试玩。
- 源码：`Claude hand off/src/js/*.js`。这些文件是**同一个 IIFE 的片段**，由 `src/shell.html` 里的 `<!-- @include js/... -->` 按顺序拼起来。
  - 片段不是独立模块：单独看括号不配对是正常的，**不要「修」括号，不要删 IIFE 的开头或收尾**；
  - 顶层的 `const` 互相可见，片段的顺序有意义。
- 生成物（**不要手改，冲突时直接重新生成**）：`Claude hand off/src/artifact-fragment.html`、`Claude hand off/src/index.html`、根目录 `index.html`。
- 设计文档：`Claude hand off/docs/`（规则书是 `战棋规则设计.md`）。协作文档：`协作/`（任务板、需求单、各对话的交接）。

## 2. 六条线（谁的地盘谁改）
| 线 | 负责 | 主要文件 | 开工先读 |
|---|---|---|---|
| 规则（兼统筹） | 战斗公式、AI 框架、地形、通用系统、规则试玩场、构建 / 测试 / 发布 / 版本号 | 01–03、07–25、27、29、`05b`、`31` 的 runBattle、`31b`–`31d`、`tools/build-*.mjs` | `协作/规则对话状态.md`、`协作/分工与派活指南.md` |
| 角色（友方） | 我方机体、武器、技能、职业、档位平衡 | `04` 的 `ALLY_T`、`06`、`03` 新个人特技、`17b` | `协作/角色对话状态.md` |
| 敌方 | 敌人概念、能力、武器、**敌人强度**（模板数值、梯队、等级曲线、词缀）、关底 Boss | `04` 的 `ENEMY_T`、`30b` 的梯队表和 `ENEMY_SCALE`、`07` 的 `ENEMY_SUPPORT / ENEMY_OVERWATCH`、`31` 的 `runEnemyLv` | `协作/敌方设计对话·开工包.md` |
| 关卡 | 地图生成、敌人编成、关卡目标、教学关、战术挑战、肉鸽层与节点 | `05`、`05c`、`10`、`26`、`28`、`30`、`30b` 的 `stageObj / respawnFoes` | `Claude hand off/docs/关卡设计交接.md` |
| 美术 | 图标、地形贴图、特效、机体精灵 | `art/`、`20-绘制.js` 里的 `buildTerrain / fx / fxAttack / unitSprite / spriteSpec / spriteRect / drawRelay` | `Claude hand off/docs/美术交接.md` |
| 音乐 | 曲目、场景配曲、音效 | `audio/`、`31d` 的音频接线、`build-src.mjs` 的 `AUDIO_ON` | `Claude hand off/docs/音乐交接.md` |

- **别人的地盘不动**：要别的线改，写进 `协作/需求单.md`，注明「给 规则 / 角色 / 敌方 / 关卡 / 美术 / 音乐」。
- 例外：角色、敌方两条线可以直接改规则文件，但必须在 `协作/角色对话→规则交接.md` / `协作/敌方对话→规则交接.md` 里写清改了什么、为什么。
- 伤害公式（`15-战斗计算.js` 的 `statCoef` 等）只归规则线。

## 3. 每次改完的固定流程
1. `git pull --rebase origin main`；
2. 改源码（只改 `src/js/` 等源文件）；
3. `node tools/build-src.mjs`（重新生成两份 HTML）；
4. 跑相关测试：`cd "Claude hand off/tests"`，再 `node <测试名>.js`（Playwright）。
   - 输出里有 `✗` 或者 `ERRS [...]` 不是空的，就是失败；
   - 测试只能通过 `window.__game` 访问游戏内部，需要的变量加进 `31d` 的 `__game`（归规则线）；
   - 已知坏的：`tut1_playthrough.js`（v0.39.1 起）、`run_bot_inpage.js` / `trial_bot_inpage.js`（这两个是注入页面用的，不能单独跑），`tut3_terrain_sim.js` 偶尔随机输一局；
5. 版本号 +0.0.1：`Claude hand off/src/js/31b-游玩记录与开场菜单.js` 里的 `GAME_VERSION`（大版本 +0.1 由规则线定）；改完再跑一次 build-src；
6. 在 `协作/任务板.md` 自己那一栏改状态，和代码一起提交；
7. 提交说明以线别开头：`[规则]`、`[角色]`、`[敌方]`、`[关卡]`、`[美术]`、`[音乐]`，然后 `git push origin main`。

## 4. 试玩页
- 作者本地直接双击根目录 `index.html` 就能玩，平时以它为准。
- claude.ai 上的试玩页（`https://claude.ai/artifact/DCAtoqhJA8mxFMpvzp8vgc`）只能从 claude.ai 的对话发布，本地发不了。
  - 本地做完后在任务板上写「待发布 vX.Y.Z」，由规则 / 统筹对话执行 `node tools/build-artifact.mjs` 再发布。

## 5. 硬规矩
- **版权**：`图片库/` 的作品截图、`audio/` 根目录下的版权 mp3，**绝不进仓库**（已在 .gitignore 里）。不照搬原作机体设计、不抄已有歌曲旋律。`audio/SUNO/` 是作者自己用 Suno 生成的，可以进仓库。
- **不要自作主张多改**：只改任务要求的地方，不顺手重构、不改格式、不改换行符（仓库统一 LF）。
- **不确定就问作者**，尤其是数值方向和设计取舍；作者拍板的决定写进对应的设计文档。
- 单个 js 文件超过约 4 万字符要拆分，拆完拼出来的页面必须逐字节不变（找规则线做）。
- 回复作者用中文、简短：做了什么、测试结果、还剩什么。
