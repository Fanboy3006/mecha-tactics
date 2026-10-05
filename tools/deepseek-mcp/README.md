# deepseek-mcp（需求单 #4）

一个**本地 stdio MCP 服务器**，让 Claude 桌面版在同一个界面里直接派活给 DeepSeek 改 `C:\DSH-机战`：
Claude 写完需求 → 调 `ds_code` → DeepSeek（Aider）自己读文件、改文件、git 提交 → 自动跑构建检查（和可选的测试）→
只把**提交号、`git diff --stat`、✓/✗ 行、`ERRS` 行**回给 Claude。不用作者在两个窗口之间转述。

```
Claude 桌面版 ──stdio(MCP)──> server.mjs ──> aider --model deepseek/deepseek-chat ──> DeepSeek API
                                    │
                                    ├─> node tools/build-src.mjs --check
                                    └─> node <你指定的测试脚本>
```

## 1. 装什么（一次性）

```powershell
# 1) 项目里的 MCP 依赖
cd C:\DSH-机战\tools\deepseek-mcp
npm install

# 2) Aider（DeepSeek 的改代码执行器）—— 见下面「别踩的坑」，用 Python 3.12
pip install uv                                    # 只要 uv，或者用已经装好的
uv venv --python 3.12 "$env:USERPROFILE\.aider312"
uv pip install --python "$env:USERPROFILE\.aider312\Scripts\python.exe" aider-chat
& "$env:USERPROFILE\.aider312\Scripts\aider.exe" --version    # 能打印 aider 0.86.x 就行

# 3) 自己的 DeepSeek API key（在 platform.deepseek.com 申请），填到 claude_desktop_config.json 的 env 里
```

`node_modules/`、`.aider*`、`.env` 都已经在 `.gitignore` 里，不会进仓库；**API key 只放环境变量，永远不进仓库**。

> **⚠ 别踩的坑（本机 2026-10-05 实际踩过）**
> 直接 `pip install aider-chat` 在 **Python 3.13 / 3.14** 上会失败，最后报
> `BackendUnavailable: Cannot import 'setuptools.build_meta'`。原因不是 setuptools：
> 新版 aider 没声明支持 3.13+，pip 于是**悄悄退回 2023 年的 `aider-chat 0.16.0`**，
> 而那个版本死锁 `numpy==1.24.3`、`scipy==1.10.1`、`tiktoken==0.4.0`、`aiohttp==3.8.4`，
> 这些都没有 3.13 / 3.14 的 wheel，pip 只好去**源码编译 numpy**，编译环境一崩就报上面那个错。
> 用 **Python 3.12**（上面 uv 的命令会自动下好 CPython 3.12）就一路都是 wheel，秒装。
> 本机已经装好：`C:\Users\zxwu0\.aider312\Scripts\aider.exe`（aider 0.86.2）。

**aider 不在 PATH 里也没关系**：把它填给 `DS_MCP_AIDER_CMD` 就行（下一节）。

## 2. 接到 Claude 桌面版

**先找到配置文件在哪**——两个地方，看你装的是哪个版本：

| 版本 | 路径 |
|---|---|
| 官网下载的 `.exe` 安装版 | `%APPDATA%\Claude\claude_desktop_config.json`，即 `C:\Users\<你>\AppData\Roaming\Claude\claude_desktop_config.json` |
| **Microsoft Store（MSIX）版** | 被系统重定向到 `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` |

不确定就用这条命令直接问出完整路径（找不到就是还没启动过桌面版）：

```powershell
Get-ChildItem "$env:APPDATA\Claude\claude_desktop_config.json",
              "$env:LOCALAPPDATA\Packages\Claude_*\LocalCache\Roaming\Claude\claude_desktop_config.json" `
              -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime
```

> 本机（作者 2026-10-05）是**商店版**，`%APPDATA%\Claude` 根本不存在，真实路径是
> `C:\Users\zxwu0\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`。

**然后在那个文件里加 `mcpServers`**（已经有别的服务器就在同一个对象里加一项；文件里还有 `preferences`
之类的其它内容，**别整个文件替换掉**，只加这一段）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "node",
      "args": ["C:\\DSH-机战\\tools\\deepseek-mcp\\server.mjs"],
      "env": {
        "DEEPSEEK_API_KEY": "sk-在这里填你的key",
        "DS_MCP_AIDER_CMD": "C:\\Users\\zxwu0\\.aider312\\Scripts\\aider.exe"
      }
    }
  }
}
```

