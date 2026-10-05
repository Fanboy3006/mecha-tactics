#!/usr/bin/env node
/* ============================================================================
 * 自检专用的「假 aider」。
 * ----------------------------------------------------------------------------
 * 只给 tools/deepseek-mcp/selftest.mjs 用（DS_MCP_AIDER_CMD 指向它）：
 * 不联网、不要 API key，模拟 aider 的行为——改一个文件 + git 提交。
 * 正式使用永远不会走到这个文件。
 * ========================================================================== */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const cwd = process.cwd();

const mi = argv.indexOf('--message');
const task = mi >= 0 ? argv[mi + 1] : '';
const files = argv.slice(mi + 2).filter(a => !a.startsWith('--'));

console.log(`fake aider: model=${argv[argv.indexOf('--model') + 1]}`);
console.log(`fake aider: task=${task}`);
console.log(`fake aider: files=${files.join(', ') || '(无)'}`);

/* 改第一个文件；没有就自己造一个，模拟「aider 改了代码」 */
const target = files.length ? path.resolve(cwd, files[0]) : path.join(cwd, 'fake-aider-target.txt');
appendFileSync(target, `\n/* fake aider 改动：${task} */\n`, 'utf8');
console.log(`Applied edit to ${path.relative(cwd, target)}`);

/* aider 默认会自动提交 */
execFileSync('git', ['add', '-A'], { cwd });
execFileSync('git', ['commit', '-q', '-m', `fake aider: ${task}`], { cwd });
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd }).toString().trim();
console.log(`Commit ${head} fake aider: ${task}`);

if (!existsSync(target)) process.exit(3);
process.exit(0);
