/* ============================================================================
 * 一次性拆分脚本（需求单 #1，Claude 写）：把 src/artifact-fragment.html 拆成
 *   src/shell.html   HTML 骨架；<style> / <script> 标签本身留在这里，内容换成占位行
 *   src/css/main.css 游戏 CSS
 *   src/js/NN-名字.js 游戏脚本，按行首的「/* ---------- 名字 ---------- *\/」分节
 * ART / AUDIO 两段生成物在 shell 里只留 BEGIN / END 两行，内容由 build-src 注入。
 * 占位行格式：<!-- @include css/main.css -->、<!-- @include js/05-状态.js -->，每行一个。
 * 拼回规则见 tools/assemble-src.mjs：占位行整行替换成文件内容（文件内容原样，含末尾换行）。
 *
 * ⚠ 已于需求单 #1 用过一次。现在源文件是 src/js 等，再跑会用 fragment 覆盖它们，不要再跑。
 * 用法：node tools/split-src.mjs        拆分（会覆盖 shell.html / css / js）
 * 拆完跑 node tools/build-src.mjs，生成的 fragment 应与拆分前逐字节相同。
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'Claude hand off', 'src');
const raw = readFileSync(join(SRC, 'artifact-fragment.html'), 'utf8');
const NL = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split('\n');          // 每行保留可能的 \r；最后一个元素是末尾换行之后的内容
const strip = l => l.replace(/\r$/, '');

const BLOCKS = [
  ['<!-- ===== ART:mech-icons BEGIN', '<!-- ===== ART:mech-icons END ===== -->'],
  ['<!-- ===== AUDIO BEGIN', '<!-- ===== AUDIO END ===== -->'],
];
const MAX = 800;
const shell = [], files = [];           // files: [rel, lines[]]
let n = 0, i = 0;
const safe = s => s.trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'part';
const num = () => String(n++).padStart(2, '0');

function emit(rel, body){ files.push([rel, body]); shell.push(`<!-- @include ${rel} -->` + (NL === '\r\n' ? '\r' : '')); }
function emitJs(name, body, nn){
  if (body.length <= MAX){ emit(`js/${nn}-${name}.js`, body); return; }
  let parts = [], rest = body, k = 0;
  while (rest.length > MAX){
    let cut = -1;
    for (let d = 0; d < 200 && cut < 0; d++){
      for (const at of [MAX - d, MAX + d]) if (at > 0 && at < rest.length && strip(rest[at - 1]) === ''){ cut = at; break; }
    }
    if (cut < 0) cut = MAX;
    parts.push(rest.slice(0, cut)); rest = rest.slice(cut);
  }
  parts.push(rest);
  parts.forEach(p => emit(`js/${nn}${String.fromCharCode(97 + k++)}-${name}.js`, p));
}

let scriptNo = 0;
while (i < lines.length){
  const l = strip(lines[i]);
  const blk = BLOCKS.find(b => l.startsWith(b[0]));
  if (blk){                                       // 生成物：只留 BEGIN / END
    shell.push(lines[i]);
    while (i < lines.length && strip(lines[i]) !== blk[1]) i++;
    shell.push(lines[i]); i++; continue;
  }
  if (l === '<style>'){
    shell.push(lines[i++]); const body = [];
    while (strip(lines[i]) !== '</style>') body.push(lines[i++]);
    emit('css/main.css', body); continue;
  }
  if (l === '<script>'){
    shell.push(lines[i++]); scriptNo++; const body = [];
    while (strip(lines[i]) !== '</script>') body.push(lines[i++]);
    // 按分节注释切开
    let cur = [], name = scriptNo === 1 ? 'head' : 'head2';
    const flush = () => { if (cur.length) emitJs(safe(name), cur, num()); cur = []; };
    for (const b of body){
      const m = strip(b).match(/^\/\* -{6,} (.+?) -{6,} \*\/$/);
      if (m){ flush(); name = m[1]; }
      cur.push(b);
    }
    flush(); continue;
  }
  shell.push(lines[i++]);
}

for (const d of ['js', 'css']){ const p = join(SRC, d); if (existsSync(p)) rmSync(p, {recursive:true}); mkdirSync(p); }
// 文件内容 = 这些行各自带 \n 连起来（最后一行也带换行），占位行整行替换时不再补换行
for (const [rel, body] of files) writeFileSync(join(SRC, rel), body.map(x => x + '\n').join(''), 'utf8');
writeFileSync(join(SRC, 'shell.html'), shell.join('\n'), 'utf8');
console.log(`拆分完成：shell.html + ${files.length} 个文件（css 1，js ${files.length - 1}）`);
