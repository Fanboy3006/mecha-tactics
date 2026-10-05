/* ============================================================================
 * 单文件游戏的「同步生成」脚本。
 * ----------------------------------------------------------------------------
 * 这个项目有两条容易踩的重复：
 *   1. 游戏要能双击直接跑，所以素材模块必须内联进 HTML；
 *   2. src/index.html 与 src/artifact-fragment.html 除了外层包装（doctype / head /
 *      字体链接 / 平台基础样式）之外，游戏主体必须**逐字相同**。
 * 规定如下，避免出现三份互相不同步的代码：
 *   - art/mech-icons.js 是素材的唯一可编辑源文件；
 *   - src/artifact-fragment.html 是游戏主体的唯一可编辑源文件；
 *   - src/index.html 的「游戏 CSS + 游戏标记 + 脚本」整段是从 fragment 复制来的；
 *   - HTML 里夹在 ART 标记之间的那一段也是生成出来的。
 *
 * 用法：node tools/build-src.mjs           生成（先注入素材，再同步 index.html）
 *       node tools/build-src.mjs --check   只检查，不写文件（改完记得跑这个）
 * ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC_DIR = join(ROOT, 'Claude hand off', 'src');

const FRAG = join(SRC_DIR, 'artifact-fragment.html');
const INDEX = join(SRC_DIR, 'index.html');
const ART_SRC = join(ROOT, 'art', 'mech-icons.js');

const BEGIN = '<!-- ===== ART:mech-icons BEGIN（自动生成，请勿手改；源文件 art/mech-icons.js）===== -->';
const END = '<!-- ===== ART:mech-icons END ===== -->';
const AUDIO_BEGIN = '<!-- ===== AUDIO BEGIN（自动生成，请勿手改；源文件 audio/score.js + audio/mech-audio.js）===== -->';
const AUDIO_END = '<!-- ===== AUDIO END ===== -->';
const ANCHOR = "<script>\n(() => {\n'use strict';\nconst N = 40, TS = 22;";

const checkOnly = process.argv.includes('--check');
const notes = [];
let problems = 0;
const fail = m => { problems++; console.error('  ✗ ' + m); };
const ok = m => console.log('  ✓ ' + m);

/* ---------- 1. 生成素材代码块 ---------- */
const artSrc = readFileSync(ART_SRC, 'utf8').replace(/\r\n/g, '\n');
if (artSrc.includes('</script')) { console.error('art/mech-icons.js 里出现了 </script，无法安全内联'); process.exit(1); }

const artBlock = [
  BEGIN,
  '<script>',
  '/* 机体图标矢量素材（原创）· 源文件 art/mech-icons.js · 由 tools/build-src.mjs 注入 */',
  artSrc.replace(/\n+$/, ''),
  '</script>',
  END,
].join('\n');

/* ---------- 1b. 生成音频代码块（乐谱 + 播放层） ---------- */
/* 顺序要紧：mech-audio.js 在工厂函数里就读 globalThis.MechScore，所以 score.js 必须在前。 */
function readModule(rel, label) {
  const s = readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  if (s.includes('</script')) throw new Error(`${rel} 里出现了 </script，无法安全内联`);
  return [`<script>`, `/* ${label} · 源文件 ${rel} · 由 tools/build-src.mjs 注入 */`, s.replace(/\n+$/, ''), `</script>`].join('\n');
}
const audioSrcFiles = ['audio/score.js', 'audio/mech-audio.js'];
for (const f of audioSrcFiles) if (!existsSync(join(ROOT, f))) { console.error(`缺少 ${f}`); process.exit(1); }

const audioBlock = [
  AUDIO_BEGIN,
  readModule('audio/score.js', '乐谱数据（唯一真源，改音乐只改这个文件）'),
  readModule('audio/mech-audio.js', '音频播放层 MechAudio（Web Audio 现场合成）'),
  AUDIO_END,
].join('\n');

/* 把音频块插到 ART 块后面（ART 块紧邻游戏主脚本之前） */
function injectAudio(text) {
  const i = text.indexOf(AUDIO_BEGIN);
  if (i >= 0) {
    const j = text.indexOf(AUDIO_END, i);
    if (j < 0) return {text, note: '音频块有 BEGIN 没有 END'};
    if (text.slice(i, j + AUDIO_END.length) === audioBlock) return {text, note: '音频代码已是最新'};
    return {text: text.slice(0, i) + audioBlock + text.slice(j + AUDIO_END.length), note: '音频代码已更新'};
  }
  const artEnd = text.indexOf(END);
  if (artEnd >= 0) {
    const at = artEnd + END.length;
    return {text: text.slice(0, at) + '\n\n' + audioBlock + text.slice(at), note: '音频代码已插入'};
  }
  const a = text.indexOf(ANCHOR);
  if (a < 0) return {text, note: null};
  return {text: text.slice(0, a) + audioBlock + '\n\n' + text.slice(a), note: '音频代码已插入（无 ART 块）'};
}

