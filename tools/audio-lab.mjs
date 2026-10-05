/* ============================================================================
 * 音乐素材离线工作台（无依赖，纯 Node）。
 * ----------------------------------------------------------------------------
 * 为什么需要它 —— 因为**我听不见任何声音**。
 *
 * 做美术素材的时候我能自己迭代，靠的是 read_image：我画出 PNG，然后真的"看见"它，
 * 于是能发现"这个图标在 22px 下糊成一团"并去改。音频没有 read_audio 这种能力，
 * 我没有任何听觉反馈。
 *
 * 这个工具就是那个缺失感官的替代品。它做三件事：
 *
 *   1. 合成：把 audio/score.js 里的乐谱渲染成 WAV。自己写的合成器
 *      （polyBLEP 抗混叠锯齿/方波、状态变量滤波器、tanh 失真、Schroeder 混响、
 *       附点八分延迟、软限幅），不依赖任何外部音源。
 *
 *   2. 导出 MIDI：让你能用现成的音源（任何 DAW / Windows 自带 GM 合成器）听到
 *      **音符本身**。这一步很重要 —— 它把"曲子写得怎么样"和"我的合成器音色怎么样"
 *      分开，否则我音色差会让你误判成曲子差。
 *
 *   3. 画图：把混音和每个分轨画成「波形 + 对数频谱图」PNG。这样我至少能用眼睛
 *      检查：音高对不对、节奏对不对、有没有削顶、低频有没有糊、主旋律有没有被盖住。
 *
 *      能用眼睛看出来的：音符的音高与时值、起音是否整齐、有没有静音缺口、
 *      频段拥挤、削顶失真、各分轨是否真的在发声。
 *      看不出来的：好不好听、够不够"燃"、有没有记忆点。**这仍然只能靠你的耳朵。**
 *
 * 用法：
 *   node tools/audio-lab.mjs              渲染全部曲目
 *   node tools/audio-lab.mjs demoBattle   只渲染某一首
 * ========================================================================== */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { pngBuffer } from './lib-png.mjs';
import { buildMIDI, GM_DRUM } from './lib-midi.mjs';
import { readMIDI } from './lib-midi.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'audio', 'out');

/* score.js 是 UMD，用 require 加载最省事 */
const require = createRequire(import.meta.url);
const MS = require(join(ROOT, 'audio', 'score.js'));

const SR = 44100;

/* ============================================================ 基础工具 */

/** 可复现的伪随机（mulberry32）——渲染必须是确定性的，否则没法对比两次改动 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(20240611);

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** polyBLEP 修正项：消除锯齿/方波在跳变处的混叠 */
function polyBlep(t, dt) {
  if (dt <= 0) return 0;
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
function saw(ph, dt) { return 2 * ph - 1 - polyBlep(ph, dt); }
function sqr(ph, dt) {
  const v = ph < 0.5 ? 1 : -1;
  return v + polyBlep(ph, dt) - polyBlep((ph + 0.5) % 1, dt);
}

/** 状态变量滤波器系数：g = 2·sin(π·fc/SR)，fc 夹到 SR/6 以内保证稳定 */
function svfG(fc) {
  const f = Math.max(20, Math.min(SR / 6, fc));
  return 2 * Math.sin(Math.PI * f / SR);
}

/** 指数型衰减包络 */
const decay = (t, tau) => Math.exp(-t / tau);

/**
 * 一阶高通（去直流 + 去掉低频堆积）。
 * ----------------------------------------------------------------------------
 * 中频和声垫（pad / choir）必须高通：它们的根音在 130–390Hz，正好和贝斯、
 * 节奏吉他完全重叠。频谱图上这一点非常直观 —— Boss 曲的 100–600Hz 整段被推到
 * 饱和发白，就是四个音色全挤在那一段的结果。高通之后各音色在频段上分开，
 * 低频留给贝斯和底鼓。这是标准做法，不改音乐本身。
 */
function makeHP(fc) {
  const a = Math.exp(-2 * Math.PI * fc / SR);
  return { a, x: 0, y: 0 };
}
function hp1(s, x) {
  s.y = s.a * (s.y + x - s.x);
  s.x = x;
  return s.y;
}

/* ============================================================ 乐器 */

/* 每个乐器函数签名：(bus, ev, C) => void，直接叠加进 bus.L / bus.R。
   C 提供 C.spb（每拍秒数）。 */

/** 底鼓：正弦扫频 130→45Hz + 点击噪声 */
function instKick(bus, ev, C) {
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round(0.42 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 45 + 85 * decay(t, 0.035);
    ph = (ph + f / SR) % 1;
    let x = Math.sin(2 * Math.PI * ph);
    if (t < 0.006) x += (rnd() * 2 - 1) * 0.5 * (1 - t / 0.006);   // 敲击 click
    x *= decay(t, 0.115) * ev.v;
    x = Math.tanh(x * 1.6) * 0.75;
    if (n0 + i < bus.L.length) { bus.L[n0 + i] += x; bus.R[n0 + i] += x; }
  }
}

/** 军鼓：噪声（带通感）+ 200Hz 鼓皮音 */
function instSnare(bus, ev, C) {
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round(0.33 * SR);
  let ph = 0, lp = 0, bp = 0, lp2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph = (ph + 190 / SR) % 1;
    let x = (rnd() * 2 - 1) * 0.85 + Math.sin(2 * Math.PI * ph) * 0.45;
    /* 一带高通、一带低通，做出 1.5k–6k 的"沙"声 */
    const g1 = svfG(1700), q1 = 1 / 0.8;
    const high = x - lp - q1 * bp; bp += g1 * high; lp += g1 * bp;
    x = high * 0.9 + lp * 0.25;
    /* 再补一层单极低通，让军鼓有"肉"而不是纯沙沙声 */
    lp2 += (x - lp2) * 0.25;
    x = x * 0.75 + lp2 * 0.5;
    x *= decay(t, 0.075) * ev.v;
    if (n0 + i < bus.L.length) { bus.L[n0 + i] += x * 0.9; bus.R[n0 + i] += x * 0.9; }
  }
}

/** 踩镲 / 开镲：高通噪声，衰减长短区分 */
function instHat(bus, ev, C) {
  const open = ev.n === 'OH';
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((open ? 0.34 : 0.075) * SR);
  let lp = 0, bp = 0;
  /* 开镲稍微偏右，闭镲稍微偏左，让镲有宽度 */
  const pan = open ? 0.18 : -0.12;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let x = rnd() * 2 - 1;
    const g = svfG(7200), q = 1 / 0.7;
    const high = x - lp - q * bp; bp += g * high; lp += g * bp;
    x = high;
    x *= decay(t, open ? 0.11 : 0.018) * ev.v;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * (1 - pan) * 0.5;
      bus.R[n0 + i] += x * (1 + pan) * 0.5;
    }
  }
}

/** 强音镲：长衰减高通噪声 */
function instCrash(bus, ev, C) {
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round(1.6 * SR);
  let lp = 0, bp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let x = rnd() * 2 - 1;
    const g = svfG(5200), q = 1 / 0.6;
    const high = x - lp - q * bp; bp += g * high; lp += g * bp;
    x = high * decay(t, 0.42) * ev.v;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * 0.35; bus.R[n0 + i] += x * 0.4;
    }
  }
}

/** 定音鼓：正弦 + 轻微下滑音 + 噪声敲击 + 长衰减 */
function instTimp(bus, ev, C) {
  const n0 = Math.round(ev.t * C.spb * SR);
  const f0 = mtof(ev.n);
  const len = Math.round(1.5 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = f0 * (1 + 0.012 * decay(t, 0.09));
    ph = (ph + f / SR) % 1;
    let x = Math.sin(2 * Math.PI * ph) * 0.9 + Math.sin(4 * Math.PI * ph) * 0.16;
    if (t < 0.008) x += (rnd() * 2 - 1) * 0.35 * (1 - t / 0.008);
    x *= decay(t, 0.5) * ev.v;
    if (n0 + i < bus.L.length) { bus.L[n0 + i] += x * 0.8; bus.R[n0 + i] += x * 0.8; }
  }
}

