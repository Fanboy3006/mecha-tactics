/* ============================================================================
 * 最小 WAV 读写（无依赖）。
 * ----------------------------------------------------------------------------
 * 写这个的原因：Node 标准库没有任何音频能力，而我要能读你自己导出的 WAV
 * （参考素材）以及验证转码结果（MP3 → WAV 之后到底对不对）。
 *
 * 读：支持 RIFF/WAVE，PCM 8/16/24/32 位、IEEE float 32/64 位、WAVE_FORMAT_EXTENSIBLE。
 * 写：16 位 PCM。
 * ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';

/** 读取 WAV。返回 {sampleRate, channels, bits, format, frames, ch: Float32Array[]} */
export function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
    throw new Error('不是 RIFF/WAVE 文件：' + path);
  }
  let p = 12;
  let fmt = null, dataOff = -1, dataLen = 0;
  while (p + 8 <= buf.length) {
    const id = buf.toString('latin1', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === 'fmt ') {
      let tag = buf.readUInt16LE(body);
      const channels = buf.readUInt16LE(body + 2);
      const sampleRate = buf.readUInt32LE(body + 4);
      const bits = buf.readUInt16LE(body + 14);
      if (tag === 0xFFFE && size >= 40) {
        /* WAVE_FORMAT_EXTENSIBLE：真正的格式在 SubFormat 的前两字节 */
        tag = buf.readUInt16LE(body + 24);
      }
      fmt = { tag, channels, sampleRate, bits };
    } else if (id === 'data') {
      dataOff = body;
      dataLen = Math.min(size, buf.length - body);
    }
    p = body + size + (size & 1);      // 块按偶数对齐
  }
  if (!fmt) throw new Error('没有 fmt 块');
  if (dataOff < 0) throw new Error('没有 data 块');

  const { tag, channels, sampleRate, bits } = fmt;
  const bytesPer = bits / 8;
  const frames = Math.floor(dataLen / (bytesPer * channels));
  const ch = Array.from({ length: channels }, () => new Float32Array(frames));

  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      const o = dataOff + (f * channels + c) * bytesPer;
      let v;
      if (tag === 3) {
        v = bits === 64 ? buf.readDoubleLE(o) : buf.readFloatLE(o);
      } else if (bits === 8) {
        v = (buf[o] - 128) / 128;                     // 8 位是无符号
      } else if (bits === 16) {
        v = buf.readInt16LE(o) / 32768;
      } else if (bits === 24) {
        const b0 = buf[o], b1 = buf[o + 1], b2 = buf[o + 2];
        let x = (b2 << 16) | (b1 << 8) | b0;
        if (x & 0x800000) x -= 0x1000000;             // 符号扩展
        v = x / 8388608;
      } else if (bits === 32) {
        v = buf.readInt32LE(o) / 2147483648;
      } else {
        throw new Error('不支持的位深：' + bits);
      }
      ch[c][f] = v;
    }
  }
  return { sampleRate, channels, bits, format: tag === 3 ? 'float' : 'pcm', frames, ch, path };
}

/** 写 16 位 PCM WAV */
export function writeWav(path, ch, sampleRate) {
  const channels = ch.length;
  const frames = ch[0].length;
  const buf = Buffer.alloc(44 + frames * channels * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + frames * channels * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(frames * channels * 2, 40);
  let p = 44;
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][f]));
      buf.writeInt16LE(Math.round(v * 32767), p); p += 2;
    }
  }
  writeFileSync(path, buf);
  return path;
}

/** 基础统计 */
export function stats(w) {
  let peak = 0, sum = 0, dc = 0, n = 0, clips = 0;
  for (const c of w.ch) {
    for (let i = 0; i < c.length; i++) {
      const v = c[i];
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 0.999) clips++;
      sum += v * v; dc += v; n++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return {
    peak, rms, clips, dc: dc / Math.max(1, n),
    peakDb: 20 * Math.log10(Math.max(peak, 1e-9)),
    rmsDb: 20 * Math.log10(Math.max(rms, 1e-9)),
  };
}
