/* ============================================================================
 * 把游戏画面渲染成 PNG —— 用游戏**自己的 draw()** 代码，在 Node 里跑出来。
 * ----------------------------------------------------------------------------
 * 为什么：本机沙箱里 headless 浏览器起不来（命名管道被拒），但美术和表现层必须
 * 用眼睛看。于是这里用一个真的 Canvas 2D 实现（tools/lib/canvas2d.mjs）顶替浏览器，
 * 启动单文件游戏、切到指定关卡、跑若干帧，然后把地图画布导出成 PNG。
 *
 * 已知差异（不影响判断美术，但要知道）：
 *   - canvas 上的**文字不会渲染**（要内嵌中文字体才画得出）：
 *     网格坐标数字、浮动伤害数字、「撤离区」标签都看不到。
 *   - 虚线按实线画。
 *   - HTML/CSS 的界面（顶栏、右侧面板）不属于 canvas，本工具不渲染。
 *
 * 用法：node tools/render-game.mjs [关卡id ...]
 * 默认渲染 tut1 / tut3 / defense
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { createEnv } from './lib/dom.mjs';
import { encodePNG } from './lib/raster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'art', 'out');
mkdirSync(OUT, {recursive: true});

const levels = process.argv.slice(2).filter(a => !a.startsWith('-'));

/* 每个关卡跑几帧、要不要做点交互，都写在这 */
const PLAN = {
  tut1:    {frames: 3, click: null},
  tut2:    {frames: 3, click: null},
  tut3:    {frames: 3, click: null},
  defense: {frames: 3, click: null},
  skirmish:{frames: 3, click: null},
};

/* ---------- 启动游戏 ---------- */
const env = createEnv({
  canvas2d: true,
  ss: 3,                    // 超采样倍数（画面小，开高一点更干净）
  devicePixelRatio: 1,
  viewportWidth: 1000,
  viewportHeight: 720,
});

const html = readFileSync(join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const ctxVm = vm.createContext(env.sandbox);
for (let i = 0; i < scripts.length; i++) {
  new vm.Script(scripts[i], {filename: `fragment#script${i}`}).runInContext(ctxVm);
}

const G = env.sandbox.__game;
if (!G) { console.error('游戏没有启动：window.__game 不存在'); process.exit(1); }

/* ---------- 逐关渲染 ---------- */
const targets = levels.length ? levels : ['tut1', 'tut3', 'defense'];
const levelSel = env.getEl('#levelSel');

for (const id of targets) {
  const plan = PLAN[id] || {frames: 3};
  levelSel.value = id;
  levelSel.onchange({target: {value: id}});
  { const b = env.getEl('#btnForm'); if (b && typeof b.onclick === 'function') b.onclick(); }   // v0.17：先过编队界面
  // 画第一帧（地形 + 单位）
  for (let i = 0; i < plan.frames; i++) env.frame();
  const cv = env.canvas;
  const png = cv.toPNG();
  const file = join(OUT, `game-${id}.png`);
  writeFileSync(file, png);
  const units = G.units.length;
  console.log(`✓ ${id}：地图 ${cv.width}×${cv.height}，${units} 个单位 → art/out/game-${id}.png`);
}

/* ---------- 顺带渲染一张「选中机体 + 显示射程」的状态图 ---------- */
try {
  levelSel.value = 'tut2';
  levelSel.onchange({target: {value: 'tut2'}});
  env.frame();
  const ally = G.units.find(u => u.side === 'ally');
  if (ally) {
    G.S.threat = true;
    G.S.threatSet = null;
    env.frame();
    // 直接点一下机体，进入移动范围显示
    G.onTile(ally.x, ally.y);
    env.frame();
    const cv = env.canvas;
    writeFileSync(join(OUT, 'game-tut2-selected.png'), cv.toPNG());
    console.log(`✓ 选中状态（含移动范围）：模式 ${G.S.mode} → art/out/game-tut2-selected.png`);
  }
} catch (e) {
  console.log('· 选中状态渲染跳过：' + e.message);
}

console.log('\n完成。注意：canvas 文字（坐标数字 / 浮动伤害）不会渲染。');