/** 电贝斯：两个失谐锯齿 + 次八度正弦，低通截止随拨弦先开后收（"咬劲"的关键） */
function instBass(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((durS + 0.07) * SR);
  const f = mtof(ev.n);
  /* 这里的次振荡器放在 f（而不是 f/2）。
     以前放在 f/2，等于把每个音都往下多叠一个八度 —— 写 A1(55Hz) 实际发出 27.5Hz，
     低于大多数扬声器能重放的范围，纯粹在糊低频。音高验证把它当成八度误判报了出来，
     查下去才发现是合成器的设计问题。放在 f 是"加厚基频"的标准做法。 */
  const dt1 = f * 1.004 / SR, dt2 = f * 0.996 / SR, dts = f / SR;
  let ph1 = 0, ph2 = 0, phs = 0, lp = 0, bp = 0;
  const rel = 0.06;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    /* 注意：绝对不能用「amp<=0 就 break」来结束循环 —— 起音包络在 t=0 时就是 0，
       那样每个音都会在第一个采样点退出，整轨静音。只能按时间判终点。 */
    if (t >= durS + rel) break;
    const amp = t < durS ? Math.min(1, t / 0.004) : Math.max(0, 1 - (t - durS) / rel);
    const x0 = (saw(ph1, dt1) + saw(ph2, dt2)) * 0.34 + Math.sin(2 * Math.PI * phs) * 0.5;
    ph1 = (ph1 + dt1) % 1; ph2 = (ph2 + dt2) % 1; phs = (phs + dts) % 1;
    const fc = t < 0.022 ? 200 + 2500 * (t / 0.022) : 900 + 1700 * Math.exp(-(t - 0.022) * 10);
    const g = svfG(fc), q = 1 / 1.3;
    const high = x0 - lp - q * bp; bp += g * high; lp += g * bp;
    const x = (lp + x0 * 0.12) * amp * ev.v * 0.5;
    if (n0 + i < bus.L.length) { bus.L[n0 + i] += x; bus.R[n0 + i] += x; }
  }
}

/** 电吉他强力和弦：每音两个失谐锯齿 → tanh 失真 → 音箱低通 */
function instGtr(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((durS + 0.3) * SR);
  const notes = MS.powerNotes(ev.n, ev.octave || 0);
  const vs = [];
  for (const m of notes) {
    const f = mtof(m);
    for (const det of [1.004, 0.9955]) vs.push({ ph: rnd(), dt: f * det / SR });
  }
  let lp = 0, bp = 0;
  const pan = 0.22, rel = 0.19;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + rel) break;                 // 见 instBass 的注释：不能按 amp<=0 退出
    const amp = t < durS ? Math.min(1, t / 0.003) : Math.max(0, 1 - (t - durS) / rel);
    let x = 0;
    for (const v of vs) { x += saw(v.ph, v.dt); v.ph = (v.ph + v.dt) % 1; }
    x /= vs.length;
    x = Math.tanh(x * 7.5);
    const fc = 2600 + 1400 * Math.exp(-t * 18);
    const g = svfG(fc), q = 1 / 0.9;
    const high = x - lp - q * bp; bp += g * high; lp += g * bp;
    x = lp * amp * ev.v * 0.42;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * (1 - pan); bus.R[n0 + i] += x * (1 + pan);
    }
  }
}

/** 铺底垫：多个失谐锯齿，慢起音慢释放，低通偏暗 */
function instPad(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((durS + 0.9) * SR);
  const notes = MS.chordNotes(ev.n, ev.octave || 0);
  const vs = [];
  for (const m of notes) {
    const f = mtof(m);
    for (const det of [1.006, 0.994, 1.0]) vs.push({ ph: rnd(), dt: f * det / SR });
  }
  let lp = 0, bp = 0;
  const atk = 0.28, rel = 0.7, pan = -0.2;
  const hpL = makeHP(200), hpR = makeHP(200);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + rel) break;                 // 见 instBass 的注释：不能按 amp<=0 退出
    let amp;
    if (t < atk) amp = t / atk;
    else if (t < durS) amp = 1 - 0.15 * (t - atk) / Math.max(0.001, durS - atk);
    else amp = 0.85 * Math.max(0, 1 - (t - durS) / rel);
    let x = 0;
    for (const v of vs) { x += saw(v.ph, v.dt); v.ph = (v.ph + v.dt) % 1; }
    x /= vs.length;
    const g = svfG(1900), q = 1 / 1.0;
    const high = x - lp - q * bp; bp += g * high; lp += g * bp;
    x = lp * amp * ev.v * 0.5;
    if (n0 + i < bus.L.length) {
      /* 高通分左右两份：单份会让相位信息不一致，声像会歪 */
      bus.L[n0 + i] += hp1(hpL, x) * (1 - pan);
      bus.R[n0 + i] += hp1(hpR, x) * (1 + pan);
    }
  }
}

/** 主旋律：方波 + 锯齿混合，带颤音（延迟起的 vibrato），亮而不刺 */
function instLead(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((durS + 0.28) * SR);
  const f = mtof(ev.n);
  const pan = 0.05;
  let phS = 0, phQ = 0, lp = 0, bp = 0;
  const rel = 0.22;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + rel) break;                 // 见 instBass 的注释：不能按 amp<=0 退出
    const amp = t < durS ? Math.min(1, t / 0.012) : Math.max(0, 1 - (t - durS) / rel);
    /* 颤音：起音 0.12 秒后才加进来，并且越来越深 —— 这是"唱"的感觉 */
    const vibDepth = 0.004 * Math.min(1, Math.max(0, (t - 0.12) / 0.25));
    const vib = 1 + vibDepth * Math.sin(2 * Math.PI * 5.6 * t);
    const ff = f * vib;
    const dtS = ff / SR, dtQ = ff * 1.001 / SR;
    const x0 = sqr(phS, dtS) * 0.45 + saw(phQ, dtQ) * 0.55;
    phS = (phS + dtS) % 1; phQ = (phQ + dtQ) % 1;
    const fc = 3000 + 2600 * Math.exp(-t * 6);
    const g = svfG(fc), q = 1 / 1.1;
    const high = x0 - lp - q * bp; bp += g * high; lp += g * bp;
    const x = lp * amp * ev.v * 0.34;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * (1 - pan); bus.R[n0 + i] += x * (1 + pan);
    }
  }
}

/** 铜管：多个失谐锯齿 + 起音瞬间的滤波器扫开 + 轻度过载。用来做号角与和弦重音。 */
function instBrass(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const len = Math.round((durS + 0.22) * SR);
  /* n 可以是单个 MIDI 音高，也可以是一个和弦名（两种都支持） */
  const notes = typeof ev.n === 'string' ? MS.chordNotes(ev.n, ev.octave || 0) : [ev.n];
  const vs = [];
  for (const m of notes) {
    const f = mtof(m);
    for (const det of [1.006, 0.994, 1.0]) vs.push({ ph: rnd(), dt: f * det / SR });
  }
  let lp = 0, bp = 0;
  const rel = 0.16, pan = -0.12;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + rel) break;
    /* 铜管的特征：起音有极短的"爆"（唇振建立），之后稳定 */
    const amp = t < durS ? Math.min(1, t / 0.018) : Math.max(0, 1 - (t - durS) / rel);
    let x = 0;
    for (const v of vs) { x += saw(v.ph, v.dt); v.ph = (v.ph + v.dt) % 1; }
    x /= vs.length;
    x = Math.tanh(x * 3.2);                    // 轻度过载，铜管的"糙"
    /* 截止频率从暗快速开到亮，然后略回落 */
    const fc = t < 0.05 ? 500 + 3200 * (t / 0.05) : 3700 - 700 * Math.min(1, (t - 0.05) / 0.3);
    const g = svfG(fc), q = 1 / 1.4;
    const high = x - lp - q * bp; bp += g * high; lp += g * bp;
    x = lp * amp * ev.v * 0.5;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * (1 - pan); bus.R[n0 + i] += x * (1 + pan);
    }
  }
}

