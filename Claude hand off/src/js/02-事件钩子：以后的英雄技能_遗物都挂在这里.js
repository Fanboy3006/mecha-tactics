/* ---------- 事件钩子：以后的英雄技能 / 遗物都挂在这里 ---------- */
const Hooks = {
  h:{}, labels:[],
  on(ev, fn, label){ (this.h[ev] = this.h[ev] || []).push(fn); if (label) this.labels.push(`${ev} · ${label}`); },
  emit(ev, ctx){ (this.h[ev] || []).forEach(fn => fn(ctx)); return ctx; }
};
/* 音频状态（放在这里是因为开局 startLevel 就会用到；接线代码在文件末尾「音频接线」一节） */
const AU = (typeof MechAudio !== 'undefined') ? MechAudio : null;
const SND_LAST = {};
const SOUND = {on:true, scene:'battle', jingleAt:-1e9, timer:null};
try { SOUND.on = localStorage.getItem('mecha-tactics-sound') !== 'off'; } catch(e){}
let phaseSide = 'ally';

