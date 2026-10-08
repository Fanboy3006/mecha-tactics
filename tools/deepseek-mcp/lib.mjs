/* ============================================================================
 * deepseek-mcp 的底层零件：路径守卫 + 子进程 + 输出裁剪。
 * ----------------------------------------------------------------------------
 * 单独一个文件是为了 selftest.mjs 能不起 MCP、不碰真仓库就测到这些逻辑。
 *
 * 两条硬规矩（需求单 #4）：
 *   1. 只允许在项目根目录（server.mjs 所在仓库的根目录，或环境变量 DS_MCP_ROOT）里操作，越界一律拒绝；
 *   2. 不进仓库的东西（图片库/ 版权图、.git/、node_modules/）不发给 DeepSeek。
 * ========================================================================== */
import { spawn } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* 项目根：默认是 server.mjs 的上两层（tools/deepseek-mcp → 项目根）。
   DS_MCP_ROOT 只给自检指向临时目录用，正式使用不要设。 */
export const ROOT = path.resolve(process.env.DS_MCP_ROOT || path.join(HERE, '..', '..'));

export const MODEL = process.env.DS_MCP_MODEL || 'deepseek/deepseek-chat';
export const MAX_CHARS = toInt(process.env.DS_MCP_MAX_CHARS, 4000);
export const CODE_TIMEOUT_MS = toInt(process.env.DS_MCP_TIMEOUT_MS, 900000);
export const TEST_TIMEOUT_MS = toInt(process.env.DS_MCP_TEST_TIMEOUT_MS, 600000);

function toInt(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

/* ---------- 1. 路径守卫 ---------- */

export class GuardError extends Error {
  constructor(msg) { super(msg); this.name = 'GuardError'; }
}

/* 不进 DeepSeek 的目录（相对项目根）：未公开的版权图 + git 内部 + 依赖 */
const PRIVATE_DIRS = ['图片库', '.git', 'node_modules'];

export function withinRoot(abs) {
  const rel = path.relative(ROOT, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/* 把对方给的路径夹到项目根里面；越界 / 禁区 / 不存在都抛 GuardError。 */
export function checkPath(p, { label = '路径', mustExist = true } = {}) {
  if (typeof p !== 'string' || !p.trim()) throw new GuardError(`${label}不能为空`);
  const raw = p.trim();
  if (raw.includes('\0')) throw new GuardError(`${label}里有非法字符`);

  const abs = path.resolve(ROOT, raw);
  if (!withinRoot(abs)) {
    throw new GuardError(`${label}「${raw}」在项目目录之外；只允许操作 ${ROOT}`);
  }

  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  for (const d of PRIVATE_DIRS) {
    if (rel === d || rel.startsWith(d + '/')) {
      throw new GuardError(`${label}「${raw}」在禁止目录 ${d}/ 里（版权图 / git 内部 / 依赖，不发给 DeepSeek）`);
    }
  }

  if (mustExist) {
    if (!existsSync(abs)) throw new GuardError(`${label}「${raw}」不存在`);
    let real = abs;
    try { real = realpathSync(abs); } catch { /* 读不到 realpath 就当它是自己 */ }
    if (!withinRoot(real)) throw new GuardError(`${label}「${raw}」是软链接，指到项目外了`);
    if (statSync(real).isDirectory()) throw new GuardError(`${label}「${raw}」是目录，测试脚本要写文件路径`);
  }
  return abs;
}

/* 测试脚本：Claude 会写 tests/xxx.js，但仓库里实际在「Claude hand off/tests/」，两种都认。 */
export function resolveTestScript(test) {
  const raw = String(test || '').trim();
  if (!raw) return null;
  const cands = [raw];
  if (!/^Claude hand off[\\/]/i.test(raw)) cands.push('Claude hand off/' + raw);
  if (!/\.[cm]?js$/i.test(raw)) { cands.push(raw + '.js'); cands.push('Claude hand off/' + raw + '.js'); }
  let last = null;
  for (const c of cands) {
    try { return checkPath(c, { label: '测试脚本' }); } catch (e) { last = e; }
  }
  throw last || new GuardError(`测试脚本「${raw}」找不到`);
}

/* ---------- 2. 子进程 ---------- */

/* 一律 pipe 收集输出：外部工具（aider / git / node）的输出都要进小结，不能直接泻到 stdout，
   否则会污染 MCP 的 stdio 协议。 */
export function run(cmd, args, { cwd = ROOT, timeoutMs = CODE_TIMEOUT_MS, extraEnv = {} } = {}) {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, ...extraEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      resolve({ code: null, spawnError: e, stdout: '', stderr: '', timedOut: false });
      return;
    }

    let stdout = '', stderr = '', timedOut = false, settled = false;
    const keep = s => (s.length > 4000000 ? s.slice(-2000000) : s);

    child.stdout.on('data', d => { stdout = keep(stdout + d.toString('utf8')); });
    child.stderr.on('data', d => { stderr = keep(stderr + d.toString('utf8')); });

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch { /* 已经退了 */ }
    }, Math.max(1000, timeoutMs));

    const done = extra => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, spawnError: null, stdout, stderr, timedOut, ...extra });
    };
    child.on('error', e => done({ spawnError: e }));
    child.on('close', code => done({ code }));
  });
}