/** 钟声：FM（正弦载波 + 正弦调制器，调制指数衰减）。长衰减，用来做标题曲与胜利曲的点缀。 */
function instBell(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const ring = 1.8;                            // 余韵
  const len = Math.round((durS + ring) * SR);
  const notes = typeof ev.n === 'string' ? MS.chordNotes(ev.n, ev.octave || 0) : [ev.n];
  const vs = notes.map((m) => ({ f: mtof(m), pc: 0, pm: 0 }));
  const ratio = 3.47;                          // 非整数比 → 金属感的钟
  const tau = durS * 0.7 + 0.6;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + ring) break;
    const env = Math.min(1, t / 0.002) * decay(t, tau);
    /* 注意：这里**不能**写成「env 太小就 break」—— 起音包络在 t=0 时是 0，
       那样每个音都会在第一个采样点退出，整轨静音。我在 instBass 里警告过这个坑，
       结果自己在这里又踩了一次（bell 全曲零输出）。终点判断只能用时间。 */
    const idx = 2.4 * decay(t, 0.3) * 2 * Math.PI;   // 调制指数（弧度）
    let x = 0;
    for (const v of vs) {
      const mod = Math.sin(2 * Math.PI * v.pm) * idx;
      x += Math.sin(2 * Math.PI * v.pc + mod);
      v.pc = (v.pc + v.f / SR) % 1;
      v.pm = (v.pm + v.f * ratio / SR) % 1;
    }
    x = (x / vs.length) * env * ev.v;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += x * 0.3; bus.R[n0 + i] += x * 0.3;
    }
  }
}

/** 人声合唱感铺底：多个失谐锯齿 + 颤音 + 两个共振峰（约 700Hz / 2400Hz）。 */
function instChoir(bus, ev, C) {
  const durS = ev.d * C.spb;
  const n0 = Math.round(ev.t * C.spb * SR);
  const atk = 0.35, rel = 0.8;
  const len = Math.round((durS + rel + 0.1) * SR);
  const notes = MS.chordNotes(ev.n, ev.octave || 0);
  const vs = [];
  for (const m of notes) {
    const f = mtof(m);
    /* 每个音 4 个失谐声部，模拟多人不齐 */
    for (const det of [1.009, 0.991, 1.003, 0.997]) vs.push({ f, ph: rnd(), det });
  }
  let lp = 0, bp = 0, lp2 = 0, bp2 = 0;
  const pan = 0.18;
  const hpL = makeHP(220), hpR = makeHP(220);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    if (t >= durS + rel) break;
    let amp;
    if (t < atk) amp = t / atk;
    else if (t < durS) amp = 1 - 0.12 * (t - atk) / Math.max(0.001, durS - atk);
    else amp = 0.88 * Math.max(0, 1 - (t - durS) / rel);
    /* 每个人声部有独立的慢颤音，相位不同 → 天然的合唱"晃动" */
    let x = 0;
    for (const v of vs) {
      const vib = 1 + 0.0035 * Math.sin(2 * Math.PI * (4.6 + v.det * 40) * t + v.ph * 6.28);
      const dt = v.f * v.det * vib / SR;
      x += saw(v.ph, dt);
      v.ph = (v.ph + dt) % 1;
    }
    x /= vs.length;
    /* 共振峰 1：约 700Hz */
    const g1 = svfG(700), q1 = 1 / 2.2;
    const h1 = x - lp - q1 * bp; bp += g1 * h1; lp += g1 * bp;
    /* 共振峰 2：约 2400Hz */
    const g2 = svfG(2400), q2 = 1 / 2.0;
    const h2 = x - lp2 - q2 * bp2; bp2 += g2 * h2; lp2 += g2 * bp2;
    x = (lp * 0.7 + lp2 * 0.45) * amp * ev.v * 0.34;
    if (n0 + i < bus.L.length) {
      bus.L[n0 + i] += hp1(hpL, x) * (1 - pan);
      bus.R[n0 + i] += hp1(hpR, x) * (1 + pan);
    }
  }
}

const INST = {
  kick: instKick, snare: instSnare, hat: instHat, crash: instCrash, timp: instTimp,
  bass: instBass, gtr: instGtr, pad: instPad, lead: instLead,
  brass: instBrass, bell: instBell, choir: instChoir,
};

/* ============================================================ 混音 */

/* 各分轨的增益 / 声像 / 送到混响的量。调这里就是调平衡。 */
const MIXCFG = {
  kick:  { g: 1.00, pan: 0.00, send: 0.05 },
  snare: { g: 0.72, pan: 0.00, send: 0.20 },
  hat:   { g: 0.50, pan: 0.00, send: 0.12 },
  crash: { g: 0.60, pan: 0.00, send: 0.32 },
  timp:  { g: 0.70, pan: -0.05, send: 0.30 },
  bass:  { g: 0.90, pan: 0.00, send: 0.03 },
  gtr:   { g: 0.60, pan: 0.00, send: 0.13 },
  pad:   { g: 0.30, pan: 0.00, send: 0.38 },
  lead:  { g: 0.62, pan: 0.00, send: 0.22 },
  brass: { g: 0.52, pan: 0.00, send: 0.22 },
  bell:  { g: 0.38, pan: 0.00, send: 0.42 },
  choir: { g: 0.32, pan: 0.00, send: 0.46 },
};

/** Schroeder 混响：8 个梳状滤波器 + 4 个全通 */
function schroeder(x) {
  const out = new Float32Array(x.length);
  const cN = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const cB = cN.map((n) => new Float32Array(n));
  const cI = cN.map((_, i) => i * 7 % cN[i]);
  const cF = new Float32Array(cN.length);
  const aN = [225, 341, 441, 556];
  const aB = aN.map((n) => new Float32Array(n));
  const aI = aN.map(() => 0);
  for (let i = 0; i < x.length; i++) {
    const inp = x[i];
    let acc = 0;
    for (let c = 0; c < cN.length; c++) {
      const b = cB[c], n = b.length;
      const y = b[cI[c]];
      cF[c] = y * 0.55 + cF[c] * 0.45;              // 高频阻尼
      b[cI[c]] = inp + cF[c] * 0.83;
      cI[c] = (cI[c] + 1) % n;
      acc += y;
    }
    acc /= cN.length;
    for (let a = 0; a < aN.length; a++) {
      const b = aB[a], n = b.length;
      const bufout = b[aI[a]];
      const o = -acc + bufout;
      b[aI[a]] = acc + bufout * 0.5;
      aI[a] = (aI[a] + 1) % n;
      acc = o;
    }
    out[i] = acc;
  }
  return out;
}

/** 附点八分延迟 */
function delayLine(x, delaySamples, fb, mix) {
  const out = new Float32Array(x.length);
  const buf = new Float32Array(Math.max(1, Math.round(delaySamples)));
  let idx = 0;
  for (let i = 0; i < x.length; i++) {
    const d = buf[idx];
    buf[idx] = x[i] + d * fb;
    idx = (idx + 1) % buf.length;
    out[i] = x[i] + d * mix;
  }
  return out;
}

