/* ============================================================================
 * 音频接入层自检
 * ----------------------------------------------------------------------------
 * 我听不见，所以这里验的是**能判定的部分**：
 *   1. 每首曲子都能摊平成音符时间表（不会抛异常、不会空）；
 *   2. 时间单调、时值为正、没有 NaN；
 *   3. **音域检查**：每个声部的音高落在合理范围内（专抓「八度写错」那类荒谬音高）；
 *   4. 和弦音齐不齐（pad / choir 的和弦名要能解析成多个音）；
 *   5. 用一个**假 AudioContext** 跑完整的 play / sfx / setVolume / mute / 切曲流程，
 *      确认不抛异常、节点真的被创建、排程时间在往前走；
 *   6. 接口约定.md 里列的那些 cue 是否都存在。
 *
 * 验不了：好不好听。那只能靠耳朵。
 *
 * 用法：node tools/check-audio.mjs
 * ========================================================================== */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const Score = require(join(ROOT, 'audio', 'score.js'));
const Audio = require(join(ROOT, 'audio', 'mech-audio.js'));

let fails = 0;
const ok = m => console.log('  ✓ ' + m);
const bad = m => { fails++; console.log('  ✗ ' + m); };

/* ====================== 假 AudioContext ====================== */
function fakeCtx() {
  const log = {nodes: 0, starts: 0, ramps: 0, connects: 0, kinds: {}};
  const param = () => ({
    value: 0,
    setValueAtTime() { log.ramps++; return this; },
    linearRampToValueAtTime() { log.ramps++; return this; },
    exponentialRampToValueAtTime() { log.ramps++; return this; },
    cancelScheduledValues() { return this; },
  });
  const node = kind => {
    log.nodes++; log.kinds[kind] = (log.kinds[kind] || 0) + 1;
    const n = {
      _kind: kind,
      connect(d) { log.connects++; return d; },
      disconnect() {},
      start() { log.starts++; },
      stop() {},
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: node('destination'),
    resume() { ctx.state = 'running'; return Promise.resolve(); },
    createGain() { const n = node('gain'); n.gain = param(); return n; },
    createOscillator() {
      const n = node('osc'); n.frequency = param(); n.detune = param(); n.type = 'sine'; return n;
    },
    createBiquadFilter() {
      const n = node('filter'); n.frequency = param(); n.Q = param(); n.gain = param(); n.type = 'lowpass'; return n;
    },
    createWaveShaper() { const n = node('shaper'); n.curve = null; n.oversample = 'none'; return n; },
    createBufferSource() { const n = node('bufsrc'); n.buffer = null; n.playbackRate = param(); return n; },
    createBuffer(ch, len, rate) {
      return {numberOfChannels: ch, length: len, sampleRate: rate,
              getChannelData: () => new Float32Array(len)};
    },
    _log: log,
  };
  return ctx;
}

/* ====================== 1. 摊平 ====================== */
console.log(`音频自检：MechScore v${Score.VERSION} / MechAudio v${Audio.VERSION}\n`);
console.log('[1] 乐谱摊平');

const ids = Object.keys(Score.CUES);
const flats = {};
for (const id of ids) {
  try {
    const f = Audio.flatten(Score.CUES[id]);
    flats[id] = f;
    if (!f.events.length) bad(`${id}：摊平后没有任何音符`);
    else if (!(f.loopSeconds > 0)) bad(`${id}：长度算出来是 ${f.loopSeconds}`);
    else ok(`${id.padEnd(12)} ${String(Score.CUES[id].name || '').padEnd(12)} bpm ${String(f.bpm).padStart(3)} · ${f.bars} 小节 · ${f.events.length} 个音符 · ${f.loopSeconds.toFixed(1)}s`);
  } catch (e) {
    bad(`${id}：摊平抛异常 ${e.message}`);
  }
}

/* ====================== 2. 时间与音高 ====================== */
console.log('\n[2] 时间与音高');
{
  let badTime = 0, badPitch = 0, nanCount = 0;
  const offenders = [];
  for (const [id, f] of Object.entries(flats)) {
    let prev = -Infinity;
    for (const e of f.events) {
      if (!isFinite(e.t) || !isFinite(e.d) || !isFinite(e.vel)) { nanCount++; continue; }
      if (e.t < prev - 1e-9) badTime++;
      prev = e.t;
      if (e.d <= 0) badTime++;
      if (e.midi != null) {
        const r = Audio.VOICE_RANGE[e.voice];
        if (r && (e.midi < r[0] || e.midi > r[1])) {
          badPitch++;
          if (offenders.length < 6) offenders.push(`${id}/${e.voice} midi=${e.midi}（应在 ${r[0]}–${r[1]}）`);
        }
      }
    }
  }
  if (nanCount) bad(`${nanCount} 个事件的数值是 NaN`); else ok('没有 NaN');
  if (badTime) bad(`${badTime} 处时间不单调或时值 ≤ 0`); else ok('时间单调、时值都为正');
  if (badPitch) bad(`${badPitch} 个音符超出该声部音域：\n      ` + offenders.join('\n      '));
  else ok('全部音符都落在各自声部的合理音域内（专抓「八度写错」那类 bug）');
}

/* ====================== 3. 和弦 ====================== */
console.log('\n[3] 和弦解析（pad / choir 的 n 是和弦名，不是音高）');
{
  let chordEvents = 0, multi = 0;
  for (const [id, f] of Object.entries(flats)) {
    for (const e of f.events) {
      if (e.voice === 'pad' || e.voice === 'choir') chordEvents++;
    }
  }
  // 直接验 Score.chordNotes 能把曲子里用到的和弦都解析出来
  const usedChords = new Set();
  for (const id of ids) for (const c of (Score.CUES[id].chords || [])) usedChords.add(c);
  for (const c of usedChords) {
    const ns = Score.chordNotes(c, 0);
    if (!Array.isArray(ns) || ns.length < 2) bad(`和弦「${c}」解析出 ${ns && ns.length} 个音`);
    else multi++;
  }
  ok(`曲子里用到 ${usedChords.size} 个和弦，全部解析出 ≥2 个音（pad/choir 共 ${chordEvents} 个事件）`);
}

/* ====================== 4. 引擎跑一遍 ====================== */
console.log('\n[4] 引擎：假 AudioContext 跑完整流程');
{
  const ctx = fakeCtx();
  const eng = Audio.createEngine({ctxFactory: () => ctx, Score});
  try {
    const r1 = eng.play('allyPhase');
    if (!r1) bad('play(allyPhase) 返回 false');
    else ok(`play(allyPhase) 成功，创建了 ${ctx._log.nodes} 个节点`);
    eng.sfx('hit'); eng.sfx('crit'); eng.sfx('destroy'); eng.sfx('shield'); eng.sfx('lambda');
    ok(`5 个音效播放没有抛异常（节点累计 ${ctx._log.nodes}）`);
    // 推时间，让调度器真的排一批音
    const before = ctx._log.ramps;
    ctx.currentTime += 0.5;
    // 触发一次 tick（引擎内部用 setInterval，这里直接再 play 一次不同曲目）
    eng.play('boss');
    if (ctx._log.ramps <= before) bad('切曲后没有产生新的排程');
    else ok('切曲（交叉淡入）产生新的排程');
    eng.setVolume(0.3, 0.4);
    const st = eng.state();
    if (st.bgm !== 0.3 || st.sfx !== 0.4) bad(`setVolume 没有生效：${JSON.stringify(st)}`);
    else ok('setVolume 生效');
    eng.mute(true);
    if (!eng.state().muted) bad('mute(true) 没生效'); else ok('mute 生效');
    eng.mute(false);
    eng.stop();
    ok('stop() 没有抛异常');
  } catch (e) {
    bad('引擎流程抛异常：' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 3).join('\n'));
  }
}

