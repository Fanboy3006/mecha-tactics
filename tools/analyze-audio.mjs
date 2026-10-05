/* ============================================================================
 * WAV 分析器 —— 我"读谱"用的工具。
 * ----------------------------------------------------------------------------
 * 用途一：验证转码正确性。MP3 是有损的，解回来的波形不可能和原始逐位相同，
 *         但必须**高度相关**。如果相关系数很低，说明解码链路有问题（或者被截断）。
 *
 * 用途二：分析你给的参考素材。我听不见，但可以**测量**：速度、调性、和弦进行、
 *         频段分布、段落边界。测出来的数字我能读，也用得上。
 *
 * 用法：
 *   node tools/analyze-audio.mjs a.wav
 *   node tools/analyze-audio.mjs a.wav --compare b.wav
 *   node tools/analyze-audio.mjs a.wav --png out.png     额外输出频谱图
 * ========================================================================== */
import { readWav, stats } from './lib-wav.mjs';
import { pngBuffer } from './lib-png.mjs';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const files = args.filter((a) => !a.startsWith('--'));
const getFlag = (n) => {
  const f = flags.find((a) => a.startsWith(n + '='));
  return f ? f.slice(n.length + 1) : null;
};

if (!files.length) {
  console.error('用法：node tools/analyze-audio.mjs <文件.wav> [--compare 另一个.wav] [--png 输出.png]');
  process.exit(1);
}

const secs = (w) => w.frames / w.sampleRate;
const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

function describe(w) {
  const st = stats(w);
  console.log(`  格式：${w.channels} 声道 / ${w.sampleRate} Hz / ${w.bits} 位 ${w.format}`);
  console.log(`  时长：${secs(w).toFixed(3)} 秒 (${w.frames} 帧)  ${fmtTime(secs(w))}`);
  console.log(`  峰值：${st.peak.toFixed(4)} (${st.peakDb.toFixed(2)} dBFS)   RMS：${st.rms.toFixed(5)} (${st.rmsDb.toFixed(2)} dBFS)`);
  console.log(`  削顶样本：${st.clips}   直流偏移：${st.dc.toFixed(6)}`);
  if (Math.abs(st.dc) > 0.01) console.log('  ⚠ 直流偏移偏大，可能有低频问题');
  if (st.clips > 0) console.log(`  ⚠ 有 ${st.clips} 个样本达到满刻度`);
}

/** 线性插值重采样（只用于比较，够用且简单） */
function resample(w, targetRate) {
  if (w.sampleRate === targetRate) return { w, resampled: false };
  const ratio = targetRate / w.sampleRate;
  const outFrames = Math.floor(w.frames * ratio);
  const ch = w.ch.map((c) => {
    const o = new Float32Array(outFrames);
    for (let i = 0; i < outFrames; i++) {
      const s = i / ratio;
      const i0 = Math.floor(s), i1 = Math.min(w.frames - 1, i0 + 1);
      const t = s - i0;
      o[i] = c[i0] * (1 - t) + c[i1] * t;
    }
    return o;
  });
  return { w: { ...w, sampleRate: targetRate, frames: outFrames, ch }, resampled: true };
}

/* ---------------------------------------------------------------- 互相关 */
/**
 * 比较两个文件的相似度。
 * mp3 编解码会引入延迟，所以除了零延迟还搜一个小的延迟范围，取最好的那个；
 * 采样率不同就先重采样，否则根本没法逐样点比。
 */
function compare(a, b0) {
  const sr = a.sampleRate;
  const { w: b, resampled } = resample(b0, sr);
  if (resampled) console.log(`  · 已把对比文件从 ${b0.sampleRate}Hz 重采样到 ${sr}Hz 再比较`);
  const n = Math.min(a.frames, b.frames);
  const maxLag = Math.round(0.05 * sr);       // 搜 ±50ms
  const step = 4;                             // 每 4 个样点取一个，够用且快

  /* 用单声道混合（取各声道平均）减少声道布局差异的干扰 */
  const mix = (w) => {
    const o = new Float32Array(w.frames);
    for (let i = 0; i < w.frames; i++) {
      let s = 0;
      for (const c of w.ch) s += c[i];
      o[i] = s / w.ch.length;
    }
    return o;
  };
  const A = mix(a), B = mix(b);

  let best = { r: -2, lag: 0 };
  for (let lag = -maxLag; lag <= maxLag; lag += 2) {
    let sa = 0, sb = 0, sab = 0, cnt = 0;
    for (let i = 0; i < n; i += step) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      const x = A[i], y = B[j];
      sa += x * x; sb += y * y; sab += x * y; cnt++;
    }
    if (cnt < 100) continue;
    const r = sab / Math.sqrt(sa * sb + 1e-20);
    if (r > best.r) best = { r, lag };
  }
  const lagMs = best.lag / sr * 1000;
  console.log(`  最佳对齐延迟：${best.lag} 样点 (${lagMs.toFixed(2)} ms)`);
  console.log(`  波形相关系数：${best.r.toFixed(4)}`);
  const sa2 = stats(a), sb2 = stats(b);
  console.log(`  RMS 比：${(sb2.rms / Math.max(sa2.rms, 1e-9)).toFixed(4)}（1.0 表示电平一致）`);

  /* 结论 */
  if (best.r > 0.95) console.log('  ✓ 高度相关（无损或有损但质量很高）');
  else if (best.r > 0.85) console.log('  ✓ 明显相关（符合有损压缩的预期）');
  else if (best.r > 0.5) console.log('  ~ 弱相关，可能是低码率有损压缩');
  else console.log('  ✗ 几乎不相关 —— 解码链路有问题，或者两个文件内容不同');
}

/* ---------------------------------------------------------------- 主流程 */
const a = readWav(files[0]);
console.log(`\n=== ${files[0]} ===`);
describe(a);

const cmpPath = getFlag('--compare') || files[1];
if (cmpPath) {
  const b = readWav(cmpPath);
  console.log(`\n=== 对比 ${cmpPath} ===`);
  describe(b);
  console.log('\n--- 相似度 ---');
  compare(a, b);
}

/* 可选：频谱图，方便我用眼睛看参考素材的结构 */
const pngOut = getFlag('--png');
if (pngOut) {
  const { spectrogramDraw } = await import('./audio-lab-spectrum.mjs').catch(() => ({}));
  if (!spectrogramDraw) {
    console.log('\n· 频谱图功能需要 audio-lab-spectrum.mjs（尚未拆分出来）；');
    console.log('  暂时请用 node tools/audio-lab.mjs 生成的频谱图。');
  } else {
    spectrogramDraw(pngOut, a);
    console.log('\n频谱图：' + pngOut);
  }
}

console.log('');
