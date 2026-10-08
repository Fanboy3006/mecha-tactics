/* ============================================================================
 * 试玩页（claude.ai 同一个链接）的多文件发布包。v0.40.1 起（统筹对话，作者 10-08 同意）。
 * ----------------------------------------------------------------------------
 * 原来整个 artifact-fragment.html（50 多万字节）当一个页面发布，每次发布前都要把线上版本整页读一遍，
 * 很费 Claude 的用量。现在拆成：
 *   dist/artifact/index.html   页面：骨架 + 样式 + 两个 <script src>（3 万字节左右）
 *   dist/artifact/art.js       机体图标素材（art/mech-icons.js 注入的那段）
 *   dist/artifact/game.js      游戏主脚本（src/js/ 拼起来的那段）
 * 脚本是普通的同步 <script src>，执行顺序和内联时一样，所以行为不变。
 * 仓库根目录的单文件版（双击就能玩）照旧由 build-src.mjs 生成，不受影响。
 *
 * 用法：node tools/build-src.mjs && node tools/build-artifact.mjs
 * 发布：Artifact 发布 dist/artifact/index.html，files = {art.js, game.js}，url 用试玩页链接，不传 capabilities。
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAG = join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html');
const OUT = join(ROOT, 'Claude hand off', 'dist', 'artifact');
const ART_BEGIN = '<!-- ===== ART:mech-icons BEGIN';
const ART_END = '<!-- ===== ART:mech-icons END ===== -->';
const MAIN = "<script>\n(() => {\n'use strict';\nconst N = 40, TS = 22;";

let s = readFileSync(FRAG, 'utf8').replace(/\r\n/g, '\n');
const fail = m => { console.error('✗ ' + m); process.exit(1); };

/* 1. 素材块 → art.js */
const a0 = s.indexOf(ART_BEGIN), a1 = s.indexOf(ART_END);
if (a0 < 0 || a1 < 0) fail('找不到 ART 块');
const artBlock = s.slice(a0, a1 + ART_END.length);
const am = artBlock.match(/<script>\n([\s\S]*)\n<\/script>/);
if (!am) fail('ART 块里找不到 <script>');
const art = am[1] + '\n';
s = s.slice(0, a0) + '<script src="art.js"></script>' + s.slice(a1 + ART_END.length);

/* 2. 游戏主脚本 → game.js（从主脚本开头到最后一个 </script>） */
const m0 = s.indexOf(MAIN), m1 = s.lastIndexOf('</script>');
if (m0 < 0 || m1 < m0) fail('找不到游戏主脚本');
const game = s.slice(m0 + '<script>\n'.length, m1).replace(/\n+$/, '') + '\n';
s = s.slice(0, m0) + '<script src="game.js"></script>' + s.slice(m1 + '</script>'.length);

if (/<script>(?![\s\S]*<\/script>)/.test(s)) fail('页面里还有没拆干净的内联脚本');
mkdirSync(OUT, {recursive: true});
writeFileSync(join(OUT, 'index.html'), s, 'utf8');
writeFileSync(join(OUT, 'art.js'), art, 'utf8');
writeFileSync(join(OUT, 'game.js'), game, 'utf8');
const kb = t => (Buffer.byteLength(t) / 1024).toFixed(0) + ' KB';
console.log(`✓ dist/artifact：index.html ${kb(s)} · art.js ${kb(art)} · game.js ${kb(game)}`);