/* git 一律关掉路径转义，中文文件名在输出里才看得懂 */
export function git(args, opts = {}) {
  return run('git', ['-c', 'core.quotepath=false', ...args], opts);
}

export function nodeBin() { return process.execPath; }

/* ---------- aider 怎么起 ----------
   DS_MCP_AIDER_CMD 可以是三种东西：
     - 不设（默认）：PATH 里的 `aider`；
     - 真的 `aider.exe` 的完整路径：直接执行（本机就是这种：aider 装在 Python 3.12 的独立 venv 里）；
     - `.mjs` / `.js`：当 Node 脚本跑（只有 selftest 的假 aider 会用）。
   `.cmd` / `.bat` 在 Windows 上不能直接 spawn，走 `cmd.exe /c`。 */
export function aiderLaunch() {
  const raw = (process.env.DS_MCP_AIDER_CMD || '').trim();
  if (!raw) return { cmd: 'aider', args: [], label: 'aider（PATH 里）', isFake: false };
  const abs = path.resolve(raw);
  if (/\.m?js$/i.test(abs)) return { cmd: process.execPath, args: [abs], label: abs, isFake: true };
  if (/\.(cmd|bat)$/i.test(abs)) {
    return { cmd: process.env.ComSpec || 'cmd.exe', args: ['/c', abs], label: abs, isFake: false };
  }
  return { cmd: abs, args: [], label: abs, isFake: false };
}

/* ---------- 3. 输出裁剪 ---------- */

/* 只挑对方要看的行：✓ / ✗ 断言行 + ERRS 行（需求单 #4 明说要这两种）。 */
export function pickLines(text, { max = 24 } = {}) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(s => s.replace(/\s+$/, ''))
    .filter(s => s.trim());
  const hit = lines.filter(l => /[✓✗]|ERRS/.test(l));
  if (hit.length <= max) return hit;
  return [...hit.slice(0, max), `…（另有 ${hit.length - max} 行同类输出）`];
}

export function countBad(text) {
  return (String(text || '').match(/✗/g) || []).length;
}

/* 尾部若干行，用于「aider 说了什么」这类旁证 */
export function tail(text, n = 8) {
  const lines = String(text || '').split(/\r?\n/).filter(s => s.trim());
  return lines.slice(-n);
}

/* 总长度硬上限（默认 4000 字，需求单 #4） */
export function clip(text, max = MAX_CHARS) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const note = '\n…（超长已截断）';
  return s.slice(0, Math.max(0, max - note.length)) + note;
}

export function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}
