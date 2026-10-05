/* ============================================================================
 * 一个能真正出像素的 Canvas 2D 实现（Node 端）
 * ----------------------------------------------------------------------------
 * 为什么需要它：本机沙箱里 headless 浏览器起不来（命名管道被拒），所以要看
 * 游戏画面就只能自己实现一份 Canvas 2D，把游戏**自己的 draw()** 跑出来存成 PNG。
 *
 * 支持的范围（够用即可，不追求完整规范）：
 *   - 变换：save/restore/translate/scale/rotate/transform/setTransform/resetTransform
 *   - 路径：beginPath/closePath/moveTo/lineTo/quadraticCurveTo/bezierCurveTo/
 *           arc/arcTo/ellipse/rect/roundRect，曲线一律打散成折线
 *   - 填充与描边：fill/stroke/fillRect/strokeRect/clearRect，非零环绕（能挖洞）
 *   - 样式：fillStyle（含线性/径向渐变）、strokeStyle、lineWidth、globalAlpha、
 *           lineCap/lineJoin（描边一律按圆头圆角处理）
 *   - 图像：drawImage（缩放 + alpha 合成，只按包围盒处理，不支持旋转）
 *   - 文字：measureText 给个粗略宽度，fillText/strokeText **不画**（见下）
 *
 * 已知取舍：
 *   - **文字不渲染**。要真画中文得内嵌字体，收益不值这个复杂度。所以导出的画面里
 *     没有网格坐标数字、没有浮动伤害数字、没有「撤离区」这类 canvas 文字。
 *     不影响判断美术。
 *   - setLineDash 被忽略（虚线按实线画）。
 *   - 抗锯齿靠 SS 倍超采样，不是解析覆盖率。
 * ========================================================================== */
import {
  parseColor, ellipsePoly, roundRectPoly, fillPaths, composite, encodePNG, resolve,
} from './raster.mjs';

/* ---------- 矩阵（用户空间 → 超采样设备空间） ---------- */
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const IDENT = [1, 0, 0, 1, 0, 0];
const matScale = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

/* ---------- 曲线打散 ---------- */
function sampleQuad(out, p0, p1, p2, n) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
              u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
}
function sampleCubic(out, p0, p1, p2, p3, n) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
              u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
}
function tessArc(r) { return Math.max(6, Math.min(48, Math.ceil(Math.abs(r) * 1.6))); }

/* ============================ 渐变对象 ============================ */
class Gradient {
  constructor(type, args, m) { this.type = type; this.args = args; this.m = m.slice(); this.stops = []; }
  addColorStop(t, c) { this.stops.push([Math.max(0, Math.min(1, t)), c]); }
  /* 返回像素空间里的 grad 描述（供 composite 用） */
  toRaster() {
    if (this.type === 'linear') {
      const [x0, y0, x1, y1] = this.args;
      return {g: [apply(this.m, x0, y0), apply(this.m, x1, y1)], st: this.stops.length ? this.stops : [[0, '#000'], [1, '#000']]};
    }
    // 径向渐变：用一条从中心到边缘的线性渐变近似
    const [x0, y0, r0, x1, y1, r1] = this.args;
    const a = apply(this.m, x0, y0), b = apply(this.m, x1, y1);
    const r = Math.max(0.001, (r1 || r0 || 1) * matScale(this.m));
    return {g: [a, [b[0] + r, b[1]]], st: this.stops.length ? this.stops : [[0, '#000'], [1, '#000']]};
  }
}