/* ---------- 2. 把素材注入 fragment ---------- */
let frag = readFileSync(FRAG, 'utf8');
const eol = frag.includes('\r\n') ? '\r\n' : '\n';
const toEol = s => eol === '\r\n' ? s.replace(/\n/g, '\r\n') : s;

let fragBody = frag.replace(/\r\n/g, '\n');
{
  const i = fragBody.indexOf(BEGIN);
  if (i >= 0) {
    const j = fragBody.indexOf(END, i);
    if (j < 0) { fail('fragment 里有 ART BEGIN 但没有 END'); }
    else {
      const cur = fragBody.slice(i, j + END.length);
      if (cur === artBlock) notes.push('fragment 里的素材代码已是最新');
      else fragBody = fragBody.slice(0, i) + artBlock + fragBody.slice(j + END.length);
    }
  } else {
    const a = fragBody.indexOf(ANCHOR);
    if (a < 0) fail('fragment 里找不到游戏主脚本，无法插入素材代码');
    else fragBody = fragBody.slice(0, a) + artBlock + '\n\n' + fragBody.slice(a);
  }
}
/* 音频块：插在 ART 块之后 */
{
  const r = injectAudio(fragBody);
  if (!r.note) fail('fragment 里既没有音频块也没有 ART 块，无法插入音频代码');
  else {
    if (r.text !== fragBody) fragBody = r.text;
    notes.push('fragment：' + r.note);
  }
}
const fragOut = toEol(fragBody);
/* ---------- 3. 把 fragment 的游戏主体同步到 index.html ---------- */
/* 主体 = 紧挨着 <div class="app"> 之前的那段 <style> 起，到最后一个 </script> 结束。
   这段里包含：游戏 CSS、ART 素材块、游戏标记、游戏脚本。 */
function bodyRegion(text) {
  const appAt = text.indexOf('<div class="app">');
  if (appAt < 0) return null;
  const styleAt = text.lastIndexOf('<style>', appAt);
  if (styleAt < 0) return null;
  const end = text.lastIndexOf('</script>');
  if (end < 0 || end < appAt) return null;
  return { start: styleAt, end: end + '</script>'.length };
}

const fragN = fragOut.replace(/\r\n/g, '\n');
const fr = bodyRegion(fragN);
if (!fr) { fail('fragment 里找不到游戏主体范围'); }
else {
  const body = fragN.slice(fr.start, fr.end);
  const idxRaw = readFileSync(INDEX, 'utf8');
  const idxEol = idxRaw.includes('\r\n') ? '\r\n' : '\n';
  const idxN = idxRaw.replace(/\r\n/g, '\n');
  const ir = bodyRegion(idxN);
  if (!ir) fail('index.html 里找不到游戏主体范围');
  else {
    const cur = idxN.slice(ir.start, ir.end);
    if (cur === body) notes.push('index.html 的游戏主体与 fragment 一致');
    else {
      const out = idxN.slice(0, ir.start) + body + idxN.slice(ir.end);
      if (checkOnly) fail('index.html 的游戏主体与 fragment 不一致（跑一次 node tools/build-src.mjs）');
      else {
        writeFileSync(INDEX, idxEol === '\r\n' ? out.replace(/\n/g, '\r\n') : out, 'utf8');
        notes.push(`index.html 的游戏主体已从 fragment 同步（${body.split('\n').length} 行）`);
      }
    }
  }
}

/* ---------- 4. 只在需要时写 fragment ---------- */
if (fragOut !== frag) {
  if (checkOnly) fail('fragment 里的素材代码与 art/mech-icons.js 不同步');
  else {
    writeFileSync(FRAG, fragOut, 'utf8');
    notes.push('fragment 已注入最新素材代码');
  }
}

/* ---------- 输出 ---------- */
console.log('build-src：');
for (const n of notes) ok(n);
if (problems) { console.log(`\n${problems} 项需要处理`); process.exit(1); }
console.log('\n两份 HTML 已同步');
