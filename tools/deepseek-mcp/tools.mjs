/* ============================================================================
 * 两个工具的真正实现：ds_code / ds_status（需求单 #4）。
 * ----------------------------------------------------------------------------
 * server.mjs 只负责把它们挂到 MCP 上；selftest.mjs 直接 import 这个文件来测，
 * 所以这里不碰任何 MCP 的东西，只返回 { text, isError }。
 *
 * ds_code 的流程（需求单 #4 定的）：
 *   在项目根里跑 aider（aider 自己读文件、改文件、git 提交）
 *   → 自动跑 node tools/build-src.mjs --check
 *   → 给了 test 就再跑那个测试脚本
 *   → 只回「提交号 + git diff --stat + ✓/✗ 行 + ERRS 行」，绝不回整段代码。
 * ========================================================================== */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  CODE_TIMEOUT_MS, GuardError, MAX_CHARS, MODEL, ROOT, TEST_TIMEOUT_MS,
  checkPath, clip, countBad, git, nodeBin, pickLines, rel, resolveTestScript, run, tail,
} from './lib.mjs';

const AIDER_HELP = [
  '装 aider：`pip install aider-chat`（Windows 上装完确认 `aider --version` 能跑）。',
  '如果提示找不到命令，就在 claude_desktop_config.json 的 env 里加一行 PATH 指到 Scripts 目录，',
  '或把 DS_MCP_AIDER_CMD 指向 aider.exe 的完整路径。',
].join('\n');

/* ---------- ds_status ---------- */

export async function dsStatus() {
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim() || '(未知)';
  const log = (await git(['log', '--oneline', '-5', '--no-decorate'])).stdout.trim();
  const short = (await git(['status', '--short'])).stdout.trim();

  /* 上游对齐情况：push 前要知道差几个提交（拿不到就静默跳过） */
  const lr = await git(['rev-list', '--count', '--left-right', '@{u}...HEAD']);
  let sync = '';
  if (lr.code === 0 && lr.stdout.trim()) {
    const [behind, ahead] = lr.stdout.trim().split(/\s+/);
    sync = `与上游：落后 ${behind}，领先 ${ahead}`;
  }

  const lines = [
    `仓库：${ROOT}`,
    `分支：${branch}${sync ? '（' + sync + '）' : ''}`,
    '',
    '最近 5 个提交：',
    log || '（还没有提交）',
    '',
    `未提交改动（git status --short，${short ? short.split(/\r?\n/).length + ' 项' : '干净'}）：`,
    short || '（干净）',
  ];
  return { isError: false, text: clip(lines.join('\n'), MAX_CHARS) };
}

/* ---------- ds_code ---------- */

