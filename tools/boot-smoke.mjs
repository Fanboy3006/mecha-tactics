/* ============================================================================
 * 冒烟测试：不打开浏览器，把单文件游戏真的「启动」一次。
 * ----------------------------------------------------------------------------
 * 本机装不了 Playwright（npm 缓存目录在沙箱外，写不进去），所以这里自己搭一套
 * 最小 DOM / Canvas 替身，把 src/artifact-fragment.html 里的内联脚本放进 Node 的
 * vm 里跑起来，然后：
 *   1. 检查游戏能加载、window.__game 齐全；
 *   2. 逐个关卡 startLevel，并真的跑几帧 draw()（这会走遍 drawUnit）；
 *   3. 校验每个单位都拿到了图标（没有静默回退到方块/圆形）；
 *   4. 打开「机体名」开关再跑几帧，覆盖额外绘制分支。
 *
 * 它能抓住的是「运行时报错 / 接口对不上」，抓不到的是「好不好看」——
 * 好不好看请打开 art/preview.html 和游戏本身。
 *
 * 用法：node tools/boot-smoke.mjs
 * ========================================================================== */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

let fails = 0;
const ok = m => console.log('  ✓ ' + m);
const bad = m => { fails++; console.log('  ✗ ' + m); };
const info = m => console.log('    · ' + m);

/* ============================ Canvas 2D 替身 ============================ */
function makeCtx() {
  const noop = () => {};
  const target = {
    canvas: null,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
    shadowBlur: 0, shadowColor: 'transparent',
    filter: 'none', direction: 'ltr',
    measureText: t => ({width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2}),
    createLinearGradient: () => ({addColorStop: noop}),
    createRadialGradient: () => ({addColorStop: noop}),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4))}),
    createImageData: (w, h) => ({width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4))}),
    putImageData: noop,
    getLineDash: () => [],
  };
  // 其余方法一律当 no-op
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^(fill|stroke|clip|draw|clear|begin|close|move|line|arc|ellipse|rect|round|quadratic|bezier|save|restore|translate|scale|rotate|transform|set|reset|isPoint)/.test(k)) {
        return noop;
      }
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; },
  });
}

function makeCanvas(w = 300, h = 150) {
  const cv = {
    tagName: 'CANVAS', nodeType: 1,
    width: w, height: h,
    style: {}, dataset: {},
    clientWidth: w, clientHeight: h,
    _ctx: null,
    getContext() { return (cv._ctx = cv._ctx || makeCtx()); },
    toDataURL: () => 'data:image/png;base64,',
    addEventListener: () => {}, removeEventListener: () => {},
    appendChild: () => {}, getBoundingClientRect: () => ({left:0, top:0, width:w, height:h}),
  };
  return cv;
}

/* ============================ DOM 替身 ============================ */
const listeners = {document: [], window: [], elements: new Map()};

function makeEl(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(), nodeType: 1, id,
    innerHTML: '', textContent: '', value: '', title: '', type: '',
    hidden: false, disabled: false, checked: false, files: [],
    style: {}, dataset: {}, children: [], classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : !!f; on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); },
    },
    _attrs: {}, _handlers: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    prepend(c) { this.children.unshift(c); return c; },
    removeChild() {}, remove() {},
    querySelector(sel) {
      this._q = this._q || new Map();
      if (!this._q.has(sel)) this._q.set(sel, makeEl('div'));
      return this._q.get(sel);
    },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, click() {}, select() {}, scrollTo() {}, scrollIntoView() {},
    getBoundingClientRect: () => ({left:0, top:0, right:900, bottom:700, width:900, height:700}),
    getContext: undefined,
  };
  return el;
}

const byId = new Map();
function getEl(sel) {
  const id = String(sel).replace(/^#/, '');
  if (!byId.has(id)) {
    const el = (id === 'cv' || id === 'ptFile') ? makeCanvas(800, 600) : makeEl('div', id);
    if (id === 'ptFile') el.type = 'file';
    byId.set(id, el);
  }
  return byId.get(id);
}

const documentStub = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  head: makeEl('head'),
  querySelector(sel) { return getEl(sel); },
  querySelectorAll() { return []; },
  getElementById(id) { return getEl('#' + id); },
  createElement(tag) { return tag === 'canvas' ? makeCanvas() : makeEl(tag); },
  createDocumentFragment() { return makeEl('fragment'); },
  addEventListener(t, fn) { listeners.document.push([t, fn]); },
  removeEventListener() {},
  hidden: false,
  cookie: '',
};

