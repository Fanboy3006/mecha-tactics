/* ============================================================================
 * 素材自检：不打开浏览器也要保证 Canvas 后端和预览页脚本不会报错。
 *
 *  1. 用一个「假 Canvas 上下文」跑一遍 MechIcons.draw，检查所有绘制指令都能处理；
 *  2. 检查 makeSprite 的逻辑（用一个假 document 顶替）；
 *  3. 把 art/preview.html 里的内联脚本抽出来做语法检查。
 *
 * 用法：node tools/check-art.mjs
 * ========================================================================== */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

let fails = 0;
const ok = m => console.log('  ✓ ' + m);
const bad = m => { fails++; console.log('  ✗ ' + m); };

/* ---------- 1. 假 Canvas 上下文 ---------- */
function fakeCtx() {
  const calls = [];
  const rec = n => (...a) => { calls.push([n, a]); };
  const grad = { addColorStop: rec('addColorStop') };
  const ctx = {
    calls,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    lineCap: '', lineJoin: '',
    save: rec('save'), restore: rec('restore'), translate: rec('translate'), scale: rec('scale'),
    beginPath: rec('beginPath'), closePath: rec('closePath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), rect: rec('rect'),
    arcTo: rec('arcTo'), ellipse: rec('ellipse'),
    fill: rec('fill'), stroke: rec('stroke'),
    createLinearGradient: (...a) => { calls.push(['createLinearGradient', a]); return grad; },
  };
  return ctx;
}

/* ---------- 2. 假 document（给 makeSprite 用） ---------- */
function installFakeDocument() {
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('unexpected element: ' + tag);
      const cv = { width: 0, height: 0, _ctx: null };
      cv.getContext = () => (cv._ctx = cv._ctx || fakeCtx());
      return cv;
    },
  };
}

/* ---------- 跑测试 ---------- */
const Icons = require(join(ROOT, 'art', 'mech-icons.js'));
console.log('检查 mech-icons.js v' + Icons.VERSION + '（' + Icons.ids.length + ' 个图标）\n');

console.log('[1] Canvas 后端：每个图标 × 每个调色板 × 三种底板');
{
  const cases = [];
  for (const id of Icons.ids) {
    for (const pk of ['ying', 'moon', 'cb', 'enemy', 'acted', 'rock']) {
      for (const plate of ['square', 'circle', 'none']) {
        cases.push({id, pk, plate, size: 96});
      }
    }
    // 顺便覆盖三个细节等级
    for (const size of [22, 33, 96]) cases.push({id, pk: 'cb', plate: 'square', size});
  }
  let errs = 0, primTotal = 0;
  for (const c of cases) {
    const ctx = fakeCtx();
    try {
      const prims = Icons.build(c.id, {
        pal: c.pk, plate: c.plate, size: c.size,
        role: Icons.ROLE_OF[c.id],
      });
      primTotal += prims.length;
      Icons.draw(ctx, prims, 48, 5, 7);
      if (!prims.length) { bad(`${c.id} 没有生成任何图元`); errs++; }
      // 关键调用必须出现过
      const names = new Set(ctx.calls.map(x => x[0]));
      for (const need of ['save', 'restore', 'translate', 'scale']) {
        if (!names.has(need)) { bad(`${c.id}: 缺少 ${need}()`); errs++; }
      }
      if (!names.has('fill') && !names.has('stroke')) { bad(`${c.id}: 既没有 fill 也没有 stroke`); errs++; }
    } catch (e) {
      bad(`${c.id} / ${c.pk} / ${c.plate} / ${c.size}: ${e.message}`);
      errs++;
    }
    if (errs > 6) break;
  }
  if (!errs) ok(`${cases.length} 个组合全部通过，平均每个图标 ${Math.round(primTotal / cases.length)} 条绘制指令`);
}