/** 把乐谱渲染成混音（同时保留分轨，便于画图自检） */
function renderCue(cue, wantStems) {
  const spb = 60 / cue.bpm;
  const totalBeats = cue.bars * cue.beatsPerBar;
  const N = Math.ceil((totalBeats * spb + 2.6) * SR);
  const C = { spb, N };
  rnd = mulberry32(20240611);   // 每次渲染前重置，保证可复现

  const stems = {};
  for (const name of Object.keys(cue.tracks)) {
    const bus = { L: new Float32Array(N), R: new Float32Array(N) };
    const fn = INST[name];
    if (!fn) throw new Error('没有这个乐器的渲染函数：' + name);
    for (const e of cue.tracks[name]) fn(bus, e, C);
    stems[name] = bus;
  }

  const dryL = new Float32Array(N), dryR = new Float32Array(N);
  const sendL = new Float32Array(N), sendR = new Float32Array(N);
  for (const name of Object.keys(stems)) {
    const cfg = MIXCFG[name];
    if (!cfg) continue;
    const s = stems[name];
    const gl = cfg.g * (1 - cfg.pan), gr = cfg.g * (1 + cfg.pan);
    for (let i = 0; i < N; i++) {
      const l = s.L[i], r = s.R[i];
      dryL[i] += l * gl; dryR[i] += r * gr;
      sendL[i] += l * gl * cfg.send; sendR[i] += r * gr * cfg.send;
    }
  }

  /* 延迟 → 混响，都是"并联送出再混回来" */
  const dSamp = 0.75 * spb * SR;
  const dL = delayLine(sendL, dSamp, 0.34, 0.95);
  const dR = delayLine(sendR, dSamp * 0.98, 0.34, 0.95);
  const rvL = schroeder(dL), rvR = schroeder(dR);

  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    L[i] = dryL[i] + rvL[i] * 0.55;
    R[i] = dryR[i] + rvR[i] * 0.55;
  }
  return { L, R, stems, spb, N };
}

/** 归一化 + 温和软限幅（避免削顶爆音） */
function finalize(L, R) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak === 0) throw new Error('混音是全静音，肯定出错了');
  const g = 0.89 / peak;   // 留 ~1dB 余量：有损编码和重采样都会在峰值附近过冲，压到 0.92 会削顶
  const k = 1.15;
  const norm = Math.tanh(k);
  for (let i = 0; i < L.length; i++) {
    L[i] = Math.tanh(L[i] * g * k) / norm;
    R[i] = Math.tanh(R[i] * g * k) / norm;
  }
  return { peak, gain: g };
}

/* ============================================================ WAV 输出 */

function wavBuffer(L, R, sr = SR, bitDepth = 16) {
  const n = L.length;
  const bytes = bitDepth / 8;
  const buf = Buffer.alloc(44 + n * 2 * bytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2 * bytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);                       // PCM
  buf.writeUInt16LE(2, 22);                       // 立体声
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2 * bytes, 28);
  buf.writeUInt16LE(2 * bytes, 32);
  buf.writeUInt16LE(bitDepth, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2 * bytes, 40);
  let p = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    buf.writeInt16LE(Math.round(l * 32767), p); p += 2;
    buf.writeInt16LE(Math.round(r * 32767), p); p += 2;
  }
  return buf;
}

/* ============================================================ 频谱图（我的"眼睛"） */

/** 原地 radix-2 FFT */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j], ui = im[i + j];
        const xr = re[i + j + half], xi = im[i + j + half];
        const vr = xr * cr - xi * ci, vi = xr * ci + xi * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + half] = ur - vr; im[i + j + half] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const FFT_N = 2048, HOP = 512;

