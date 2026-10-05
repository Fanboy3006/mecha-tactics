/* ============================================================================
 * 共用的离屏光栅化内核（无依赖，只用 Node 内置 zlib）
 * ----------------------------------------------------------------------------
 * 被两个工具共用：
 *   - tools/render-art.mjs    把美术模块的 4 种图元渲染成 PNG 对照表；
 *   - tools/lib/canvas2d.mjs  实现一个真的 Canvas 2D，用来把游戏自己的 draw()
 *                             跑出 PNG（因为本机沙箱起不了 headless 浏览器）。
 * 两者读同一套填充 / 合成 / PNG 编码代码，保证结果一致。
 * ========================================================================== */

/* ============================== 颜色 ============================== */
export function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 1];
  const h = s.trim();
  if (h.startsWith('rgba') || h.startsWith('rgb')) {
    const m = h.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 1];
    const p = m[1].split(',').map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  let d = h.replace('#', '');
  if (d.length === 3) d = d[0] + d[0] + d[1] + d[1] + d[2] + d[2];
  const n = parseInt(d, 16);
  if (!isFinite(n)) return [0, 0, 0, 1];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
}

/* ======================= 几何 → 多边形 ======================= */
export function ellipsePoly(cx, cy, rx, ry) {
  const n = Math.max(12, Math.min(96, Math.ceil(Math.max(Math.abs(rx), Math.abs(ry)) * 2.0)));
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return p;
}

export function roundRectPoly(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (r <= 0.02) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const seg = Math.max(3, Math.min(16, Math.ceil(r * 1.2)));
  const out = [];
  const corners = [
    [x + w - r, y + r, -Math.PI / 2, 0],
    [x + w - r, y + h - r, 0, Math.PI / 2],
    [x + r, y + h - r, Math.PI / 2, Math.PI],
    [x + r, y + r, Math.PI, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

/* ================= 扫描线非零环绕填充（支持多子路径） ================= */
/* paths: [[[x,y],...], ...]，多个子路径一起累计环绕数，所以能正确挖洞 */
export function fillPaths(mask, W, H, paths) {
  let minY = Infinity, maxY = -Infinity;
  for (const poly of paths) {
    for (const p of poly) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  }
  if (!isFinite(minY)) return;
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const poly of paths) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (a[1] === b[1]) continue;
        const ymin = Math.min(a[1], b[1]), ymax = Math.max(a[1], b[1]);
        if (sy < ymin || sy >= ymax) continue;
        const t = (sy - a[1]) / (b[1] - a[1]);
        xs.push([a[0] + (b[0] - a[0]) * t, a[1] < b[1] ? 1 : -1]);
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p[0] - q[0]);
    let w = 0;
    const row = y * W;
    for (let i = 0; i < xs.length - 1; i++) {
      w += xs[i][1];
      if (w === 0) continue;
      const xa = Math.max(0, Math.ceil(xs[i][0] - 0.5));
      const xb = Math.min(W - 1, Math.floor(xs[i + 1][0] - 0.5));
      for (let x = xa; x <= xb; x++) mask[row + x] = 1;
    }
  }
}

