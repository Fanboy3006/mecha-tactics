# ============================================================================
# 用 Windows 自带的 Media Foundation 转码（不需要 ffmpeg）
# ----------------------------------------------------------------------------
# 背景：这台机器没有 ffmpeg / fluidsynth / 任何 DAW，npm 也装不了包（缓存目录在
# 工作区外）。但 Windows 自己带一套完整的媒体编解码器，可以通过 WinRT 的
# Windows.Media.Transcoding.MediaTranscoder 调用，而 PowerShell 能加载它。
#
# 用法：
#   powershell -File tools/transcode.ps1 -In a.mp3 -Out a.wav
#   powershell -File tools/transcode.ps1 -In a.wav -Out a.mp3 -Quality High
#
# 支持的输出格式（按扩展名推断）：.wav .mp3 .m4a .wma
# 输入格式取决于系统装了哪些解码器，一般 mp3/aac/m4a/wma/wav 都有。
#
# !! 本文件必须保存为 UTF-8 with BOM !!
#    PowerShell 5.1 会按系统 ANSI 代码页读取 .ps1；没有 BOM 时中文注释会变成
#    乱码并导致语法错误。如果你用别的工具改过这个文件，记得把 BOM 加回来。
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [ValidateSet('Low', 'Medium', 'High')][string]$Quality = 'High',
  # 默认 0 = 不强制采样率。实测：在 WAV 编码配置上设 SampleRate/ChannelCount 会让
  # Media Foundation 认为组合非法（PrepareFileTranscodeAsync 报 FailureReason=Unknown），
  # 转码直接失败。默认 WAV 输出是 48kHz，而 tools/analyze-audio.mjs 会重采样，
  # 所以没必要冒这个险。真想强制就显式传 -SampleRate 44100 并自行验证。
  [int]$SampleRate = 0
)

$ErrorActionPreference = 'Stop'

# ---- 加载 WinRT 类型 ----
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null = [Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Media.MediaProperties.AudioEncodingQuality, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFolder, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.CreationCollisionOption, Windows.Storage, ContentType = WindowsRuntime]

# ---- WinRT 异步 → 同步等待（只用于 IAsyncOperation<T>，这个能work） ----
$asTaskOp = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
if (-not $asTaskOp) { throw '拿不到 AsTask 扩展方法，无法等待异步操作' }

function Wait-Op($op, [Type]$resultType) {
  $t = $asTaskOp.MakeGenericMethod($resultType).Invoke($null, @($op))
  if (-not $t.Wait(120000)) { throw '异步操作超时（120 秒）' }
  return $t.Result
}

function Get-Profile([string]$path, [string]$q, [int]$rate) {
  # 坑：PowerShell 5.1 里「$变量::枚举成员」写在 switch 块内会静默取到空值，
  #     必须写完整类型名。这个坑让我多跑了一轮。
  if ($q -eq 'Low') { $qval = [Windows.Media.MediaProperties.AudioEncodingQuality]::Low }
  elseif ($q -eq 'Medium') { $qval = [Windows.Media.MediaProperties.AudioEncodingQuality]::Medium }
  else { $qval = [Windows.Media.MediaProperties.AudioEncodingQuality]::High }
  $ext = [IO.Path]::GetExtension($path).ToLower()
  switch ($ext) {
    '.wav' { $p = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav($qval) }
    '.mp3' { $p = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateMp3($qval) }
    '.m4a' { $p = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateM4a($qval) }
    '.wma' { $p = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWma($qval) }
    default { throw "不支持的输出扩展名：$ext（支持 .wav .mp3 .m4a .wma）" }
  }
  # 固定采样率与声道数。Media Foundation 默认把 WAV 输出成 48kHz，那既和本工程
  # 其它工具（44.1kHz）对不上，重采样本身还会在峰值附近产生过冲削顶。
  if ($rate -gt 0 -and $p.Audio) {
    try {
      $p.Audio.SampleRate = [uint32]$rate
      $p.Audio.ChannelCount = [uint32]2
    } catch { Write-Host "· 无法设置采样率 $rate，沿用默认：$($_.Exception.Message)" }
  }
  return $p
}
# ---- 用 Shell 属性读回媒体的时长与比特率，用于自检 ----
$sh = New-Object -ComObject Shell.Application
function Get-MediaInfo([string]$full) {
  $dir = $sh.Namespace([IO.Path]::GetDirectoryName($full))
  if (-not $dir) { return $null }
  $it = $dir.ParseName([IO.Path]::GetFileName($full))
  if (-not $it) { return $null }
  $dur = $dir.GetDetailsOf($it, 27)      # 27 = 时长
  $br = $dir.GetDetailsOf($it, 28)       # 28 = 比特率
  $sec = -1
  if ($dur -match '(\d+):(\d+):(\d+)') { $sec = [int]$matches[1] * 3600 + [int]$matches[2] * 60 + [int]$matches[3] }
  return [pscustomobject]@{ Seconds = $sec; Text = $dur; Bitrate = $br }
}

