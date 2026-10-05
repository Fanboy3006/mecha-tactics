/* ============================================================================
 * 裁剪 + 最近邻放大 PNG：用来把渲染出来的游戏画面局部放大看细节。
 *
 * 用法：node tools/zoom-png.mjs <输入.png> <x> <y> <宽> <高> <倍数> [输出.png]
 * 省略输出路径就输出到 art/out/_zoom.png
 * ========================================================================== */
import { readFileSync, writeFileSync } from 'fs';
import { inflateSync } from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { encodePNG } from './lib/raster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* 极简 PNG 解码：只处理本工具链自己写出的 8bit RGBA、所有 filter 类型 */
export function decodePNG(buf) {
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return {w, h, px: new Uint8Array(out)};
}

export function cropZoom(img, x, y, w, h, f) {
  const o = {w: w * f, h: h * f, px: new Uint8Array(w * f * h * f * 4)};
  for (let yy = 0; yy < o.h; yy++) {
    for (let xx = 0; xx < o.w; xx++) {
      const sx = Math.min(img.w - 1, Math.max(0, x + Math.floor(xx / f)));
      const sy = Math.min(img.h - 1, Math.max(0, y + Math.floor(yy / f)));
      const si = (sy * img.w + sx) * 4, di = (yy * o.w + xx) * 4;
      o.px[di] = img.px[si]; o.px[di + 1] = img.px[si + 1];
      o.px[di + 2] = img.px[si + 2]; o.px[di + 3] = 255;
    }
  }
  return o;
}

/* 只有被直接运行时才做命令行处理（被 import 时不做） */
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/zoom-png.mjs')) {
  const [, , inp, xs, ys, ws, hs, fs, outs] = process.argv;
  if (!inp) {
    console.log('用法：node tools/zoom-png.mjs <输入.png> <x> <y> <宽> <高> <倍数> [输出.png]');
    process.exit(1);
  }
  const img = decodePNG(readFileSync(inp));
  const x = +xs || 0, y = +ys || 0, w = +ws || img.w, h = +hs || img.h, f = +fs || 3;
  const c = cropZoom(img, x, y, w, h, f);
  const out = outs || join(ROOT, 'art', 'out', '_zoom.png');
  writeFileSync(out, encodePNG(c.w, c.h, c.px));
  console.log(`${inp} 裁 (${x},${y},${w}×${h}) 放大 ${f}× → ${out}  (${c.w}×${c.h})`);
}