console.log('\n[2] makeSprite 预渲染（画布非正方形：图标盒在底部 + 上方留白）');
{
  installFakeDocument();
  let errs = 0;
  for (const id of Icons.ids) {
    try {
      const box = 96;
      const cv = Icons.makeSprite(id, {pal: 'ying', plate: 'square', size: 22, role: Icons.ROLE_OF[id]}, box);
      // 高度 = 宽度 × (1 + headroom)，默认 headroom 0.08
      if (cv.width !== box) { bad(`${id}: 宽度应为 ${box}，实际 ${cv.width}`); errs++; }
      if (cv.height !== Math.round(box * 1.08)) { bad(`${id}: 高度应为 ${Math.round(box*1.08)}，实际 ${cv.height}`); errs++; }
      if (!cv._ctx || !cv._ctx.calls.length) { bad(`${id}: 没有产生任何绘制调用`); errs++; }
    } catch (e) { bad(`${id}: ${e.message}`); errs++; }
    if (errs > 3) break;
  }
  if (!errs) ok(`${Icons.ids.length} 个图标都能预渲染，画布比例符合「高出格子」的设定`);

  // 外描边：开启后绘制调用应该明显变多（8 个方向的剪影 + 本体）
  try {
    const a = Icons.makeSprite('B1', {pal: 'cb', size: 22, role: '近卫'}, 64).getContext('2d').calls.length;
    const b = Icons.makeSprite('B1', {pal: 'cb', size: 22, role: '近卫', outline: '#000'}, 64).getContext('2d').calls.length;
    if (b > a * 4) ok(`外描边生效：绘制调用 ${a} → ${b}（8 个方向的剪影）`);
    else bad(`外描边似乎没生效：${a} → ${b}`);
  } catch (e) { bad('外描边检查报错：' + e.message); }
}