# ---- 解析绝对路径 ----
$inFull = (Resolve-Path -LiteralPath $In).Path
if ([IO.Path]::IsPathRooted($Out)) { $outFull = [IO.Path]::GetFullPath($Out) }
else { $outFull = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Out)) }
$outDir = [IO.Path]::GetDirectoryName($outFull)
$outName = [IO.Path]::GetFileName($outFull)
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if ($inFull -eq $outFull) { throw '输入和输出不能是同一个文件' }

$srcSize = (Get-Item -LiteralPath $inFull).Length
$srcInfo = Get-MediaInfo $inFull
Write-Host "输入：$inFull  $([math]::Round($srcSize/1KB,1)) KB  时长 $($srcInfo.Text)  $($srcInfo.Bitrate)"

# ---- 取 StorageFile ----
$srcFile = Wait-Op ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inFull)) ([Windows.Storage.StorageFile])
$dstFolder = Wait-Op ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outDir)) ([Windows.Storage.StorageFolder])
$dstFile = Wait-Op ($dstFolder.CreateFileAsync($outName, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])

# ---- 准备 ----
$profile = Get-Profile $outFull $Quality $SampleRate
$tc = [Windows.Media.Transcoding.MediaTranscoder]::new()
$prep = Wait-Op ($tc.PrepareFileTranscodeAsync($srcFile, $dstFile, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])

if (-not $prep.CanTranscode) {
  Write-Host "✗ 无法转码。FailureReason = $($prep.FailureReason)"
  if ($prep.FailureReason -eq [Windows.Media.Transcoding.TranscodeFailureReason]::CodecNotFound) {
    Write-Host '  系统里没有对应的编解码器。'
  }
  exit 2
}

# ---- 执行 ----
# 坑（第二个）：TranscodeAsync() 返回的是 System.__ComObject，在 PowerShell 5.1 里
#   既读不到 .Status（永远是空串），也无法强转成 Windows.Foundation.IAsyncAction，
#   所以拿不到「完成」信号。
#   但转码本身是正常在跑的 —— 之前我因为读状态失败就抛异常退出，结果把转码
#   中途掐死，产出了只有 5 秒的残缺文件（原曲 16.5 秒）。
#   解决办法：不管状态对象，直接盯输出文件大小，连续多次不变才算写完。
$act = $prep.TranscodeAsync()
$deadline = (Get-Date).AddSeconds(300)
$lastSize = -1
$stableFor = 0
while ($true) {
  Start-Sleep -Milliseconds 200
  if ((Get-Date) -gt $deadline) { throw '转码超时（300 秒）' }
  $sz = if (Test-Path -LiteralPath $outFull) { (Get-Item -LiteralPath $outFull).Length } else { 0 }
  if ($sz -gt 0 -and $sz -eq $lastSize) {
    $stableFor++
    if ($stableFor -ge 3) { break }    # 连续 3 次（约 0.6 秒）大小不变 → 认为写完
  }
  else { $stableFor = 0 }
  $lastSize = $sz
}

# ---- 自检 ----
$dstSize = (Get-Item -LiteralPath $outFull).Length
if ($dstSize -le 44) { Write-Host "✗ 输出文件不合法（只有 $dstSize 字节）"; exit 3 }
$dstInfo = Get-MediaInfo $outFull
Write-Host "输出：$outFull  $([math]::Round($dstSize/1KB,1)) KB  时长 $($dstInfo.Text)  $($dstInfo.Bitrate)"

$ok = $true
if ($srcInfo.Seconds -ge 0 -and $dstInfo.Seconds -ge 0) {
  $diff = [math]::Abs($srcInfo.Seconds - $dstInfo.Seconds)
  # mp3 有编码器延迟与补零，差 1–2 秒正常；差得多就是被截断了
  if ($diff -gt 2) {
    Write-Host "✗ 时长不符：输入 $($srcInfo.Seconds)s，输出 $($dstInfo.Seconds)s（差 $diff 秒，疑似被截断）"
    $ok = $false
  }
  else {
    Write-Host "✓ 时长自检通过（差 $diff 秒）"
  }
}
else {
  Write-Host '· 时长自检跳过（Shell 读不到时长）'
}
if (-not $ok) { exit 4 }
Write-Host '✓ 转码完成'
exit 0
