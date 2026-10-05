/* ============================================================================
 * 机甲战棋 —— 音乐素材：乐谱数据（唯一真源）
 * ============================================================================
 * 这个文件的地位和 art/mech-icons.js 完全一样：**所有音乐只在这里写一次**，
 * 下游有四个消费者共用它：
 *   1. tools/audio-lab.mjs   离线渲染成 WAV（我做自检用）
 *   2. tools/audio-lab.mjs   导出成 MIDI（你用现成音源听音符本身）
 *   3. 游戏本体              用 Web Audio 在运行时合成 BGM（不打包任何音频文件）
 *   4. audio/preview.html    试听页
 *
 * 所以：改音乐 = 改这个文件，不要去改任何渲染器。
 *
 * ---------------------------------------------------------------------------
 * 版权立场（重要，写在这里防止后人误改）：
 *   本文件里的所有旋律、和声进行、节奏型都是**为本作原创**的。
 *   风格可以借鉴（热血动画歌 / 电吉他+管弦 / 快速定音鼓 / 转调副歌都是公有领域
 *   的音乐语汇），但**不允许**把任何已有歌曲的具体旋律、riff 或乐句抄进来。
 *   如果你自己哼了一段旋律想用，把音高写进这个文件——那段的著作权是你的。
 *
 * 音名约定：'C4' = 中央 C = MIDI 60。'Bb2' = 降 B。
 * 时间约定：t / d 都以**拍**为单位（4/4 拍，1 拍 = 四分音符）。
 * ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MechScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- 音名 → MIDI */
  const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /** 'Bb2' → 46；'C4' → 60 */
  function nm(s) {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(s);
    if (!m) throw new Error('坏音名：' + s);
    let v = STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return v + (parseInt(m[3], 10) + 1) * 12;
  }

  /* ------------------------------------------------------------------ 和弦表 */
  /* 用真实音名写，方便肉眼检查声部有没有写错八度。
     根音统一放在 C3–B3（MIDI 48–59），这样各调的铺底音区一致，
     不会有的调沉在低频里和贝斯打架、有的调又飘太高。
     低音根音与吉他根音都从这张表**推导**出来，不再单独登记 ——
     以前 CHORDS / BASSROOT / GTRROOT 三张表要手工同步，加一个新和弦得改三处，
     漏改就会静默取到 undefined，是 bug 的温床。 */
  const CHORDS = {
    /* 大调三和弦 */
    C:   ['C3', 'E3', 'G3'],
    Db:  ['Db3', 'F3', 'Ab3'],
    D:   ['D3', 'F#3', 'A3'],
    Eb:  ['Eb3', 'G3', 'Bb3'],
    E:   ['E3', 'G#3', 'B3'],
    F:   ['F3', 'A3', 'C4'],
    Gb:  ['Gb3', 'Bb3', 'Db4'],
    G:   ['G3', 'B3', 'D4'],
    Ab:  ['Ab3', 'C4', 'Eb4'],
    A:   ['A3', 'C#4', 'E4'],
    Bb:  ['Bb3', 'D4', 'F4'],
    B:   ['B3', 'D#4', 'F#4'],
    /* 小调三和弦 */
    Cm:  ['C3', 'Eb3', 'G3'],
    Csm: ['C#3', 'E3', 'G#3'],
    Dm:  ['D3', 'F3', 'A3'],
    Ebm: ['Eb3', 'Gb3', 'Bb3'],
    Em:  ['E3', 'G3', 'B3'],
    Fm:  ['F3', 'Ab3', 'C4'],
    Fsm: ['F#3', 'A3', 'C#4'],
    Gm:  ['G3', 'Bb3', 'D4'],
    Gsm: ['G#3', 'B3', 'D#4'],
    Am:  ['A3', 'C4', 'E4'],
    Bbm: ['Bb3', 'Db4', 'F4'],
    Bm:  ['B3', 'D4', 'F#4'],
  };

  /** 把音高整体移八度，塞进 [lo, hi] 区间 */
  function fitOctave(midi, lo, hi) {
    while (midi < lo) midi += 12;
    while (midi > hi) midi -= 12;
    return midi;
  }
  /** 和弦根音（MIDI 音高） */
  function chordRoot(name) {
    const c = CHORDS[name];
    if (!c) throw new Error('未知和弦：' + name);
    return nm(c[0]);
  }
  /** 三和弦 → MIDI 数组。octave 的单位是**八度**（不是半音）。 */
  function chordNotes(name, octave) {
    const c = CHORDS[name];
    if (!c) throw new Error('未知和弦：' + name);
    return c.map((s) => nm(s) + (octave || 0) * 12);
  }
  /** 强力和弦（根音 + 五度 + 八度）→ MIDI 数组。octave 单位是八度。 */
  function powerNotes(name, octave) {
    const r = fitOctave(chordRoot(name), 45, 57);   // E2–A3 附近，节奏吉他最结实的音区
    return [r, r + 7, r + 12].map((v) => v + (octave || 0) * 12);
  }
  /** 低音根音 → MIDI。octave 单位是八度。 */
  function bassNote(name, octave) {
    return fitOctave(chordRoot(name), 28, 43) + (octave || 0) * 12;   // E1–G2 附近
  }

  /* ------------------------------------------------------------------ 剪辑台 */
  const BAR = 4;   // 每小节 4 拍

  function mkTracks() {
    return {
      kick: [], snare: [], hat: [], crash: [], timp: [],
      bass: [], gtr: [], pad: [], lead: [],
      brass: [], bell: [], choir: [],
    };
  }
  /** 加一个事件。bar/beat 都是小节内相对位置，beat 可以是 0.5 这样的值。 */
  function ev(list, bar, beat, dur, n, v, extra) {
    const e = { t: bar * BAR + beat, d: dur, n: n, v: v == null ? 0.85 : v };
    if (extra) Object.assign(e, extra);
    list.push(e);
  }
  /**
   * 用 16 分音符格子写鼓。pat 是 16 个字符，每格 = 1/16 音符。
   * 字符含义由 map 决定：'K' 底鼓、'S' 军鼓、'H' 闭镲、'O' 开镲、'C' 强音镲、'.' 空。
   */
  const DRUM_MAP = { K: ['K', 0.95], S: ['S', 0.85], H: ['H', 0.42], O: ['OH', 0.5], C: ['C', 0.9] };
  function drumGrid(tr, bar, pat) {
    if (pat.length !== 16) throw new Error(`鼓格子必须是 16 格，收到 ${pat.length}：「${pat}」`);
    for (let i = 0; i < 16; i++) {
      const m = DRUM_MAP[pat[i]];
      if (!m) continue;
      /* 强拍（1、3 拍 = 第 0、8 格）的镲略微加重，听感上更有推动力 */
      const v = (pat[i] === 'H' && i % 4 === 0) ? 0.55 : m[1];
      const track = m[0] === 'K' ? tr.kick : m[0] === 'S' ? tr.snare
                  : m[0] === 'C' ? tr.crash : tr.hat;
      ev(track, bar, i * 0.25, 0.25, m[0], v);
    }
  }
  /** 八分音符直线上低音，offsets 是相对根音的半音偏移 */
  function bassLine(tr, bar, chord, offsets) {
    offsets.forEach((semi, i) => {
      const onBeat = i % 2 === 0;
      ev(tr.bass, bar, i * 0.5, 0.5, bassNote(chord) + semi, onBeat ? 0.92 : 0.78);
    });
  }
  /** 铺底和弦垫：一整小节一个长音。octave 单位是八度。 */
  function padBar(tr, bar, chord, octave, v) {
    ev(tr.pad, bar, 0, BAR, chord, v == null ? 0.5 : v, { octave: octave || 0 });
  }
  /** 通用旋律线：notes = [[拍, MIDI 音高, 时值(拍), 力度?], ...] */
  function mel(list, bar, notes) {
    for (const n of notes) ev(list, bar, n[0], n[2], n[1], n[3] == null ? 0.9 : n[3]);
  }
  /**
   * 通用和弦节奏格子。'X' = 短促闷音，'-' = 放响（延音到下一个八分）。
   * 电吉他和铜管都用它 —— 两者的区别只在音色，不在节奏语法。
   */
  function chordGrid(list, bar, chord, pat, octave, vel) {
    if (pat.length !== 16) throw new Error(`和弦格子必须是 16 格，收到 ${pat.length}：「${pat}」`);
    for (let i = 0; i < 16; i++) {
      const c = pat[i];
      if (c !== 'X' && c !== '-') continue;
      const v = (c === '-' ? 0.9 : 0.72) * (vel == null ? 1 : vel);
      ev(list, bar, i * 0.25, c === '-' ? 0.5 : 0.25, chord, v, { octave: octave || 0 });
    }
  }
  /** 电吉他节奏格子 */
  function gtrGrid(tr, bar, chord, pat, octave) { chordGrid(tr.gtr, bar, chord, pat, octave); }
  /** 铜管节奏格子（默认比吉他轻一点，免得盖住主旋律） */
  function brassGrid(tr, bar, chord, pat, octave) { chordGrid(tr.brass, bar, chord, pat, octave, 0.88); }
  /** 主旋律 */
  function lead(tr, bar, notes) { mel(tr.lead, bar, notes); }
  /** 低音线条（显式音高，用于半音下行之类不能靠和弦根音表达的写法） */
  function bassLine2(tr, bar, notes) { mel(tr.bass, bar, notes); }

  /* ==========================================================================
   * 曲目一：战斗（试作）
   * --------------------------------------------------------------------------
   * 调性 D 小调（自然小调），172 BPM —— 热血动画歌的典型速度区间。
   * 和声骨架：i–VI–III–VII（Dm–Bb–F–C），这是"史诗感"最经典的顺阶下行低音。
   * 结构：前奏 2 小节 → A 段 4 小节 → 副歌 4 小节，共 10 小节 ≈ 14 秒。
   * ======================================================================== */
  function buildDemoBattle() {
    const tr = mkTracks();

    const BPM = 172;
    /* 每小节的和弦 */
    const PROG = ['Dm', 'Dm', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb'];

    /* ---- 定音鼓：第 0 小节 16 分音符滚奏（力度渐强），第 1 小节落主音 ---- */
    for (let i = 0; i < 16; i++) {
      ev(tr.timp, 0, i * 0.25, 0.25, nm('A2'), 0.12 + 0.83 * (i / 15));
    }
    ev(tr.timp, 1, 0, 1.0, nm('D2'), 1.0);
    ev(tr.timp, 2, 0, 0.5, nm('D3'), 0.9);
    ev(tr.timp, 5, 3.5, 0.5, nm('A2'), 0.9);     // 副歌前的推进
    ev(tr.timp, 6, 0, 0.75, nm('D3'), 1.0);
    ev(tr.timp, 9, 0, 0.5, nm('A2'), 1.0);

    /* ---- 鼓 ---- */
    drumGrid(tr, 0, '................');                       // 前奏第 0 小节交给定音鼓
    drumGrid(tr, 1, 'K...S.K.K...S...');                       // 全奏进入
    const DRIVE = 'K...S.K.K...S...';
    for (const b of [2, 3, 4]) drumGrid(tr, b, DRIVE);
    drumGrid(tr, 5, 'K...S.K.K...SSSS');                       // A 段末：16 分军鼓过门
    const DOUBLE = 'K.K.S.K.K.K.S.K.';                         // 副歌：双踩
    for (const b of [6, 7, 8]) drumGrid(tr, b, DOUBLE);
    drumGrid(tr, 9, 'K.K.S.K.K.K.SSSS');

    /* ---- 镲：八分音符铺满，每小节最后一格开镲 ---- */
    const hatList = tr.hat;
    for (let b = 1; b <= 9; b++) {
      for (const i of [0, 2, 4, 6, 8, 10]) ev(hatList, b, i * 0.25, 0.25, 'H', i % 8 === 0 ? 0.55 : 0.42);
      ev(hatList, b, 14 * 0.25, 0.25, 'OH', 0.5);
    }
    for (const b of [1, 2, 6, 8]) ev(tr.crash, b, 0, 1, 'C', 0.9);

    /* ---- 低音：八分音符直线，偏移型让线条不平 ---- */
    const BASSLINE = [0, 0, 0, 0, 12, 0, 7, 12];
    for (let b = 1; b <= 9; b++) bassLine(tr, b, PROG[b], BASSLINE);

    /* ---- 电吉他：8 分音符闷音推进；副歌改为 1、3 拍放响 ---- */
    gtrGrid(tr, 0, PROG[0], 'X.......-.......');              // 前奏：大和弦顿音
    for (let b = 1; b <= 4; b++) gtrGrid(tr, b, PROG[b], 'X.X.X.X.X.X.X.X.');
    gtrGrid(tr, 5, PROG[5], 'X.X.X.X.X.X.----');
    for (let b = 6; b <= 9; b++) gtrGrid(tr, b, PROG[b], '-.X.X.X.-.X.X.X.');
    gtrGrid(tr, 9, PROG[9], '-.X.X.X.-.X.X.X.', 1);           // 末小节高八度叠一层（单位：八度）

    /* ---- 铺底：A 段三和弦，副歌叠高八度 ---- */
    for (let b = 1; b <= 5; b++) padBar(tr, b, PROG[b], 0, 0.45);
    for (let b = 6; b <= 9; b++) { padBar(tr, b, PROG[b], 0, 0.5); padBar(tr, b, PROG[b], 1, 0.32); }

    /* ---- 主旋律 ---- */
    lead(tr, 1, [[3.5, 74, 0.5]]);                             // 起句引导音 D5
    lead(tr, 2, [[0, 69, 0.5], [0.5, 74, 0.5], [1, 77, 1], [2, 76, 0.5], [2.5, 74, 0.5], [3, 69, 1]]);
    lead(tr, 3, [[0, 77, 0.5], [0.5, 74, 0.5], [1, 70, 1], [2, 74, 0.5], [2.5, 77, 0.5], [3, 79, 1]]);
    lead(tr, 4, [[0, 81, 2], [2, 79, 0.5], [2.5, 77, 0.5], [3, 76, 1]]);
    lead(tr, 5, [[0, 79, 0.5], [0.5, 76, 0.5], [1, 72, 1], [2, 76, 0.5], [2.5, 79, 0.5], [3, 82, 1]]);
    lead(tr, 6, [[0, 74, 0.5], [0.5, 77, 0.5], [1, 82, 2], [3, 81, 1]]);
    lead(tr, 7, [[0, 79, 0.5], [0.5, 76, 0.5], [1, 84, 2], [3, 82, 1]]);
    lead(tr, 8, [[0, 81, 0.5], [0.5, 77, 0.5], [1, 86, 2], [3, 84, 1]]);
    lead(tr, 9, [[0, 82, 0.5], [0.5, 81, 0.5], [1, 79, 0.5], [1.5, 77, 0.5], [2, 74, 1], [3, 72, 0.5], [3.5, 74, 0.5]]);

    return {
      id: 'demoBattle',
      name: '战斗（试作）',
      bpm: BPM,
      beatsPerBar: BAR,
      bars: 10,
      key: 'Dm',
      chords: PROG,
      sections: [
        { name: '前奏', from: 0, to: 2 },
        { name: 'A段', from: 2, to: 6 },
        { name: '副歌', from: 6, to: 10 },
      ],
      tracks: tr,
    };
  }

  /* ==========================================================================
   * 曲目表：以后加曲子就在这里加一条
   * ======================================================================== */

  /** 整小节持续和弦（铺底与合唱通用）。octave 单位是八度。 */
  function sustain(list, bar, chord, octave, v) {
    ev(list, bar, 0, BAR, chord, v == null ? 0.5 : v, { octave: octave || 0 });
  }
  /** 和弦根音移进定音鼓音区，返回 MIDI 音高 */
  const timpOf = (c) => fitOctave(chordRoot(c), 36, 48);
  /** 造一个曲子对象，省掉每首都写一遍的样板 */
  function cue(id, name, bpm, bars, key, chords, sections, tracks) {
    return { id, name, bpm, beatsPerBar: BAR, bars, key, chords, sections, tracks };
  }

  /* ==========================================================================
   * 曲目二：标题
   * --------------------------------------------------------------------------
   * D 小调，92 BPM，16 小节 ≈ 42 秒。庄严、缓慢、有"引子—呈示—全奏—收束"的过程。
   * 结构：钟声独奏 4 小节 → 弦乐与低音进入 4 小节 → 铜管与人声全奏 6 小节 → 收束 2 小节。
   * 故意不用鼓组 —— 标题曲要的是庄重，不是节奏推进，重量交给定音鼓。
   * ======================================================================== */
  function buildTitle() {
    const tr = mkTracks();
    const P8 = ['Dm', 'Bb', 'F', 'C', 'Gm', 'A', 'Dm', 'A'];
    const P = [...P8, ...P8];      // 16 小节

    /* 引子：钟声独奏，只有弦乐垫在下面（第 2 小节起） */
    mel(tr.bell, 0, [[0, 74, 1.5], [2, 69, 2]]);
    mel(tr.bell, 1, [[0, 70, 1.5], [2, 77, 2]]);
    mel(tr.bell, 2, [[0, 72, 1.5], [2, 81, 2]]);
    mel(tr.bell, 3, [[0, 76, 2], [3, 74, 1]]);
    for (let b = 2; b < 16; b++) padBar(tr, b, P[b], 0, 0.48);

    /* 低音：一个音两拍，根音接五度 —— 圣咏式的沉稳 */
    for (let b = 4; b < 16; b++) {
      const r = bassNote(P[b]);
      mel(tr.bass, b, b === 15 ? [[0, r, 4]] : [[0, r, 2], [2, r + 7, 2]]);
    }
    /* 定音鼓：每小节落一次根音；半终止前加滚奏 */
    for (let b = 4; b < 16; b++) mel(tr.timp, b, [[0, timpOf(P[b]), 1, 0.85]]);
    for (let i = 0; i < 8; i++) mel(tr.timp, 7, [[2 + i * 0.25, timpOf(P[7]), 0.25, 0.3 + i * 0.08]]);
    for (let i = 0; i < 8; i++) mel(tr.timp, 11, [[2 + i * 0.25, timpOf(P[11]), 0.25, 0.3 + i * 0.08]]);

    /* 主旋律：两个乐句，音区不高不低，走的是赞美诗式的级进 */
    mel(tr.lead, 4, [[0, 62, 2], [2, 65, 1], [3, 69, 1]]);
    mel(tr.lead, 5, [[0, 70, 2], [2, 69, 1], [3, 65, 1]]);
    mel(tr.lead, 6, [[0, 67, 2], [2, 65, 1], [3, 64, 1]]);
    mel(tr.lead, 7, [[0, 65, 3], [3, 64, 1]]);
    mel(tr.lead, 8, [[0, 74, 2], [2, 72, 1], [3, 70, 1]]);
    mel(tr.lead, 9, [[0, 73, 2], [2, 76, 1], [3, 69, 1]]);
    mel(tr.lead, 10, [[0, 74, 2], [2, 69, 1], [3, 74, 1]]);
    mel(tr.lead, 11, [[0, 76, 1], [1, 73, 1], [2, 69, 2]]);
    mel(tr.lead, 12, [[0, 77, 2], [2, 74, 1], [3, 70, 1]]);
    mel(tr.lead, 13, [[0, 69, 2], [2, 72, 1], [3, 77, 1]]);
    mel(tr.lead, 14, [[0, 74, 2], [2, 70, 2]]);
    mel(tr.lead, 15, [[0, 69, 4]]);

    /* 铜管：全奏段的和弦柱；最后 4 小节加倍主旋律把曲子推到顶 */
    for (let b = 8; b < 12; b++) brassGrid(tr, b, P[b], '-.......-.......');
    mel(tr.brass, 12, [[0, 77, 2], [2, 74, 1], [3, 70, 1]]);
    mel(tr.brass, 13, [[0, 69, 2], [2, 72, 1], [3, 77, 1]]);
    mel(tr.brass, 14, [[0, 74, 2], [2, 70, 2]]);
    mel(tr.brass, 15, [[0, 69, 4]]);
    /* 人声合唱：全奏段铺在最底下 */
    for (let b = 8; b < 16; b++) sustain(tr.choir, b, P[b], 0, 0.42);
    /* 收尾钟声 */
    mel(tr.bell, 15, [[0, 86, 2], [2, 81, 2]]);

    return cue('title', '标题', 92, 16, 'Dm', P, [
      { name: '引子', from: 0, to: 4 },
      { name: '呈示', from: 4, to: 8 },
      { name: '全奏', from: 8, to: 14 },
      { name: '收束', from: 14, to: 16 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目三：地图 / 战略
   * --------------------------------------------------------------------------
   * G 小调，108 BPM，12 小节 ≈ 27 秒。紧张、克制、留白多 —— 这段是给玩家思考用的，
   * 不能有强烈节奏推进，否则会催人。所以：不用鼓组，镲只给极轻的四分音符，
   * 低音走切分（制造"悬着"的感觉），主旋律一句一停。
   * ======================================================================== */
  function buildMapStrategy() {
    const tr = mkTracks();
    const P = ['Gm', 'Gm', 'Eb', 'Eb', 'Cm', 'Cm', 'D', 'D', 'Gm', 'Eb', 'Cm', 'D'];

    for (let b = 0; b < 12; b++) padBar(tr, b, P[b], 0, 0.36);
    /* 低音：切分，刻意避开强拍，让底下"不稳" */
    for (let b = 0; b < 12; b++) {
      const r = bassNote(P[b]);
      mel(tr.bass, b, [[0, r, 1], [1.5, r, 0.5], [2, r + 7, 1], [3.5, r, 0.5]]);
    }
    /* 镲：极轻的四分音符，只是给时间感 */
    for (let b = 4; b < 12; b++) for (const i of [0, 4, 8, 12]) ev(tr.hat, b, i * 0.25, 0.25, 'H', 0.18);
    /* 定音鼓：每两小节一下，像心跳 */
    for (const b of [0, 2, 4, 6, 8, 10]) mel(tr.timp, b, [[0, timpOf(P[b]), 1, 0.6]]);
    /* 钟声：稀疏的气压层 */
    mel(tr.bell, 0, [[0, 79, 2], [3, 77, 1]]);
    mel(tr.bell, 2, [[0, 75, 2], [3, 72, 1]]);
    mel(tr.bell, 4, [[0, 72, 2], [3, 70, 1]]);
    mel(tr.bell, 6, [[0, 78, 2], [3, 74, 1]]);
    mel(tr.bell, 8, [[0, 79, 3]]);
    mel(tr.bell, 10, [[0, 75, 2], [3, 79, 1]]);
    /* 主旋律：一句一停，问句式的 */
    mel(tr.lead, 0, [[0, 70, 1], [1.5, 74, 0.5], [2, 72, 1]]);
    mel(tr.lead, 1, [[0, 70, 2]]);
    mel(tr.lead, 2, [[0, 75, 1], [1.5, 72, 0.5], [2, 70, 1]]);
    mel(tr.lead, 3, [[0, 67, 2]]);
    mel(tr.lead, 4, [[0, 72, 1], [1.5, 75, 0.5], [2, 75, 1]]);
    mel(tr.lead, 5, [[0, 72, 2]]);
    mel(tr.lead, 6, [[0, 74, 1], [1.5, 78, 0.5], [2, 81, 1]]);
    mel(tr.lead, 7, [[0, 78, 2]]);
    mel(tr.lead, 8, [[0, 70, 1], [1.5, 74, 0.5], [2, 79, 1]]);
    mel(tr.lead, 9, [[0, 75, 2]]);
    mel(tr.lead, 10, [[0, 72, 1], [1.5, 75, 0.5], [2, 79, 1]]);
    mel(tr.lead, 11, [[0, 74, 3]]);
    /* 人声：后半段加入，把气氛压得更沉 */
    for (let b = 8; b < 12; b++) sustain(tr.choir, b, P[b], 0, 0.32);
    ev(tr.crash, 8, 0, 1, 'C', 0.42);

    return cue('mapStrategy', '地图 / 战略', 108, 12, 'Gm', P, [
      { name: 'A段', from: 0, to: 4 },
      { name: 'B段', from: 4, to: 8 },
      { name: 'C段', from: 8, to: 12 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目四：我方回合
   * --------------------------------------------------------------------------
   * C 大调，132 BPM，8 小节 ≈ 15 秒（循环）。明亮、向前、有行进感但不凶。
   * 这是玩家思考和操作时的背景，所以节奏要给推力、旋律要正、不能有压迫感。
   * ======================================================================== */
  function buildAllyPhase() {
    const tr = mkTracks();
    const P = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'];

    for (let b = 0; b < 7; b++) drumGrid(tr, b, 'K...S...K...S...');
    drumGrid(tr, 7, 'K...S...K...SSSS');
    for (let b = 0; b < 8; b++) {
      for (const i of [0, 2, 4, 6, 8, 10, 12, 14]) {
        ev(tr.hat, b, i * 0.25, 0.25, 'H', i % 4 === 0 ? 0.42 : 0.3);
      }
      ev(tr.hat, b, 3.5, 0.25, 'OH', 0.36);
    }
    for (const b of [0, 4]) ev(tr.crash, b, 0, 1, 'C', 0.72);

    for (let b = 0; b < 8; b++) {
      bassLine(tr, b, P[b], [0, 0, 0, 0, 12, 0, 7, 7]);
      gtrGrid(tr, b, P[b], 'X.X.X.X.X.X.X.X.');
      padBar(tr, b, P[b], 0, 0.42);
    }
    /* 铜管：后半段在强拍上给和弦柱，像口号应答 */
    for (let b = 4; b < 8; b++) brassGrid(tr, b, P[b], 'X.......X.......');

    mel(tr.lead, 0, [[0, 72, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 76, 1], [3, 74, 1]]);
    mel(tr.lead, 1, [[0, 74, 1], [1, 71, 0.5], [1.5, 74, 0.5], [2, 79, 2]]);
    mel(tr.lead, 2, [[0, 81, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 1], [3, 74, 1]]);
    mel(tr.lead, 3, [[0, 77, 2], [2, 76, 1], [3, 74, 1]]);
    mel(tr.lead, 4, [[0, 72, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 84, 2]]);
    mel(tr.lead, 5, [[0, 83, 1], [1, 81, 0.5], [1.5, 79, 0.5], [2, 74, 1], [3, 79, 1]]);
    mel(tr.lead, 6, [[0, 81, 2], [2, 79, 1], [3, 77, 1]]);
    mel(tr.lead, 7, [[0, 79, 1], [1, 77, 0.5], [1.5, 76, 0.5], [2, 74, 2]]);
    /* 收尾的钟声上行，给"这一回合干得不错"的暗示 */
    mel(tr.bell, 7, [[3, 84, 0.25], [3.25, 86, 0.25], [3.5, 88, 0.25], [3.75, 91, 0.25]]);

    return cue('allyPhase', '我方回合', 132, 8, 'C', P, [
      { name: 'A段', from: 0, to: 4 },
      { name: 'B段', from: 4, to: 8 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目五：敌方回合
   * --------------------------------------------------------------------------
   * F 小调，126 BPM，8 小节 ≈ 15 秒（循环）。阴暗、有威胁、要让人不自在。
   * 手法：低音走**半音下行**（F→E→Eb→D→C…），人声铺在最底下，
   * 主旋律也是半音下行，全曲没有一处明亮的解决。吉他用低八度弹，更闷更重。
   * ======================================================================== */
  function buildEnemyPhase() {
    const tr = mkTracks();
    const P = ['Fm', 'Fm', 'Db', 'Db', 'Bbm', 'Bbm', 'C', 'C'];

    for (let b = 0; b < 8; b++) {
      drumGrid(tr, b, 'K...S...K...S...');
      for (const i of [0, 4, 8, 12]) ev(tr.hat, b, i * 0.25, 0.25, 'H', 0.22);
      gtrGrid(tr, b, P[b], 'X.X.X.X.X.X.X.X.');          // 不再低八度：Db 会掉到 C#2，低于吉他低音 E2
      padBar(tr, b, P[b], 0, 0.44);
    }
    for (const b of [0, 4]) ev(tr.crash, b, 0, 1, 'C', 0.85);
    /* 定音鼓：每小节落一次，另外在 3、7 小节加推进 */
    for (const b of [0, 2, 4, 6]) mel(tr.timp, b, [[0, timpOf(P[b]), 1.5, 0.9]]);
    mel(tr.timp, 7, [[3, timpOf(P[7]), 0.5, 0.9], [3.5, timpOf(P[7]), 0.5, 1.0]]);

    /* 低音：半音下行，这是整首曲子的"阴气"来源 */
    bassLine2(tr, 0, [[0, 41, 1], [1, 41, 0.5], [1.5, 41, 0.5], [2, 41, 1], [3, 41, 1]]);
    bassLine2(tr, 1, [[0, 41, 1], [1, 40, 0.5], [1.5, 39, 0.5], [2, 38, 1], [3, 36, 1]]);
    bassLine2(tr, 2, [[0, 37, 1], [1, 37, 0.5], [1.5, 37, 0.5], [2, 37, 1], [3, 37, 1]]);
    bassLine2(tr, 3, [[0, 37, 1], [1, 36, 0.5], [1.5, 35, 0.5], [2, 34, 1], [3, 32, 1]]);
    bassLine2(tr, 4, [[0, 34, 1], [1, 34, 0.5], [1.5, 34, 0.5], [2, 34, 1], [3, 34, 1]]);
    bassLine2(tr, 5, [[0, 34, 1], [1, 33, 0.5], [1.5, 32, 0.5], [2, 31, 1], [3, 29, 1]]);
    bassLine2(tr, 6, [[0, 36, 1], [1, 36, 0.5], [1.5, 36, 0.5], [2, 36, 1], [3, 36, 1]]);
    bassLine2(tr, 7, [[0, 36, 1], [1, 38, 0.5], [1.5, 40, 0.5], [2, 41, 1], [3, 43, 1]]);

    /* 人声：后半段进来，压在低音上面制造不祥 */
    for (let b = 4; b < 8; b++) sustain(tr.choir, b, P[b], 0, 0.38);
    mel(tr.bell, 0, [[0, 84, 2, 0.35]]);
    mel(tr.bell, 4, [[0, 82, 2, 0.35]]);

    /* 主旋律：半音下行，句尾都不落主音 */
    mel(tr.lead, 0, [[0, 65, 1], [1, 68, 0.5], [1.5, 65, 0.5], [2, 63, 2]]);
    mel(tr.lead, 1, [[0, 65, 1], [1, 64, 0.5], [1.5, 63, 0.5], [2, 61, 2]]);
    mel(tr.lead, 2, [[0, 61, 1], [1, 65, 0.5], [1.5, 68, 0.5], [2, 70, 2]]);
    mel(tr.lead, 3, [[0, 68, 1], [1, 70, 0.5], [1.5, 68, 0.5], [2, 65, 2]]);
    mel(tr.lead, 4, [[0, 70, 1], [1, 68, 0.5], [1.5, 65, 0.5], [2, 63, 2]]);
    mel(tr.lead, 5, [[0, 65, 1], [1, 63, 0.5], [1.5, 61, 0.5], [2, 58, 2]]);
    mel(tr.lead, 6, [[0, 60, 1], [1, 64, 0.5], [1.5, 67, 0.5], [2, 72, 2]]);
    mel(tr.lead, 7, [[0, 71, 1], [1, 67, 0.5], [1.5, 64, 0.5], [2, 60, 2]]);

    return cue('enemyPhase', '敌方回合', 126, 8, 'Fm', P, [
      { name: 'A段', from: 0, to: 4 },
      { name: 'B段', from: 4, to: 8 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目六：Boss
   * --------------------------------------------------------------------------
   * C 小调，150 BPM，16 小节 ≈ 26 秒。沉重、压迫、有"对面很强"的感觉。
   * 和声骨架 i–VI–iv–V（Cm–Ab–Fm–G）—— 史诗感的经典进行，半音关系带来压迫。
   * 后半段铜管加倍主旋律、人声全程铺底、双踩鼓贯穿，把重量堆到最大。
   * ======================================================================== */
  function buildBoss() {
    const tr = mkTracks();
    const P8 = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G'];
    const P = [...P8, ...P8];

    for (let b = 0; b < 16; b++) {
      drumGrid(tr, b, b === 7 ? 'K.K.S.K.K.K.SSSS' : b === 15 ? 'K.K.S.K.K.K.SSSS' : 'K.K.S.K.K.K.S.K.');
      for (const i of [0, 2, 4, 6, 8, 10, 12, 14]) {
        ev(tr.hat, b, i * 0.25, 0.25, 'H', i % 4 === 0 ? 0.42 : 0.3);
      }
      bassLine(tr, b, P[b], [0, 0, 12, 0, 0, 0, 7, 12]);
      gtrGrid(tr, b, P[b], '-.X.X.X.-.X.X.X.');
      padBar(tr, b, P[b], 0, 0.44);
      sustain(tr.choir, b, P[b], 0, 0.4);
      brassGrid(tr, b, P[b], '-.X.X.X.-.X.X.X.');
    }
    for (const b of [0, 4, 8, 12]) ev(tr.crash, b, 0, 1, 'C', 0.9);
    for (let b = 0; b < 16; b++) mel(tr.timp, b, [[0, timpOf(P[b]), 1, 0.95]]);
    for (let i = 0; i < 8; i++) mel(tr.timp, 7, [[2 + i * 0.25, timpOf(P[7]), 0.25, 0.4 + i * 0.07]]);
    for (let i = 0; i < 8; i++) mel(tr.timp, 15, [[2 + i * 0.25, timpOf(P[15]), 0.25, 0.4 + i * 0.07]]);

    /* 主旋律：两个 8 小节乐句，后半句冲到最高再把重量砸下来 */
    const M = [
      [[0, 72, 1], [1, 75, 0.5], [1.5, 72, 0.5], [2, 70, 2]],
      [[0, 68, 1], [1, 72, 0.5], [1.5, 75, 0.5], [2, 77, 2]],
      [[0, 77, 1], [1, 75, 0.5], [1.5, 72, 0.5], [2, 68, 2]],
      [[0, 71, 1], [1, 74, 0.5], [1.5, 79, 0.5], [2, 74, 2]],
      [[0, 84, 1], [1, 82, 0.5], [1.5, 79, 0.5], [2, 75, 2]],
      [[0, 80, 1], [1, 79, 0.5], [1.5, 75, 0.5], [2, 72, 2]],
      [[0, 79, 1], [1, 77, 0.5], [1.5, 74, 0.5], [2, 70, 2]],
      [[0, 74, 2], [2, 71, 1], [3, 74, 1]],
    ];
    for (let b = 0; b < 16; b++) mel(tr.lead, b, M[b % 8]);
    /* 铜管在后半段加倍主旋律 */
    for (let b = 12; b < 16; b++) mel(tr.brass, b, M[b % 8]);

    return cue('boss', 'Boss', 150, 16, 'Cm', P, [
      { name: 'A段', from: 0, to: 8 },
      { name: 'B段', from: 8, to: 16 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目七：胜利
   * --------------------------------------------------------------------------
   * C 大调，138 BPM，5 小节 ≈ 9 秒。短号角，不循环 —— 打完就切走。
   * 号角动机是"同音重复三次再级进上行"，这是最经典的胜利语汇。
   * ======================================================================== */
  function buildVictory() {
    const tr = mkTracks();
    const P = ['C', 'F', 'G', 'C', 'C'];

    for (let b = 0; b < 3; b++) drumGrid(tr, b, 'K...S...K...S...');
    drumGrid(tr, 3, 'K...S...K...SSSS');
    drumGrid(tr, 4, 'K...............');
    for (let b = 0; b < 4; b++) for (const i of [0, 2, 4, 6, 8, 10, 12, 14]) ev(tr.hat, b, i * 0.25, 0.25, 'H', 0.4);
    for (const b of [0, 3, 4]) ev(tr.crash, b, 0, 1, 'C', 0.85);

    for (let b = 0; b < 4; b++) {
      bassLine(tr, b, P[b], [0, 0, 0, 7, 0, 0, 7, 12]);
      gtrGrid(tr, b, P[b], 'X.X.X.X.X.X.X.X.');
      padBar(tr, b, P[b], 0, 0.42);
    }
    padBar(tr, 4, 'C', 0, 0.5);
    sustain(tr.choir, 3, 'C', 0, 0.4);
    sustain(tr.choir, 4, 'C', 0, 0.42);

    /* 定音鼓：落点和弦根音，第 2 小节末尾加滚奏 */
    for (const b of [0, 1, 2, 3, 4]) mel(tr.timp, b, [[0, timpOf(P[b]), 1, 0.9]]);
    for (let i = 0; i < 8; i++) mel(tr.timp, 2, [[2 + i * 0.25, timpOf(P[2]), 0.25, 0.35 + i * 0.08]]);

    /* 号角旋律：铜管主奏，主旋律轨低八度加倍，钟声在末小节收 */
    mel(tr.brass, 0, [[0, 72, 0.5], [0.5, 72, 0.5], [1, 72, 1], [2, 76, 1], [3, 79, 1]]);
    mel(tr.brass, 1, [[0, 81, 2], [2, 77, 1], [3, 81, 1]]);
    mel(tr.brass, 2, [[0, 83, 1], [1, 81, 0.5], [1.5, 79, 0.5], [2, 86, 2]]);
    mel(tr.brass, 3, [[0, 84, 4]]);
    brassGrid(tr, 4, 'C', '-...............');
    mel(tr.lead, 0, [[0, 60, 0.5], [0.5, 60, 0.5], [1, 60, 1], [2, 64, 1], [3, 67, 1]]);
    mel(tr.lead, 1, [[0, 69, 2], [2, 65, 1], [3, 69, 1]]);
    mel(tr.lead, 2, [[0, 71, 1], [1, 69, 0.5], [1.5, 67, 0.5], [2, 74, 2]]);
    mel(tr.lead, 3, [[0, 72, 4]]);
    mel(tr.lead, 4, [[0, 79, 4]]);
    mel(tr.bell, 3, [[3, 84, 0.25], [3.25, 86, 0.25], [3.5, 88, 0.25], [3.75, 91, 0.25]]);
    sustain(tr.bell, 4, 'C', 1, 0.5);

    return cue('victory', '胜利', 138, 5, 'C', P, [
      { name: '号角', from: 0, to: 3 },
      { name: '收束', from: 3, to: 5 },
    ], tr);
  }

  /* ==========================================================================
   * 曲目八：败北 / 游戏结束
   * --------------------------------------------------------------------------
   * A 小调，76 BPM，8 小节 ≈ 25 秒。沉郁、稀疏、不断下行。
   * 没有鼓组，只有弦乐、人声、低音长音和零星钟声 —— 用"空"来表达失落，
   * 而不是用悲伤的旋律去煽情。最后停在 Am 上，不解决、不释怀。
   * ======================================================================== */
  function buildDefeat() {
    const tr = mkTracks();
    const P = ['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'Am'];

    for (let b = 0; b < 8; b++) {
      padBar(tr, b, P[b], 0, 0.42);
      mel(tr.bass, b, [[0, bassNote(P[b]), 4]]);          // 一小节一个长音
    }
    for (let b = 4; b < 8; b++) sustain(tr.choir, b, P[b], 0, 0.34);
    /* 定音鼓：很轻的心跳，隔一小节一次 */
    for (const b of [0, 2, 4, 6]) mel(tr.timp, b, [[0, timpOf(P[b]), 1, 0.5]]);

    mel(tr.lead, 0, [[0, 69, 2], [2, 72, 2]]);
    mel(tr.lead, 1, [[0, 71, 1], [1, 69, 3]]);
    mel(tr.lead, 2, [[0, 77, 2], [2, 76, 2]]);
    mel(tr.lead, 3, [[0, 74, 1], [1, 72, 3]]);
    mel(tr.lead, 4, [[0, 74, 2], [2, 77, 2]]);
    mel(tr.lead, 5, [[0, 76, 1], [1, 74, 3]]);
    mel(tr.lead, 6, [[0, 71, 2], [2, 68, 2]]);
    mel(tr.lead, 7, [[0, 69, 4]]);
    /* 钟声：只在乐句末尾留一个回声，高八度 */
    mel(tr.bell, 1, [[2, 81, 3, 0.32]]);
    mel(tr.bell, 3, [[1, 84, 3, 0.32]]);
    mel(tr.bell, 5, [[1, 86, 3, 0.32]]);
    mel(tr.bell, 7, [[0, 81, 4, 0.34]]);

    return cue('defeat', '败北 / 游戏结束', 76, 8, 'Am', P, [
      { name: 'A段', from: 0, to: 4 },
      { name: 'B段', from: 4, to: 8 },
    ], tr);
  }

  const CUES = {
    demoBattle: buildDemoBattle(),
    title: buildTitle(),
    mapStrategy: buildMapStrategy(),
    allyPhase: buildAllyPhase(),
    enemyPhase: buildEnemyPhase(),
    boss: buildBoss(),
    victory: buildVictory(),
    defeat: buildDefeat(),
  };

  /* 曲目在游戏里的用途（供 UI 显示；真正的挂接点在游戏代码里） */
  const CUE_USE = {
    demoBattle: '战斗 / 攻击',
    title: '标题画面',
    mapStrategy: '地图 / 战略（部署与思考）',
    allyPhase: '我方回合',
    enemyPhase: '敌方回合',
    boss: 'Boss 战',
    victory: '胜利',
    defeat: '败北 / 游戏结束',
  };

  return {
    VERSION: '0.2.0',
    nm, chordNotes, powerNotes, bassNote, chordRoot, fitOctave,
    CHORDS,
    CUES, CUE_USE,
  };
});
