/* ============================================================================
 * 机甲战棋 · 音频播放层  MechAudio
 * ----------------------------------------------------------------------------
 * 作用：把 `audio/score.js`（乐谱数据，唯一真源）用 Web Audio **现场合成**播放。
 * 零音频文件、零加载时间、零版权风险 —— 和美术一样，运行时靠代码生成。
 *
 * 设计分成两半，刻意分开：
 *   1. `flatten(cue)`：**纯函数**，把乐谱摊平成「第几拍、哪个声部、哪个音、多长」
 *      的时间表。不需要 AudioContext，所以能在 Node 里跑自检（见 tools/check-audio.mjs）。
 *   2. `voices`：把时间表上的一个音符变成 Web Audio 节点。
 * 这样「音高对不对、时间对不对」是可判定的；只有「好不好听」验不了。
 *
 * 接口（已登记在 协作/接口约定.md 第 4 节）：
 *   MechAudio.play(cueId)        切 BGM，交叉淡入。cueId 见 CUES
 *   MechAudio.sfx(name)          播放音效（名字见 SFX）
 *   MechAudio.setVolume(bgm, sfx) 0..1
 *   MechAudio.mute(bool)
 *   MechAudio.unlock()           浏览器要求用户手势后才能出声，Claude 可以在
 *                                第一次点击时显式调用；没调用也会自动挂一次性监听
 *   MechAudio.state()            调试用：{ready, cue, muted, bgm, sfx, playing}
 *
 * 用法（游戏里由 tools/build-src.mjs 注入，和 MechIcons 一样是 UMD）：
 *   MechAudio.play('allyPhase');
 *   MechAudio.sfx('hit');
 * ========================================================================== */