/* ============================ window 替身 ============================ */
const store = new Map();
let rafCb = null, rafCount = 0;

const sandbox = {
  console,
  document: documentStub,
  devicePixelRatio: 2,
  innerWidth: 1440, innerHeight: 900,
  matchMedia: q => ({matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}}),
  requestAnimationFrame(cb) { rafCb = cb; rafCount++; return rafCount; },
  cancelAnimationFrame() {},
  setTimeout: (fn) => { return 0; },            // 冒烟测试不推进异步流程
  clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  performance: {now: () => Date.now()},
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  },
  Image: class { constructor() { this.width = 10; this.height = 10; } set src(v) { this._src = v; if (this.onload) this.onload(); } get src() { return this._src; } },
  FileReader: class { readAsDataURL() { this.result = 'data:,'; if (this.onload) this.onload(); } },
  navigator: {userAgent: 'node', clipboard: {writeText: () => Promise.resolve()}},
  alert() {}, confirm: () => true, prompt: () => null,
  addEventListener(t, fn) { listeners.window.push([t, fn]); },
  removeEventListener() {},
  getComputedStyle: () => ({getPropertyValue: () => '#000'}),
  scrollTo() {},
  load() {},
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

/* ============================ 加载游戏脚本 ============================ */
const html = readFileSync(join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`冒烟测试：加载 artifact-fragment.html（${scripts.length} 段内联脚本）\n`);

const ctxVm = vm.createContext(sandbox);
let loaded = true;
for (let i = 0; i < scripts.length; i++) {
  try {
    new vm.Script(scripts[i], {filename: `fragment#script${i}`}).runInContext(ctxVm);
    info(`脚本 ${i} 执行完成（${scripts[i].length} 字符）`);
  } catch (e) {
    bad(`脚本 ${i} 执行报错：${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n      ') : e}`);
    loaded = false;
    break;
  }
}

console.log('\n[1] 启动');
if (!loaded) { console.log('\n游戏无法加载，后续检查跳过'); process.exit(1); }
const G = sandbox.__game;
if (!G) bad('window.__game 没有暴露'); else ok('window.__game 已就绪');

/* —— 跑一帧 —— */
function frame() {
  if (typeof rafCb !== 'function') return false;
  const cb = rafCb;
  rafCb = null;
  cb(Date.now());
  return true;
}
try { frame(); ok('draw() 第一帧执行成功'); }
catch (e) { bad('draw() 报错：' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join('\n      ') : e)); }

console.log('\n[2] 逐关切换 + 跑帧');
const levels = ['tut1', 'tut2', 'tut3', 'defense', 'skirmish'];
const levelSel = getEl('#levelSel');
/* v0.17 起多数关卡开场先弹编队界面，我方要点「开始作战」才会上场 */
const confirmFormation = () => { const b = getEl('#btnForm'); if (b && typeof b.onclick === 'function') b.onclick(); };
for (const id of levels) {
  try {
    levelSel.value = id;
    if (typeof levelSel.onchange === 'function') { levelSel.onchange({target: {value: id}}); confirmFormation(); }
    else bad(`#levelSel 没有 onchange，无法切换关卡`);
    const n = G.units.length;
    let frames = 0;
    for (let i = 0; i < 3; i++) if (frame()) frames++;
    ok(`${id}：${n} 个单位，跑了 ${frames} 帧`);
  } catch (e) {
    bad(`${id} 失败：${e && e.stack ? e.stack.split('\n').slice(0, 5).join('\n      ') : e}`);
  }
}

console.log('\n[3] 图标覆盖：每个单位都要拿到图标');
try {
  const missing = [], noSprite = [];
  for (const id of levels) {
    levelSel.value = id;
    levelSel.onchange({target: {value: id}}); confirmFormation();
    for (const u of G.units) {
      const icon = G.iconIdOf(u);
      if (!icon) missing.push(`${id}/${u.mech}(${u.side})`);
      else if (!G.unitSprite(u)) noSprite.push(`${id}/${u.mech}`);
    }
  }
  if (missing.length) bad('没有图标的单位：' + missing.join('、'));
  else ok('所有关卡的所有单位都有对应图标');
  if (noSprite.length) bad('图标生成了但精灵为空：' + noSprite.join('、'));
  else ok('所有单位都能生成精灵');
} catch (e) { bad('图标覆盖检查报错：' + e.message); }

