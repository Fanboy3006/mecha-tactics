/* ============================================================================
 * 最小 DOM / window 替身：让单文件游戏能在 Node 里「启动」。
 * ----------------------------------------------------------------------------
 * 两个工具共用：
 *   - tools/boot-smoke.mjs   启动冒烟（Canvas 用 no-op 替身，快）
 *   - tools/render-game.mjs  真的把游戏画面渲染成 PNG（Canvas 用 canvas2d）
 * ========================================================================== */
import { createCanvas2D } from './canvas2d.mjs';

export function createEnv(opts = {}) {
  const real = !!opts.canvas2d;
  const dpr = opts.devicePixelRatio == null ? 1 : opts.devicePixelRatio;
  const ss = opts.ss || 2;
  const VP_W = opts.viewportWidth || 1000;
  const VP_H = opts.viewportHeight || 700;

  const warnings = [];
  const listeners = {document: [], window: []};

  /* ---------- Canvas ---------- */
  function makeCtxNoop() {
    const noop = () => {};
    return new Proxy({
      measureText: t => ({width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2}),
      createLinearGradient: () => ({addColorStop: noop}),
      createRadialGradient: () => ({addColorStop: noop}),
      getLineDash: () => [],
    }, {
      get(t, k) { return k in t ? t[k] : noop; },
      set(t, k, v) { t[k] = v; return true; },
      has() { return true; },
    });
  }

  function makeCanvas(w = 300, h = 150) {
    if (real) return createCanvas2D(w, h, {ss});
    const cv = {
      tagName: 'CANVAS', nodeType: 1, width: w, height: h,
      style: {}, dataset: {}, clientWidth: w, clientHeight: h, _ctx: null,
      getContext() { return (cv._ctx = cv._ctx || makeCtxNoop()); },
      toDataURL: () => 'data:image/png;base64,',
      addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {},
      getBoundingClientRect: () => ({left: 0, top: 0, width: w, height: h}),
    };
    return cv;
  }

  /* ---------- 元素 ---------- */
  function makeEl(tag = 'div', id = '') {
    const el = {
      tagName: String(tag).toUpperCase(), nodeType: 1, id,
      innerHTML: '', textContent: '', value: '', title: '', type: '',
      hidden: false, disabled: false, checked: false, files: [],
      style: {}, dataset: {}, children: [],
      classList: {
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
      getBoundingClientRect: () => ({left: 0, top: 0, right: VP_W, bottom: VP_H, width: VP_W, height: VP_H}),
    };
    return el;
  }

  const byId = new Map();
  function getEl(sel) {
    const id = String(sel).replace(/^#/, '');
    if (!byId.has(id)) {
      let el;
      if (id === 'cv') { el = makeCanvas(800, 600); }
      else if (id === 'ptFile') { el = makeEl('input', id); el.type = 'file'; }
      else if (id === 'mapWrap') { el = makeEl('div', id); el.clientWidth = VP_W; el.clientHeight = VP_H; }
      else el = makeEl('div', id);
      byId.set(id, el);
    }
    return byId.get(id);
  }

  const documentStub = {
    documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'),
    querySelector: getEl,
    querySelectorAll: () => [],
    getElementById: id => getEl('#' + id),
    createElement: tag => (tag === 'canvas' ? makeCanvas() : makeEl(tag)),
    createDocumentFragment: () => makeEl('fragment'),
    addEventListener(t, fn) { listeners.document.push([t, fn]); },
    removeEventListener() {},
    hidden: false, cookie: '',
  };

  /* ---------- window ---------- */
  const store = new Map();
  let rafCb = null, rafCount = 0;

  const sandbox = {
    console, document: documentStub,
    devicePixelRatio: dpr, innerWidth: VP_W, innerHeight: VP_H,
    matchMedia: q => ({matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}}),
    requestAnimationFrame(cb) { rafCb = cb; rafCount++; return rafCount; },
    cancelAnimationFrame() {},
    setTimeout: () => 0,
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
    navigator: {userAgent: 'node'},
    alert() {}, confirm: () => true, prompt: () => null,
    addEventListener(t, fn) { listeners.window.push([t, fn]); },
    removeEventListener() {},
    getComputedStyle: () => ({getPropertyValue: () => '#000'}),
    scrollTo() {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  return {
    sandbox, documentStub, getEl, listeners, warnings,
    viewport: {w: VP_W, h: VP_H},
    /* 跑一帧（拿最近一次 requestAnimationFrame 的回调） */
    frame(t = 0) {
      if (typeof rafCb !== 'function') return false;
      const cb = rafCb; rafCb = null;
      cb(t || Date.now());
      return true;
    },
    get canvas() { return getEl('#cv'); },
    get rafCount() { return rafCount; },
  };
}
