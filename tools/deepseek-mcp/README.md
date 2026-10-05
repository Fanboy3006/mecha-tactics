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

# 2) Aider（DeepSeek 的改代码执行器）
pip install aider-chat
aider --version          # 能打印版本就行

# 3) 自己的 DeepSeek API key（在 platform.deepseek.com 申请）
```

`node_modules/` 已经在 `.gitignore` 里，不会进仓库；**API key 只放环境变量，永远不进仓库**。

## 2. 接到 Claude 桌面版

配置文件在 `%APPDATA%\Claude\claude_desktop_config.json`（Windows 路径一般是
`C:\Users\<你>\AppData\Roaming\Claude\claude_desktop_config.json`）。把这一段加进 `mcpServers`
（已经有别的服务器就在同一个对象里加一项，别整个文件替换掉）：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "node",
      "args": ["C:\\DSH-机战\\tools\\deepseek-mcp\\server.mjs"],
      "env": {
        "DEEPSEEK_API_KEY": "sk-在这里填你的key"
      }
    }
  }
}
```

- JSON 里的反斜杠要写两个：`C:\\DSH-机战\\...`。路径用引号包好，中文目录名没问题。
- 如果桌面版报 `node` 找不到，把 `command` 换成绝对路径：`"C:\\Program Files\\nodejs\\node.exe"`。
- 环境变量只在**这个服务器进程**里生效，不会影响系统别的东西。
- 改完配置**完全退出桌面版再启动**（托盘里也要退干净），Claude 的工具列表里就会出现
  `ds_code` 和 `ds_status`。

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
| `DS_MCP_AIDER_CMD` | 空（用 `aider`） | **只给自检用**：换成假 aider 脚本 |

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
| 桌面版工具列表里没有 `ds_code` | 配置没读到（路径 / JSON 语法）或没完全重启桌面版；`claude_desktop_config.json` 里 JSON 不能有注释 |
| 返回「没有 DEEPSEEK_API_KEY」 | key 没写进 `env`，或者写了没重启 |
| 返回「找不到 aider 命令」 | 没装（`pip install aider-chat`），或 aider 不在 PATH 里；把 `DS_MCP_AIDER_CMD` 指到 `aider.exe` 全路径 |
| aider 超时 | 任务太大，拆成几个小任务；或调大 `DS_MCP_TIMEOUT_MS` |
| 测试跑不起来（`Cannot find module 'playwright'`） | 测试脚本要 Playwright：`npm i playwright` + `npx playwright install chromium`（见 `Claude hand off/tests/README.md`） |
| 中文任务乱码 | 服务器已经给 aider 设了 `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1`；还有问题就看 aider 输出尾部 |

## 8. 文件

| 文件 | 作用 |
|---|---|
| `server.mjs` | MCP 服务器入口：只做 MCP ↔ 工具的接线 |
| `tools.mjs` | `ds_code` / `ds_status` 的实现，以及工具清单 |
| `lib.mjs` | 路径守卫、子进程、输出裁剪 |
| `selftest.mjs` | 自检（上面第 6 节） |
| `test/fake-aider.mjs` | 自检用的假 aider（正式使用永远走不到） |