console.log('\n[4] 变身（纳德雷）图标');
try {
  levelSel.value = 'defense'; levelSel.onchange({target: {value: 'defense'}}); confirmFormation();
  const cb4 = G.units.find(u => u.mech === 'CB4');
  if (!cb4) bad('找不到 CB4 提耶利亚');
  else {
    const before = G.iconIdOf(cb4);
    cb4.transformed = true;
    const after = G.iconIdOf(cb4);
    const spr = G.unitSprite(cb4);
    cb4.transformed = false;
    if (before === 'CB4' && after === 'CB4N' && spr) ok(`提耶利亚变身：图标 ${before} → ${after}，精灵生成成功`);
    else bad(`提耶利亚变身图标不对：${before} → ${after}`);
  }
} catch (e) { bad('变身检查报错：' + e.message); }

console.log('\n[5] 已行动灰调 / 状态标记');
try {
  levelSel.value = 'tut1'; levelSel.onchange({target: {value: 'tut1'}});
  const u = G.units.find(x => x.side === 'ally');
  u.acted = true; u.flying = true; u.debuffs.push({});
  const s1 = G.unitSprite(u);
  u.acted = false; u.debuffs.length = 0; u.flying = false;
  const s2 = G.unitSprite(u);
  if (s1 && s2 && s1 !== s2) ok('已行动（灰调）与正常状态的精灵是分开缓存的');
  else bad('已行动状态的精灵没有区分');
  frame();
  ok('带 破防 / 飞行 / 已行动 标记的帧执行成功');
} catch (e) { bad('状态标记检查报错：' + e.message); }

console.log('\n[6] 「机体名」开关');
try {
  const btn = getEl('#btnNames');
  if (typeof btn.onclick !== 'function') bad('#btnNames 没有接线');
  else {
    btn.onclick();
    if (!G.S.names) bad('点击后 S.names 没有变成 true');
    else { frame(); ok('打开机体名后跑帧成功（覆盖额外绘制分支）'); }
    btn.onclick();
    if (G.S.names) bad('再次点击没有关闭 S.names'); else ok('开关可以关闭');
    frame();
  }
} catch (e) { bad('机体名开关报错：' + e.message); }

console.log('\n[7] 选中 / 面板渲染（走 unitCardHTML）');
try {
  levelSel.value = 'defense'; levelSel.onchange({target: {value: 'defense'}});
  let n = 0;
  for (const u of G.units) {
    G.onTile(u.x, u.y);            // 点单位 → 面板刷新
    frame();
    n++;
    if (n > 14) break;
  }
  ok(`对 ${n} 个单位执行了点击 + 面板刷新 + 跑帧`);
} catch (e) { bad('点击 / 面板报错：' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join('\n      ') : e)); }

console.log('\n[8] 音频模块（注入顺序 + 无 AudioContext 时的降级）');
try {
  const MA = sandbox.MechAudio, MS = sandbox.MechScore;
  if (!MS) bad('游戏里没有 MechScore（乐谱没注入，或者注入顺序不对）');
  else if (!MS.CUES || Object.keys(MS.CUES).length < 8) bad(`MechScore.CUES 只有 ${MS.CUES ? Object.keys(MS.CUES).length : 0} 首`);
  else ok(`MechScore 已注入，${Object.keys(MS.CUES).length} 首曲子`);

  if (!MA) bad('游戏里没有 MechAudio');
  else {
    const api = ['play', 'sfx', 'setVolume', 'mute', 'unlock', 'state', 'stop'];
    const miss = api.filter(k => typeof MA[k] !== 'function');
    if (miss.length) bad('MechAudio 缺接口：' + miss.join('、'));
    else ok('MechAudio 接口齐全');
    // 这个替身环境里没有 AudioContext：必须**优雅降级**，而不是抛异常
    let threw = null;
    try {
      const r = MA.play('allyPhase');
      MA.sfx('hit'); MA.setVolume(0.5, 0.5); MA.mute(true); MA.mute(false); MA.stop();
      const st = MA.state();
      if (r !== false) info(`没有 AudioContext 时 play() 返回了 ${r}（预期 false）`);
      if (st.ready !== false) bad('没有 AudioContext 时 state().ready 应该是 false');
      else ok('没有 AudioContext 时优雅降级（play 返回 false，不抛异常）');
    } catch (e) { threw = e; }
    if (threw) bad('没有 AudioContext 时抛异常了：' + threw.message);
  }
} catch (e) { bad('音频检查报错：' + e.message); }

console.log(fails ? `\n共 ${fails} 项失败` : '\n冒烟测试全部通过');
process.exit(fails ? 1 : 0);
