/* ============================================================================
 * 美术自检工具：把 art/mech-icons.js 的矢量指令离线光栅化成 PNG。
 * ----------------------------------------------------------------------------
 * 为什么需要它：headless 浏览器在本机沙箱里跑不起来，所以美术没法用截图检查。
 * 这个脚本自己实现了一个超采样光栅化器 + PNG 编码器（只用 Node 内置 zlib），
 * 和游戏里的 Canvas 后端读的是**同一份几何数据**，所以看到的就是游戏里的样子。
 *
 * 用法：node tools/render-art.mjs
 * 输出：art/out/*.png（只供检查，不参与游戏运行）
 * ========================================================================== */
import { createRequire } from 'module';
import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const Icons = require(join(ROOT, 'art', 'mech-icons.js'));

const SS = 4;   // 超采样倍数

/* ========================== 颜色 ========================== */
function parseColor(s) {
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
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
}

/* ====================== 几何 → 多边形 ====================== */
function ellipsePoly(cx, cy, rx, ry) {
  const n = Math.max(12, Math.min(96, Math.ceil(Math.max(Math.abs(rx), Math.abs(ry)) * 2.0)));
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return p;
}

function roundRectPoly(x, y, w, h, r) {
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

/* ================= 扫描线非零环绕填充 ================= */
function fillPolygon(mask, W, H, poly) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of poly) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  if (!isFinite(minY)) return;
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a[1] === b[1]) continue;
      const ymin = Math.min(a[1], b[1]), ymax = Math.max(a[1], b[1]);
      if (sy < ymin || sy >= ymax) continue;
      const t = (sy - a[1]) / (b[1] - a[1]);
      xs.push([a[0] + (b[0] - a[0]) * t, a[1] < b[1] ? 1 : -1]);
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
function composite(dst, W, H, mask, grad, flat, alphaScale) {
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
        let k = stops.length - 2;
        for (let s = 0; s < stops.length - 1; s++) {
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

/* ==================== 画一条图元 ==================== */
/* k  = 单位空间 → 子像素的缩放
 * ox = 单位空间原点的子像素偏移 */
function drawPrim(dst, W, H, prim, k, ox) {
  const T = p => [ox + p[0] * k, ox + p[1] * k];
  const lw = (prim.lw || 0) * k;
  const alpha = prim.alpha == null ? 1 : prim.alpha;

  if (prim.t === 's') {
    const a = T(prim.a), b = T(prim.b);
    const mask = new Float32Array(W * H);
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * lw / 2, ny = dx / L * lw / 2;
    fillPolygon(mask, W, H, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    const r = lw / 2;
    fillPolygon(mask, W, H, ellipsePoly(a[0], a[1], r, r));
    fillPolygon(mask, W, H, ellipsePoly(b[0], b[1], r, r));
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
  fillPolygon(mask, W, H, poly);
  if (prim.fill || gradT) composite(dst, W, H, mask, gradT, prim.fill, alpha);

  if (prim.stroke && lw > 0) {
    const sm = new Float32Array(W * H);
    const r = lw / 2;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L * r, ny = dx / L * r;
      fillPolygon(sm, W, H, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    }
    for (const p of poly) fillPolygon(sm, W, H, ellipsePoly(p[0], p[1], r, r));
    composite(dst, W, H, sm, null, prim.stroke, alpha);
  }
}

/* ================= 渲染图标到 RGBA 位图 ================= */
/* 返回 {w, h, px:Uint8Array(RGBA，非预乘)} */
function renderIcon(id, opts) {
  const S = opts.size;
  const pad = opts.pad || 0;
  const W = Math.round(S * (1 + 2 * pad));
  const Ws = W * SS;
  const dst = new Float32Array(Ws * Ws * 4);
  const prims = Icons.build(id, opts);
  const k = Ws, ox = pad * Ws;
  for (const p of prims) drawPrim(dst, Ws, Ws, p, k, ox);

  // 降采样 + 反预乘
  const out = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const j = ((y * SS + sy) * Ws + (x * SS + sx)) * 4;
          r += dst[j]; g += dst[j + 1]; b += dst[j + 2]; a += dst[j + 3];
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
  return { w: W, h: W, px: out };
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
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;                                            // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ==================== 拼图（画布） ==================== */
function makeCanvas(w, h, bg) {
  const px = new Uint8Array(w * h * 4);
  if (bg) {
    const c = parseColor(bg);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
    }
  }
  return { w, h, px };
}
function blit(cv, img, dx, dy) {
  for (let y = 0; y < img.h; y++) {
    const ty = dy + y; if (ty < 0 || ty >= cv.h) continue;
    for (let x = 0; x < img.w; x++) {
      const tx = dx + x; if (tx < 0 || tx >= cv.w) continue;
      const i = (y * img.w + x) * 4, j = (ty * cv.w + tx) * 4;
      const a = img.px[i + 3] / 255;
      if (a <= 0) continue;
      const inv = 1 - a;
      cv.px[j] = Math.round(img.px[i] * a + cv.px[j] * inv);
      cv.px[j + 1] = Math.round(img.px[i + 1] * a + cv.px[j + 1] * inv);
      cv.px[j + 2] = Math.round(img.px[i + 2] * a + cv.px[j + 2] * inv);
      cv.px[j + 3] = 255;
    }
  }
}

/* 最近邻放大：把 22px 的真实结果放大，用来检查「玩家实际看到的像素」 */
function upscale(img, f) {
  const out = { w: img.w * f, h: img.h * f, px: new Uint8Array(img.w * f * img.h * f * 4) };
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

/* 放大对照表：真机尺寸渲染 → 最近邻放大，横向排开 */
function sheetZoom(ids, name, size, f) {
  const cell = size * f + 6;
  const COLS = Math.min(ids.length, 6);
  const rows = Math.ceil(ids.length / COLS);
  const cv = makeCanvas(cell * COLS + 6, cell * rows + 6, TERRAIN.plain);
  ids.forEach((id, i) => {
    const gx = (i % COLS) * cell + 6, gy = Math.floor(i / COLS) * cell + 6;
    blit(cv, upscale(iconImg(id, size), f), gx, gy);
  });
  writeFileSync(join(OUT, `sheet-${name}.png`), encodePNG(cv.w, cv.h, cv.px));
}

/* ==================== 主流程 ==================== */
const OUT = join(ROOT, 'art', 'out');
mkdirSync(OUT, { recursive: true });

const PAL_KEY = {
  B1:'ying', B2:'ying', M1:'moon', M2:'moon', M3:'moon',
  CB1:'cb', CB2:'cb', CB3:'cb', CB4:'cb', CB4N:'cb',
};
const TERRAIN = { plain:'#3b4a37', forest:'#264530', mountain:'#5b4e40', water:'#1f3d5c', chasm:'#07090c' };
const BG_TERRAIN = ['plain', 'forest', 'mountain', 'water', 'chasm'];

const GS = 96;                 // 大图标尺寸

const plateFor = id => (PAL_KEY[id] ? 'square' : id === 'debris' ? 'none' : 'circle');
function palFor(id) { return Icons.PAL[PAL_KEY[id] || 'enemy']; }
const iconImg = (id, size, extra) =>
  renderIcon(id, Object.assign({
    size, pad: 0.10, pal: palFor(id), plate: plateFor(id), role: Icons.ROLE_OF[id],
    headroom: 0.08, outline: '#05070d',
  }, extra || {}));

/* 单个图标：大图 + 真机 22px */
function sheetSingle(id) {
  const big = iconImg(id, GS);
  const small = iconImg(id, 22);
  const cv = makeCanvas(GS + 48, GS + 20, '#12151a');
  blit(cv, big, 10, 10);
  blit(cv, small, GS + 26, 10);
  writeFileSync(join(OUT, `icon-${id}.png`), encodePNG(cv.w, cv.h, cv.px));
}

/* 对照表：4 列格子，每格上面是 96px 大图，下面是 22 / 33 / 44 的真机尺寸 */
function sheetGrid(ids, name) {
  const CW = 112, CH = 156, COLS = 4;
  const rows = Math.ceil(ids.length / COLS);
  const cv = makeCanvas(CW * COLS + 8, CH * rows + 8, '#0b0e12');
  ids.forEach((id, i) => {
    const gx = (i % COLS) * CW + 8, gy = Math.floor(i / COLS) * CH + 8;
    // 格子底色（上半平原、下半森林，模拟真实地形底）
    for (let y = gy; y < Math.min(gy + CH - 8, cv.h); y++) {
      for (let x = gx; x < Math.min(gx + CW - 8, cv.w); x++) {
        const j = (y * cv.w + x) * 4;
        const c = parseColor(y < gy + 100 ? TERRAIN.plain : TERRAIN.forest);
        cv.px[j] = c[0]; cv.px[j + 1] = c[1]; cv.px[j + 2] = c[2]; cv.px[j + 3] = 255;
      }
    }
    blit(cv, iconImg(id, 96), gx + 4, gy + 2);
    let x = gx + 6;
    for (const s of [22, 33, 44]) { blit(cv, iconImg(id, s), x, gy + 102); x += s + 8; }
  });
  writeFileSync(join(OUT, `sheet-${name}.png`), encodePNG(cv.w, cv.h, cv.px));
}

/* 地图模拟：真实格子尺寸 + 地形底 + 朝向标记，检验可辨识度 */
function sheetMapMock() {
  const TS = 22, SC = 1.7;
  const tile = Math.round(TS * SC);              // ≈37px，游戏里最大显示尺寸
  const allies = ['B1', 'B2', 'M1', 'M2', 'M3', 'CB1', 'CB2', 'CB3', 'CB4', 'CB4N'];
  const enemies = ['grunt', 'hound', 'drone', 'ironwall', 'raider', 'turret', 'shield', 'pursuer', 'fighter', 'artillery'];
  const rows = [allies, enemies];
  const cols = 6;
  const cv = makeCanvas(tile * cols, tile * 2 * Math.ceil(allies.length / cols) + 8, TERRAIN.plain);
  // 铺地形
  const terSeq = ['plain', 'forest', 'plain', 'mountain', 'water', 'plain', 'forest', 'plain'];
  for (let y = 0; y < cv.h; y += tile) for (let x = 0; x < cv.w; x += tile) {
    const c = parseColor(TERRAIN[terSeq[(x / tile + y / tile) % terSeq.length]]);
    for (let yy = y; yy < Math.min(y + tile, cv.h); yy++) for (let xx = x; xx < Math.min(x + tile, cv.w); xx++) {
      const j = (yy * cv.w + xx) * 4;
      cv.px[j] = c[0]; cv.px[j + 1] = c[1]; cv.px[j + 2] = c[2]; cv.px[j + 3] = 255;
    }
  }
  const draw = (id, gx, gy, sizeTiles) => {
    const px = Math.round(tile * sizeTiles);
    const img = renderIcon(id, { size: px, pad: 0.02, pal: palFor(id), plate: id === 'debris' ? 'square' : (PAL_KEY[id] ? 'square' : 'circle') });
    blit(cv, img, gx * tile, gy * tile);
    // 朝向标记（和游戏一致：上边缘的三角）
    const cx = gx * tile + px / 2, cy0 = gy * tile + 2;
    for (let i = 0; i < 5; i++) {
      const w = 5 - i;
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
        const y = cy0 + i; if (x < 0 || x >= cv.w || y < 0 || y >= cv.h) continue;
        const j = (y * cv.w + x) * 4;
        cv.px[j] = 255; cv.px[j + 1] = 233; cv.px[j + 2] = 184; cv.px[j + 3] = 255;
      }
    }
  };
  const SIZES = { M2: 2, fortress: 2, flagship: 3 };
  let i = 0;
  for (const list of rows) for (const id of list) {
    const gy = Math.floor(i / cols), gx = i % cols;
    draw(id, gx, gy, SIZES[id] || 1);
    i++;
  }
  writeFileSync(join(OUT, 'sheet-mock.png'), encodePNG(cv.w, cv.h, cv.px));
}

/* 执行 */
const ALLY_IDS = ['B1', 'B2', 'M1', 'M2', 'M3', 'CB1', 'CB2', 'CB3', 'CB4', 'CB4N'];
const ENEMY_IDS = ['grunt', 'hound', 'drone', 'ironwall', 'raider', 'turret', 'shield', 'pursuer', 'fighter', 'artillery', 'fortress', 'flagship'];

for (const id of [...ALLY_IDS, ...ENEMY_IDS, 'debris']) sheetSingle(id);
sheetGrid(ALLY_IDS, 'ally');
sheetGrid(ENEMY_IDS, 'enemy');
sheetZoom(ALLY_IDS, 'zoom22-ally', 22, 6);
sheetZoom(ALLY_IDS, 'zoom37-ally', 37, 4);
sheetZoom(ENEMY_IDS, 'zoom22-enemy', 22, 6);
sheetZoom(ENEMY_IDS, 'zoom37-enemy', 37, 4);
sheetMapMock();

console.log('已输出到 art/out/ ：');
console.log('  sheet-ally.png / sheet-enemy.png    对照表（96px 大图 + 22/33/44 真机尺寸）');
console.log('  sheet-zoom22-*.png                  真机 22px，最近邻放大 6 倍（看实际像素）');
console.log('  sheet-zoom37-*.png                  真机 37px（SC1.7），放大 4 倍');
console.log('  sheet-mock.png                      地图模拟（37px 格 + 朝向标记）');
console.log('  icon-<id>.png                       单图标大图 + 真机 22px');
