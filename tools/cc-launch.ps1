# 本地 Claude Code 启动命令（统筹对话 10-10）：cc-ds 走 DeepSeek，cc-opus 走 Claude（你的 Claude 账号额度）。
# 安装：在 PowerShell 里运行一次
#   [Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY', '<你的 DeepSeek key>', 'User')
#   Add-Content $PROFILE "`n. 'F:\DSH-mecha\mecha-tactics\tools\cc-launch.ps1'"
# 然后重开 PowerShell。用法（在仓库目录里）：
#   cc-ds          用 DeepSeek 开新会话（默认 deepseek-flash；会话里 /model opus 换成 DeepSeek V4 Pro，更强也更贵）
#   cc-opus        用 Claude Opus 开新会话
#   cc-ds -c / cc-opus -c   接着上一次的会话（跨模型接续可能报错，报错就开新会话，让它先读任务板）
# 环境变量只在这一次启动里生效，退出后恢复原样，所以两个命令互不影响。

function Invoke-ClaudeWith([hashtable]$vars, $rest){
  $saved = @{}
  foreach ($k in $vars.Keys){ $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, $vars[$k], 'Process') }
  try { & claude @rest }
  finally { foreach ($k in $vars.Keys){ [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') } }
}

function cc-ds {
  $key = $env:DEEPSEEK_API_KEY
  if (-not $key){ $key = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY', 'User') }
  if (-not $key){ Write-Host '没有找到 DEEPSEEK_API_KEY，见本文件开头的安装说明' -ForegroundColor Red; return }
  Invoke-ClaudeWith @{
    ANTHROPIC_BASE_URL             = 'https://api.deepseek.com/anthropic'
    ANTHROPIC_AUTH_TOKEN           = $key
    ANTHROPIC_MODEL                = 'deepseek-flash[1m]'
    ANTHROPIC_DEFAULT_SONNET_MODEL = 'deepseek-flash[1m]'
    ANTHROPIC_DEFAULT_HAIKU_MODEL  = 'deepseek-flash'
    CLAUDE_CODE_SUBAGENT_MODEL     = 'deepseek-flash'
  } $args
}

function cc-opus {
  # 清掉可能残留的 DeepSeek 设置，走 Claude 账号登录
  Invoke-ClaudeWith @{
    ANTHROPIC_BASE_URL = $null; ANTHROPIC_AUTH_TOKEN = $null; ANTHROPIC_MODEL = $null
    ANTHROPIC_DEFAULT_SONNET_MODEL = $null; ANTHROPIC_DEFAULT_HAIKU_MODEL = $null; CLAUDE_CODE_SUBAGENT_MODEL = $null
  } (@('--model', 'opus') + $args)
}