console.log('\n[3] 预览页内联脚本语法');
{
  const html = readFileSync(join(ROOT, 'art', 'preview.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!scripts.length) bad('没有找到内联脚本');
  scripts.forEach((src, i) => {
    try { new vm.Script(src, {filename: `preview.html#script${i}`}); ok(`内联脚本 ${i} 语法通过（${src.length} 字符）`); }
    catch (e) { bad(`内联脚本 ${i}: ${e.message}`); }
  });
  // 引用的 id 必须在 HTML 里存在
  const ids = ['allies', 'enemies', 'neutral', 'roles', 'lod', 'cnt'];
  for (const id of ids) {
    if (!html.includes(`id="${id}"`)) { bad(`preview.html 缺少 id="${id}"`); }
  }
  const used = [...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
  const missing = [...new Set(used)].filter(u => !ids.includes(u));
  if (missing.length) bad('脚本引用了不存在的 id: ' + missing.join(', '));
  else ok('脚本引用的所有元素 id 都存在');
}

console.log('\n[4] 数据一致性');
{
  // 游戏里可能出现的 mech 名都要有对应图标
  const mechNames = ['B1','B2','M1','M2','M3','CB1','CB2','CB3','CB4',
    '量产机','猎犬','无人机','铁壁','突击兵','固定炮台','盾卫','追击炮车','战斗机','炮击机','重装要塞','指挥舰','陨石残骸'];
  const miss = mechNames.filter(m => !Icons.ICON_BY_MECH[m] || !Icons.ids.includes(Icons.ICON_BY_MECH[m]));
  if (miss.length) bad('以下机体名没有图标：' + miss.join('、'));
  else ok(`${mechNames.length} 个机体名都能映射到图标`);

  // 每个图标都要有中文名
  const noName = Icons.ids.filter(id => !Icons.NAMES[id]);
  if (noName.length) bad('以下图标没有中文名：' + noName.join('、'));
  else ok('每个图标都有中文名');

  // 我方 9 台都要有战斗分类和阵营
  const allies = ['B1','B2','M1','M2','M3','CB1','CB2','CB3','CB4'];
  const noRole = allies.filter(id => !Icons.ROLE_OF[id] || !Icons.FACTION_OF[id]);
  if (noRole.length) bad('以下我方机体缺少分类/阵营：' + noRole.join('、'));
  else ok('9 台我方机体的战斗分类与阵营都齐全');
}

console.log('\n[5] 游戏 HTML：内联脚本语法 + 图标接入点');
{
  const files = ['Claude hand off/src/artifact-fragment.html', 'Claude hand off/src/index.html'];
  for (const rel of files) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    let bad0 = 0;
    scripts.forEach((src, i) => {
      try { new vm.Script(src, {filename: `${rel}#script${i}`}); }
      catch (e) { bad(`${rel} 内联脚本 ${i}: ${e.message}`); bad0++; }
    });
    if (!bad0) ok(`${rel}：${scripts.length} 段内联脚本语法全部通过`);

    // 素材模块必须已内联
    if (!html.includes('globalThis.MechIcons') && !/root\.MechIcons\s*=/.test(html)) {
      bad(`${rel} 里没有内联素材模块，跑 node tools/build-src.mjs`);
    } else ok(`${rel}：素材模块已内联`);

    // 接入点必须存在（表现层：精灵比格子大 + 三趟绘制）
    for (const [what, needle] of [
      ['图标精灵缓存', 'spriteCache'],
      ['精灵比格子大', 'function spriteSpec'],
      ['地面标记几何', 'function groundGeom'],
      ['第一趟 地面', 'function drawUnitGround'],
      ['第二趟 机体', 'function drawUnitSprite'],
      ['第三趟 状态', 'function drawUnitStatus'],
      ['画家算法排序', '.sort((a, b) => (a.y + a.h) - (b.y + b.h)'],
      ['外描边', 'SPR_OUTLINE'],
      ['机体名开关按钮', 'id="btnNames"'],
      ['网格开关按钮', 'id="btnGrid"'],
      ['机体名接线', "$('#btnNames').onclick"],
      ['网格接线', "$('#btnGrid').onclick"],
      ['S.names 字段', 'names:false'],
      ['S.grid 字段', 'grid:false'],
      ['网格改成按需绘制', 'function drawGrid'],
      ['测试接口暴露素材', 'get art(){ return MI; }'],
      // 可视层与可复用标记组件（新机制往这些层里加东西）
      ['地块修饰层', 'function drawTileDecor'],
      ['单位连线层', 'function drawUnitLinks'],
      ['连线列表', 'const unitLinks = []'],
      ['机体附加层（光罩）', 'function drawUnitAura'],
      ['多段条组件', 'function segBar'],
      ['增益减益徽记组件', 'function badgeRow'],
      ['光罩组件', 'function auraRing'],
      ['连线组件', 'function unitLink'],
      ['半透明（隐蔽）', 'u.hidden'],
    ]) {
      if (!html.includes(needle)) bad(`${rel}：找不到「${what}」`);
    }
    if (!bad0) ok(`${rel}：图标接入点齐全（含三趟绘制 / 地面标记 / 开关 / 可视层组件）`);
    // 势力与分类必须走查表，不能退回硬编码
    if (!html.includes('MI.FACTION_PAL[u.tags && u.tags.势力]')) bad(`${rel}：palKeyOf 没有查 FACTION_PAL 表`);
    if (!html.includes('function roleOf(u)')) bad(`${rel}：缺少 roleOf()（分类应来自 tags）`);
    // 变身形态的图标必须是数据字段
    if (!/nadleeh:\{name:'纳德雷', icon:/.test(html)) bad(`${rel}：FORMS 里缺少 icon 字段`);
    if (!bad0) ok(`${rel}：势力 / 分类 / 变身图标都是查表得到的`);
    // 地形预渲染里不应该再有常驻网格
    const bt = html.slice(html.indexOf('function buildTerrain'), html.indexOf('function drawGrid'));
    if (/strokeStyle = COL\.grid/.test(bt)) bad(`${rel}：buildTerrain 里还画着常驻网格线`);
    else ok(`${rel}：常驻网格线已从地形里移除`);
  }
}

console.log(fails ? `\n共 ${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
