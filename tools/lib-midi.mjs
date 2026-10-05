/* ============================================================================
 * 最小标准 MIDI 文件（SMF）写入器 + 一个够用的读取器。
 * ----------------------------------------------------------------------------
 * 为什么要有它：**我听不见任何东西**。MIDI 是唯一能让「你」用现成音源
 * （任何 DAW / 播放器 / Windows 自带 GM 合成器）听到我写的**音符本身**的格式，
 * 从而把「作曲」和「我的合成器音色好不好」这两件事分开评价。
 *
 * 写出格式：SMF format 1（多轨同步），division = 每四分音符 tick 数。
 * 读取器只用来做往返自检，不追求兼容全部怪文件。
 * ========================================================================== */

function vlq(n) {
  const out = [n & 0x7f];
  n = Math.floor(n / 128);
  while (n > 0) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
  return Buffer.from(out.reverse());
}
const str = (s) => Buffer.from(s, 'latin1');
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b; }
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff, 0); return b; }
function chunk(type, data) { return Buffer.concat([str(type), u32(data.length), data]); }

/* GM 打击乐通道上的常见音高 */
export const GM_DRUM = { K: 36, S: 38, H: 42, OH: 46, C: 49, T: 45, R: 51 };

/**
 * @param {object} o
 * @param {number} o.division  每四分音符 tick 数
 * @param {number} o.bpm
 * @param {Array}  o.tracks    [{ name, channel, program, notes:[{tick, note, vel, durTicks}] }]
 * @returns {Buffer}
 */
export function buildMIDI({ division = 480, bpm = 120, tracks = [] }) {
  /* --- 轨 0：速度与拍号 --- */
  const usPerBeat = Math.round(60000000 / bpm);
  const t0 = Buffer.concat([
    vlq(0), str('\xFF\x03'), vlq(str('Tempo').length), str('Tempo'),
    vlq(0), str('\xFF\x51\x03'), Buffer.from([(usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255]),
    vlq(0), str('\xFF\x58\x04'), Buffer.from([4, 2, 24, 8]),   // 4/4
    vlq(0), str('\xFF\x2F\x00'),
  ]);
  const chunks = [chunk('MTrk', t0)];

  for (const tr of tracks) {
    /* 把所有事件摊平成 (tick, 字节串)，再排序、算增量 */
    const evs = [];
    for (const n of tr.notes) {
      const ch = tr.channel & 0x0f;
      evs.push({ tick: n.tick, b: Buffer.from([0x90 | ch, n.note & 0x7f, Math.max(1, Math.min(127, Math.round(n.vel * 127)))]) });
      evs.push({ tick: n.tick + Math.max(1, n.durTicks), b: Buffer.from([0x80 | ch, n.note & 0x7f, 0x40]) });
    }
    evs.sort((a, b) => a.tick - b.tick || (a.b[0] & 0xf0) - (b.b[0] & 0xf0)); // 同 tick 先 off 后 on

    const head = [];
    head.push(vlq(0), str('\xFF\x03'), vlq(Buffer.byteLength(tr.name, 'latin1')), str(tr.name));
    if (tr.program != null && (tr.channel & 0x0f) !== 9) {
      head.push(vlq(0), Buffer.from([0xC0 | (tr.channel & 0x0f), tr.program & 0x7f]));
    }
    const body = [];
    let last = 0;
    for (const e of evs) { body.push(vlq(e.tick - last), e.b); last = e.tick; }
    body.push(vlq(0), str('\xFF\x2F\x00'));
    chunks.push(chunk('MTrk', Buffer.concat([...head, ...body])));
  }

  const header = Buffer.concat([str('MThd'), u32(6), u16(1), u16(chunks.length), u16(division)]);
  return Buffer.concat([header, ...chunks]);
}

/** 极简 SMF 读取器：只取出每个 MTrk 里 note-on 的音高与 tick，用于往返自检。 */
export function readMIDI(buf) {
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('不是 MIDI 文件');
  const fmt = buf.readUInt16BE(8), ntrk = buf.readUInt16BE(10), division = buf.readUInt16BE(12);
  let p = 14;
  const tracks = [];
  while (p < buf.length && tracks.length < ntrk) {
    const type = buf.toString('latin1', p, p + 4);
    const len = buf.readUInt32BE(p + 4);
    const end = p + 8 + len;
    if (type !== 'MTrk') { p = end; continue; }
    let q = p + 8, tick = 0, running = 0;
    const notes = [];
    while (q < end) {
      /* 变长增量 */
      let d = 0, b;
      do { b = buf[q++]; d = (d << 7) | (b & 0x7f); } while (b & 0x80 && q < end);
      tick += d;
      let st = buf[q];
      if (st & 0x80) { q++; running = st; } else { st = running; }
      if (st === 0xFF) {
        const mt = buf[q++]; let l = 0, bb;
        do { bb = buf[q++]; l = (l << 7) | (bb & 0x7f); } while (bb & 0x80);
        q += l;
      } else if (st === 0xF0 || st === 0xF7) {
        let l = 0, bb;
        do { bb = buf[q++]; l = (l << 7) | (bb & 0x7f); } while (bb & 0x80);
        q += l;
      } else {
        const hi = st & 0xf0;
        if (hi === 0x90 || hi === 0x80) {
          const note = buf[q], vel = buf[q + 1]; q += 2;
          if (hi === 0x90 && vel > 0) notes.push({ tick, note, vel });
        } else if (hi === 0xC0 || hi === 0xD0) { q += 1; }
        else { q += 2; }
      }
    }
    tracks.push({ notes });
    p = end;
  }
  return { fmt, division, tracks };
}