- 改完**先做一次体检**：`node tools/deepseek-mcp/doctor.mjs` —— 它会告诉你配置文件的真实位置、JSON 有没有写坏、
  key 和 `server.mjs` / `aider.exe` 路径对不对（key 只打码显示前缀和长度）。
- JSON 里的反斜杠要写两个：`C:\\DSH-机战\\...`。路径用引号包好，中文目录名没问题。
- `DS_MCP_AIDER_CMD` 建议**一定填**（指向第 1 节装出来的 `aider.exe` 完整路径）：这样不用管 PATH，
  也不会和系统里别的 Python 抢 `aider` 这个名字。
- 如果桌面版报 `node` 找不到，把 `command` 换成绝对路径：`"C:\\Program Files\\nodejs\\node.exe"`。
- 环境变量只在**这个服务器进程**里生效，不会影响系统别的东西。
- **改之前先把桌面版完全退出**（托盘右键也要退），否则它退出时会把这个文件写回去、把你的改动冲掉；
  改完再启动，Claude 的工具列表里就会出现 `ds_code` 和 `ds_status`。

## 3. 两个工具

### `ds_code({task, files?, test?})`

| 参数 | 说明 |
|---|---|
| `task` | 要 DeepSeek 做的事（必填），写清改哪个文件、改成什么样 |
| `files` | 交给 aider 的文件（可省）。仓库相对路径；`tests/class_mech.js` 和 `Claude hand off/tests/class_mech.js` 两种写法都认 |
| `test` | 改完要跑的测试脚本（可省），同上 |

干的事，按顺序：

1. 在 `C:\DSH-机战` 里跑
   `aider --model deepseek/deepseek-chat --yes-always --no-check-update --no-pretty --message <task> <files...>`
   （aider 自己读文件、改文件、**git 提交**）；
2. 自动跑 `node tools/build-src.mjs --check`；
3. 给了 `test` 就再跑那个脚本；
4. 返回一小段（**不超过 4000 字**）：提交号、`git diff --stat`、构建检查结论 + ✓/✗ 行、
   测试结论 + ✓/✗ 行 + `ERRS` 行、aider 输出的最后几行。**不回整段代码。**

构建检查或测试有问题时，返回的 `isError` 是 true，Claude 一眼能看出这轮没通过。

> **一个实测细节**：aider **出错时也可能返回退出码 0**（实测：key 不对时它打印 `Authentication Fails` 然后照样 exit 0）。
> 所以 `ds_code` 不只信退出码，还会自己数一遍「这次到底动没动文件」：
> 一个文件都没改、也没有新提交时明确写 ⚠；输出里有 `Authentication Fails` / `litellm.*Error` / `Traceback` 这类字样时直接判 `isError`。

### `ds_status()`

`git log --oneline -5`、`git status --short`，外加当前分支和与上游差几个提交。开工前先看一眼很有用。

## 4. 安全边界（需求单 #4 定的，代码里硬拦）

- **只能在项目根目录里操作**：默认 `C:\DSH-机战`（按 `server.mjs` 的位置算出来的，移动整个项目也认）。
  所有路径先夹一遍，`..` 越界、绝对路径越界、软链接指向外面 —— 一律当场拒绝，**不会启动 aider**。
- **不发给 DeepSeek 的东西**：`图片库/`（没进仓库的版权图）、`.git/`、`node_modules/` 直接进禁区。
- **不 push、不碰 GitHub**：Server 只做提交，推送仍然由 DSH 在协作流程里做。
- **不碰世界观 / 剧情设定以外的额外上下文**：aider 只看它自己读到的仓库文件（仓库本来就是公开的）。
- `ds_code` 跑完的改动都是 aider 提的**本地提交**，Claude 审 diff 不合意可以直接 `git reset` / `git revert`。

## 5. 环境变量（都有默认值，一般不用设）