export async function dsCode(args = {}) {
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  if (!task) return { isError: true, text: 'ds_code：task 不能为空（写清要改什么）。' };
  if (args.files != null && !Array.isArray(args.files)) {
    return { isError: true, text: 'ds_code：files 要写成字符串数组，例如 ["Claude hand off/tests/class_mech.js"]。' };
  }

  /* 1. 先把路径全部过一遍守卫，越界就当场拒绝，不启动 aider */
  let files = [];
  try {
    files = (args.files || []).map(f => checkPath(f, { label: 'files' }));
  } catch (e) {
    if (e instanceof GuardError) return { isError: true, text: `ds_code：${e.message}` };
    throw e;
  }
  let testAbs = null;
  if (args.test) {
    try { testAbs = resolveTestScript(args.test); }
    catch (e) { return { isError: true, text: `ds_code：${e.message || e}` }; }
  }

  /* 自检用的假 aider 走 node 脚本，不需要 API key；正式跑必须要有 key */
  const fakeAider = process.env.DS_MCP_AIDER_CMD;
  if (!fakeAider && !process.env.DEEPSEEK_API_KEY) {
    return {
      isError: true,
      text: [
        'ds_code：没有 DEEPSEEK_API_KEY，aider 起不来。',
        '把 key 填进 claude_desktop_config.json 的 env 段（写法见 tools/deepseek-mcp/README.md），然后重启桌面版。',
        'key 只在环境变量里，不要写进仓库。',
      ].join('\n'),
    };
  }

  const before = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const notes = [];

  /* 2. aider：自己读文件、改文件、提交 */
  const aiderArgs = [
    '--model', MODEL,
    '--yes-always',
    '--no-check-update',
    '--no-pretty',
    '--message', task,
    ...files,
  ];
  const [cmd, baseArgs] = fakeAider ? [nodeBin(), [path.resolve(fakeAider)]] : ['aider', []];
  const aider = await run(cmd, [...baseArgs, ...aiderArgs], {
    timeoutMs: CODE_TIMEOUT_MS,
    /* aider 是 Python：Windows 上强制 UTF-8，否则中文任务会炸编码 */
    extraEnv: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  let aiderBad = false;
  if (aider.spawnError) {
    aiderBad = true;
    if (aider.spawnError.code === 'ENOENT') notes.push(`找不到 aider 命令。\n${AIDER_HELP}`);
    else notes.push(`aider 起不来：${aider.spawnError.message}`);
  } else if (aider.timedOut) {
    aiderBad = true;
    notes.push(`aider 超时（${Math.round(CODE_TIMEOUT_MS / 60000)} 分钟）已被杀掉。任务可以拆小一点再试。`);
  } else if (aider.code !== 0) {
    aiderBad = true;
    notes.push(`aider 退出码 ${aider.code}，输出尾部见下。`);
  }

  /* 3. 提交号 + git diff --stat（aider 会自己提交；没提交就把工作区改动报出来） */
  const after = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  let commitLine = '（这次 aider 没有产生新提交，改动还留在工作区）';
  let statOut = '';
  if (before && after && before !== after) {
    commitLine = (await git(['log', '-1', '--format=%h %s', after])).stdout.trim() || after.slice(0, 7);
    statOut = (await git(['diff', '--stat', before, after])).stdout.trim();
  } else {
    statOut = (await git(['diff', '--stat'])).stdout.trim();
    const st = (await git(['status', '--short'])).stdout.trim();
    if (st) statOut += (statOut ? '\n' : '') + '未跟踪/未提交：\n' + st.split(/\r?\n/).slice(0, 10).join('\n');
  }

  /* 4. 构建检查（需求单 #4：跑完自动执行） */
  let buildOk = null, buildOut = '';
  const buildScript = path.join(ROOT, 'tools', 'build-src.mjs');
  if (!existsSync(buildScript)) {
    buildOut = `找不到 tools/build-src.mjs，跳过构建检查。`;
  } else {
    const b = await run(nodeBin(), ['tools/build-src.mjs', '--check'], { timeoutMs: 120000 });
    buildOk = b.code === 0;
    buildOut = [b.stdout, b.stderr].filter(Boolean).join('\n').trim();
  }

  /* 5. 测试（给了才跑） */
  let testOk = null, testOut = '', testRel = '';
  if (testAbs) {
    testRel = rel(testAbs);
    const t = await run(nodeBin(), [testAbs], { timeoutMs: TEST_TIMEOUT_MS });
    testOk = t.code === 0 && countBad(t.stdout + t.stderr) === 0;
    testOut = [t.stdout, t.stderr].filter(Boolean).join('\n').trim();
    if (t.timedOut) testOut += `\n（测试超时 ${Math.round(TEST_TIMEOUT_MS / 60000)} 分钟被杀）`;
  }

  /* 6. 拼小结：只要结论 + 关键行，不回代码 */
  const L = [];
  const bad = aiderBad || buildOk === false || testOk === false;
  L.push(`ds_code ${bad ? '⚠ 有问题，见下' : '✓ 完成'}${fakeAider ? '（假 aider 自检模式）' : ''}`);
  L.push(`任务：${task.length > 200 ? task.slice(0, 200) + '…' : task}`);
  L.push(`提交：${commitLine}`);
  L.push('');
  L.push('git diff --stat：');
  L.push(statOut ? statOut.split(/\r?\n/).slice(0, 14).join('\n') : '（没有改动）');

  L.push('');
  if (buildOk === null) L.push(`构建检查 build-src --check：${buildOut || '跳过'}`);
  else {
    const bl = pickLines(buildOut, { max: 10 });
    L.push(`构建检查 build-src --check：${buildOk ? '通过' : '不通过'}`);
    if (bl.length) L.push(...bl.map(s => '  ' + s));
  }

  if (testAbs) {
    L.push('');
    const tl = pickLines(testOut, { max: 16 });
    L.push(`测试 ${testRel}：${testOk ? '通过（无 ✗，ERRS 见下）' : '不通过'}`);
    if (tl.length) L.push(...tl.map(s => '  ' + s));
    else L.push('  （没有 ✓/✗ 行，输出尾部：' + tail(testOut, 3).join(' | ') + '）');
  }

  if (notes.length) {
    L.push('');
    L.push(...notes);
  }

  const aiderTail = tail([aider.stdout, aider.stderr].filter(Boolean).join('\n'), 6);
  if (aiderTail.length) {
    L.push('');
    L.push('aider 输出尾部：');
    L.push(...aiderTail.map(s => '  ' + (s.length > 200 ? s.slice(0, 200) + '…' : s)));
  }

  return { isError: bad, text: clip(L.join('\n'), MAX_CHARS) };
}

/* ---------- 工具清单（server.mjs 直接用） ---------- */

export const TOOLS = [
  {
    name: 'ds_code',
    description: [
      '在 C:\\DSH-机战 里派活给 DeepSeek（Aider）：aider 自己读文件、改文件、git 提交，',
      '然后自动跑 node tools/build-src.mjs --check，给了 test 再跑那个测试脚本。',
      '返回很短：提交号、git diff --stat、✓/✗ 行、ERRS 行，不回整段代码。',
      'files 可以传要动的文件（仓库相对路径，如 "Claude hand off/tests/class_mech.js"，也可以只写 "tests/class_mech.js"）。',
      'test 传测试脚本路径（如 "tests/class_mech.js"）。只能操作项目目录里的文件，aider 不会 push。',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: '要 DeepSeek 做的事，写清改哪里、改成什么样' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '要交给 aider 的文件（仓库相对路径，可省）',
        },
        test: { type: 'string', description: '改完要跑的测试脚本（可省）' },
      },
      required: ['task'],
      additionalProperties: false,
    },
  },
  {
    name: 'ds_status',
    description: '看 C:\\DSH-机战 的当前状态：分支与上游对齐情况、最近 5 个提交（git log --oneline -5）、未提交改动（git status --short）。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];
