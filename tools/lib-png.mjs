/* ============================================================================
 * 最小 PNG 编码器（无依赖，只用 node:zlib）。
 * ----------------------------------------------------------------------------
 * 为什么自己写：这台机器上 npm 缓存目录在工作区外，装不了 sharp/pngjs；
 * 而 Node 标准库自带 zlib，PNG 剩下的部分（CRC32 + 分块）不到 60 行。
 *
 * 用法：
 *   import { pngBuffer, writePNG } from './lib-png.mjs';
 *   writePNG('a.png', w, h, (x, y) => [r, g, b, a]);   // 每次调用返回一个像素
 * ========================================================================== */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/* CRC32 查表 */
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** 8 位 RGBA 真彩 PNG。get(x,y) 返回 [r,g,b,a]（0–255）。 */
export function pngBuffer(w, h, get) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;                                   // 每行滤波器 = None
    for (let x = 0; x < w; x++) {
      const c = get(x, y);
      raw[p++] = c[0] & 255; raw[p++] = c[1] & 255; raw[p++] = c[2] & 255; raw[p++] = c[3] & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;        // 位深
  ihdr[9] = 6;        // 颜色类型 6 = RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function writePNG(path, w, h, get) {
  writeFileSync(path, pngBuffer(w, h, get));
  return path;
}