/** 返回 { frames: Float32Array[](每帧 dB 谱), nFrames }；fftN/hop 可调 */
function spectrogram(x, fftN = FFT_N, hop = HOP) {
  const win = new Float32Array(fftN);
  for (let i = 0; i < fftN; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftN - 1));
  const nFrames = Math.max(1, Math.floor((x.length - fftN) / hop) + 1);
  const frames = [];
  let globalMax = 1e-12;
  const re = new Float64Array(fftN), im = new Float64Array(fftN);
  for (let f = 0; f < nFrames; f++) {
    const off = f * hop;
    for (let i = 0; i < fftN; i++) { re[i] = x[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(fftN / 2);
    for (let k = 0; k < fftN / 2; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      mag[k] = m;
      if (m > globalMax) globalMax = m;
    }
    frames.push(mag);
  }
  /* 转成相对满量程的 dB */
  const db = frames.map((mag) => {
    const o = new Float32Array(mag.length);
    for (let k = 0; k < mag.length; k++) o[k] = 20 * Math.log10(Math.max(mag[k], 1e-12) / globalMax);
    return o;
  });
  return { frames: db, nFrames, globalMax, fftN };
}

/* magma 配色，读频谱图时对比度最好 */
const MAGMA = [
  [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122],
  [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
];
function magma(t) {
  t = Math.max(0, Math.min(1, t));
  const s = t * (MAGMA.length - 1);
  const i = Math.min(MAGMA.length - 2, Math.floor(s));
  const f = s - i;
  const a = MAGMA[i], b = MAGMA[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const FMIN = 40, FMAX = 16000, DB_FLOOR = -72;

/**
 * 画「波形 + 频谱」总览图。
 * 上半：波形峰值包络（看削顶、静音、动态）
 * 下半：对数频率频谱图（看音高、和声、频段拥挤、旋律是否浮出）
 * 竖线：每小节一条暗线，段落起始一条亮线，0 拍一条橙线。
 */
function drawOverview(path, mix, cue) {
  const W = Math.min(1500, spectrogram(mix.L).nFrames);
  const H1 = 110, H2 = 520, H = H1 + H2;
  const spec = spectrogram(mix.L);
  const scale = spec.nFrames / W;

  /* 预算：每列该用哪一帧 */
  const colFrame = (x) => Math.min(spec.nFrames - 1, Math.floor(x * scale));

  /* 频率 → 行（对数） */
  const rowF = (y) => FMAX * Math.pow(FMIN / FMAX, y / (H2 - 1));
  const binOf = (f) => f * FFT_N / SR;
  function magAt(frame, f) {
    const b = binOf(f);
    const i0 = Math.floor(b), i1 = Math.min(spec.frames[0].length - 1, i0 + 1);
    if (i0 < 0) return DB_FLOOR;
    const fr = spec.frames[frame];
    if (i0 >= fr.length) return DB_FLOOR;
    const t = b - i0;
    return fr[i0] * (1 - t) + fr[Math.min(fr.length - 1, i1)] * t;
  }

  /* 波形包络（取 L/R 最大绝对值） */
  const env = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const i0 = Math.floor(x * mix.L.length / W), i1 = Math.floor((x + 1) * mix.L.length / W);
    let m = 0;
    for (let i = i0; i < i1 && i < mix.L.length; i++) m = Math.max(m, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
    env[x] = m;
  }

  /* 时间参考线位置 */
  const spb = mix.spb;
  const xOfTime = (t) => (t / (mix.L.length / SR)) * W;
  const barXs = [];
  for (let b = 0; b <= cue.bars; b++) barXs.push(xOfTime(b * cue.beatsPerBar * spb));
  const secXs = cue.sections.map((s) => xOfTime(s.from * cue.beatsPerBar * spb));
  /* 八度参考频率线，用来读音高 */
  const octHz = [110, 220, 440, 880, 1760, 3520, 7040];

  const px = (x, y) => {
    /* 1. 竖参考线 */
    for (const bx of barXs) if (Math.abs(x - bx) < 0.5) return [70, 80, 96, 255];
    for (const sx of secXs) if (Math.abs(x - sx) < 1.0) return [233, 162, 59, 255];
    if (y < H1) {
      const c = Math.abs(y - H1 / 2);
      if (c < 0.6) return [60, 70, 84, 255];
      if (c <= env[x] * (H1 / 2 - 4)) return [125, 232, 255, 255];
      return [14, 18, 26, 255];
    }
    const yy = y - H1;
    for (const f of octHz) {
      const fy = Math.log(FMAX / f) / Math.log(FMAX / FMIN) * (H2 - 1);
      if (Math.abs(yy - fy) < 0.5) return [90, 100, 120, 255];
    }
    const db = magAt(colFrame(x), rowF(yy));
    const t = (db - DB_FLOOR) / (0 - DB_FLOOR);
    const [r, g, b] = magma(Math.pow(Math.max(0, t), 0.75));
    return [r, g, b, 255];
  };

  writeFileSync(path, pngBuffer(W, H, px));
  return { W, H, frames: spec.nFrames };
}

/** 画分轨小图阵（每轨一条波形+频谱，用来确认每个乐器真的在按预期发声） */
function drawStems(path, stems, cue, mix) {
  const names = Object.keys(stems);
  const cols = 3, cw = 480, chH = 150, chW = 460;
  const rows = Math.ceil(names.length / cols);
  const W = cols * cw, H = rows * chH + 8;
  const specs = {};
  for (const n of names) specs[n] = spectrogram(stems[n].L);
  const xOfTime = (t) => (t / (mix.L.length / SR));

  const px = (x, y) => {
    const c = Math.min(cols - 1, Math.floor(x / cw));
    const r = Math.floor(y / chH);
    const i = r * cols + c;
    if (i >= names.length) return [8, 10, 14, 255];
    const name = names[i];
    const ox = x - c * cw, oy = y - r * chH;
    if (oy < 16) /* 标题条用亮度表示增益，代替文字 */
      return [35, 42, 56, 255];
    const inY = oy - 18, inH = chH - 26;
    const spec = specs[name];
    /* 上 40% 波形，下 60% 频谱 */
    const split = Math.floor(inH * 0.4);
    if (inY < split) {
      const cc = split / 2, d = Math.abs(inY - cc);
      const i0 = Math.floor(ox / chW * stems[name].L.length);
      const i1 = Math.floor((ox + 1) / chW * stems[name].L.length);
      let m = 0;
      for (let k = i0; k < i1 && k < stems[name].L.length; k++) m = Math.max(m, Math.abs(stems[name].L[k]));
      if (d < 0.6) return [50, 58, 72, 255];
      return d <= m * (cc - 2) ? [125, 232, 255, 255] : [14, 18, 26, 255];
    }
    const yy = inY - split, hh = inH - split;
    if (spec.nFrames < 2) return [14, 18, 26, 255];
    const fr = Math.min(spec.nFrames - 1, Math.floor(ox / chW * spec.nFrames));
    const f = FMAX * Math.pow(FMIN / FMAX, yy / (hh - 1));
    const b = f * FFT_N / SR;
    const arr = spec.frames[fr];
    const i0 = Math.floor(b), i1 = Math.min(arr.length - 1, i0 + 1);
    if (i0 < 0 || i0 >= arr.length) return [14, 18, 26, 255];
    const tv = b - i0;
    const db = arr[i0] * (1 - tv) + arr[i1] * tv;
    const t = (db - DB_FLOOR) / (0 - DB_FLOOR);
    const [rr, gg, bb] = magma(Math.pow(Math.max(0, t), 0.75));
    void xOfTime;
    return [rr, gg, bb, 255];
  };
  writeFileSync(path, pngBuffer(W, H, px));
  return { W, H };
}

/**
 * 放大细节图：把「某一轨、某一段拍数」放大到能读出音高的分辨率。
 * ----------------------------------------------------------------------------
 * 这是整个工作台里最关键的一张图 —— 它回答「我能不能验证音高」。
 * 用 FFT 4096 + hop 256（频率精度约 10.8Hz/格，时间精度约 5.8ms），
 * 频率轴默认 50Hz–5kHz（旋律与和声真正所在的区间），
 * 横轴每拍画一条线、小节线画橙色。
 * 蓝色横线是 A 的八度（110/220/440/880/1760/3520Hz），用来肉眼定音高。
 */
function drawDetail(path, mix, cue, opt) {
  const src = opt.track ? mix.stems[opt.track] : mix;
  if (!src) throw new Error('没有这个分轨：' + opt.track);
  const spb = mix.spb;
  const i0 = Math.max(0, Math.round(opt.fromBeat * spb * SR));
  const i1 = Math.min(src.L.length, Math.round(opt.toBeat * spb * SR));
  if (i1 - i0 < 8192) throw new Error('这一段太短，至少要 0.2 秒');
  const seg = src.L.subarray(i0, i1);
  const spec = spectrogram(seg, 4096, 256);
  const fmin = opt.fmin || 50, fmax = opt.fmax || 5000;
  const H1 = 80, H2 = 560, H = H1 + H2;
  const W = Math.max(200, Math.min(2600, spec.nFrames));
  const scale = spec.nFrames / W;
  const rowF = (y) => fmax * Math.pow(fmin / fmax, y / (H2 - 1));

  function magAt(frame, f) {
    const b = f * spec.fftN / SR;
    const arr = spec.frames[frame];
    const k0 = Math.floor(b), k1 = Math.min(arr.length - 1, k0 + 1);
    if (k0 < 0 || k0 >= arr.length) return DB_FLOOR;
    const t = b - k0;
    return arr[k0] * (1 - t) + arr[k1] * t;
  }

  const env = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const a0 = Math.floor(x * seg.length / W), a1 = Math.floor((x + 1) * seg.length / W);
    let m = 0;
    for (let i = a0; i < a1 && i < seg.length; i++) m = Math.max(m, Math.abs(seg[i]));
    env[x] = m;
  }
  const durS = (i1 - i0) / SR;
  const xOfBeat = (bt) => ((bt - opt.fromBeat) * spb / durS) * W;
  const A_HZ = [110, 220, 440, 880, 1760, 3520];

  const px = (x, y) => {
    const frame = Math.min(spec.nFrames - 1, Math.floor(x * scale));
    for (let bt = Math.ceil(opt.fromBeat); bt <= opt.toBeat; bt++) {
      const bx = xOfBeat(bt);
      const isBar = ((bt % cue.beatsPerBar) + cue.beatsPerBar) % cue.beatsPerBar === 0;
      if (Math.abs(x - bx) < (isBar ? 1.0 : 0.5)) return isBar ? [233, 162, 59, 255] : [86, 98, 118, 255];
    }
    if (y < H1) {
      const c = H1 / 2;
      if (Math.abs(y - c) < 0.6) return [60, 70, 84, 255];
      if (Math.abs(y - c) <= env[x] * (H1 / 2 - 4)) return [125, 232, 255, 255];
      return [14, 18, 26, 255];
    }
    const yy = y - H1;
    const fTop = rowF(yy), fBot = rowF(Math.min(H2 - 1, yy + 1));
    /* A 的八度：亮蓝，用来定音高 */
    for (const a of A_HZ) if (a <= fTop && a >= fBot) return [120, 200, 255, 255];
    /* 1kHz 以下再每 100Hz 画一条暗线，方便数半音 */
    if (fTop < 1000) {
      const n100 = Math.round(fTop / 100) * 100;
      if (n100 > 0 && n100 <= fTop && n100 >= fBot) return [70, 80, 96, 255];
    }
    const db = magAt(frame, rowF(yy));
    const t = (db - DB_FLOOR) / (0 - DB_FLOOR);
    const [r, g, b] = magma(Math.pow(Math.max(0, t), 0.75));
    return [r, g, b, 255];
  };
  writeFileSync(path, pngBuffer(W, H, px));
  return { W, H, durS, nFrames: spec.nFrames };
}

/* ============================================================ MIDI 导出 */

function exportMIDI(cue) {
  const div = 480;
  const spbTicks = div;                       // 4/4，1 拍 = 1 个四分音符
  const tick = (beats) => Math.round(beats * spbTicks);
  const tracks = [];

  /* 音色选择：GM 里挑最接近的 */
  const PROG = { bass: 33, gtr: 30, pad: 89, lead: 81, timp: 47, brass: 61, bell: 14, choir: 52 };

  for (const name of Object.keys(cue.tracks)) {
    const evs = cue.tracks[name];
    if (!evs.length) continue;
    const isDrum = name === 'kick' || name === 'snare' || name === 'hat' || name === 'crash';
    const notes = [];
    for (const e of evs) {
      const durTicks = Math.max(8, tick(e.d));
      if (isDrum) {
        const gm = GM_DRUM[e.n];
        if (gm == null) continue;
        notes.push({ tick: tick(e.t), note: gm, vel: e.v, durTicks: Math.min(durTicks, 60) });
      } else if (typeof e.n === 'string') {
        /* 和弦名展开成真实音高，让 GM 音源听起来才对 */
        const ns = name === 'gtr' ? MS.powerNotes(e.n, e.octave || 0) : MS.chordNotes(e.n, e.octave || 0);
        for (const m of ns) {
          notes.push({ tick: tick(e.t), note: m, vel: e.v * (name === 'gtr' ? 0.85 : 1), durTicks });
        }
      } else if (typeof e.n === 'number') {
        notes.push({ tick: tick(e.t), note: e.n, vel: e.v, durTicks });
      }
    }
    tracks.push({
      name: name,
      channel: isDrum ? 9 : 0,
      program: PROG[name],
      notes,
    });
  }
  /* 非鼓轨要分到不同通道，否则 GM 音源上会互相抢音色 */
  let ch = 0;
  for (const t of tracks) {
    if (t.channel !== 9) { t.channel = ch % 9; ch++; }
  }
  return buildMIDI({ division: div, bpm: cue.bpm, tracks });
}

/* ============================================================ 主流程 */

function rms(L, R) {
  let s = 0;
  for (let i = 0; i < L.length; i++) s += L[i] * L[i] + R[i] * R[i];
  return Math.sqrt(s / (L.length * 2));
}
function peakOf(L, R) {
  let p = 0;
  for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return p;
}
function clipCount(L, R) {
  let c = 0;
  for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) >= 0.999 || Math.abs(R[i]) >= 0.999) c++;
  return c;
}
/** 统计每轨有多少事件真的产生了声音（防止"写了事件但乐器没出声"） */
function trackEnergy(stems) {
  const out = {};
  for (const [n, b] of Object.entries(stems)) {
    let s = 0;
    for (let i = 0; i < b.L.length; i++) s += b.L[i] * b.L[i];
    out[n] = Math.sqrt(s / b.L.length);
  }
  return out;
}

/* ============================================================ 音高验证 */
/*
 * 这是整个工作台里最有价值的一个自检。
 *
 * 频谱图只能让我"大概看看结构"，靠肉眼量像素去读频率并不可靠。
 * 所以这里做硬验证：对乐谱里每一个有音高的音符，取它发声的中间一段，
 * 用 HPS（谐波积谱）估基频，换算成最近的 MIDI 音高，和乐谱上写的对比。
 *
 *   吻合率高 → 合成器确实把音高渲染对了（我听不见也能确认这件事）。
 *   不吻合   → 要么合成器有 bug，要么检测器被骗了，两种都必须查清楚。
 */

const PITCH_N = 16384;   // 零填充到这个长度，配合抛物线插值拿到足够精度

/** HPS 估基频：返回 {f, alt}（alt 是得分最高的几个候选，用于诊断八度/五度误判） */
function detectPitch(src, a, b) {
  const len = b - a;
  if (len < 256) return null;
  const N = PITCH_N;
  const re = new Float64Array(N), im = new Float64Array(N);
  const n = Math.min(len, N);
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    re[i] = src[a + i] * w;
  }
  fft(re, im);
  const half = N / 2;
  const mag = new Float64Array(half);
  for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);

  const H = 5;                                        // 用 5 个谐波
  const NB = 2;                                       // 取谐波峰值时向两侧各看 2 个 bin
  const kMin = Math.max(2, Math.floor(45 * N / SR));  // 45Hz 下限
  const kMax = Math.floor(Math.min(1600, SR / 2 / H) * N / SR);
  const score = new Float64Array(kMax + 2);
  for (let k = kMin; k <= kMax; k++) {
    let s = 0;
    for (let h = 1; h <= H; h++) {
      /* 注意：不能只取 mag[h*k] 这一个 bin。
         第 h 次谐波的峰值未必落在 h*k 上 —— 实测 5 次谐波能偏 2 个 bin，
         在 Hann 窗下就是 20dB 的损失，足以让正确的基频输给它的 2 倍频
         （贝斯因此被误判高一个八度）。取邻域极大才是稳健写法。 */
      const c = h * k;
      let m = 0;
      for (let d = -NB; d <= NB; d++) {
        const j = c + d;
        if (j > 0 && j < half) m = Math.max(m, mag[j]);
      }
      s += Math.log(m + 1e-12);
    }
    s -= 0.02 * (k / kMax);            // 轻微惩罚高频候选，防止泛音被当成基频
    score[k] = s;
  }
  /* 取局部极大作为候选 */
  const cands = [];
  for (let k = kMin; k <= kMax; k++) {
    if (score[k] >= score[k - 1] && score[k] >= score[k + 1]) cands.push({ k, s: score[k] });
  }
  cands.sort((x, y) => y.s - x.s);
  if (!cands.length) return null;

  const ref = (k) => {
    if (k <= 0 || k + 1 >= half) return null;
    const y0 = Math.log(mag[k - 1] + 1e-12), y1 = Math.log(mag[k] + 1e-12), y2 = Math.log(mag[k + 1] + 1e-12);
    const den = y0 - 2 * y1 + y2;
    const d = Math.abs(den) < 1e-12 ? 0 : 0.5 * (y0 - y2) / den;
    return (k + Math.max(-1, Math.min(1, d))) * SR / N;
  };
  const f = ref(cands[0].k);
  if (f == null || f <= 20 || f >= 8000) return null;
  const alt = cands.slice(0, 4).map((c) => ({ f: ref(c.k), s: c.s })).filter((c) => c.f);
  return { f, alt };
}