/* ====================== 5. 接口约定一致性 ====================== */
console.log('\n[5] 与 协作/接口约定.md 的一致性');
{
  const need = ['title', 'mapStrategy', 'allyPhase', 'enemyPhase', 'boss', 'victory', 'defeat'];
  const miss = need.filter(c => !Score.CUES[c]);
  if (miss.length) bad('接口约定里列出的 cue 缺失：' + miss.join('、'));
  else ok(`接口约定里列的 ${need.length} 个 cue 都存在`);

  const sfxNeed = ['hit', 'miss', 'crit', 'destroy', 'shield', 'lambda'];
  const sfxMiss = sfxNeed.filter(s => !Audio.SFX[s]);
  if (sfxMiss.length) bad('缺音效：' + sfxMiss.join('、'));
  else ok(`接口约定提到的音效都有：${sfxNeed.join(' / ')}（另有 ${Audio.SFX_NAMES.filter(s => !sfxNeed.includes(s)).join(' / ')}）`);

  // 对外 API 必须齐
  const api = ['play', 'sfx', 'setVolume', 'mute', 'unlock', 'state', 'stop'];
  const apiMiss = api.filter(k => typeof Audio[k] !== 'function');
  if (apiMiss.length) bad('缺少对外接口：' + apiMiss.join('、'));
  else ok('对外接口齐全：' + api.join(' / '));
}

console.log('\n[6] 试听页 audio/preview.html');
{
  const fs = await import('fs');
  const vm = await import('vm');
  const html = fs.readFileSync(join(ROOT, 'audio', 'preview.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let bad0 = 0;
  scripts.forEach((s, i) => {
    try { new vm.Script(s, {filename: `preview#${i}`}); }
    catch (e) { bad(`preview.html 内联脚本 ${i}: ${e.message}`); bad0++; }
  });
  if (!bad0) ok(`${scripts.length} 段内联脚本语法通过`);

  const used = [...new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
  const miss = used.filter(u => !html.includes('id="' + u + '"'));
  if (miss.length) bad('preview.html 脚本引用了不存在的 id：' + miss.join('、'));
  else ok('脚本引用的元素 id 都存在');

  for (const f of ['score.js', 'mech-audio.js']) {
    if (!html.includes('src="' + f + '"')) bad(`preview.html 没有引用 ${f}`);
  }
  ok('引用了 score.js / mech-audio.js');
}

console.log(fails ? `\n共 ${fails} 项失败` : '\n全部通过（但「好不好听」验不了，那只能靠耳朵）');
process.exit(fails ? 1 : 0);
