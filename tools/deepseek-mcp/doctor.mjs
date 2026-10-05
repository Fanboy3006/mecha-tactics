#!/usr/bin/env node
/* ============================================================================
 * deepseek-mcp 配置体检（`node tools/deepseek-mcp/doctor.mjs`）。
 * ----------------------------------------------------------------------------
 * 专门用来回答「桌面版到底会在哪读配置、我填对没有」。只读文件，不起任何子进程：
 *   1. 找出 claude_desktop_config.json 的真实位置（官网版 / 商店版路径不同）；
 *   2. 按 UTF-8 解析（和桌面版一样）、报 BOM 和上级键重复；
 *   3. 检查 mcpServers.deepseek 里的 command / args / env，并把 key 打码；
 *   4. 检查被指到的 server.mjs 和 aider.exe 在不在；
 *   5. 打印下一步。
 * 加 `--fix`：如果发现文件是「两个 JSON 对象粘在一起」（最常见的手改事故：把整份内容
 * 追加进了已有文件），自动备份后只保留合法的那一份。DS_MCP_CLAUDE_CONFIG 可以指定别的文件（自检用）。
 * ========================================================================== */
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const FIX = process.argv.includes('--fix');
let bad = 0;
const ok = m => console.log('  ✓ ' + m);
const no = m => { bad++; console.log('  ✗ ' + m); };
const info = m => console.log('    ' + m);

/* ---------- 1. 找配置文件 ---------- */
console.log('deepseek-mcp 配置体检\n');
console.log('[1] 找 claude_desktop_config.json');