const MIDI_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);
const midiName = (m) => MIDI_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);

/** 取一段音频的幅度谱（零填充到 PITCH_N） */
function spectrumOf(src, a, b) {
  const N = PITCH_N;
  const re = new Float64Array(N), im = new Float64Array(N);
  const n = Math.max(1, Math.min(b - a, N));
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    re[i] = src[a + i] * w;
  }
  fft(re, im);
  const half = N / 2;
  const mag = new Float64Array(half);
  for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

/* 乐器按"能不能用单基频检测验证"分类。注意这只用于**打击乐的排除** ——
   单音/和弦的区分改成按**事件**判定（同一个乐器可能两者都弹，例如铜管）。
   但鼓组必须先单独排掉：它的 n 也是字符串（'K'/'S'），会被"字符串=和弦名"的分支误判。 */
const DRUM_TRACKS = new Set(['kick', 'snare', 'hat', 'crash']);
const PERC_TRACKS = new Set(['timp']);                // 有音高但是打击乐
/* 非谐波乐器：频谱不是整数倍谐波列，HPS 在这里不成立。
   钟声是 FM 合成的，边频在 f ± n·f_m —— 实测 2/3/4/5 次谐波全在噪声底（−145dB），
   HPS 必然把它误判到低八度。所以改用「期望频率上有没有能量」来验证。 */
const INHARMONIC_TRACKS = new Set(['bell']);

/** 某个音符取样窗口（掐掉首尾各 20%，避开起音与释放） */
function windowOf(e, spb, len) {
  const s0 = e.t * spb * SR, s1 = (e.t + e.d) * spb * SR;
  const guard = (s1 - s0) * 0.2;
  return [Math.max(0, Math.round(s0 + guard)), Math.min(len, Math.round(s1 - guard))];
}

/**
 * 逐音符验证。判定方式按**事件类型**而不是按轨决定 —— 同一个乐器可能既弹单音
 * 也按和弦（例如铜管），按轨分类会漏掉一半情况。
 *   和弦名（字符串）→ 检查乐谱上写的**每一个和弦音**在频谱里是否真的存在（相对峰值 −30dB 以内）
 *   单个音高（数字）→ HPS 估基频，和乐谱音高严格比对（±0.6 半音）
 *   打击乐           → 不做音高断言（短促低频打击音在原理上分不出半音）
 */
/* 每个乐器的合理音域。超出范围几乎一定是「单位写错」这类 bug ——
   这个检查是被 gtr 那次把八度当半音（oct=12，结果高了 12 个八度）的 bug 逼出来的。 */