| 变量 | 默认 | 作用 |
|---|---|---|
| `DEEPSEEK_API_KEY` | （必填） | aider 的 key，写在 `claude_desktop_config.json` 的 `env` 里 |
| `DS_MCP_MODEL` | `deepseek/deepseek-chat` | 换模型 |
| `DS_MCP_TIMEOUT_MS` | `900000` | aider 单次超时（15 分钟） |
| `DS_MCP_TEST_TIMEOUT_MS` | `600000` | 测试脚本超时（10 分钟） |
| `DS_MCP_MAX_CHARS` | `4000` | 返回文本上限 |
| `DS_MCP_ROOT` | 项目根 | **只给自检用**；正式使用不要设 |
| `DS_MCP_AIDER_CMD` | 空（用 PATH 里的 `aider`） | 指向 `aider.exe` 的完整路径（**推荐**）。`.mjs` / `.js` 会当 Node 脚本跑（只有自检的假 aider 用），`.cmd` / `.bat` 走 `cmd.exe /c` |

## 6. 自检

```powershell
node tools/deepseek-mcp/selftest.mjs
```

不联网、不装 aider、不要 key、**不碰真仓库**：在系统临时目录里造一个假项目，跑一遍
路径守卫 → `ds_code` 全流程（假 aider + 构建检查 + 测试）→ `ds_status` → 真的起 `server.mjs`
走 MCP 握手（`initialize` / `tools/list` / `tools/call`）。全过会打印「全部通过」。

> 自检必须能起子进程；在被沙箱管住的终端里会报 `EPERM`，普通 PowerShell 窗口里跑就行。

## 7. 出问题先看这几条

| 现象 | 原因 / 办法 |
|---|---|
| 桌面版里看不到这两个工具 | 先跑 `node tools/deepseek-mcp/doctor.mjs`。最常见两种：①**把整份内容「追加」进了已有文件**，变成两个 JSON 对象粘在一起（跑 `doctor.mjs --fix` 能修，会先备份原文件）；②改了配置但没**完全**重启桌面版 |
| 配置文件里的改动被冲掉了 | 改之前桌面版没退出：它退出时会把自己的状态写回这个文件。先完全退出再改 |
| 返回「没有 DEEPSEEK_API_KEY」 | key 没写进 `env`，或者写了没重启 |
| 返回「找不到 aider 命令」 | 没装，或不在 PATH 里。用第 1 节的 Python 3.12 + uv 装，然后把 `DS_MCP_AIDER_CMD` 指到 `aider.exe` 完整路径 |
| 装 aider 时报 `Cannot import 'setuptools.build_meta'` | 用了 Python 3.13 / 3.14，pip 退回了 2023 年的 aider 0.16.0 并去源码编译 numpy。改用 Python 3.12（见第 1 节的坑） |
| aider 起来了但报 401 / 没权限 | `DEEPSEEK_API_KEY` 不对或没余额；key 是在 platform.deepseek.com 申请的 |
| aider 超时 | 任务太大，拆成几个小任务；或调大 `DS_MCP_TIMEOUT_MS` |
| 测试跑不起来（`Cannot find module 'playwright'`） | 测试脚本要 Playwright：`npm i playwright` + `npx playwright install chromium`（见 `Claude hand off/tests/README.md`） |
| 中文任务乱码 | 服务器已经给 aider 设了 `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1`；还有问题就看 aider 输出尾部 |

## 8. 文件

| 文件 | 作用 |
|---|---|
| `server.mjs` | MCP 服务器入口：只做 MCP ↔ 工具的接线 |
| `tools.mjs` | `ds_code` / `ds_status` 的实现，以及工具清单 |
| `lib.mjs` | 路径守卫、子进程、输出裁剪 |
| `doctor.mjs` | 配置体检：找出配置文件真实位置、验 JSON、把 key 打码、检查 aiders 和 server.mjs 在不在。`--fix` 能修「两个 JSON 对象粘在一起」这种手改事故（先备份） |
| `selftest.mjs` | 自检（上面第 6 节） |
| `test/fake-aider.mjs` | 自检用的假 aider（正式使用永远走不到） |

## ds_code 的固定流程（需求单 #5 起）

1. 任务前自动加一段提醒：`src/js` 里单个文件括号不配对是正常的，不要修；
2. aider 参数带 `--line-endings lf --no-auto-lint`；
3. aider 结束后把改到的文本文件统一成 LF，跑一次 `node tools/build-src.mjs`，有变化就并入同一个提交；
4. 再跑 `build-src --check`，给了 `test` 就跑那个测试（本机已装 Playwright，装在 `Claude hand off/tests/node_modules`，不进仓库）。
