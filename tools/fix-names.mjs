/* ============================================================================
 * 修复「解压导致的乱码文件名」。
 * ----------------------------------------------------------------------------
 * 症状：文件名在磁盘上长成 µêÿµúïΦºäσêÖΦ«╛Φ«í.md 这样。
 * 成因：文件名本来是 UTF-8 字节，被某个工具当成 CP437 逐字节转成了字符，然后又
 *       按 UTF-8 存了一遍（经典的二次编码）。
 * 修法：把文件名的每个字符按 CP437 还原成字节，再按 UTF-8 解码，就得到原名。
 *
 * 这个脚本**先解码验证再改名**：只有「还原结果是合法 UTF-8，且包含 CJK 字符」
 * 才会认为是乱码名，避免误伤正常文件名。
 *
 * 用法：node tools/fix-names.mjs          只列出诊断结果，不改名（默认）
 *       node tools/fix-names.mjs --apply  真的改名
 * ========================================================================== */
import { readdirSync, renameSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const apply = process.argv.includes('--apply');

/* CP437 的 0x80–0xFF 字符表 */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00A0';

const CP437_BYTE = new Map();
for (let i = 0; i < CP437_HIGH.length; i++) CP437_BYTE.set(CP437_HIGH[i], 0x80 + i);

/* 名字 → CP437 字节；遇到映射表外的字符就返回 null */
function toCP437Bytes(name) {
  const out = [];
  for (const ch of name) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) { out.push(cp); continue; }
    const b = CP437_BYTE.get(ch);
    if (b === undefined) return null;
    out.push(b);
  }
  return Buffer.from(out);
}

/* 名字是不是「乱码」？还原后必须是合法 UTF-8 且含 CJK */
function decodeName(name) {
  if (!/[\u0080-\u00ff\u2500-\u25ff\u0391-\u03c9]/.test(name)) return null;
  const bytes = toCP437Bytes(name);
  if (!bytes) return null;
  let fixed;
  try {
    fixed = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch { return null; }
  if (fixed === name) return null;
  if (!/[\u4e00-\u9fff]/.test(fixed)) return null;          // 中文名才认
  if (/[\uFFFD]/.test(fixed)) return null;
  return fixed;
}

/* 递归扫描（跳过 node_modules 之类的目录） */
const SKIP = new Set(['node_modules', '.git', '.chrome-tmp', 'out']);
const results = [];
function walk(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir, {withFileTypes: true}); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    const fixed = decodeName(e.name);
    if (fixed && fixed !== e.name) results.push({full, from: e.name, to: fixed, dir: e.isDirectory()});
    if (e.isDirectory()) walk(full, depth + 1);
  }
}
walk(ROOT);

console.log(`扫描完成：发现 ${results.length} 个乱码文件名\n`);
let renamed = 0, failed = 0;
for (const r of results) {
  const rel = r.full.slice(ROOT.length + 1);
  console.log(`  ${r.dir ? '[目录]' : '[文件]'} ${rel}`);
  console.log(`         → ${r.to}`);
  if (apply) {
    const target = join(dirname(r.full), r.to);
    try {
      // 目标重名就先报错，不覆盖
      statSync(target);
      console.error(`         ✗ 目标已存在，跳过：${r.to}`);
      failed++;
      continue;
    } catch { /* 不存在才好 */ }
    try { renameSync(r.full, target); renamed++; console.log('         ✓ 已改名'); }
    catch (e) { console.error('         ✗ 改名失败：' + e.message); failed++; }
  }
}

if (!apply && results.length) console.log('\n这是预演。确认无误后加 --apply 真的改名。');
if (apply) console.log(`\n改名 ${renamed} 个${failed ? `，失败/跳过 ${failed} 个` : ''}`);
