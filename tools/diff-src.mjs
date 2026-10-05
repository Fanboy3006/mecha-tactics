/* 比较 src/index.html 与 src/artifact-fragment.html 的「游戏主体」是否一致。
 * 两份文件只应该在外层包装（doctype/head/字体/base 样式）上不同。
 * 用法：node tools/diff-src.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const A = readFileSync(join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html'), 'utf8');
const B = readFileSync(join(ROOT, 'Claude hand off', 'src', 'index.html'), 'utf8');

const ANCHOR = '<div class="app">';
const cut = s => s.slice(s.indexOf(ANCHOR), s.lastIndexOf('</script>') + '</script>'.length);

const a = cut(A).split(/\r?\n/);
const b = cut(B).split(/\r?\n/);
console.log(`fragment 主体 ${a.length} 行 / index 主体 ${b.length} 行`);

let n = 0;
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    n++;
    if (n <= 20) {
      console.log(`\n第 ${i + 1} 行起不一致`);
      console.log('  fragment: ' + JSON.stringify(a[i] ?? null).slice(0, 200));
      console.log('  index   : ' + JSON.stringify(b[i] ?? null).slice(0, 200));
    }
  }
}
console.log(n ? `\n共 ${n} 行不一致` : '\n游戏主体完全一致');

if (n) {
  console.log('\n--- index.html 的 head 部分 ---');
  console.log(B.slice(B.indexOf('<style>'), B.indexOf(ANCHOR)));
}
