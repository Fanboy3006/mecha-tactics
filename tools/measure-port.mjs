/* 量一下「换引擎要搬多少东西」：统计代码构成与耦合点。
 * 用法：node tools/measure-port.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const F = join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html');
const src = readFileSync(F, 'utf8');
const lines = src.split('\n');

const find = re => { const i = lines.findIndex(l => re.test(l)); return i < 0 ? null : i + 1; };
const artS = find(/ART:mech-icons BEGIN/), artE = find(/ART:mech-icons END/);
const audS = find(/AUDIO BEGIN/), audE = find(/AUDIO END/);
const gameS = find(/const N = 40, TS = 22;/);

console.log('文件：Claude hand off/src/artifact-fragment.html');
console.log(`总行数 ${lines.length}　总字节 ${src.length}\n`);

const seg = (a, b, name) => {
  const n = b - a + 1;
  if (n <= 0) return;
  console.log(`  ${name.padEnd(14)} 行 ${String(a).padStart(5)}–${String(b).padStart(5)}  ${String(n).padStart(5)} 行  ${(n / lines.length * 100).toFixed(1)}%`);
};
console.log('构成（按在文件里的位置）：');
seg(1, artS - 1, 'CSS + HTML');
seg(artS, artE, '美术模块*');
seg(audS, audE, '音频模块*');
if (gameS - 1 > audE) seg(audE + 1, gameS - 1, '（script 标签）');
seg(gameS, lines.length, '游戏脚本');
console.log('  * = 由 tools/build-src.mjs 注入的生成块，不是手写的');

/* 只统计游戏脚本内部 */
const body = lines.slice(gameS - 1).join('\n');
const n = re => (body.match(re) || []).length;

console.log('\n游戏脚本里的耦合点：');
const rows = [
  ['async', /\basync\b/g, '异步函数（回合流程要 await）'],
  ['await', /\bawait\b/g, '等待点（动画 / 弹窗）'],
  ['sleep(', /\bsleep\(/g, '等动画时长'],
  ['fx(', /\bfx\(/g, '触发特效'],
  ['drawImage', /drawImage/g, '画精灵'],
  ['ctx.', /\bctx\./g, '直接操作 Canvas 2D'],
  ['document.', /document\./g, '直接操作 DOM'],
  ['innerHTML', /innerHTML/g, 'HTML 字符串拼界面'],
  ['localStorage', /localStorage/g, '浏览器存储'],
  ['matchMedia', /matchMedia/g, '浏览器媒体查询'],
  ['requestAnimationFrame', /requestAnimationFrame/g, '浏览器帧循环'],
  ['setTimeout', /setTimeout/g, '浏览器计时器'],
  ['Math.random', /Math\.random/g, '无种子随机'],
  ['mulberry32', /mulberry32/g, '有种子随机'],
];
for (const [name, re, why] of rows) {
  console.log(`  ${name.padEnd(22)} ${String(n(re)).padStart(4)} 次　${why}`);
}

/* 找 async 函数名，看回合流程有多碎 */
console.log('\nasync 函数清单（这些是「逻辑和界面缠在一起」的地方）：');
const asyncFns = [...body.matchAll(/async function (\w+)\s*\(([^)]*)\)/g)].map(m => m[1]);
if (asyncFns.length) console.log('  ' + asyncFns.join(' / '));
else {
  const arrow = [...body.matchAll(/(?:const|let)\s+(\w+)\s*=\s*async/g)].map(m => m[1]);
  console.log('  ' + (arrow.join(' / ') || '（没有 async function 声明形式）'));
}

/* 顶层可变全局（IIFE 里的 let/var） */
console.log('\n顶层可变状态（IIFE 作用域内的 let）：');
const globals = [...body.matchAll(/^let (\w+)/gm)].map(m => m[1]);
console.log('  ' + globals.join('、'));
const consts = [...body.matchAll(/^const (\w+)/gm)].map(m => m[1]);
console.log(`\n顶层 const（含数据表，共 ${consts.length} 个）：`);
console.log('  ' + consts.slice(0, 40).join('、') + (consts.length > 40 ? ' …' : ''));