/* ============ 合成：预乘 alpha，painter's algorithm ============ */
/* grad = {g:[[x0,y0],[x1,y1]], st:[[t,color],...]}，坐标为**当前像素空间** */
export function composite(dst, W, H, mask, grad, flat, alphaScale) {
  const isGrad = !!grad;
  let fr = 0, fg = 0, fb = 0, fa = 1, gx = 0, gy = 0, glen2 = 1, stops = null;
  if (isGrad) {
    gx = grad.g[1][0] - grad.g[0][0];
    gy = grad.g[1][1] - grad.g[0][1];
    glen2 = gx * gx + gy * gy || 1e-9;
    stops = grad.st.map(([t, c]) => [t, parseColor(c)]);
  } else {
    const c = parseColor(flat || '#ffffff');
    fr = c[0]; fg = c[1]; fb = c[2]; fa = c[3];
  }
  const nStops = stops ? stops.length : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const m = mask[i] * alphaScale;
      if (m <= 0) continue;
      let r, g, b, ca;
      if (isGrad) {
        const px = (x + 0.5) - grad.g[0][0];
        const py = (y + 0.5) - grad.g[0][1];
        let t = (px * gx + py * gy) / glen2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        let k = nStops - 2;
        for (let s = 0; s < nStops - 1; s++) {
          if (t >= stops[s][0] && t <= stops[s + 1][0]) { k = s; break; }
        }
        const t0 = stops[k][0], c0 = stops[k][1];
        const t1 = stops[k + 1][0], c1 = stops[k + 1][1];
        const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        r = c0[0] + (c1[0] - c0[0]) * u;
        g = c0[1] + (c1[1] - c0[1]) * u;
        b = c0[2] + (c1[2] - c0[2]) * u;
        ca = c0[3] + (c1[3] - c0[3]) * u;
      } else {
        r = fr; g = fg; b = fb; ca = fa;
      }
      const sa = m * ca;
      if (sa <= 0) continue;
      const inv = 1 - sa, j = i * 4;
      dst[j] = r * sa + dst[j] * inv;
      dst[j + 1] = g * sa + dst[j + 1] * inv;
      dst[j + 2] = b * sa + dst[j + 2] * inv;
      dst[j + 3] = sa + dst[j + 3] * inv;
    }
  }
}

/* ==================== PNG 编码 ==================== */
const CRC_TBL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TBL[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
import { deflateSync } from 'zlib';
function deflate(buf) { return deflateSync(buf, {level: 9}); }

/* ==================== 位图小工具 ==================== */
export function makeImage(w, h, bg) {
  const px = new Uint8Array(w * h * 4);
  if (bg) {
    const c = parseColor(bg);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
    }
  }
  return {w, h, px};
}

export function blit(dst, src, dx, dy, dw, dh) {
  dw = dw == null ? src.w : Math.round(dw);
  dh = dh == null ? src.h : Math.round(dh);
  const sx = src.w / dw, sy = src.h / dh;
  for (let y = 0; y < dh; y++) {
    const ty = dy + y; if (ty < 0 || ty >= dst.h) continue;
    const syy = Math.min(src.h - 1, Math.max(0, Math.floor((y + 0.5) * sy)));
    for (let x = 0; x < dw; x++) {
      const tx = dx + x; if (tx < 0 || tx >= dst.w) continue;
      const sxx = Math.min(src.w - 1, Math.max(0, Math.floor((x + 0.5) * sx)));
      const i = (syy * src.w + sxx) * 4, j = (ty * dst.w + tx) * 4;
      const a = src.px[i + 3] / 255;
      if (a <= 0) continue;
      const inv = 1 - a;
      dst.px[j] = Math.round(src.px[i] * a + dst.px[j] * inv);
      dst.px[j + 1] = Math.round(src.px[i + 1] * a + dst.px[j + 1] * inv);
      dst.px[j + 2] = Math.round(src.px[i + 2] * a + dst.px[j + 2] * inv);
      dst.px[j + 3] = 255;
    }
  }
}

export function upscale(img, f) {
  const out = {w: img.w * f, h: img.h * f, px: new Uint8Array(img.w * f * img.h * f * 4)};
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const si = (Math.floor(y / f) * img.w + Math.floor(x / f)) * 4;
      const di = (y * out.w + x) * 4;
      out.px[di] = img.px[si]; out.px[di + 1] = img.px[si + 1];
      out.px[di + 2] = img.px[si + 2]; out.px[di + 3] = img.px[si + 3];
    }
  }
  return out;
}

/* 预乘浮点缓冲 → 反预乘的 RGBA8（并做 SS×SS 盒式降采样） */
export function resolve(buf, W, H, SS) {
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const j = ((y * SS + sy) * (W * SS) + (x * SS + sx)) * 4;
          r += buf[j]; g += buf[j + 1]; b += buf[j + 2]; a += buf[j + 3];
        }
      }
      const n = SS * SS;
      r /= n; g /= n; b /= n; a /= n;
      const i = (y * W + x) * 4;
      if (a <= 0.0001) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
      out[i] = Math.min(255, Math.round(r / a));
      out[i + 1] = Math.min(255, Math.round(g / a));
      out[i + 2] = Math.min(255, Math.round(b / a));
      out[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  return out;
}
