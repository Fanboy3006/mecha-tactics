/* ============================================================================
 * 把「绘制指令」光栅化成位图（共用）
 * ----------------------------------------------------------------------------
 * 从 tools/render-art.mjs 抽出来，现在两处共用：
 *   - tools/render-art.mjs  图标对照表
 *   - tools/style-lab.mjs   美术风格试验（同一套几何、换风格渲染）
 * 这样风格试验和正式素材走的是同一条光栅化路径，看到的东西可比。
 * ========================================================================== */
import { fillPaths, composite, ellipsePoly, roundRectPoly } from './raster.mjs';

/* 画一条图元。k = 单位空间→子像素的缩放；ox/oy = 单位空间原点在画布上的子像素位置。
   W/H 可以不等（支持「精灵比格子高」那种非正方画布）。 */
export function drawPrim(dst, W, H, prim, k, ox, oy) {
  oy = oy || 0;
  const T = p => [ox + p[0] * k, oy + p[1] * k];
  const lw = (prim.lw || 0) * k;
  const alpha = prim.alpha == null ? 1 : prim.alpha;

  if (prim.t === 's') {
    const a = T(prim.a), b = T(prim.b);
    const mask = new Float32Array(W * H);
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * lw / 2, ny = dx / L * lw / 2;
    fillPaths(mask, W, H, [[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]]);
    const r = lw / 2;
    fillPaths(mask, W, H, [ellipsePoly(a[0], a[1], r, r)]);
    fillPaths(mask, W, H, [ellipsePoly(b[0], b[1], r, r)]);
    composite(dst, W, H, mask, null, prim.fill, alpha);
    return;
  }

  let poly = null;
  if (prim.t === 'p') poly = prim.pts.map(T);
  else if (prim.t === 'e') poly = ellipsePoly(ox + prim.cx * k, ox + prim.cy * k, prim.rx * k, prim.ry * k);
  else if (prim.t === 'r') { const P = T([prim.x, prim.y]); poly = roundRectPoly(P[0], P[1], prim.w * k, prim.h * k, (prim.r || 0) * k); }
  if (!poly) return;

  // 渐变的控制点也在单位空间，同样要换算到子像素空间
  const gradT = prim.grad ? { g: prim.grad.g.map(T), st: prim.grad.st } : null;

  const mask = new Float32Array(W * H);
  fillPaths(mask, W, H, [poly]);
  if (prim.fill || gradT) composite(dst, W, H, mask, gradT, prim.fill, alpha);

  if (prim.stroke && lw > 0) {
    const sm = new Float32Array(W * H);
    const r = lw / 2;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L * r, ny = dx / L * r;
      fillPaths(sm, W, H, [[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]]);
    }
    for (const p of poly) fillPaths(sm, W, H, [ellipsePoly(p[0], p[1], r, r)]);
    composite(dst, W, H, sm, null, prim.stroke, alpha);
  }
}

/* 一组图元 → RGBA 位图（非预乘）。size 是边长，pad 是四周留白比例 */
export function renderPrims(prims, size, opts = {}) {
  const pad = opts.pad || 0;
  const ss = opts.ss || 4;
  const W = Math.round(size * (1 + 2 * pad));
  const Ws = Math.max(1, W * ss);
  const dst = new Float32Array(Ws * Ws * 4);
  const k = Ws, ox = pad * Ws;
  for (const p of prims) drawPrim(dst, Ws, Ws, p, k, ox);

  // 降采样 + 反预乘
  const out = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const j = ((y * ss + sy) * Ws + (x * ss + sx)) * 4;
          r += dst[j]; g += dst[j + 1]; b += dst[j + 2]; a += dst[j + 3];
        }
      }
      const n = ss * ss;
      r /= n; g /= n; b /= n; a /= n;
      const i = (y * W + x) * 4;
      if (a <= 0.0001) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
      out[i] = Math.min(255, Math.round(r / a));
      out[i + 1] = Math.min(255, Math.round(g / a));
      out[i + 2] = Math.min(255, Math.round(b / a));
      out[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  return { w: W, h: W, px: out };
}

/* 非方形画布：单位空间的 1×1 方框贴在画布**底部**，上方留 headroom（见 art/README 第 3.1 节） */
export function renderPrimsBox(prims, box, headroom, opts = {}) {
  const ss = opts.ss || 4;
  const W = Math.max(1, Math.round(box));
  const H = Math.max(1, Math.round(box * (1 + (headroom || 0))));
  const Ws = W * ss, Hs = H * ss;
  const dst = new Float32Array(Ws * Hs * 4);
  const oy = Hs - Ws;                       // 单位空间原点下移到画布底部
  for (const p of prims) drawPrim(dst, Ws, Hs, p, Ws, 0, oy);
  return downsample(dst, Ws, Hs, W, H, ss);
}

/* 预乘浮点缓冲 → 反预乘 RGBA8（带 ss×ss 盒式降采样） */
function downsample(dst, Ws, Hs, W, H, ss) {
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const j = ((y * ss + sy) * Ws + (x * ss + sx)) * 4;
          r += dst[j]; g += dst[j + 1]; b += dst[j + 2]; a += dst[j + 3];
        }
      }
      const n = ss * ss;
      r /= n; g /= n; b /= n; a /= n;
      const i = (y * W + x) * 4;
      if (a <= 0.0001) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
      out[i] = Math.min(255, Math.round(r / a));
      out[i + 1] = Math.min(255, Math.round(g / a));
      out[i + 2] = Math.min(255, Math.round(b / a));
      out[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  return { w: W, h: H, px: out };
}
