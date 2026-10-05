/* ============================================================================
 * 角色池 × 美术图标 覆盖率报告
 * ----------------------------------------------------------------------------
 * 角色池要扩到几十个，靠人记「谁还没画图标」是不行的。这个脚本：
 *   1. 启动游戏，从 window.__game.roster 取出**全部单位模板**（含还没出场的）；
 *   2. 和 art/mech-icons.js 的图标表对账；
 *   3. 按「势力 × 战斗分类」打一张覆盖表，并列出缺图标的单位。
 *
 * 用法：node tools/roster.mjs            打报告（缺图标时以非 0 退出，可进 CI）
 *       node tools/roster.mjs --all      连每个单位的图标 id / 调色板一起列出
 * ========================================================================== */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { createRequire } from 'module';
import { createEnv } from './lib/dom.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const Icons = require(join(ROOT, 'art', 'mech-icons.js'));
const showAll = process.argv.includes('--all');

/* ---------- 启动游戏，取单位模板 ---------- */
const env = createEnv({canvas2d: false});
const html = readFileSync(join(ROOT, 'Claude hand off', 'src', 'artifact-fragment.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const ctx = vm.createContext(env.sandbox);
for (let i = 0; i < scripts.length; i++) {
  new vm.Script(scripts[i], {filename: `fragment#script${i}`}).runInContext(ctx);
}
const G = env.sandbox.__game;
if (!G) { console.error('游戏没启动，无法读取单位模板'); process.exit(1); }
const R = G.roster;

/* ---------- 归一化成一条条「单位」 ---------- */
/* kind: 'ally' | 'enemy' | 'form' | 'neutral' */
function collect() {
  const out = [];
  for (const t of R.allies) {
    out.push({kind: 'ally', mech: t.mech, pilot: t.pilot, tags: t.tags || {}, size: `${t.w || 1}×${t.h || 1}`, trait: t.trait, transform: t.transform});
  }
  for (const key of Object.keys(R.enemies)) {
    const t = R.enemies[key];
    out.push({kind: 'enemy', key, mech: t.mech, pilot: t.pilot, tags: t.tags || {}, size: `${t.w || 1}×${t.h || 1}`});
  }
  for (const key of Object.keys(R.forms || {})) {
    const t = R.forms[key];
    out.push({kind: 'form', key, mech: t.name || key, icon: t.icon || null, pilot: '', tags: {}, size: '1×1'});
  }
  out.push({kind: 'neutral', mech: R.debris.mech, pilot: '', tags: {}, size: '1×1'});
  return out;
}
const units = collect();

/* ---------- 对账 ---------- */
const ICON_MAP = Icons.ICON_BY_MECH;
for (const u of units) {
  // 变身形态的图标写在 FORMS 的 icon 字段上，其余按机体名查表
  u.icon = u.icon || ICON_MAP[u.mech] || null;
  u.hasIcon = !!(u.icon && Icons.ids.includes(u.icon));
  u.hasName = !!(u.icon && Icons.NAMES[u.icon]);
  u.faction = u.tags.势力 || (u.kind === 'ally' ? '(未标注)' : '');
  u.role = u.tags.战斗分类 || '';
  u.pal = Icons.FACTION_PAL[u.faction] || (u.kind === 'enemy' ? 'enemy' : u.kind === 'neutral' ? 'rock' : null);
}

const missing = units.filter(u => !u.hasIcon);
const noName = units.filter(u => u.hasIcon && !u.hasName);
const noPal = units.filter(u => u.kind === 'ally' && !u.pal);

/* ---------- 报告 ---------- */
const allies = units.filter(u => u.kind === 'ally');
const enemies = units.filter(u => u.kind === 'enemy');

console.log('角色池 × 美术图标 覆盖率\n');
console.log(`  我方机体 ${allies.length} 台　敌方机体 ${enemies.length} 种　其他 ${units.length - allies.length - enemies.length} 项　合计 ${units.length}`);
console.log(`  已接入图标 ${units.filter(u => u.hasIcon).length} 个　缺少图标 ${missing.length} 个\n`);

/* 势力 × 分类 覆盖表 */
const factions = [...new Set(units.map(u => u.faction).filter(Boolean))];
const roles = [...new Set(units.map(u => u.role).filter(Boolean))];
if (factions.length && roles.length) {
  console.log('势力 × 战斗分类 覆盖表（数字 = 该格单位数，✗ = 有单位但缺图标）');
  const head = ['势力'.padEnd(10), ...roles.map(r => r.padStart(8))].join(' ');
  console.log('  ' + head);
  for (const f of factions) {
    const cells = roles.map(r => {
      const bunch = units.filter(u => u.faction === f && u.role === r);
      if (!bunch.length) return '·'.padStart(8);
      const bad = bunch.filter(u => !u.hasIcon).length;
      return (`${bunch.length}${bad ? ` ✗${bad}` : ''}`).padStart(8);
    });
    console.log('  ' + [String(f).padEnd(10), ...cells].join(' '));
  }
  console.log('');
}

/* 势力 → 调色板 */
console.log('势力 → 调色板');
for (const f of factions) {
  const pal = Icons.FACTION_PAL[f];
  const c = pal && Icons.PAL[pal];
  console.log(`  ${String(f).padEnd(10)} ${pal ? `${pal.padEnd(6)} ${c ? `armor ${c.armor}  accent ${c.accent}` : '⚠ PAL 里没有这套颜色'}` : '✗ 没有登记，会在游戏里回退成 cb（青绿）'}`);
}
console.log('');

/* 战斗分类 → 核心色 */
const usedRoles = [...new Set(units.map(u => u.role).filter(Boolean))];
console.log('战斗分类 → 胸口核心色');
for (const r of usedRoles) {
  console.log(`  ${String(r).padEnd(10)} ${Icons.ROLE_COL[r] || '✗ 没有颜色，会在游戏里回退成势力强调色'}`);
}
console.log('');

if (missing.length) {
  console.log('缺图标的单位（游戏里会**静默退回一个纯色方块/圆**，不会报错）：');
  for (const u of missing) {
    const tag = u.kind === 'form' ? `（变身形态 ${u.key}）` : '';
    console.log(`  ✗ ${u.faction ? `${u.faction} · ` : ''}${u.mech}${u.role ? ` · ${u.role}` : ''}${tag}  ${u.size}`);
  }
  console.log('');
}
if (noName.length) {
  console.log('图标有、但缺中文名的单位（对照表和面板上会显示 id）：');
  for (const u of noName) console.log(`  ✗ ${u.icon}  ${u.mech}`);
  console.log('');
}
if (noPal.length) {
  console.log('我方单位所属势力没有调色板（会回退成 cb 青绿）：');
  for (const u of noPal) console.log(`  ✗ ${u.mech} · 势力「${u.faction}」`);
  console.log('');
}

if (showAll) {
  console.log('全部单位明细');
  for (const u of units) {
    console.log(`  ${u.hasIcon ? '✓' : '✗'} ${String(u.mech).padEnd(10)} ${String(u.faction).padEnd(10)} ${String(u.role).padEnd(6)} ${String(u.pal || '').padEnd(6)} ${u.icon || '—'}`);
  }
  console.log('');
}

const bad = missing.length + noName.length + noPal.length;
if (bad) {
  console.log(`共 ${bad} 项待补。补法：在 art/mech-icons.js 里加图标 + 在 ICON_BY_MECH 登记机体名，`);
  console.log('然后跑 node tools/build-src.mjs 注入游戏。（详见 art/README.md）');
  process.exit(1);
}
console.log('全部单位都有图标、中文名和势力调色板。');