(function (root, factory) {
  const Score = (root && root.MechScore) ||
    (typeof module === 'object' && module.exports ? require('./score.js') : null);
  const api = factory(Score);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MechAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Score) {
  'use strict';

  const VERSION = '1.0.0';

  /* ==========================================================================
   *  一、乐谱 → 音符时间表（纯函数，可在 Node 里测）
   * ======================================================================== */

  /** 每个声部的音域，用来兜住「单位写错」这类荒谬音高（音域检查）。 */
  const VOICE_RANGE = {
    kick: [24, 60], snare: [24, 90], hat: [24, 120], crash: [24, 127], timp: [24, 60],
    bass: [24, 60], gtr: [36, 84], pad: [36, 96], lead: [48, 100],
    brass: [40, 88], bell: [60, 108], choir: [40, 84],
  };

  /* 打击乐的 n 不是音高，是鼓件代号 */
  const DRUM_VOICES = { kick: 1, snare: 1, hat: 1, crash: 1, timp: 1 };

  function chordToMidi(name, octave) {
    if (!Score || typeof Score.chordNotes !== 'function') return [60];
    try {
      const ns = Score.chordNotes(name, octave || 0);
      return Array.isArray(ns) && ns.length ? ns : [60];
    } catch (e) { return [60]; }
  }

  /**
   * 把一首曲子摊平成按时间排序的音符表。
   * @returns {{events:Array, spb:number, bars:number, loopSeconds:number, seconds:number}}
   *   event = {t, d, voice, midi, vel}，t/d 的单位是**拍**
   */
  function flatten(cue) {
    if (!cue || !cue.tracks) throw new Error('flatten：不是一首曲子');
    const spb = 60 / (cue.bpm || 120);                       // 每拍秒数
    const beatsPerBar = cue.beatsPerBar || 4;
    const out = [];

    for (const voice of Object.keys(cue.tracks)) {
      const range = VOICE_RANGE[voice];
      for (const e of cue.tracks[voice]) {
        if (!e || !isFinite(e.t)) continue;
        const d = isFinite(e.d) && e.d > 0 ? e.d : 0.25;
        const vel = isFinite(e.v) ? e.v : 0.85;

        if (DRUM_VOICES[voice]) {
          // 打击乐：n 是鼓件代号，不参与音高判定
          out.push({t: e.t, d, voice, midi: null, drum: String(e.n || voice), vel});
          continue;
        }
        const notes = (typeof e.n === 'number') ? [e.n] : chordToMidi(e.n, e.octave);
        for (const n of notes) {
          if (!isFinite(n)) continue;
          // 音域检查：超范围的丢掉，避免出现「高 12 个八度」那种只剩混叠噪声的惨案
          if (range && (n < range[0] || n > range[1])) continue;
          out.push({t: e.t, d, voice, midi: n, vel});
        }
      }
    }
    out.sort((a, b) => a.t - b.t || (a.midi || 0) - (b.midi || 0));

    const bars = cue.bars || Math.ceil((out.length ? out[out.length - 1].t + 1 : 1) / beatsPerBar);
    const loopSeconds = bars * beatsPerBar * spb;
    return {events: out, spb, bars, beatsPerBar, loopSeconds, seconds: loopSeconds, bpm: cue.bpm || 120};
  }

  /* ==========================================================================
   *  二、声部（Web Audio 现场合成）
   * --------------------------------------------------------------------------
   * 音色路线和离线工作台（tools/audio-lab.mjs）一致：算法振荡器 + 滤波器 + 包络，
   * 不做采样。**听感不会和离线渲染逐位相同**，但结构、音高、节奏完全一致。
   * ======================================================================== */

  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  function makeNoiseBuffer(ctx, seconds) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < n; i++) {                 // 固定种子，保证每次一致
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x3fffffff) - 1;
    }
    return buf;
  }

  /* 每个声部一个函数：voice(ctx, dest, noise, t, hz, dur, vel) */
  const VOICES = {
    /* 底鼓：正弦从高滑到低 + 快速衰减 */
    kick(ctx, dest, noise, t, hz, dur, vel) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.95, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.34);
    },
    /* 军鼓：噪声 + 一点音高 */
    snare(ctx, dest, noise, t, hz, dur, vel) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.6, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      s.connect(bp); bp.connect(g); g.connect(dest);
      s.start(t); s.stop(t + 0.2);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 190;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og); og.connect(dest);
      o.start(t); o.stop(t + 0.12);
    },
    /* 闭镲 / 开镲：高通噪声，短 */
    hat(ctx, dest, noise, t, hz, dur, vel) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain();
      const len = Math.max(0.03, Math.min(0.3, dur));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.32, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(hp); hp.connect(g); g.connect(dest);
      s.start(t); s.stop(t + len + 0.02);
    },
    /* 强音镲：高通噪声，长尾 */
    crash(ctx, dest, noise, t, hz, dur, vel) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      s.connect(hp); hp.connect(g); g.connect(dest);
      s.start(t); s.stop(t + 1.15);
    },
    /* 定音鼓：低正弦 + 轻微下滑 */
    timp(ctx, dest, noise, t, hz, dur, vel) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(hz * 1.06, t);
      o.frequency.exponentialRampToValueAtTime(hz, t + 0.06);
      const len = Math.max(0.12, dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.7, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + len + 0.02);
    },
    /* 电贝斯：锯齿 + 低通，短促 */
    bass(ctx, dest, noise, t, hz, dur, vel) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1600, t);
      lp.frequency.exponentialRampToValueAtTime(320, t + 0.14);
      lp.Q.value = 4;
      const len = Math.max(0.08, dur * 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.55, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(lp); lp.connect(g); g.connect(dest);
      o.start(t); o.stop(t + len + 0.02);
    },
    /* 电吉他：锯齿 + 失真 + 低通（强力和弦的感觉） */
    gtr(ctx, dest, noise, t, hz, dur, vel) {
      const shaper = ctx.createWaveShaper();
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 3.2); }
      shaper.curve = curve;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = hz;
      o2.type = 'sawtooth'; o2.frequency.value = hz * 1.005;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
      lp.Q.value = 2;
      const g = ctx.createGain();
      const len = Math.max(0.06, dur * 0.85);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.42, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(lp); o2.connect(lp); lp.connect(shaper); shaper.connect(g); g.connect(dest);
      o.start(t); o2.start(t); o.stop(t + len + 0.02); o2.stop(t + len + 0.02);
    },
    /* 铺底：三个失谐锯齿 + 慢起音 */
    pad(ctx, dest, noise, t, hz, dur, vel) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.7;
      const g = ctx.createGain();
      const len = Math.max(0.3, dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * 0.20, t + Math.min(0.35, len * 0.3));
      g.gain.setValueAtTime(vel * 0.20, t + len * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      lp.connect(g); g.connect(dest);
      for (const dt of [-0.06, 0, 0.07]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = hz * (1 + dt * 0.02);
        o.connect(lp); o.start(t); o.stop(t + len + 0.02);
      }
    },
    /* 主音：方波 + 轻微失真 */
    lead(ctx, dest, noise, t, hz, dur, vel) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'square'; o.frequency.value = hz;
      lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 1;
      const len = Math.max(0.08, dur * 0.92);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.30, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(lp); lp.connect(g); g.connect(dest);
      o.start(t); o.stop(t + len + 0.02);
    },
    /* 铜管：锯齿 + 滤波器扫起来的包络，起音更硬 */
    brass(ctx, dest, noise, t, hz, dur, vel) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz;
      lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.linearRampToValueAtTime(2600, t + Math.min(0.12, dur * 0.4));
      const len = Math.max(0.1, dur * 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * 0.38, t + 0.035);
      g.gain.setValueAtTime(vel * 0.38, t + len * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(lp); lp.connect(g); g.connect(dest);
      o.start(t); o.stop(t + len + 0.02);
    },
    /* 钟声：正弦 + 高次谐波，长衰减 */
    bell(ctx, dest, noise, t, hz, dur, vel) {
      const g = ctx.createGain();
      const len = Math.max(0.6, dur * 1.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.30, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      g.connect(dest);
      for (const [mult, amp] of [[1, 1], [2.76, 0.42], [5.4, 0.16]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sine'; o.frequency.value = hz * mult; og.gain.value = amp;
        o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.02);
      }
    },
    /* 人声合唱：几个正弦叠出共鸣腔的感觉，慢起音 */
    choir(ctx, dest, noise, t, hz, dur, vel) {
      const g = ctx.createGain();
      const len = Math.max(0.4, dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel * 0.16, t + Math.min(0.4, len * 0.35));
      g.gain.setValueAtTime(vel * 0.16, t + len * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      g.connect(dest);
      for (const [formant, amp] of [[1, 1], [1.005, 0.7], [2, 0.35], [3, 0.12]]) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = hz * formant;
        const og = ctx.createGain(); og.gain.value = amp;
        o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.02);
      }
    },
  };

  /* 打击乐件的音高（对合成器只是频率参考） */
  const DRUM_HZ = {K: 55, S: 190, H: 8000, OH: 7000, C: 6000};

  /* ==========================================================================
   *  三、音效（短促，一次性）
   * ======================================================================== */

  const SFX = {
    /* 攻击命中：短促的下坠音 + 噪声 */
    hit(ctx, dest, noise, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.09);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.14);
    },
    /* 未中：很轻的掠过声 */
    miss(ctx, dest, noise, t) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      s.connect(bp); bp.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.18);
    },
    /* 暴击：命中音 + 高八度层 */
    crit(ctx, dest, noise, t) {
      SFX.hit(ctx, dest, noise, t);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(300, t + 0.12);
      g.gain.setValueAtTime(0.20, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.18);
    },
    /* 击破：爆音 + 尾巴 */
    destroy(ctx, dest, noise, t) {
      const s = ctx.createBufferSource(); s.buffer = noise;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(240, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.42, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      s.connect(lp); lp.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.6);
    },
    /* 护盾吸收：金属感的短叮 */
    shield(ctx, dest, noise, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.2);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.3);
    },
    /* λ 觉醒：上滑 + 钟声 */
    lambda(ctx, dest, noise, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(1200, t + 0.45);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.26, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.65);
      VOICES.bell(ctx, dest, noise, t + 0.3, midiHz(86), 0.6, 0.5);
    },
    /* 回复 */
    heal(ctx, dest, noise, t) {
      for (const [i, hz] of [523, 659, 784].entries()) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        const ts = t + i * 0.05;
        g.gain.setValueAtTime(0.0001, ts);
        g.gain.linearRampToValueAtTime(0.14, ts + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.25);
        o.connect(g); g.connect(dest); o.start(ts); o.stop(ts + 0.28);
      }
    },
    /* 界面点击 */
    ui(ctx, dest, noise, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.10, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.09);
    },
    /* 警告（回合上限、陨石预警） */
    warn(ctx, dest, noise, t) {
      for (const k of [0, 1]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 660;
        const ts = t + k * 0.22;
        g.gain.setValueAtTime(0.0001, ts);
        g.gain.linearRampToValueAtTime(0.16, ts + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.16);
        o.connect(g); g.connect(dest); o.start(ts); o.stop(ts + 0.18);
      }
    },
  };

  /* ==========================================================================
   *  四、引擎
   * ======================================================================== */

  /** 默认不循环的曲子（结算用，放完就停） */
  const NO_LOOP = {victory: 1, defeat: 1};

  const LOOKAHEAD = 0.25;     // 提前排程的秒数
  const TICK_MS = 40;
  const FADE = 0.9;           // 交叉淡入淡出时长

  /**
   * 造一个引擎。ctxFactory 可以注入，方便在 Node 里用假 AudioContext 做自检。
   * @param {{ctxFactory?:Function, Score?:object}} o
   */
  function createEngine(o) {
    o = o || {};
    const S = o.Score || Score;
    const ctxFactory = o.ctxFactory || (() => {
      const AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
                 (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
      return AC ? new AC() : null;
    });

    let ctx = null, master = null, bgmBus = null, sfxBus = null, noiseBuf = null;
    let muted = false, volBgm = 0.7, volSfx = 0.8;
    let current = null;                 // {id, cue, flat, gain, idx, origin, timer, loop}
    let faded = null;                   // 正在淡出的旧 BGM

    function ensure() {
      if (ctx) return ctx;
      ctx = ctxFactory();
      if (!ctx) return null;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      bgmBus = ctx.createGain(); bgmBus.gain.value = volBgm; bgmBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = volSfx; sfxBus.connect(master);
      noiseBuf = makeNoiseBuffer(ctx, 1.2);
      return ctx;
    }

    /** 把时间表上某个区间的音符排进 Web Audio 的时钟 */
    function scheduleWindow(slot, fromBeat, toBeat, originTime) {
      const {flat, gain} = slot;
      const ev = flat.events;
      while (slot.idx < ev.length && ev[slot.idx].t < toBeat) {
        const e = ev[slot.idx++];
        if (e.t < fromBeat) continue;
        const when = originTime + (e.t - fromBeat) * flat.spb;
        if (when < ctx.currentTime - 0.05) continue;       // 已经过去了就跳过
        const dur = e.d * flat.spb;
        if (e.midi == null) {
          const v = VOICES[e.voice] || VOICES.hat;
          const hz = DRUM_HZ[e.drum] || 200;
          v(ctx, gain, noiseBuf, when, hz, dur, e.vel);
        } else {
          const v = VOICES[e.voice] || VOICES.lead;
          v(ctx, gain, noiseBuf, when, midiHz(e.midi), dur, e.vel);
        }
      }
    }

    function tick() {
      const slot = current;
      if (!slot || !ctx) return;
      const now = ctx.currentTime;
      const horizon = now + LOOKAHEAD;
      const endBeat = slot.loop ? Infinity : slot.flat.bars * slot.flat.beatsPerBar;
      let windowEnd = (horizon - slot.origin) / slot.flat.spb;
      if (windowEnd > endBeat) windowEnd = endBeat;
      scheduleWindow(slot, 0, Math.max(0, windowEnd), slot.origin);

      if (!slot.loop && now >= slot.origin + slot.flat.loopSeconds) {
        stop();                                            // 不循环的曲子放完就停
        return;
      }
      // 循环：把原点往前推一整首
      if (slot.loop && now >= slot.origin + slot.flat.loopSeconds) {
        slot.origin += slot.flat.loopSeconds;
        slot.idx = 0;
      }
    }

    function stop() {
      if (current && current.timer) clearInterval(current.timer);
      if (faded && faded.timer) clearInterval(faded.timer);
      current = null; faded = null;
    }

    function play(cueId) {
      if (!S || !S.CUES) return false;
      const cue = S.CUES[cueId];
      if (!cue) return false;
      if (current && current.id === cueId) return true;      // 已经在放同一首，不打断
      if (!ensure()) return false;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});

      // 旧的淡出
      if (current) {
        const old = current;
        if (old.timer) clearInterval(old.timer);
        const g = old.gain.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setValueAtTime(g.value, ctx.currentTime);
        g.linearRampToValueAtTime(0.0001, ctx.currentTime + FADE);
        faded = old;
        if (typeof setTimeout === 'function') {
          setTimeout(() => { try { old.gain.disconnect(); } catch (e) {} if (faded === old) faded = null; }, (FADE + 0.1) * 1000);
        }
      }

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(bgmBus);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);

      const slot = {
        id: cueId, cue, flat: flatten(cue), gain,
        idx: 0, origin: ctx.currentTime, timer: null,
        loop: !NO_LOOP[cueId],
      };
      current = slot;
      slot.timer = setInterval(tick, TICK_MS);
      tick();
      return true;
    }

    function sfx(name) {
      if (muted) return false;
      if (!ensure()) return false;
      const f = SFX[name];
      if (!f) return false;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
      f(ctx, sfxBus, noiseBuf, ctx.currentTime + 0.01);
      return true;
    }

    function setVolume(bgm, s) {
      if (bgm != null) volBgm = Math.max(0, Math.min(1, bgm));
      if (s != null) volSfx = Math.max(0, Math.min(1, s));
      if (bgmBus) bgmBus.gain.value = volBgm;
      if (sfxBus) sfxBus.gain.value = volSfx;
    }

    function mute(on) {
      muted = !!on;
      if (master) master.gain.value = muted ? 0 : 1;
      return muted;
    }

    function unlock() {
      const c = ensure();
      if (c && c.state === 'suspended' && c.resume) c.resume().catch(() => {});
      return !!c;
    }

    function state() {
      return {
        ready: !!ctx, cue: current ? current.id : null,
        muted, bgm: volBgm, sfx: volSfx,
        playing: !!(current && current.idx > 0),
      };
    }

    return {play, sfx, setVolume, mute, unlock, state, stop, _ensure: ensure,
            get ctx() { return ctx; }};
  }

  /* ==========================================================================
   *  五、浏览器里的单例 + 自动解锁
   * ======================================================================== */

  const engine = createEngine({});
  let unlockBound = false;

  /** 浏览器要求用户手势后才能出声：第一次点击 / 按键时自动解锁一次 */
  function bindUnlock() {
    if (unlockBound || typeof document === 'undefined' || !document.addEventListener) return;
    unlockBound = true;
    const once = () => {
      engine.unlock();
      document.removeEventListener('pointerdown', once);
      document.removeEventListener('keydown', once);
    };
    document.addEventListener('pointerdown', once);
    document.addEventListener('keydown', once);
  }
  bindUnlock();

  return {
    VERSION,
    play: id => engine.play(id),
    sfx: n => engine.sfx(n),
    setVolume: (b, s) => engine.setVolume(b, s),
    mute: on => engine.mute(on),
    unlock: () => engine.unlock(),
    state: () => engine.state(),
    stop: () => engine.stop(),
    /* 供预览页 / 自检用 */
    createEngine, flatten, VOICES, SFX, SFX_NAMES: Object.keys(SFX),
    CUES: () => (Score && Score.CUES ? Object.keys(Score.CUES) : []),
    CUE_USE: () => (Score && Score.CUE_USE ? Score.CUE_USE : {}),
    VOICE_RANGE, _engine: engine,
  };
});