/* ============================ 画布 ============================ */
export function createCanvas2D(width, height, opts = {}) {
  const SS = opts.ss || 2;
  let W = Math.max(1, Math.round(width)), H = Math.max(1, Math.round(height));
  let DW = W * SS, DH = H * SS;
  let buf = new Float32Array(DW * DH * 4);

  const cv = {
    tagName: 'CANVAS', nodeType: 1,
    style: {}, dataset: {},
    _img: null, _ctx: null,
    get width() { return W; },
    set width(v) { resize(v, H); },
    get height() { return H; },
    set height(v) { resize(W, v); },
    get clientWidth() { return W; },
    get clientHeight() { return H; },
    getContext(kind) { if (kind !== '2d') return null; return (cv._ctx = cv._ctx || makeCtx()); },
    toDataURL: () => 'data:image/png;base64,',
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    getBoundingClientRect: () => ({left: 0, top: 0, width: W, height: H}),
    /* 导出：把超采样缓冲解析成 RGBA 位图（带缓存） */
    toImage() {
      if (!cv._img) cv._img = {w: W, h: H, px: resolve(buf, W, H, SS)};
      return cv._img;
    },
    toPNG() { const im = cv.toImage(); return encodePNG(W, H, im.px); },
  };

  /* 游戏会在 setMapSize 里改 canvas.width/height，所以要能重新分配缓冲 */
  function resize(w, h) {
    W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h));
    DW = W * SS; DH = H * SS;
    buf = new Float32Array(DW * DH * 4);
    cv._img = null;
  }

  function makeCtx() {
    let m = mul([SS, 0, 0, SS, 0, 0], IDENT);      // 基础缩放：用户空间 → 设备空间
    const stack = [];
    let path = [];        // [{pts:[[x,y]...], closed:bool}]，点已经是设备空间
    let cur = null;
    const st = {
      fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
      globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
      lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
      shadowBlur: 0, shadowColor: 'transparent', filter: 'none', direction: 'ltr', miterLimit: 10,
    };

    const P = (x, y) => apply(m, x, y);
    function addPt(x, y) { if (!cur) { cur = {pts: [], closed: false}; path.push(cur); } cur.pts.push(P(x, y)); }
    function lastPt() { return cur && cur.pts.length ? cur.pts[cur.pts.length - 1] : null; }

    function paintPath(kind) {
      if (!path.length) return;
      const polys = path.filter(s => s.pts.length >= 2).map(s => s.pts);
      if (!polys.length) return;
      const a = st.globalAlpha;
      if (kind === 'fill') {
        const mask = new Float32Array(DW * DH);
        fillPaths(mask, DW, DH, polys);
        const fs = st.fillStyle;
        if (fs instanceof Gradient) composite(buf, DW, DH, mask, fs.toRaster(), null, a);
        else composite(buf, DW, DH, mask, null, fs, a);
        cv._img = null;
      } else {
        const lw = Math.max(0.35, st.lineWidth * matScale(m));
        const mask = new Float32Array(DW * DH);
        const r = lw / 2;
        for (const poly of polys) {
          const n = poly.length;
          const lim = (path.find(s => s.pts === poly) || {}).closed ? n : n - 1;
          for (let i = 0; i < lim; i++) {
            const p = poly[i], q = poly[(i + 1) % n];
            const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
            const nx = -dy / L * r, ny = dx / L * r;
            fillPaths(mask, DW, DH, [[[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]]);
          }
          for (const p of poly) fillPaths(mask, DW, DH, [ellipsePoly(p[0], p[1], r, r)]);
        }
        const ss = st.strokeStyle;
        if (ss instanceof Gradient) composite(buf, DW, DH, mask, ss.toRaster(), null, a);
        else composite(buf, DW, DH, mask, null, ss, a);
        cv._img = null;
      }
    }

    const ctx = {
      canvas: cv,
      get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
      get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
      get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
      get globalAlpha() { return st.globalAlpha; }, set globalAlpha(v) { st.globalAlpha = v; },
      get font() { return st.font; }, set font(v) { st.font = v; },
      get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
      get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
      get lineCap() { return st.lineCap; }, set lineCap(v) { st.lineCap = v; },
      get lineJoin() { return st.lineJoin; }, set lineJoin(v) { st.lineJoin = v; },
      get globalCompositeOperation() { return st.globalCompositeOperation; }, set globalCompositeOperation(v) { st.globalCompositeOperation = v; },
      get imageSmoothingEnabled() { return st.imageSmoothingEnabled; }, set imageSmoothingEnabled(v) { st.imageSmoothingEnabled = v; },
      get imageSmoothingQuality() { return st.imageSmoothingQuality; }, set imageSmoothingQuality(v) { st.imageSmoothingQuality = v; },
      get shadowBlur() { return st.shadowBlur; }, set shadowBlur(v) { st.shadowBlur = v; },
      get shadowColor() { return st.shadowColor; }, set shadowColor(v) { st.shadowColor = v; },
      get filter() { return st.filter; }, set filter(v) { st.filter = v; },
      get direction() { return st.direction; }, set direction(v) { st.direction = v; },
      get miterLimit() { return st.miterLimit; }, set miterLimit(v) { st.miterLimit = v; },

      /* --- 状态 --- */
      save() { stack.push({m: m.slice(), ...st}); },
      restore() { const s = stack.pop(); if (!s) return; m = s.m; for (const k in st) if (k in s) st[k] = s[k]; },

      /* --- 变换 --- */
      setTransform(a, b, c, d, e, f) { m = mul([SS, 0, 0, SS, 0, 0], [a, b, c, d, e, f]); },
      resetTransform() { m = mul([SS, 0, 0, SS, 0, 0], IDENT); },
      transform(a, b, c, d, e, f) { m = mul(m, [a, b, c, d, e, f]); },
      translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); },
      scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
      rotate(a) { const c = Math.cos(a), s = Math.sin(a); m = mul(m, [c, s, -s, c, 0, 0]); },

      /* --- 路径 --- */
      beginPath() { path = []; cur = null; },
      closePath() { if (cur) { cur.closed = true; } },
      moveTo(x, y) { cur = {pts: [P(x, y)], closed: false}; path.push(cur); },
      lineTo(x, y) { addPt(x, y); },
      quadraticCurveTo(cx, cy, x, y) {
        const p0 = lastPt() || P(cx, cy);
        const tmp = [];
        sampleQuad(tmp, p0, P(cx, cy), P(x, y), 10);
        if (!cur) cur = {pts: [], closed: false}, path.push(cur);
        cur.pts.push(...tmp);
      },
      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        const p0 = lastPt() || P(c1x, c1y);
        const tmp = [];
        sampleCubic(tmp, p0, P(c1x, c1y), P(c2x, c2y), P(x, y), 14);
        if (!cur) cur = {pts: [], closed: false}, path.push(cur);
        cur.pts.push(...tmp);
      },
      arc(cx, cy, r, a0, a1, ccw) {
        const n = tessArc(r);
        if (!cur) { cur = {pts: [], closed: false}; path.push(cur); }
        let span = a1 - a0;
        if (!ccw && span < 0) span += Math.PI * 2;
        if (ccw && span > 0) span -= Math.PI * 2;
        for (let i = 0; i <= n; i++) {
          const a = a0 + span * i / n;
          cur.pts.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
        }
      },
      ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
        const n = tessArc(Math.max(rx, ry));
        if (!cur) { cur = {pts: [], closed: false}; path.push(cur); }
        let span = a1 - a0;
        if (!ccw && span < 0) span += Math.PI * 2;
        if (ccw && span > 0) span -= Math.PI * 2;
        const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
        for (let i = 0; i <= n; i++) {
          const a = a0 + span * i / n;
          const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
          cur.pts.push(P(cx + ex * cr - ey * sr, cy + ex * sr + ey * cr));
        }
      },
      /* arcTo：按标准做法求两切线点之间的圆弧 */
      arcTo(x1, y1, x2, y2, r) {
        const p0 = lastPt();
        const p1 = P(x1, y1), p2 = P(x2, y2);
        if (!p0) { addPt(x1, y1); return; }
        const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
        const l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
        const cosT = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
        const theta = Math.acos(cosT);
        if (theta < 1e-4 || Math.abs(Math.PI - theta) < 1e-4) { addPt(x1, y1); return; }
        const RR = r * matScale(m);
        const dist = RR / Math.tan(theta / 2);
        const t1 = [p1[0] + u1[0] * dist, p1[1] + u1[1] * dist];
        const t2 = [p1[0] + u2[0] * dist, p1[1] + u2[1] * dist];
        if (!cur) cur = {pts: [], closed: false}, path.push(cur);
        cur.pts.push(t1);
        // 用折线近似这段圆弧
        const bis = [(u1[0] + u2[0]) / 2, (u1[1] + u2[1]) / 2];
        const bl = Math.hypot(bis[0], bis[1]) || 1;
        const cdist = RR / Math.sin(theta / 2);
        const cc = [p1[0] + bis[0] / bl * cdist, p1[1] + bis[1] / bl * cdist];
        const a0 = Math.atan2(t1[1] - cc[1], t1[0] - cc[0]);
        const a1 = Math.atan2(t2[1] - cc[1], t2[0] - cc[0]);
        let span = a1 - a0;
        if (span > Math.PI) span -= Math.PI * 2;
        if (span < -Math.PI) span += Math.PI * 2;
        const n = Math.max(3, Math.ceil(Math.abs(span) * RR / 3));
        for (let i = 1; i <= n; i++) {
          const a = a0 + span * i / n;
          cur.pts.push([cc[0] + Math.cos(a) * RR, cc[1] + Math.sin(a) * RR]);
        }
      },
      rect(x, y, w, h) {
        const s = {pts: [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], closed: true};
        path.push(s); cur = s;
      },
      roundRect(x, y, w, h, r) {
        const p0 = P(x, y), p1 = P(x + w, y + h);
        const pts = roundRectPoly(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], (r || 0) * matScale(m));
        const s = {pts, closed: true};
        path.push(s); cur = s;
      },

      fill() { paintPath('fill'); },
      stroke() { paintPath('stroke'); },
      clip() { /* 不实现裁剪 */ },

      /* --- 直接矩形 --- */
      clearRect(x, y, w, h) {
        const a = P(x, y), b = P(x + w, y + h);
        const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]))), x1 = Math.min(DW, Math.ceil(Math.max(a[0], b[0])));
        const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]))), y1 = Math.min(DH, Math.ceil(Math.max(a[1], b[1])));
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
          const j = (yy * DW + xx) * 4;
          buf[j] = buf[j + 1] = buf[j + 2] = buf[j + 3] = 0;
        }
        cv._img = null;
      },
      fillRect(x, y, w, h) {
        const mask = new Float32Array(DW * DH);
        const a = P(x, y), b = P(x + w, y + h);
        fillPaths(mask, DW, DH, [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]]);
        const fs = st.fillStyle;
        if (fs instanceof Gradient) composite(buf, DW, DH, mask, fs.toRaster(), null, st.globalAlpha);
        else composite(buf, DW, DH, mask, null, fs, st.globalAlpha);
        cv._img = null;
      },
      strokeRect(x, y, w, h) {
        const a = P(x, y), b = P(x + w, y + h);
        const lw = Math.max(0.35, st.lineWidth * matScale(m));
        const mask = new Float32Array(DW * DH);
        const r = lw / 2;
        const rect = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
        for (let i = 0; i < 4; i++) {
          const p = rect[i], q = rect[(i + 1) % 4];
          const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L * r, ny = dx / L * r;
          fillPaths(mask, DW, DH, [[[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]]);
        }
        composite(buf, DW, DH, mask, null, st.strokeStyle, st.globalAlpha);
        cv._img = null;
      },

      /* --- 图像 --- */
      drawImage(img, ...a) {
        let dx, dy, dw, dh;
        if (a.length >= 8) { dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
        else if (a.length >= 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; }
        else { dx = a[0]; dy = a[1]; dw = img.width; dh = img.height; }
        const src = img && typeof img.toImage === 'function' ? img.toImage() : null;
        if (!src) return;
        const p = P(dx, dy), q = P(dx + dw, dy + dh);
        const dst = {w: W, h: H, px: resolve(buf, W, H, SS)};
        // 用最近邻 + 包围盒做缩放合成，再把解析结果写回浮点缓冲
        const x0 = Math.min(p[0], q[0]), x1 = Math.max(p[0], q[0]);
        const y0 = Math.min(p[1], q[1]), y1 = Math.max(p[1], q[1]);
        const sw = x1 - x0, sh = y1 - y0;
        for (let yy = Math.max(0, Math.floor(y0)); yy < Math.min(DH, Math.ceil(y1)); yy++) {
          for (let xx = Math.max(0, Math.floor(x0)); xx < Math.min(DW, Math.ceil(x1)); xx++) {
            const u = (xx + 0.5 - x0) / sw, v = (yy + 0.5 - y0) / sh;
            if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
            const sx = Math.min(src.w - 1, Math.floor(u * src.w));
            const sy = Math.min(src.h - 1, Math.floor(v * src.h));
            const si = (sy * src.w + sx) * 4;
            const a2 = (src.px[si + 3] / 255) * st.globalAlpha;
            if (a2 <= 0) continue;
            const j = (yy * DW + xx) * 4;
            const inv = 1 - a2;
            buf[j] = src.px[si] * a2 + buf[j] * inv;
            buf[j + 1] = src.px[si + 1] * a2 + buf[j + 1] * inv;
            buf[j + 2] = src.px[si + 2] * a2 + buf[j + 2] * inv;
            buf[j + 3] = a2 + buf[j + 3] * inv;
          }
        }
        cv._img = null;
      },
      getImageData(x, y, w, h) {
        const im = cv.toImage();
        const out = new Uint8ClampedArray(Math.max(1, w * h * 4));
        return {width: w, height: h, data: out};
      },
      putImageData() {},
      createImageData(w, h) { return {width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4))}; },

      /* --- 渐变 --- */
      createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1], m); },
      createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1], m); },
      createPattern() { return null; },

      /* --- 文字：只量不画 --- */
      measureText(t) {
        const size = parseFloat((/(\d+(?:\.\d+)?)px/.exec(st.font) || [0, 10])[1]) || 10;
        let w = 0;
        for (const ch of String(t)) w += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.55;
        return {width: w, actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2};
      },
      fillText() {}, strokeText() {},

      /* --- 虚线：忽略 --- */
      setLineDash() {}, getLineDash() { return []; },
    };
    return ctx;
  }

  return cv;
}
