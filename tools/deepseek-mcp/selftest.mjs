#!/usr/bin/env node
/* ============================================================================
 * deepseek-mcp 自检（`node tools/deepseek-mcp/selftest.mjs`）。
 * ----------------------------------------------------------------------------
 * 不联网、不装 aider、不要 API key、**不碰真仓库**：
 *   1. 路径守卫 / 取行 / 裁剪 的单元检查；
 *   2. 在临时目录里伪造一个「项目 + 假 aider」，跑完整 ds_code 流程（含构建检查 + 测试脚本）；
 *   3. 起真的 server.mjs，走一遍 MCP 握手：initialize / tools/list / tools/call。
 * 任何一项 ✗ 就以退出码 1 结束。
 * ========================================================================== */
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AIDER = path.join(HERE, 'test', 'fake-aider.mjs');
const SERVER = path.join(HERE, 'server.mjs');

let bad = 0;
const check = (label, ok, extra = '') => {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`);
};

/* ---------- 造一个临时「项目」，别动真仓库 ---------- */
const tmp = mkdtempSync(path.join(os.tmpdir(), 'ds-mcp-selftest-'));
mkdirSync(path.join(tmp, 'tools'), { recursive: true });
mkdirSync(path.join(tmp, 'Claude hand off', 'tests'), { recursive: true });
mkdirSync(path.join(tmp, 'src'), { recursive: true });
mkdirSync(path.join(tmp, '图片库'), { recursive: true });

writeFileSync(path.join(tmp, 'tools', 'build-src.mjs'), [
  "console.log('build-src：');",
  "console.log('  ✓ fragment 里的素材代码已是最新');",
  "console.log('  ✓ index.html 的游戏主体与 fragment 一致');",
  "console.log('\\n两份 HTML 已同步');",
].join('\n'), 'utf8');

writeFileSync(path.join(tmp, 'Claude hand off', 'tests', 'demo_test.js'), [
  "console.log('✓ 断言一：顺手');",
  "console.log('✗ 断言二：故意失败（自检要看到 ✗ 被抓出来）');",
  "console.log('ERRS []');",
].join('\n'), 'utf8');

writeFileSync(path.join(tmp, 'src', 'fake.js'), 'export const a = 1;\n', 'utf8');
writeFileSync(path.join(tmp, '图片库', '版权图.png'), 'not a real png', 'utf8');

execFileSync('git', ['init', '-q'], { cwd: tmp });
execFileSync('git', ['config', 'user.email', 'selftest@example.invalid'], { cwd: tmp });
execFileSync('git', ['config', 'user.name', 'selftest'], { cwd: tmp });
execFileSync('git', ['add', '-A'], { cwd: tmp });
execFileSync('git', ['commit', '-q', '-m', '初始提交'], { cwd: tmp });

/* 关键：必须在 import lib.mjs 之前设好，ROOT 是 import 时算的 */
process.env.DS_MCP_ROOT = tmp;
process.env.DS_MCP_AIDER_CMD = FAKE_AIDER;
delete process.env.DEEPSEEK_API_KEY;

const { checkPath, GuardError, pickLines, clip, aiderLaunch, run } = await import('./lib.mjs');
const { dsCode, dsStatus, TOOLS } = await import('./tools.mjs');

console.log(`临时项目：${tmp}\n`);

/* ---------- 1. 单元检查 ---------- */
console.log('[1] 路径守卫 / 取行 / 裁剪');
const denies = [
  ['../../Windows/system32/config', '越界（../）'],
  [path.join(os.homedir(), 'Documents', 'x.md'), '越界（绝对路径）'],
  ['图片库/版权图.png', '禁区（版权图）'],
  ['.git/config', '禁区（git 内部）'],
  ['node_modules/x.js', '禁区（依赖）'],
];
for (const [p, why] of denies) {
  let threw = false, msg = '';
  try { checkPath(p); } catch (e) { threw = e instanceof GuardError; msg = e.message; }
  check(`拒绝 ${why}`, threw, msg.slice(0, 60));
}
let okInside = '';
try { okInside = checkPath('src/fake.js'); } catch (e) { okInside = ''; }
check('允许项目内正常路径', okInside === path.join(tmp, 'src', 'fake.js'));

const lines = pickLines('a\n✓ 一\nb\n✗ 二\nERRS []\n');
check('取行只留 ✓/✗/ERRS', lines.length === 3 && lines[0].startsWith('✓') && lines[2] === 'ERRS []');
const longText = 'x'.repeat(9000);
const clipped = clip(longText, 4000);
check('裁剪到 4000 字以内', clipped.length <= 4000, `${clipped.length} 字`);
check('工具清单有两个工具', TOOLS.length === 2 && TOOLS[0].name === 'ds_code' && TOOLS[1].name === 'ds_status');

/* DS_MCP_AIDER_CMD 的三种写法要分得清（.exe 直接跑、.mjs 用 node、空则用 PATH） */
const launchFake = aiderLaunch();
check('aiderLaunch：.mjs 当 Node 脚本跑', launchFake.isFake && /node\.exe$/i.test(launchFake.cmd));
process.env.DS_MCP_AIDER_CMD = 'C:\\somewhere\\Scripts\\aider.exe';
const launchExe = aiderLaunch();
check('aiderLaunch：.exe 直接执行（不再套 node）', launchExe.isFake === false && launchExe.cmd === 'C:\\somewhere\\Scripts\\aider.exe');
process.env.DS_MCP_AIDER_CMD = 'C:\\somewhere\\aider.cmd';
check('aiderLaunch：.cmd 走 cmd.exe /c', aiderLaunch().cmd.toLowerCase().endsWith('cmd.exe') && aiderLaunch().args[0] === '/c');
process.env.DS_MCP_AIDER_CMD = '';
check('aiderLaunch：不设就用 PATH 里的 aider', aiderLaunch().cmd === 'aider' && aiderLaunch().isFake === false);
process.env.DS_MCP_AIDER_CMD = FAKE_AIDER;

/* ---------- 2. ds_code 全流程（假 aider + 构建检查 + 测试） ---------- */
console.log('\n[2] ds_code 全流程（临时项目里）');
const r1 = await dsCode({
  task: '把 fake.js 里的 a 改成 2',
  files: ['src/fake.js'],
  test: 'tests/demo_test.js',
});
const t1 = r1.text;
check('回了提交号', /提交：\w{7,} /.test(t1), (t1.match(/提交：.*/) || [''])[0].slice(0, 70));
check('回了 git diff --stat', /git diff --stat：/.test(t1) && /fake\.js/.test(t1));
check('回了构建检查结论', /build-src --check：通过/.test(t1));
check('抓到了测试的 ✓ / ✗ 行', t1.includes('✓ 断言一') && t1.includes('✗ 断言二'));
check('抓到了 ERRS 行', t1.includes('ERRS []'));
check('测试路径自动补「Claude hand off/」', t1.includes('Claude hand off/tests/demo_test.js'));
check('长度不超 4000 字', t1.length <= 4000, `${t1.length} 字`);
check('没有回整段代码', !t1.includes('export const a = 1'));
check('测试有 ✗ → isError', r1.isError === true);

const r2 = await dsCode({ task: '越界测试', files: ['../../evil.js'] });
check('files 越界被拒（且没启动 aider）', r2.isError === true && /项目目录之外/.test(r2.text));
const r3 = await dsCode({ task: '' });
check('空 task 被拒', r3.isError === true);
const r4 = await dsCode({ task: '禁区测试', files: ['图片库/版权图.png'] });
check('files 落在禁区被拒', r4.isError === true && /禁止目录/.test(r4.text));

/* aider 说成功但什么都没干；以及 aider 报错却 exit 0 —— 都不能被当成 ✓ */
process.env.FAKE_AIDER_MODE = 'noop';
const r5 = await dsCode({ task: '什么都不做', files: ['src/fake.js'] });
check('aider 没改动时给 ⚠ 提示', /一个文件都没改/.test(r5.text) && r5.isError === false);
process.env.FAKE_AIDER_MODE = 'authfail';
const r6 = await dsCode({ task: 'key 不对', files: ['src/fake.js'] });
check('aider 其实报错（exit 0）时判 isError', r6.isError === true && /Authentication Fails/.test(r6.text));
delete process.env.FAKE_AIDER_MODE;

console.log('\n[3] ds_status');
const s1 = await dsStatus();
check('回了最近提交', /fake aider|初始提交/.test(s1.text));
check('回了未提交改动段', /未提交改动/.test(s1.text));

/* ---------- 4. 真 MCP 握手（acceptance：桌面版能看到这两个工具） ---------- */
console.log('\n[4] MCP 握手（真的起 server.mjs）');
const mcp = await mcpSession();
try {
  const init = await mcp.send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'selftest', version: '0' },
  });
  check('initialize 有回 serverInfo', !!init?.result?.serverInfo?.name, JSON.stringify(init?.result?.serverInfo || {}));
  mcp.notify('notifications/initialized');

  const list = await mcp.send('tools/list', {});
  const names = (list?.result?.tools || []).map(t => t.name);
  check('tools/list 里有 ds_code 和 ds_status', names.includes('ds_code') && names.includes('ds_status'), names.join(', '));
  check('ds_code 的 inputSchema 有 task', !!(list?.result?.tools || []).find(t => t.name === 'ds_code')?.inputSchema?.properties?.task);

  const st = await mcp.send('tools/call', { name: 'ds_status', arguments: {} });
  check('tools/call ds_status 有内容', /最近 5 个提交/.test(st?.result?.content?.[0]?.text || ''));

  const code = await mcp.send('tools/call', {
    name: 'ds_code',
    arguments: { task: '再改一次 fake.js', files: ['src/fake.js'], test: 'tests/demo_test.js' },
  });
  const codeText = code?.result?.content?.[0]?.text || '';
  check('tools/call ds_code 有提交号 + 测试结果', /提交：\w{7,}/.test(codeText) && /ERRS \[\]/.test(codeText));

  const badCall = await mcp.send('tools/call', { name: 'ds_code', arguments: { task: '越界', files: ['../x.js'] } });
  check('越界调用走 isError 返回', badCall?.result?.isError === true && /项目目录之外/.test(badCall?.result?.content?.[0]?.text || ''));

  const unknown = await mcp.send('tools/call', { name: 'nope', arguments: {} });
  check('未知工具名有友好报错', /没有这个工具/.test(unknown?.result?.content?.[0]?.text || ''));
} finally {
  mcp.close();
}

/* ---------- 5. 真 aider：装了就顺手验一下（没装只提示，不算失败） ---------- */
console.log('\n[5] 真 aider（装了就验，没装只提示）');
{
  const saved = process.env.DS_MCP_AIDER_CMD;
  delete process.env.DS_MCP_AIDER_CMD;
  const l = aiderLaunch();
  const probe = await run(l.cmd, ['--version'], { timeoutMs: 60000 });
  if (saved) process.env.DS_MCP_AIDER_CMD = saved;
  const out = (probe.stdout || probe.stderr || '').trim().split(/\r?\n/)[0] || '';
  if (probe.spawnError || probe.code !== 0) {
    console.log(`… PATH 里没有 aider（${probe.spawnError ? probe.spawnError.code : '退出码 ' + probe.code}），跳过这一步。`);
    console.log('  装法见 tools/deepseek-mcp/README.md 第 1 节：用 Python 3.12 + uv，别用 3.13 / 3.14。');
  } else {
    check(`真 aider 能跑：${out}`, /aider/i.test(out));
  }
}

console.log(bad ? `\n${bad} 项没过` : '\n全部通过');
process.exit(bad ? 1 : 0);

/* ---------- MCP stdio 客户端（够用就好） ---------- */
function mcpSession() {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, DS_MCP_ROOT: tmp, DS_MCP_AIDER_CMD: FAKE_AIDER },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let buf = '';
  const waiting = new Map();
  const errLines = [];
  child.stdout.on('data', d => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const w = waiting.get(msg.id);
      if (w) { waiting.delete(msg.id); w(msg); }
    }
  });
  child.stderr.on('data', d => errLines.push(d.toString('utf8')));
  let nextId = 1;
  return {
    send(method, params) {
      const id = nextId++;
      const p = new Promise((res, rej) => {
        const timer = setTimeout(() => { waiting.delete(id); rej(new Error(`${method} 超时`)); }, 60000);
        waiting.set(id, m => { clearTimeout(timer); res(m); });
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return p;
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    },
    close() {
      try { child.stdin.end(); } catch { /* 已关 */ }
      try { child.kill(); } catch { /* 已退 */ }
      if (process.env.DS_MCP_SELFTEST_VERBOSE && errLines.length) {
        console.log('[server stderr]\n' + errLines.join(''));
      }
    },
  };
}