const candidates = [
  path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json'),
];
/* 商店（MSIX）版：%APPDATA% 被重定向到包的 LocalCache 里 */
const pkgRoot = path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'Packages');
try {
  for (const d of readdirSync(pkgRoot)) {
    if (!/^Claude_/i.test(d)) continue;
    candidates.push(path.join(pkgRoot, d, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'));
  }
} catch { /* 没有 Packages 目录就算了 */ }

const found = candidates.filter(p => existsSync(p));
if (!found.length) {
  no('两个位置都没找到配置。桌面版至少启动过一次才会有这个文件。');
  info('官网版：' + candidates[0]);
  for (const c of candidates.slice(1)) info('商店版：' + c);
  process.exit(1);
}
for (const p of found) ok(`找到：${p}（${statSync(p).size} 字节）`);

const cfgPath = process.env.DS_MCP_CLAUDE_CONFIG || found[0];
if (found.length > 1) info('有多个：下面的检查用第一个，两边可能都填一遍才保险。');

/* ---------- 2. 按 UTF-8 读 + 解析 ---------- */
console.log('\n[2] 解析（UTF-8，和桌面版一致）');
let raw = readFileSync(cfgPath, 'utf8');
if (raw.charCodeAt(0) === 0xfeff) no('文件带 UTF-8 BOM，某些解析器会当成非法字符，建议存成「UTF-8 无 BOM」。');
else ok('没有 BOM');

let cfg = null;
let parseErr = null;
try { cfg = JSON.parse(raw); ok('JSON 合法'); }
catch (e) { parseErr = e; no(`JSON 不合法：${e.message}`); }

/* 手改最常见的事故：把整份内容「追加」进已有文件 → 两个对象粘在一起。
   人不好看出来，但 JSON.parse 会明确说 "after JSON at position N"，N 就是第一个对象结束的位置。 */
if (parseErr && FIX) {
  const m = /after JSON at position (\d+)/.exec(parseErr.message);
  if (m) {
    const cut = Number(m[1]);
    const head = raw.slice(0, cut).trim();
    const tail = raw.slice(cut).trim();
    const parseOrNull = s => { try { return JSON.parse(s); } catch { return null; } };
    const jHead = parseOrNull(head), jTail = parseOrNull(tail);
    const keepTail = jTail && jTail.mcpServers && !(jHead && jHead.mcpServers);
    const keep = keepTail ? tail : (jHead && jHead.mcpServers ? head : null);
    if (!keep) {
      no('看出来了是两个对象粘在一起，但两边都拿不准该留哪个，没敢动。请手工处理。');
    } else {
      const bak = `${cfgPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      copyFileSync(cfgPath, bak);
      writeFileSync(cfgPath, keep.endsWith('\n') ? keep : keep + '\n', 'utf8');
      ok(`已修好：保留${keepTail ? '后' : '前'}一个对象，原文件备份在 ${bak}`);
      if (bad > 0) bad--;   /* 上面那条「JSON 不合法」已经修掉了，别再算它 */
      raw = readFileSync(cfgPath, 'utf8');
      cfg = JSON.parse(raw);
      parseErr = null;
    }
  }
}

/* 上级键重复检查：JSON.parse 会「后者覆盖前者」，容易埋坑 */
if (cfg) {
  for (const key of ['mcpServers', 'preferences', 'coworkUserFilesPath']) {
    const n = (raw.match(new RegExp(`"${key}"\\s*:`, 'g')) || []).length;
    if (n > 1) no(`顶层键 "${key}" 出现了 ${n} 次（重复，后一个会盖掉前一个）—— 多半是粘贴时把整份内容插进了已有文件里`);
  }
  ok('顶层键：' + Object.keys(cfg).join(', '));
}

/* ---------- 3. 看 deepseek 这一项 ---------- */
console.log('\n[3] mcpServers.deepseek');
const d = cfg && cfg.mcpServers && cfg.mcpServers.deepseek;
if (!d) {
  no('没有 mcpServers.deepseek 这一项（或上级 mcpServers 被重复项盖掉了）。');
  info('要加的内容见 tools/deepseek-mcp/README.md 第 2 节。');
} else {
  ok('有 mcpServers.deepseek');
  d.command === 'node' || /node(\.exe)?$/i.test(String(d.command)) ? ok(`command = ${d.command}`) : no(`command = ${d.command}（建议 "node" 或 node.exe 全路径）`);
  const server = Array.isArray(d.args) ? d.args[0] : null;
  server && existsSync(server) ? ok(`args[0] 指向的 server.mjs 存在：${server}`) : no(`args[0] 指不到文件：${server}`);
  const env = d.env || {};
  const key = String(env.DEEPSEEK_API_KEY || '');
  if (!key) no('env 里没有 DEEPSEEK_API_KEY');
  else if (/在这里|换成|your|xxx|sk-xxx/i.test(key)) no('DEEPSEEK_API_KEY 还是占位符，要换成真的');
  else ok(`DEEPSEEK_API_KEY 看着是真的（前缀 ${key.slice(0, 6)}…，长度 ${key.length}）`);
  const aider = String(env.DS_MCP_AIDER_CMD || '');
  if (!aider) info('没设 DS_MCP_AIDER_CMD：会用 PATH 里的 aider（没在 PATH 里就会报「找不到 aider 命令」）');
  else if (existsSync(aider)) ok(`DS_MCP_AIDER_CMD 指向的 aider 存在：${aider}`);
  else no(`DS_MCP_AIDER_CMD 指不到文件：${aider}（重装见 README 第 1 节）`);
}

/* ---------- 4. 结论 ---------- */
console.log('\n[4] 下一步');
if (bad) {
  console.log(`  上面有 ${bad} 个 ✗，先修掉。修完把桌面版**完全退出**再启动（托盘也要退，否则它退出时会覆盖配置文件）。`);
  process.exit(1);
}
console.log('  配置没问题。启动桌面版后，工具列表里应该出现 ds_code 和 ds_status：');
console.log('    · 先让它跑一次 ds_status（不花钱，只是看仓库状态）；');
console.log('    · 再让它用 ds_code 做一个小改动（比如需求单 #2），返回里会有提交号和测试结果。');
