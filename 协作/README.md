# 协作说明（Claude ↔ DSH）

两个 agent 之间**没有直接通信**：
- Claude 在云端，通过 Claude 桌面应用读写本文件夹（已授权 `C:\DSH-机战`）；它在你电脑上没有终端。
- DSH 在你本机工作。

所以本文件夹就是**唯一的共享仓库**，沟通全靠下面三份文件，作者负责转告「该你了」。

## 文件
| 文件 | 用途 | 谁写 |
|---|---|---|
| `协作日志.md` | 每次交付追加一条（最新的放最上面） | 双方 |
| `任务板.md` | 待办，按负责人分栏；开工前在条目上标「🔒进行中」 | 双方 |
| `接口约定.md` | 游戏 ↔ 美术 / 音乐 / 工具之间的字段与函数约定 | 改接口的一方先登记 |

## 唯一源文件
| 内容 | 源文件 | 生成物（不要手改） |
|---|---|---|
| 游戏 | `Claude hand off/src/artifact-fragment.html` | `src/index.html`（`node tools/build-src.mjs`） |
| 机体图标 | `art/mech-icons.js` | HTML 里 `ART:mech-icons BEGIN/END` 之间那段 |
| 音乐 | `audio/score.js` | `audio/out/*` |
| 设计文档 | `Claude hand off/docs/*.md` | Claude 同时同步到 claude.ai 项目 |

## 分工
- **Claude 负责**：规则、数据（`ALLY_T` / `ENEMY_T` / `LEVELS` / 肉鸽）、AI、界面逻辑、设计文档、浏览器自动化测试（Playwright：整局、教学关、试玩关），以及发布 claude.ai 页面。
- **DSH 负责**：`art/`、`audio/`、`tools/`，以及游戏里的**绘制层**：
  - `drawUnitGround` / `drawUnitSprite` / `drawUnitAura` / `drawUnitStatus`；
  - `segBar` / `badgeRow` / `auraRing` / `unitLink` / `tileDecor`；
  - `buildTerrain`、`drawFX`；
  - 以后的音频接入层。
- 越界的改动尽量小，**必须在日志里写明**。

## 一次交接的流程
1. **开工前**：读 `协作日志.md` 最上面几条和 `任务板.md`，再把要做的条目标成「🔒进行中（名字）」。
2. **做完**：
   1. 跑自检：DSH 跑 `node tools/build-src.mjs && node tools/check-art.mjs && node tools/boot-smoke.mjs && node tools/roster.mjs`，Claude 再加跑 `tests/` 里的浏览器测试；
   2. 版本号加一（游戏里的 `GAME_VERSION` 和顶栏）；
   3. 在 `协作日志.md` 顶部追加一条。
3. **交接**：作者转告另一方「X 交付了 vN，看日志」。

## 版本管理（建议）
请 DSH 在本文件夹执行一次 `git init`，之后每次交接各提交一次（commit 信息照抄日志标题）。Claude 看不到 git，靠日志和文件修改时间判断，不受影响。
在没有 git 之前，覆盖旧版本前先把旧版放进 `_备份/vX/`。