const RANGE = {
  bass: [28, 55],    // E1–G3
  gtr:  [40, 79],    // E2–G5
  pad:  [43, 91],    // G2–G6（合成弦乐弹到 G2 是正常的，下限别定太窄）
  lead: [55, 100],   // G3–E7
  timp: [33, 60],    // A1–C4
  brass: [45, 86],   // A2–D6（小号/长号/圆号的常用音区）
  bell: [60, 103],   // C4–G7
  choir: [43, 84],   // G2–C6
};

/** 乐谱音域合法性检查。返回错误描述数组。 */
function validateScore(cue) {
  const errs = [];
  for (const [name, evs] of Object.entries(cue.tracks)) {
    const r = RANGE[name];
    for (const e of evs) {
      let ns;
      if (DRUM_TRACKS.has(name)) continue;             // 鼓组没有音高
      if (typeof e.n === 'string') ns = name === 'gtr' ? MS.powerNotes(e.n, e.octave || 0) : MS.chordNotes(e.n, e.octave || 0);
      else if (typeof e.n === 'number') ns = [e.n];
      else continue;
      for (const m of ns) {
        const at = `第 ${(e.t / 4).toFixed(2)} 小节`;
        if (!Number.isFinite(m)) errs.push(`${name} ${at}：音高不是有限数`);
        else if (m < 21 || m > 108) errs.push(`${name} ${at}：${midiName(m)} 超出钢琴音域（MIDI ${m}）`);
        else if (r && (m < r[0] || m > r[1])) {
          errs.push(`${name} ${at}：${midiName(m)} 超出该乐器音域 ${midiName(r[0])}–${midiName(r[1])}`);
        }
      }
    }
  }
  return errs;
}

function verifyPitch(stems, cue, mix) {
  const spb = mix.spb;
  const perTrack = {}, misses = [];
  let total = 0, hit = 0;

  for (const [name, evs] of Object.entries(cue.tracks)) {
    if (!evs.length || !stems[name]) continue;
    const src = stems[name].L;
    let h = 0, t = 0;

    for (const e of evs) {
      if (DRUM_TRACKS.has(name)) continue;             // 鼓组的 n 是 'K'/'S' 这类标记，不是音高
      /* 打击乐先排除（没有音高可验） */
      if (PERC_TRACKS.has(name)) {
        /* 打击乐不做音高断言，原因是物理限制而不是懒得验：
           定音鼓音符短（0.5 拍 ≈ 0.17 秒，掐掉首尾后约 0.1 秒），
           0.1 秒窗口对 110Hz 的频率分辨率约 10Hz，而 110Hz 处一个半音只有 6.5Hz ——
           这个方法在原理上就分不出半音。所以只记账，不谎称验证过。 */
        perTrack[name] ||= { hit: 0, total: 0, skipped: 0 };
        perTrack[name].skipped = (perTrack[name].skipped || 0) + 1;
        continue;
      }

      if (typeof e.n === 'string' || typeof e.n === 'number') {
        /* --- 非谐波乐器（FM 钟声）：只验「期望频率上有没有能量」 ---
           HPS 假设频谱是整数倍谐波列，对 FM 钟声不成立（边频在 f ± n·f_m），
           所以这里不验基频、只验能量是否落在谱面写的地方。
           这同样能抓出"音高渲染错了"，只是不能证明它是基频。 */
        if (INHARMONIC_TRACKS.has(name)) {
          const freqs = typeof e.n === 'string'
            ? MS.chordNotes(e.n, e.octave || 0).map(mtof)
            : [mtof(e.n)];
          const [a, b] = windowOf(e, spb, src.length);
          if (b - a < 256) continue;
          const mag = spectrumOf(src, a, b);
          let pk = 1e-12;
          const kTop = Math.min(mag.length - 1, Math.ceil(4000 * PITCH_N / SR));
          for (let k = 0; k <= kTop; k++) pk = Math.max(pk, mag[k]);
          const floor = pk * Math.pow(10, -30 / 20);
          const missing = [];
          for (const f of freqs) {
            const bin = f * PITCH_N / SR;
            let best = 0;
            for (let k = Math.floor(bin * 0.99); k <= Math.ceil(bin * 1.01); k++) {
              if (k >= 0 && k < mag.length) best = Math.max(best, mag[k]);
            }
            if (best < floor) missing.push(f.toFixed(1) + 'Hz');
          }
          t++;
          perTrack[name] ||= { hit: 0, total: 0, presence: 1 };
          perTrack[name].total++;
          if (!missing.length) { h++; perTrack[name].hit++; }
          else misses.push({ name, at: e.t, kind: '期望频率上没有能量', missing });
          continue;
        }
      }

      if (typeof e.n === 'string') {
        /* --- 和弦名：逐个和弦音查频谱 --- */
        const notes = name === 'gtr' ? MS.powerNotes(e.n, e.octave || 0) : MS.chordNotes(e.n, e.octave || 0);
        const [a, b] = windowOf(e, spb, src.length);
        if (b - a < 512) continue;
        const mag = spectrumOf(src, a, b);
        /* 参考峰值取 45Hz–2.5kHz 内最大的谱线 */
        let peak = 1e-12;
        const k0 = Math.floor(45 * PITCH_N / SR), k1 = Math.min(mag.length - 1, Math.ceil(2500 * PITCH_N / SR));
        for (let k = k0; k <= k1; k++) peak = Math.max(peak, mag[k]);
        const floor = peak * Math.pow(10, -30 / 20);
        const missing = [];
        for (const m of notes) {
          const bin = mtof(m) * PITCH_N / SR;
          let best = 0;
          /* 允许 ±0.5% 失谐（合成器用了多个失谐振荡器） */
          for (let k = Math.floor(bin * 0.995); k <= Math.ceil(bin * 1.005); k++) {
            if (k >= 0 && k < mag.length) best = Math.max(best, mag[k]);
          }
          if (best < floor) missing.push(midiName(m));
        }
        t++;
        perTrack[name] ||= { hit: 0, total: 0, missing: 0, chordTotal: 0 };
        perTrack[name].total++;
        perTrack[name].chordTotal = (perTrack[name].chordTotal || 0) + 1;
        perTrack[name].missing += missing.length;
        if (!missing.length) { h++; perTrack[name].hit++; }
        else misses.push({ name, at: e.t, kind: '和弦音缺失', missing });
        continue;
      }

      if (typeof e.n !== 'number') continue;          // 鼓：没有音高
      /* --- 单个音高：HPS 严格验 --- */
      const want = e.n;
      const [a, b] = windowOf(e, spb, src.length);
      if (b - a < 256) continue;
      const det = detectPitch(src, a, b);
      t++;
      perTrack[name] ||= { hit: 0, total: 0 };
      perTrack[name].total++;
      if (!det) { misses.push({ name, want, got: null, f: null, at: e.t, alt: [], kind: '估不出基频' }); continue; }
      const got = hzToMidi(det.f);
      if (Math.abs(got - want) <= 0.6) { h++; perTrack[name].hit++; }
      else {
        /* 不吻合时把「期望基频及其各次谐波」的相对电平量出来 ——
           这样能一眼看出是八度误判（基频比 2 次谐波弱）还是真的渲染错了。 */
        const mag = spectrumOf(src, a, b);
        let pk = 1e-12;
        for (let k = 0; k < mag.length; k++) pk = Math.max(pk, mag[k]);
        const harm = [];
        for (let n = 1; n <= 6; n++) {
          const bin = mtof(want) * n * PITCH_N / SR;
          let best = 0;
          for (let k = Math.floor(bin * 0.99); k <= Math.ceil(bin * 1.01); k++) {
            if (k >= 0 && k < mag.length) best = Math.max(best, mag[k]);
          }
          harm.push(best <= 0 ? -99 : 20 * Math.log10(best / pk));
        }
        misses.push({ name, want, got, f: det.f, at: e.t, alt: det.alt, harm, kind: '音高不符' });
      }
    }
    if (t) { hit += h; total += t; }
  }
  return { perTrack, total, hit, misses };
}

mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
/* --detail=轨名,起拍,止拍   例：--detail=lead,8,16   轨名写 mix 就是整个混音 */
const detailArg = (process.argv.find((a) => a.startsWith('--detail=')) || '').slice('--detail='.length);
/* 画频谱图很贵（每个分轨都要做一次全曲 FFT）。渲染多首时默认跳过，
   只渲染一首（迭代时）默认生成。也可以显式 --png / --no-png 覆盖。 */
const wantPng = flags.includes('--png') || (!!only && !flags.includes('--no-png'));
const cues = Object.values(MS.CUES).filter((c) => !only || c.id === only);
if (!cues.length) { console.error('没有匹配的曲目：' + only); process.exit(1); }

let bad = 0;
for (const cue of cues) {
  const t0 = Date.now();
  const mix = renderCue(cue, true);
  const pre = peakOf(mix.L, mix.R);
  const norm = finalize(mix.L, mix.R);
  const durS = mix.L.length / SR;

  /* --- WAV --- */
  const wavPath = join(OUT, `${cue.id}.wav`);
  writeFileSync(wavPath, wavBuffer(mix.L, mix.R));

  /* --- MIDI --- */
  const midPath = join(OUT, `${cue.id}.mid`);
  const midBuf = exportMIDI(cue);
  writeFileSync(midPath, midBuf);
  /* 往返自检：用自己写的读取器把 MIDI 读回来，确认音高数量对得上 */
  const back = readMIDI(midBuf);
  const backNotes = back.tracks.reduce((a, t) => a + t.notes.length, 0);
  /* 期望音符数按**与导出器相同的规则**独立算一遍：和弦名 → 3 个音，单音 → 1 个，鼓 → 1 个。
     注意不能直接用导出器的计数，否则检查就变成自证了。 */
  const wantNotes = Object.entries(cue.tracks).reduce((a, [n, evs]) => {
    const isDrum = DRUM_TRACKS.has(n);
    for (const e of evs) {
      if (isDrum) { if (GM_DRUM[e.n] != null) a++; }
      else if (typeof e.n === 'string') a += 3;      // 强力和弦与三和弦都是 3 个音
      else if (typeof e.n === 'number') a++;
    }
    return a;
  }, 0);

  /* --- 图（按需生成，见 wantPng 的说明） --- */
  let ov = null, st = null, det = null;
  if (wantPng) {
    ov = drawOverview(join(OUT, `${cue.id}-spectrum.png`), mix, cue);
    st = drawStems(join(OUT, `${cue.id}-stems.png`), mix.stems, cue, mix);
  }
  if (detailArg) {
    const [tr, a, b] = detailArg.split(',');
    det = drawDetail(join(OUT, `${cue.id}-detail.png`), mix, cue, {
      track: tr && tr !== 'mix' ? tr : null,
      fromBeat: parseFloat(a) || 0,
      toBeat: parseFloat(b) || cue.bars * cue.beatsPerBar,
    });
  }

  /* --- 自检报告 --- */
  const clips = clipCount(mix.L, mix.R);
  const en = trackEnergy(mix.stems);
  /* 只检查**有事件**的轨：没写事件的分轨本来就是空的，不是错误 */
  const used = Object.keys(cue.tracks).filter((n) => cue.tracks[n].length > 0);
  const silent = used.filter((n) => en[n] < 1e-5);
  const pv = verifyPitch(mix.stems, cue, mix);
  const scoreErrs = validateScore(cue);
  const beatS = 60 / cue.bpm;

  console.log(`\n=== ${cue.name} (${cue.id}) ===`);
  console.log(`  BPM ${cue.bpm}  调 ${cue.key}  ${cue.bars} 小节  ${durS.toFixed(2)} 秒`);
  console.log(`  归一化前峰值 ${pre.toFixed(3)} → 增益 ${norm.gain.toFixed(2)}×  最终峰值 ${peakOf(mix.L, mix.R).toFixed(3)}`);
  console.log(`  RMS ${rms(mix.L, mix.R).toFixed(4)}  削顶样本 ${clips}`);
  if (clips > 0) { console.error('  ✗ 有削顶，需要降低增益'); bad++; }
  if (silent.length) { console.error('  ✗ 这些轨完全没出声（事件写了但乐器没发声）：' + silent.join(', ')); bad++; }
  console.log(`  MIDI：写回读出 ${backNotes} 个音符 / 期望 ${wantNotes} 个` + (backNotes === wantNotes ? '  ✓' : '  ✗ 不一致'));
  if (backNotes !== wantNotes) bad++;
  console.log(`  分轨能量：` + used.map((n) => `${n} ${en[n].toFixed(4)}`).join('  '));

  /* --- 音高验证：这是"我听不见但能确认音高对了"的依据 --- */
  const rate = pv.total ? pv.hit / pv.total : 0;
  console.log(`  音高验证：${pv.hit}/${pv.total} 通过 (${(rate * 100).toFixed(1)}%)`);
  console.log('    ' + Object.entries(pv.perTrack).map(([n, r]) => {
    if (r.skipped && !r.total) return `${n} 不做音高断言（${r.skipped} 个音符：短促低频打击乐在原理上分不出半音）`;
    let s = `${n} ${r.hit}/${r.total}${r.hit === r.total ? '✓' : ' ✗'}`;
    if (r.presence) s += '（非谐波音色：只验期望频率上有没有能量）';
    if (r.chordTotal) s += `（和弦音${r.missing ? `✗缺${r.missing}个` : '全齐'}）`;
    if (r.skipped) s += `（另有 ${r.skipped} 个打击音未验）`;
    return s;
  }).join('   '));
  if (pv.misses.length) {
    console.log(`    不吻合明细（共 ${pv.misses.length} 条）：`);
    for (const m of pv.misses.slice(0, 10)) {
      if (m.missing) {
        console.log(`      ${m.name} 第 ${(m.at / 4).toFixed(2)} 小节：频谱里找不到 ${m.missing.join(',')}`);
      } else {
        const alts = m.alt.map((c) => `${c.f.toFixed(1)}Hz`).join(' ');
        console.log(`      ${m.name} 第 ${(m.at / 4).toFixed(2)} 小节：期望 ${midiName(m.want)}，得到 `
          + (m.f == null ? '（估不出）' : `${midiName(m.got)} ${m.f.toFixed(1)}Hz`) + `  候选 ${alts}`);
        if (m.harm) {
          console.log(`         期望音的各次谐波相对电平：` + m.harm.map((d, i) => `${i + 1}次 ${d.toFixed(1)}dB`).join('  '));
        }
      }
    }
  }
  if (rate < 0.95) { console.error(`  ✗ 音高验证通过率只有 ${(rate * 100).toFixed(1)}%，需要查`); bad++; }

  /* --- 乐谱音域合法性（防「单位写错」这类 bug） --- */
  if (scoreErrs.length) {
    console.error(`  ✗ 乐谱音域检查发现 ${scoreErrs.length} 处问题：`);
    for (const s of scoreErrs.slice(0, 8)) console.error('      ' + s);
    if (scoreErrs.length > 8) console.error(`      …另有 ${scoreErrs.length - 8} 处`);
    bad++;
  } else {
    console.log('  乐谱音域检查：全部音符都在各乐器合理音域内 ✓');
  }
  console.log(`  输出：${cue.id}.wav / ${cue.id}.mid` + (ov ? ` / ${cue.id}-spectrum.png / ${cue.id}-stems.png` : ''));
  if (ov) {
    console.log(`  图尺寸 ${ov.W}×${ov.H}（频谱 ${ov.frames} 帧，1 拍 = ${beatS.toFixed(3)}s ≈ ${(ov.W / (durS / beatS)).toFixed(1)}px）  分轨图 ${st.W}×${st.H}`);
  }
  if (det) console.log(`  细节图 ${det.W}×${det.H}（${det.durS.toFixed(2)}s / ${det.nFrames} 帧 → ${(det.W / det.durS).toFixed(0)}px/秒，可读音高）`);
  console.log(`  耗时 ${Date.now() - t0} ms`);
}

console.log(bad ? `\n自检失败 ${bad} 项` : '\n自检全部通过');
process.exit(bad ? 1 : 0);
