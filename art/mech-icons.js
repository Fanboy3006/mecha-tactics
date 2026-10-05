/* ============================================================================
 * 机甲战棋 · 机体图标矢量素材  v1
 * ----------------------------------------------------------------------------
 * 这是地图上单位图标的**唯一几何来源**。所有图标都是原创矢量图形，不含外部
 * 图片、不含版权素材，可以随单文件 HTML 一起发布。
 *
 * 【坐标约定】
 *   图标在自己的**单位空间**里描述：左下 (0,0) 到右下 (1,1)。
 *   一个图标会被缩放到「单位占用的格子区域」上（1×1 就是 1 格，2×2 就是 2×2 格）。
 *   y 轴向下，(0.5, 0.1) 是机体的**正面**，所以所有图标都朝上画，
 *   朝向由游戏另外画的朝向标记表示（图标本身不旋转，保证 22px 下形体清晰）。
 *
 * 【绘制指令】四个基础图元，Canvas 后端和离屏光栅化后端都支持：
 *   {t:'p', pts:[[x,y],...], fill, grad, stroke, lw}   多边形
 *   {t:'e', cx, cy, rx, ry,  fill, grad, stroke, lw}   椭圆
 *   {t:'r', x, y, w, h, r,   fill, grad, stroke, lw}   圆角矩形
 *   {t:'s', a:[x,y], b:[x,y], lw, fill}                粗线段（圆头）
 *   fill 可以是颜色字符串，也可以是 grad（渐变），grad 优先。
 *   grad = {g:[[x0,y0],[x1,y1]], st:[[0,c0],[0.5,c1],[1,c2]]}
 *
 * 【调色板】由游戏按「阵营 / 是否已行动」传入，见 PAL。
 * ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MechIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0';

  /* ---------- 调色板 ---------- */

  // 阵营配色：armor 主体装甲 / light 亮面 / dark 暗面 / accent 能量光 / trim 装饰边 / visor 面罩
  const PAL = {
    // 影世界：暗紫 + 奥术辉光
    ying:   {armor:'#5f4f96', light:'#8a6bd8', dark:'#2e2650', accent:'#d9b8ff', trim:'#a98fe0', visor:'#eeddff'},
    // 月球王国：银蓝 + 月光
    moon:   {armor:'#7d92ad', light:'#9fb7d8', dark:'#39475d', accent:'#eaf6ff', trim:'#c2d6ef', visor:'#bfe6ff'},
    // 天人：青绿 + GN 粒子
    cb:     {armor:'#2c7663', light:'#4fc3a1', dark:'#153f35', accent:'#9ff3e0', trim:'#63d6b4', visor:'#b6ffe9'},
    // 敌方：暗红 + 橙黄警示
    enemy:  {armor:'#8c3a32', light:'#d9564b', dark:'#431a15', accent:'#ffcf8a', trim:'#e07a6c', visor:'#ffd8a0'},
    // 已行动：整体去饱和
    acted:  {armor:'#444b56', light:'#6b7480', dark:'#24282f', accent:'#98a2ae', trim:'#79828e', visor:'#a8b2be'},
    // 中立（陨石残骸）
    rock:   {armor:'#5d554e', light:'#8b7f74', dark:'#2f2b27', accent:'#c9b9a8', trim:'#7a6f65', visor:'#c9b9a8'},
    /* v0.17 新势力（Claude 合并时补的占位配色，DSH 在 v0.19 调整了两套）。
     * 底色取自游戏里头像徽章用的 FACTION_COL，保证地图和面板颜色一致。 */
    // 克莱因派：樱粉 + 白　（色相 335°，和其他六套都拉得开）
    clyne:  {armor:'#a85d80', light:'#e88fb4', dark:'#4f2a3d', accent:'#ffe3f0', trim:'#f2b3cf', visor:'#ffd6ea'},
    // 预防者：金黄 + 白　（色相 42°，唯一大面积暖黄）
    prev:   {armor:'#a8822c', light:'#f2c14e', dark:'#4d3a12', accent:'#fff1c4', trim:'#f7d77f', visor:'#fff0b8'},
    /* ATX：近白钢 + 橙红能量。
     * 原来填的是「银白 #c7cfdc」，和月球王国「银蓝 #9fb7d8」**色相几乎一样、明度也接近**，
     * 35px 下两台机体分不出来。改成：亮面推到近白（#e6eaf0，几乎不带蓝）、装甲压暗到中性钢，
     * 靠**明度差**和月球王国拉开；强调色换成橙红（古铁的红黑印象），
     * 这是全七套里唯一的暖红点缀，识别度最高。 */
    atx:    {armor:'#6e7684', light:'#e9e7e2', dark:'#2b3038', accent:'#ff8a5c', trim:'#c6c3bc', visor:'#ffd9c0'},
    /* 秘银（原「米斯里尔」）：军用深橄榄绿 + 沙色。
     * 原来偏亮偏黄绿（#8fb86b），和天人「亮青绿 #4fc3a1」同属绿色区、又是接近的明度。
     * 整体压暗、去饱和，走军用橄榄的路子；强调色从淡绿换成沙色，避免和身体同色。 */
    mithril:{armor:'#54683a', light:'#7d9a58', dark:'#222d17', accent:'#ffd98a', trim:'#8fa970', visor:'#e6dfa4'},
  };

  // 战斗分类的强调色（图标上用来区分定位的小面积点缀）
  const ROLE_COL = {
    近卫:'#ff9a86', 尖兵:'#ffd766', 辅助:'#cfa8ff', 重装:'#8fd0ff',
    狙击:'#ffa8dd', 特种:'#7fe6ff',
    // v0.17：医疗分类已并入辅助（反馈第 15 条）
  };

  /* ---------- 颜色工具 ---------- */

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  function rgb2hex(r, g, b) {
    return '#' + ((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).padStart(6, '0');
  }
  const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b);
    return rgb2hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  // amt > 0 提亮，amt < 0 压暗
  function shade(hex, amt) {
    const c = hex2rgb(hex);
    const f = v => amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return rgb2hex(f(c[0]), f(c[1]), f(c[2]));
  }

  /* ---------- 绘制指令构造器 ---------- */

  function B() {
    const out = [];
    const M = {
      poly(pts, o) { out.push({t:'p', pts, fill:o && o.fill, grad:o && o.grad, stroke:o && o.stroke, lw:o && o.lw, alpha:o && o.alpha}); return M; },
      ell(cx, cy, rx, ry, o) { out.push({t:'e', cx, cy, rx, ry, fill:o && o.fill, grad:o && o.grad, stroke:o && o.stroke, lw:o && o.lw, alpha:o && o.alpha}); return M; },
      rr(x, y, w, h, r, o) { out.push({t:'r', x, y, w, h, r, fill:o && o.fill, grad:o && o.grad, stroke:o && o.stroke, lw:o && o.lw, alpha:o && o.alpha}); return M; },
      seg(a, b, lw, o) { out.push({t:'s', a, b, lw, fill:o && o.fill, alpha:o && o.alpha}); return M; },
      get list() { return out; },
    };
    return M;
  }

  /* ---------- 几何工具 ---------- */

  // 以 x=0.5 为轴镜像一组点（保持环绕方向）
  const mir = pts => pts.map(p => [1 - p[0], p[1]]).reverse();

  // a→b 之间宽度从 w0 收到 w1 的四边形（用来画刀身、炮管、四肢）
  function quad(a, b, w0, w1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    return [
      [a[0] + nx * w0, a[1] + ny * w0],
      [b[0] + nx * w1, b[1] + ny * w1],
      [b[0] - nx * w1, b[1] - ny * w1],
      [a[0] - nx * w0, a[1] - ny * w0],
    ];
  }

  // a→b 沿线段的矩形骨架（两端平头）
  function seg2poly(a, b, w) { return quad(a, b, w / 2, w / 2); }

  // 顶点角度起、逆时针的多边形（角度以「正上方」为 0，顺时针为正）
  function ringPts(cx, cy, rx, ry, n, phase) {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = (phase || 0) + i / n * Math.PI * 2 - Math.PI / 2;
      p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return p;
  }
  const hexPts = (cx, cy, rx, ry, ph) => ringPts(cx, cy, rx, ry, 6, ph);

  // 正多边形（用于炮塔底座等）
  function polyPts(cx, cy, rx, ry, n, ph) { return ringPts(cx, cy, rx, ry, n, ph); }

  /* ---------- 渐变工具 ---------- */

  // 垂直渐变：0 在上，1 在下
  const GY = (c0, c1, mid) => mid
    ? {g:[[0, 0], [0, 1]], st:[[0, c0], [0.5, mid], [1, c1]]}
    : {g:[[0, 0], [0, 1]], st:[[0, c0], [1, c1]]};
  // 沿任意方向
  const GG = (c0, c1, x0, y0, x1, y1) => ({g:[[x0, y0], [x1, y1]], st:[[0, c0], [1, c1]]});

  const STEEL = '#98a4b6', STEEL_HI = '#cdd7e4', STEEL_LO = '#464e5c', GUN = '#2c313b';

  /* ==========================================================================
   *  通用部件
   * ======================================================================== */

  /* SD（超级变形）比例系数：头比写实比例大一圈，四肢更粗。
   * SD 不只是风格问题 —— 大头在缩小之后仍然认得出来，是「小尺寸可读」的关键。
   * 所以这里用**统一系数**放大所有机体的头，而不是逐个图标手调。 */
  const SD_HEAD = 1.45;      // 头部尺寸倍率
  const SD_LIMB = 1.14;      // 四肢粗细倍率

  /* 人型机体核心。
   * o = {bulk:0..1 体重, leg:'biped'|'wide'|'stub'|'none'|'track', skirt:true, pack:0..1}
   * 画完之后各个角色再往上加武器、头部装饰、翅膀等等。
   */
  function core(M, C, o) {
    o = o || {};
    const b = o.bulk == null ? 0.45 : o.bulk;
    const W = 0.132 + 0.046 * b;          // 躯干半宽
    const SW = 0.300 + 0.112 * b;         // 肩部外缘
    const leg = o.leg || 'biped';

    const A = C.armor, AL = C.light, AD = C.dark, AC = C.accent;

    /* 背包 / 推进器（最底层，从肩后探出） */
    if (leg !== 'none') {
      const pw = 0.055 + 0.025 * b;
      for (const s of [1, -1]) {
        const cx = 0.5 + s * (W + 0.045);
        M.poly(quad([cx, 0.44], [cx - s * 0.035, 0.20], pw, pw * 0.75),
          {grad: GY(shade(AD, 0.16), shade(AD, -0.1)), stroke: shade(AD, -0.3), lw: 0.018});
        M.ell(cx - s * 0.035, 0.205, pw * 0.72, pw * 0.5, {fill: AC, alpha: 0.75});
      }
    }

    /* 腿（SD 比例：更短更粗） */
    if (leg === 'biped' || leg === 'wide' || leg === 'stub') {
      const spread = leg === 'wide' ? 0.052 : leg === 'stub' ? 0.028 : 0.030;
      const footY = leg === 'stub' ? 0.80 : 0.876;
      const kneeY = leg === 'stub' ? 0.71 : 0.742;
      const lw = 0.098 * SD_LIMB, fw = 0.108 * SD_LIMB;
      for (const s of [1, -1]) {
        M.poly([[0.5 + s * spread, 0.625], [0.5 + s * (spread + lw), 0.625],
                [0.5 + s * (spread + lw * 0.88), kneeY], [0.5 + s * (spread + 0.014), kneeY]],
          {grad: GY(shade(A, -0.04), shade(AD, 0.12)), stroke: shade(AD, -0.25), lw: 0.018});
        M.poly([[0.5 + s * (spread + 0.012), kneeY], [0.5 + s * (spread + lw * 0.92), kneeY],
                [0.5 + s * (spread + lw * 0.84), footY], [0.5 + s * (spread + 0.004), footY]],
          {grad: GY(shade(A, -0.10), shade(AD, 0.05)), stroke: shade(AD, -0.25), lw: 0.016});
        // 脚
        M.poly([[0.5 + s * (spread - 0.006), footY - 0.012], [0.5 + s * (spread + fw), footY - 0.012],
                [0.5 + s * (spread + fw + 0.010), footY + 0.055], [0.5 + s * (spread - 0.018), footY + 0.055]],
          {grad: GY(shade(AL, -0.18), shade(AD, -0.05)), stroke: shade(AD, -0.35), lw: 0.016});
        // 膝盖亮块
        M.rr(0.5 + s * (spread + 0.020), kneeY - 0.042, 0.062, 0.036, 0.012, {fill: shade(AL, 0.06), alpha: 0.9});
      }
    } else if (leg === 'track') {
      for (const s of [1, -1]) {
        M.rr(0.5 + s * 0.235 - 0.085, 0.60, 0.17, 0.335, 0.075,
          {grad: GY(shade(AD, 0.08), shade(AD, -0.25)), stroke: shade(AD, -0.4), lw: 0.02});
        for (let i = 0; i < 3; i++) {
          M.ell(0.5 + s * 0.235, 0.665 + i * 0.092, 0.052, 0.042, {fill: shade(STEEL_LO, -0.1)});
        }
      }
    }

    /* 髋 / 裙甲 */
    M.poly([[0.5 - 0.104, 0.560], [0.5 + 0.104, 0.560], [0.5 + 0.126, 0.652], [0.5 - 0.126, 0.652]],
      {fill: shade(AD, 0.18), stroke: shade(AD, -0.2), lw: 0.016});
    if (o.skirt !== false) {
      for (const s of [1, -1]) {
        M.poly([[0.5 + s * 0.108, 0.585], [0.5 + s * 0.186, 0.612], [0.5 + s * 0.176, 0.712], [0.5 + s * 0.106, 0.688]],
          {grad: GY(shade(A, -0.06), shade(AD, 0.10)), stroke: shade(AD, -0.25), lw: 0.014});
      }
    }

    /* 手臂（肩到腰，SD 比例：更粗） */
    for (const s of [1, -1]) {
      const ax = 0.5 + s * (W + 0.010);
      M.poly(quad([ax, 0.315], [ax + s * 0.012, 0.520], 0.058 * SD_LIMB, 0.048 * SD_LIMB),
        {grad: GY(shade(A, -0.08), shade(AD, 0.06)), stroke: shade(AD, -0.25), lw: 0.015});
      M.ell(ax + s * 0.012, 0.522, 0.032, 0.030, {fill: shade(AL, -0.25)});
    }

    /* 躯干 */
    M.poly([[0.5 - W * 0.86, 0.298], [0.5 + W * 0.86, 0.298], [0.5 + W, 0.402],
            [0.5 + W * 0.80, 0.578], [0.5 - W * 0.80, 0.578], [0.5 - W, 0.402]],
      {grad: GY(shade(AL, -0.02), shade(AD, 0.14)), stroke: shade(AD, -0.3), lw: 0.02});
    /* 胸甲 */
    M.poly([[0.5 - W * 0.66, 0.320], [0.5 + W * 0.66, 0.320], [0.5 + W * 0.74, 0.452], [0.5 - W * 0.74, 0.452]],
      {grad: GY(shade(AL, 0.16), shade(A, 0.02)), stroke: shade(AD, -0.05), lw: 0.014});
    /* 胸口核心（用「战斗分类」的颜色，是区分定位的主要色彩线索） */
    const KC = C.core || AC;
    M.ell(0.5, 0.428, 0.058, 0.054, {fill: KC, alpha: 0.98});
    M.ell(0.5, 0.428, 0.084, 0.078, {stroke: shade(KC, -0.42), lw: 0.024});
    M.rr(0.5 - W * 0.80, 0.545, W * 1.60, 0.030, 0.012, {fill: shade(AD, 0.30), alpha: 0.9});

    /* 肩甲 */
    for (const s of [1, -1]) {
      const x0 = 0.5 + s * (W * 0.55), x1 = 0.5 + s * SW;
      M.poly([[x0, 0.252], [x1, 0.300], [x1 - s * 0.012, 0.452], [x0 + s * 0.030, 0.472]],
        {grad: GG(shade(AL, 0.10), shade(AD, 0.10), 0.5, 0.25, 0.5 + s * 0.4, 0.5),
         stroke: shade(AD, -0.35), lw: 0.018});
      // 肩部能量线
      M.seg([x0 + s * 0.055, 0.286], [x1 - s * 0.030, 0.322], 0.020, {fill: AC, alpha: 0.85});
    }

    /* 颈 + 头 */
    M.rr(0.5 - 0.042, 0.268, 0.084, 0.048, 0.014, {fill: shade(AD, 0.22)});
    return {W, SW, A, AL, AD, AC};
  }

  /* 头（六棱柱 + 面罩 + 大眼睛），o = {y, rx, ry, crest:bool}
   * rx / ry 会统一乘以 SD_HEAD，所以各处传的比例保持不变，整体一起变大。 */
  function head(M, C, o) {
    o = o || {};
    const cy = o.y == null ? 0.228 : o.y;
    const rx = (o.rx || 0.086) * SD_HEAD, ry = (o.ry || 0.082) * SD_HEAD;
    M.poly(hexPts(0.5, cy, rx, ry, Math.PI / 6),
      {grad: GY(shade(C.light, -0.05), shade(C.armor, -0.05)), stroke: shade(C.dark, -0.3), lw: 0.018});
    // 面罩（正面朝上，所以画在头上半部）
    M.rr(0.5 - rx * 0.80, cy - ry * 0.62, rx * 1.60, ry * 0.50, ry * 0.22,
      {fill: C.visor, alpha: 0.95});
    // 两只发光的眼睛：SD 机体的表情全靠这里，缩小后也是最快认出「这是张脸」的东西
    for (const s of [1, -1]) {
      M.ell(0.5 + s * rx * 0.42, cy - ry * 0.34, rx * 0.24, ry * 0.20,
        {fill: shade(C.visor, 0.55), alpha: 0.95});
    }
    M.rr(0.5 - rx * 0.62, cy - ry * 0.50, rx * 1.24, ry * 0.20, ry * 0.10,
      {fill: shade(C.visor, 0.5), alpha: 0.85});
    if (o.crest) {
      M.poly([[0.5, cy - ry - 0.085], [0.5 + 0.026, cy - ry - 0.004], [0.5 - 0.026, cy - ry - 0.004]],
        {fill: C.accent, alpha: 0.95});
    }
    return {cy, rx, ry};
  }

  /* 手持武器：刀 / 剑 */
  function sword(M, C, a, b, w, glow) {
    M.poly(quad(a, b, w, w * 0.42), {grad: GG(STEEL_HI, STEEL_LO, a[0], a[1], b[0], b[1])});
    M.poly(quad(a, b, w * 0.34, w * 0.16), {fill: glow || C.accent, alpha: 0.9});
    // 尖
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    M.poly([[b[0] + dx / L * w * 1.5, b[1] + dy / L * w * 1.5],
            [b[0] - dy / L * w * 0.5, b[1] + dx / L * w * 0.5],
            [b[0] + dy / L * w * 0.5, b[1] - dx / L * w * 0.5]], {fill: STEEL_HI});
  }

  /* 炮管 */
  function barrel(M, C, a, b, w) {
    M.poly(quad(a, b, w, w * 0.86), {grad: GG(shade(STEEL, 0.25), shade(STEEL_LO, 0.1), a[0], a[1], b[0], b[1]),
      stroke: '#20242c', lw: 0.030});
    // 枪口：只稍微加宽一点，做成环而不是一坨
    M.poly(quad([b[0] - (b[0] - a[0]) * 0.10, b[1] - (b[1] - a[1]) * 0.10], b, w * 1.06, w * 1.02),
      {fill: shade(STEEL_LO, -0.12)});
  }

  /* 能量环（推进器 / 屏障光） */
  function glowRing(M, cx, cy, rx, ry, col, a) {
    M.ell(cx, cy, rx, ry, {stroke: col, lw: 0.026, alpha: a == null ? 0.85 : a});
    M.ell(cx, cy, rx * 0.62, ry * 0.62, {fill: col, alpha: (a == null ? 0.85 : a) * 0.55});
  }

  /* ==========================================================================
   *  我方机体图标（9 + 纳德雷形态）
   * ======================================================================== */

  const BUILD = {};

  /* 雷萨 · B1 — 近卫。单手持长刀高举，刀身带门的紫色辉光。 */
  BUILD.B1 = (M, C, o) => {
    const AC = C.accent;
    const k = core(M, C, {bulk: 0.45, leg: 'biped'});
    head(M, C, {y: 0.232, crest: true});
    // 左肩尖刺
    M.poly([[0.5 - k.W * 0.55, 0.256], [0.5 - k.SW - 0.075, 0.196], [0.5 - k.SW + 0.02, 0.330]],
      {grad: GY(shade(C.light, 0.05), shade(C.dark, 0.1)), stroke: shade(C.dark, -0.35), lw: 0.024});
    // 右手长刀（斜举，够粗才看得见）
    sword(M, C, [0.720, 0.560], [0.892, 0.052], 0.055, AC);
    // 护手
    M.poly([[0.676, 0.556], [0.764, 0.510], [0.792, 0.578], [0.704, 0.624]],
      {fill: shade(C.dark, 0.25), stroke: shade(C.dark, -0.3), lw: 0.022});
    // 左手短刃
    sword(M, C, [0.286, 0.560], [0.170, 0.348], 0.044, AC);
    // 刀光（只在大尺寸画）
    if (o.detail) M.seg([0.770, 0.492], [0.874, 0.116], 0.034, {fill: AC, alpha: 0.40});
  };

  /* 蕾卡 · B2 — 尖兵。低矮宽大的后掠翼飞行框架：剪影是「一架飞机」，
   * 和 B1 的细高剑士完全区分开。 */
  BUILD.B2 = (M, C, o) => {
    const AC = C.accent;
    const KC = C.core || AC;
    // 主翼（大而薄，向侧后方展开，是剪影最主要的特征）
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.076, 0.296], [0.5 + s * 0.458, 0.596], [0.5 + s * 0.432, 0.700], [0.5 + s * 0.084, 0.472]],
        {grad: GG(shade(C.light, 0.18), shade(C.dark, 0.06), 0.5, 0.32, 0.5 + s * 0.46, 0.64),
         stroke: shade(C.dark, -0.45), lw: 0.032});
      // 翼前缘高光
      M.seg([0.5 + s * 0.104, 0.316], [0.5 + s * 0.452, 0.602], 0.028, {fill: AC, alpha: 0.8});
      // 翼尖推进器
      M.poly([[0.5 + s * 0.386, 0.638], [0.5 + s * 0.470, 0.586], [0.5 + s * 0.478, 0.684], [0.5 + s * 0.404, 0.722]],
        {fill: shade(C.dark, 0.28), stroke: shade(C.dark, -0.45), lw: 0.024});
      glowRing(M, 0.5 + s * 0.450, 0.700, 0.070, 0.050, AC, 0.9);
      // 前翼（鸭翼）
      M.poly([[0.5 + s * 0.064, 0.186], [0.5 + s * 0.246, 0.250], [0.5 + s * 0.224, 0.300], [0.5 + s * 0.068, 0.250]],
        {fill: shade(C.light, 0.04), stroke: shade(C.dark, -0.38), lw: 0.024});
    }
    // 机身
    M.poly([[0.5, 0.062], [0.5 + 0.086, 0.238], [0.5 + 0.094, 0.520], [0.5 + 0.076, 0.842],
            [0.5 - 0.076, 0.842], [0.5 - 0.094, 0.520], [0.5 - 0.086, 0.238]],
      {grad: GY(shade(C.light, 0.14), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.45), lw: 0.032});
    // 座舱
    M.ell(0.5, 0.222, 0.048, 0.080, {fill: C.visor, alpha: 0.95});
    // 胸口核心
    M.ell(0.5, 0.452, 0.062, 0.058, {fill: KC, alpha: 0.98});
    M.ell(0.5, 0.452, 0.088, 0.082, {stroke: shade(KC, -0.42), lw: 0.024});
    // 翼根双炮
    barrel(M, C, [0.5 - 0.078, 0.330], [0.5 - 0.118, 0.088], 0.042);
    barrel(M, C, [0.5 + 0.078, 0.330], [0.5 + 0.118, 0.088], 0.042);
    // 收起的起落架 / 腿（保留「这是机体」的读法）
    for (const s of [1, -1]) {
      M.poly(quad([0.5 + s * 0.048, 0.836], [0.5 + s * 0.098, 0.944], 0.052, 0.044),
        {fill: shade(C.armor, -0.10), stroke: shade(C.dark, -0.3), lw: 0.022});
      M.poly([[0.5 + s * 0.046, 0.928], [0.5 + s * 0.152, 0.914], [0.5 + s * 0.164, 0.968], [0.5 + s * 0.038, 0.980]],
        {fill: shade(C.dark, 0.18), stroke: shade(C.dark, -0.35), lw: 0.022});
    }
  };

  /* Feena · M1 — 辅助。长裙 + 头顶光环 + 新月，手持法球，没有武器。 */
  BUILD.M1 = (M, C) => {
    const AC = C.accent;
    // 头顶新月与光环
    M.ell(0.5, 0.150, 0.170, 0.062, {stroke: AC, lw: 0.024, alpha: 0.85});
    M.poly([[0.5, 0.038], [0.575, 0.078], [0.545, 0.092],
            [0.5, 0.104], [0.455, 0.092], [0.425, 0.078]],
      {fill: AC, alpha: 0.95});
    M.ell(0.5, 0.086, 0.150, 0.052, {stroke: AC, lw: 0.014, alpha: 0.45});
    // 裙摆（代替腿）
    M.poly([[0.5 - 0.128, 0.560], [0.5 + 0.128, 0.560], [0.5 + 0.250, 0.918], [0.5 - 0.250, 0.918]],
      {grad: GY(shade(C.light, 0.02), shade(C.dark, 0.10)), stroke: shade(C.dark, -0.3), lw: 0.022});
    // 裙摆纵向褶
    for (const dx of [-0.13, 0, 0.13]) {
      M.poly(quad([0.5 + dx * 0.62, 0.585], [0.5 + dx * 1.55, 0.900], 0.020, 0.030),
        {fill: shade(C.light, 0.22), alpha: 0.55});
    }
    // 躯干与肩
    M.poly([[0.5 - 0.104, 0.300], [0.5 + 0.104, 0.300], [0.5 + 0.132, 0.402],
            [0.5 + 0.126, 0.578], [0.5 - 0.126, 0.578], [0.5 - 0.132, 0.402]],
      {grad: GY(shade(C.light, 0.10), shade(C.armor, 0.04)), stroke: shade(C.dark, -0.25), lw: 0.02});
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.090, 0.276], [0.5 + s * 0.228, 0.312], [0.5 + s * 0.214, 0.420], [0.5 + s * 0.108, 0.418]],
        {grad: GY(shade(C.light, 0.18), shade(C.armor, 0.06)), stroke: shade(C.dark, -0.3), lw: 0.018});
      // 手臂
      M.poly(quad([0.5 + s * 0.150, 0.400], [0.5 + s * 0.196, 0.560], 0.040, 0.034),
        {fill: shade(C.armor, 0.02), stroke: shade(C.dark, -0.2), lw: 0.014});
      // 袖口
      M.poly(quad([0.5 + s * 0.176, 0.520], [0.5 + s * 0.212, 0.620], 0.052, 0.062),
        {fill: shade(C.light, 0.06), alpha: 0.9});
    }
    head(M, C, {y: 0.242, rx: 0.082, ry: 0.080});
    // 法球
    M.ell(0.790, 0.660, 0.062, 0.062, {fill: AC, alpha: 0.8});
    M.ell(0.790, 0.660, 0.092, 0.092, {stroke: AC, lw: 0.016, alpha: 0.5});
    // 胸口月纹
    M.poly([[0.5, 0.372], [0.548, 0.408], [0.528, 0.412], [0.5, 0.418], [0.472, 0.412], [0.452, 0.408]],
      {fill: AC, alpha: 0.9});
  };

  /* 阿布拉德 · M2 — 重装（2×2）。极宽肩甲、右臂巨大打桩机、左侧塔盾。 */
  BUILD.M2 = (M, C) => {
    const AC = C.accent;
    const k = core(M, C, {bulk: 1.0, leg: 'wide'});
    // 超宽肩甲
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.150, 0.218], [0.5 + s * 0.452, 0.276],
              [0.5 + s * 0.436, 0.492], [0.5 + s * 0.166, 0.500]],
        {grad: GG(shade(C.light, 0.14), shade(C.dark, 0.10), 0.5, 0.24, 0.5 + s * 0.44, 0.50),
         stroke: shade(C.dark, -0.35), lw: 0.022});
      // 肩甲分层与铆钉
      M.poly([[0.5 + s * 0.196, 0.252], [0.5 + s * 0.420, 0.300], [0.5 + s * 0.412, 0.352], [0.5 + s * 0.190, 0.310]],
        {fill: shade(C.light, 0.04), alpha: 0.65});
      for (const t of [0.30, 0.56, 0.82]) {
        M.ell(0.5 + s * (0.190 + (0.436 - 0.190) * t), 0.330 + t * 0.120, 0.017, 0.017, {fill: shade(STEEL_HI, -0.1)});
      }
    }
    head(M, C, {y: 0.246, rx: 0.070, ry: 0.066});
    // 右臂打桩机（亮面 + 三段钻头，远远就能认出「重装」）
    M.poly(quad([0.752, 0.448], [0.844, 0.752], 0.122, 0.136),
      {grad: GY(shade(C.armor, 0.22), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.42), lw: 0.030});
    M.rr(0.752, 0.752, 0.122, 0.082, 0.026, {fill: shade(STEEL_HI, -0.12), stroke: '#20242c', lw: 0.022});
    for (let i = 0; i < 3; i++) {
      M.poly([[0.756, 0.830 + i * 0.042], [0.870, 0.830 + i * 0.042], [0.813, 0.886 + i * 0.042]],
        {fill: i % 2 ? shade(STEEL_HI, -0.04) : shade(STEEL_HI, 0.20), stroke: '#20242c', lw: 0.018});
    }
    // 左臂塔盾（亮面 + 粗边）
    M.poly([[0.102, 0.378], [0.268, 0.334], [0.302, 0.762], [0.112, 0.812]],
      {grad: GG(shade(C.light, 0.24), shade(C.dark, 0.14), 0.10, 0.38, 0.30, 0.78),
       stroke: shade(C.dark, -0.46), lw: 0.032});
    M.poly([[0.146, 0.420], [0.252, 0.392], [0.270, 0.514], [0.162, 0.540]], {fill: AC, alpha: 0.55});
    M.seg([0.124, 0.466], [0.290, 0.428], 0.026, {fill: shade(C.light, 0.34), alpha: 0.75});
  };

  /* Iris · M3 — 医疗（飞行）。主体是一块白色医疗舱，上面一个大绿十字，
   * 22px 下也能一眼读出「医疗」。 */
  BUILD.M3 = (M, C, o) => {
    const AC = C.accent, HEAL = '#7de89a', WHITE = '#e6f1ef';
    // 悬浮喷口（在机体下面）
    for (const s of [1, -1]) {
      M.rr(0.5 + s * 0.152 - 0.072, 0.724, 0.144, 0.108, 0.038,
        {grad: GY(shade(STEEL_LO, 0.36), shade(STEEL_LO, -0.06)), stroke: shade(C.dark, -0.32), lw: 0.024});
      glowRing(M, 0.5 + s * 0.152, 0.846, 0.086, 0.044, AC, 0.9);
    }
    // 侧翼
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.110, 0.280], [0.5 + s * 0.372, 0.342], [0.5 + s * 0.354, 0.420], [0.5 + s * 0.114, 0.396]],
        {grad: GY(shade(C.light, 0.20), shade(C.dark, 0.08)), stroke: shade(C.dark, -0.38), lw: 0.028});
      glowRing(M, 0.5 + s * 0.354, 0.382, 0.062, 0.038, AC, 0.9);
    }
    // 主体医疗舱（偏白，医疗单位的识别色）
    M.poly([[0.5 - 0.176, 0.316], [0.5 + 0.176, 0.316], [0.5 + 0.196, 0.552], [0.5 + 0.156, 0.766],
            [0.5 - 0.156, 0.766], [0.5 - 0.196, 0.552]],
      {grad: GY(shade(WHITE, -0.02), shade(C.armor, 0.10)), stroke: shade(C.dark, -0.45), lw: 0.032});
    // 大十字
    M.rr(0.5 - 0.046, 0.368, 0.092, 0.340, 0.026, {fill: HEAL, stroke: '#1d5a39', lw: 0.024});
    M.rr(0.5 - 0.172, 0.484, 0.344, 0.092, 0.026, {fill: HEAL, stroke: '#1d5a39', lw: 0.024});
    // 头
    head(M, C, {y: 0.250, rx: 0.084, ry: 0.078});
    // 修理臂
    M.poly(quad([0.360, 0.420], [0.272, 0.680], 0.066, 0.076), {fill: shade(C.armor, 0.04), stroke: shade(C.dark, -0.32), lw: 0.026});
    // 防身机枪
    barrel(M, C, [0.644, 0.428], [0.744, 0.284], 0.040);
  };

  /* 刹那 · CB1 — 近卫。V 字天线、背后双 GN 剑、双肩 GN 锥。 */
  BUILD.CB1 = (M, C) => {
    const AC = C.accent;
    // 背后展开的双剑（X 形）
    M.poly(quad([0.300, 0.640], [0.086, 0.190], 0.044, 0.020), {grad: GG(STEEL, STEEL_HI, 0.3, 0.6, 0.1, 0.2)});
    M.poly(quad([0.700, 0.640], [0.914, 0.190], 0.044, 0.020), {grad: GG(STEEL, STEEL_HI, 0.7, 0.6, 0.9, 0.2)});
    M.seg([0.300, 0.640], [0.086, 0.190], 0.016, {fill: AC, alpha: 0.75});
    M.seg([0.700, 0.640], [0.914, 0.190], 0.016, {fill: AC, alpha: 0.75});
    const k = core(M, C, {bulk: 0.50, leg: 'biped'});
    head(M, C, {y: 0.236, rx: 0.084, ry: 0.082});
    // V 字天线
    M.poly([[0.5, 0.104], [0.560, 0.186], [0.530, 0.196], [0.5, 0.150]], {fill: AC, alpha: 0.95});
    M.poly([[0.5, 0.104], [0.440, 0.186], [0.470, 0.196], [0.5, 0.150]], {fill: AC, alpha: 0.95});
    M.seg([0.5, 0.100], [0.500, 0.156], 0.022, {fill: shade(AC, -0.15)});
    // 双肩 GN 锥
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * k.W * 0.62, 0.256], [0.5 + s * (k.SW + 0.052), 0.196],
              [0.5 + s * (k.SW + 0.020), 0.336]],
        {grad: GY(shade(C.light, 0.18), shade(C.dark, 0.10)), stroke: shade(C.dark, -0.35), lw: 0.018});
      M.seg([0.5 + s * (k.SW + 0.040), 0.216], [0.5 + s * (k.W * 0.72 + 0.045), 0.300], 0.014, {fill: AC, alpha: 0.8});
    }
    // 右手 GN 剑（剑模式，斜举）
    sword(M, C, [0.712, 0.556], [0.872, 0.104], 0.040, AC);
    // 左手长短刃
    sword(M, C, [0.288, 0.560], [0.170, 0.398], 0.032, AC);
    // 裙甲侧展
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.150, 0.590], [0.5 + s * 0.246, 0.626], [0.5 + s * 0.240, 0.742], [0.5 + s * 0.146, 0.706]],
        {fill: shade(C.armor, 0.08), stroke: shade(C.dark, -0.25), lw: 0.016});
    }
  };

  /* 洛克昂 · CB2 — 狙击。超长狙击枪斜贯整个图标，剪影就是一条对角线，
   * 机体缩到中间偏小，把画面让给枪。 */
  BUILD.CB2 = (M, C, o) => {
    const AC = C.accent;
    const KC = C.core || AC;
    // 机体（蹲姿、小一号）
    const k = core(M, C, {bulk: 0.10, leg: 'stub', skirt: false});
    head(M, C, {y: 0.296, rx: 0.074, ry: 0.070});
    // 肩甲
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * k.W * 0.60, 0.352], [0.5 + s * (k.SW - 0.010), 0.396],
              [0.5 + s * (k.SW - 0.034), 0.500], [0.5 + s * k.W * 0.74, 0.488]],
        {grad: GY(shade(C.light, 0.12), shade(C.armor, 0.02)), stroke: shade(C.dark, -0.38), lw: 0.026});
    }
    // 胸口核心
    M.ell(0.5, 0.446, 0.056, 0.052, {fill: KC, alpha: 0.98});
    // 狙击枪：贯穿全格的对角线
    const A = [0.112, 0.912], B = [0.928, 0.120];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    barrel(M, C, A, B, 0.060);
    // 瞄准镜（沿枪身中段、偏向一侧）
    const mid = [A[0] + dx * 0.42, A[1] + dy * 0.42];
    const off = 0.062;
    const s1 = [mid[0] - ux * 0.095 + nx * off, mid[1] - uy * 0.095 + ny * off];
    const s2 = [mid[0] + ux * 0.095 + nx * off, mid[1] + uy * 0.095 + ny * off];
    barrel(M, C, s1, s2, 0.058);
    M.ell(s2[0] + ux * 0.02, s2[1] + uy * 0.02, 0.030, 0.030, {fill: AC, alpha: 0.95});
    // 弹匣
    M.poly(quad([A[0] + dx * 0.52, A[1] + dy * 0.52], [A[0] + dx * 0.60, A[1] + dy * 0.60], 0.052, 0.052),
      {fill: shade(C.dark, 0.30), stroke: '#20242c', lw: 0.020});
    // 两脚架
    M.poly(quad([A[0] + dx * 0.26, A[1] + dy * 0.26], [0.286, 0.930], 0.026, 0.020), {fill: shade(STEEL_LO, 0.18)});
    M.poly(quad([A[0] + dx * 0.32, A[1] + dy * 0.32], [0.652, 0.930], 0.026, 0.020), {fill: shade(STEEL_LO, 0.18)});
  };

  /* 阿雷路亚 · CB3 — 特种。宽箭头机身 + 正面冲撞板 + 折起的后掠翼。 */
  BUILD.CB3 = (M, C) => {
    const AC = C.accent;
    // 折起后掠翼（向后上方）
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.110, 0.330], [0.5 + s * 0.430, 0.232], [0.5 + s * 0.470, 0.312], [0.5 + s * 0.128, 0.424]],
        {grad: GG(shade(C.light, 0.14), shade(C.dark, 0.10), 0.5, 0.30, 0.5 + s * 0.46, 0.34),
         stroke: shade(C.dark, -0.3), lw: 0.018});
      M.seg([0.5 + s * 0.150, 0.402], [0.5 + s * 0.430, 0.272], 0.014, {fill: AC, alpha: 0.75});
    }
    core(M, C, {bulk: 0.34, leg: 'stub', skirt: false});
    // 正面冲撞板（GN 冲撞）
    M.poly([[0.5 - 0.232, 0.268], [0.5 + 0.232, 0.268], [0.5 + 0.180, 0.148], [0.5 - 0.180, 0.148]],
      {grad: GY(shade(C.light, 0.22), shade(C.armor, 0.06)), stroke: shade(C.dark, -0.35), lw: 0.022});
    M.poly([[0.5 - 0.150, 0.246], [0.5 + 0.150, 0.246], [0.5 + 0.110, 0.176], [0.5 - 0.110, 0.176]],
      {fill: AC, alpha: 0.55});
    head(M, C, {y: 0.108, rx: 0.062, ry: 0.052});
    // 双肩冲锋枪
    barrel(M, C, [0.700, 0.470], [0.760, 0.300], 0.036);
    barrel(M, C, [0.300, 0.470], [0.240, 0.300], 0.036);
  };

  /* 提耶利亚 · CB4 — 特种（德天使）。圆胖重装 + 右肩巨型火箭筒 + 底部 GN 推进锥。
   * 刻意左右不对称，避免和对称的人型机体混在一起。 */
  BUILD.CB4 = (M, C, o) => {
    const AC = C.accent, KC = C.core || AC;
    // 下方 GN 推进锥
    for (const s of [1, -1]) {
      M.poly(quad([0.5 + s * 0.168, 0.630], [0.5 + s * 0.212, 0.884], 0.124, 0.102),
        {grad: GY(shade(C.dark, 0.28), shade(C.dark, -0.14)), stroke: shade(C.dark, -0.42), lw: 0.028});
      glowRing(M, 0.5 + s * 0.220, 0.888, 0.086, 0.042, AC, 0.85);
    }
    // 粗腿
    for (const s of [1, -1]) {
      M.poly(quad([0.5 + s * 0.102, 0.626], [0.5 + s * 0.138, 0.846], 0.152, 0.132),
        {grad: GY(shade(C.armor, 0.06), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.38), lw: 0.028});
    }
    // 右侧巨型火箭筒（长而粗）
    M.rr(0.5 + 0.104, 0.108, 0.196, 0.152, 0.042,
      {fill: shade(C.armor, 0.14), stroke: shade(C.dark, -0.42), lw: 0.028});
    barrel(M, C, [0.5 + 0.204, 0.144], [0.5 + 0.222, 0.022], 0.086);
    // 左侧宽大盾形肩甲
    M.poly([[0.5 - 0.092, 0.326], [0.5 - 0.332, 0.266], [0.5 - 0.354, 0.470], [0.5 - 0.106, 0.502]],
      {grad: GG(shade(C.light, 0.18), shade(C.dark, 0.10), 0.5, 0.28, 0.5 - 0.35, 0.48),
       stroke: shade(C.dark, -0.44), lw: 0.032});
    M.seg([0.5 - 0.150, 0.320], [0.5 - 0.338, 0.290], 0.026, {fill: AC, alpha: 0.75});
    // 圆胖躯干
    M.ell(0.5, 0.472, 0.258, 0.212, {grad: GY(shade(C.light, 0.12), shade(C.dark, 0.18)),
      stroke: shade(C.dark, -0.46), lw: 0.034});
    M.ell(0.5, 0.458, 0.170, 0.142, {fill: shade(C.light, 0.22), alpha: 0.55});
    // 胸口核心
    M.ell(0.5, 0.478, 0.070, 0.066, {fill: KC, alpha: 0.98});
    M.ell(0.5, 0.478, 0.100, 0.094, {stroke: shade(KC, -0.42), lw: 0.028});
    // 头
    head(M, C, {y: 0.298, rx: 0.070, ry: 0.066});
  };

  /* 纳德雷形态 — 细身机体 + 从头部向两侧下方展开的**宽扇形长发缆线**，
   * 变身之后剪影和德天使（圆胖）完全相反，一眼就能看出换了形态。 */
  BUILD.CB4N = (M, C, o) => {
    const AC = C.accent, KC = C.core || AC;
    // 长发状缆线（纳德雷最标志性的剪影）
    const strands = [
      [0.418, 0.058, 0.996, 0.048],
      [0.452, 0.178, 0.968, 0.044],
      [0.482, 0.288, 0.926, 0.040],
      [0.518, 0.712, 0.926, 0.040],
      [0.548, 0.822, 0.968, 0.044],
      [0.582, 0.942, 0.996, 0.048],
    ];
    for (const [x0, x1, y1, w] of strands) {
      M.poly(quad([x0, 0.272], [x1, y1], w, w * 0.34),
        {grad: GY(shade(C.light, 0.14), shade(C.dark, 0.24)), stroke: shade(C.dark, -0.38), lw: 0.022});
    }
    // 细身机体
    core(M, C, {bulk: 0.16, leg: 'biped', skirt: false});
    head(M, C, {y: 0.238, rx: 0.084, ry: 0.084});
    // 头顶长天线
    M.seg([0.5, 0.156], [0.5, 0.042], 0.024, {fill: AC, alpha: 0.9});
    // 右手高举的光束剑（光刃很亮，和 CB1 的实体剑区分）
    M.poly(quad([0.704, 0.564], [0.846, 0.262], 0.046, 0.038),
      {fill: shade(C.dark, 0.22), stroke: shade(C.dark, -0.35), lw: 0.022});
    M.seg([0.846, 0.262], [0.902, 0.100], 0.048, {fill: shade(AC, 0.55), alpha: 0.95});
    M.seg([0.846, 0.262], [0.902, 0.100], 0.024, {fill: '#ffffff', alpha: 0.8});
    // 左手光束手枪
    barrel(M, C, [0.292, 0.494], [0.194, 0.406], 0.040);
  };

  /* ==========================================================================
   *  敌方机体图标（12）
   * ======================================================================== */

  /* 量产机 — 通用步兵：方头单眼、左肩尖刺、斜持突击步枪。 */
  BUILD.grunt = (M, C) => {
    const AC = C.accent;
    const k = core(M, C, {bulk: 0.52, leg: 'biped'});
    // 方头 + 单眼
    M.rr(0.5 - 0.092, 0.138, 0.184, 0.170, 0.030,
      {grad: GY(shade(C.light, -0.06), shade(C.armor, -0.06)), stroke: shade(C.dark, -0.3), lw: 0.02});
    M.rr(0.5 - 0.078, 0.176, 0.156, 0.048, 0.020, {fill: C.visor, alpha: 0.95});
    M.ell(0.5, 0.200, 0.026, 0.026, {fill: AC});
    // 左肩尖刺
    M.poly([[0.5 - k.W * 0.58, 0.260], [0.5 - k.SW - 0.086, 0.176], [0.5 - k.SW + 0.012, 0.336]],
      {grad: GY(shade(C.light, 0.08), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.35), lw: 0.02});
    // 右肩装甲块
    M.poly([[0.5 + k.W * 0.56, 0.256], [0.5 + k.SW - 0.010, 0.300], [0.5 + k.SW - 0.026, 0.446], [0.5 + k.W * 0.70, 0.468]],
      {grad: GY(shade(C.light, 0.04), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.35), lw: 0.02});
    // 突击步枪（斜持）
    barrel(M, C, [0.286, 0.660], [0.752, 0.288], 0.042);
    M.rr(0.474, 0.470, 0.086, 0.100, 0.024, {fill: shade(C.dark, 0.28), stroke: '#20242c', lw: 0.014});
    M.ell(0.316, 0.628, 0.046, 0.042, {fill: shade(C.light, -0.16)});
  };

  /* 猎犬 — 四足步行机：四条腿分居四角（俯视下的四足读法）+ 前伸犬首 + 背上猎枪。 */
  BUILD.hound = (M, C, o) => {
    const AC = C.accent;
    // 四条腿：前两条朝上前方，后两条朝下后方，四角各一条
    for (const [x0, y0, x1, y1] of [[0.336, 0.430, 0.098, 0.282], [0.664, 0.430, 0.902, 0.282],
                                    [0.336, 0.668, 0.116, 0.914], [0.664, 0.668, 0.884, 0.914]]) {
      M.poly(quad([x0, y0], [x1, y1], 0.064, 0.046),
        {fill: shade(C.dark, 0.24), stroke: shade(C.dark, -0.40), lw: 0.024});
      M.ell(x1, y1, 0.054, 0.040, {fill: shade(C.armor, -0.06), stroke: shade(C.dark, -0.32), lw: 0.018});
    }
    // 机体（扁长的六边形躯干）
    M.poly([[0.5 - 0.204, 0.436], [0.5 + 0.204, 0.436], [0.5 + 0.246, 0.562],
            [0.5 + 0.192, 0.690], [0.5 - 0.192, 0.690], [0.5 - 0.246, 0.562]],
      {grad: GY(shade(C.light, -0.02), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.44), lw: 0.030});
    // 前伸的犬首
    M.poly([[0.5 - 0.102, 0.412], [0.5 + 0.102, 0.412], [0.5 + 0.070, 0.226], [0.5 - 0.070, 0.226]],
      {grad: GY(shade(C.light, 0.14), shade(C.armor, -0.04)), stroke: shade(C.dark, -0.44), lw: 0.028});
    M.poly(quad([0.5, 0.240], [0.5, 0.130], 0.104, 0.084),
      {fill: shade(C.armor, -0.16), stroke: shade(C.dark, -0.40), lw: 0.024});
    M.rr(0.5 - 0.082, 0.274, 0.164, 0.050, 0.020, {fill: C.visor, alpha: 0.95});
    // 背上猎枪（偏右，避免和前伸的头叠在一起）
    barrel(M, C, [0.660, 0.478], [0.716, 0.158], 0.054);
    M.ell(0.702, 0.212, 0.036, 0.030, {fill: AC, alpha: 0.9});
    if (o.detail) for (const s of [1, -1]) {
      M.seg([0.5 + s * 0.068, 0.480], [0.5 + s * 0.116, 0.656], 0.022, {fill: AC, alpha: 0.55});
    }
  };

  /* 无人机 — 四旋翼：X 形机架、四个转子舱、中央单眼。 */
  BUILD.drone = (M, C) => {
    const AC = C.accent;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ex = 0.5 + sx * 0.336, ey = 0.5 + sy * 0.336;
      M.poly(quad([0.5 + sx * 0.09, 0.5 + sy * 0.09], [ex, ey], 0.056, 0.048),
        {fill: shade(C.dark, 0.22), stroke: shade(C.dark, -0.3), lw: 0.016});
      // 转子舱
      M.ell(ex, ey, 0.098, 0.094, {grad: GY(shade(C.armor, 0.10), shade(C.dark, 0.06)),
        stroke: shade(C.dark, -0.35), lw: 0.018});
      // 旋翼环
      M.ell(ex, ey, 0.072, 0.068, {stroke: AC, lw: 0.018, alpha: 0.8});
      M.ell(ex, ey, 0.040, 0.038, {fill: shade(C.light, -0.20)});
    }
    // 中央机体
    M.ell(0.5, 0.5, 0.150, 0.142, {grad: GY(shade(C.light, 0.02), shade(C.dark, 0.14)),
      stroke: shade(C.dark, -0.38), lw: 0.022});
    M.ell(0.5, 0.5, 0.096, 0.090, {fill: shade(C.dark, 0.10)});
    // 单眼
    M.ell(0.5, 0.462, 0.048, 0.044, {fill: C.visor, alpha: 0.95});
    M.ell(0.5, 0.462, 0.024, 0.022, {fill: AC});
    M.seg([0.5, 0.404], [0.5, 0.268], 0.016, {fill: AC, alpha: 0.6});
  };

  /* 铁壁 — 占满整格的一堵墙：平顶、通宽、纵向装甲柱 + 正面箭头，没有头也没有腿。
   * 和「盾卫」（有头有腿、举盾）刻意拉开差别。 */
  BUILD.ironwall = (M, C, o) => {
    const AC = C.accent;
    // 基座
    M.rr(0.066, 0.772, 0.868, 0.146, 0.040,
      {grad: GY(shade(STEEL_LO, 0.18), shade(STEEL_LO, -0.20)), stroke: '#1d2027', lw: 0.028});
    // 主装甲板（占满整格宽度）
    M.poly([[0.028, 0.764], [0.972, 0.764], [0.972, 0.146], [0.902, 0.072],
            [0.098, 0.072], [0.028, 0.146]],
      {grad: GY(shade(C.light, -0.02), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.48), lw: 0.034});
    // 两侧纵向装甲柱
    for (const x of [0.132, 0.868]) {
      M.rr(x - 0.040, 0.126, 0.080, 0.600, 0.022,
        {fill: shade(C.armor, 0.12), alpha: 0.9, stroke: shade(C.dark, -0.26), lw: 0.018});
    }
    // 中间的横向装甲带
    M.rr(0.170, 0.574, 0.660, 0.084, 0.020, {fill: shade(C.armor, 0.06), alpha: 0.85, stroke: shade(C.dark, -0.24), lw: 0.016});
    // 正面装甲箭头（说明只减正面伤害）
    M.poly([[0.5 - 0.166, 0.372], [0.5, 0.208], [0.5 + 0.166, 0.372], [0.5 + 0.166, 0.462],
            [0.5, 0.298], [0.5 - 0.166, 0.462]], {fill: AC, alpha: 0.55});
    // 观察缝
    M.rr(0.5 - 0.108, 0.104, 0.216, 0.036, 0.014, {fill: C.visor, alpha: 0.92});
    if (o.detail) {
      for (const x of [0.072, 0.928]) for (const t of [0.24, 0.52, 0.80]) {
        M.ell(x, 0.160 + t * 0.560, 0.022, 0.022, {fill: shade(STEEL_HI, -0.18)});
      }
    }
  };

  /* 突击兵 — 细长机体 + 前刺长枪 + 后掠头鳍。 */
  BUILD.raider = (M, C) => {
    const AC = C.accent;
    const k = core(M, C, {bulk: 0.12, leg: 'biped', skirt: false});
    // 长枪
    M.poly(quad([0.238, 0.712], [0.902, 0.126], 0.040, 0.016), {grad: GG(STEEL_LO, STEEL_HI, 0.24, 0.71, 0.90, 0.13)});
    M.seg([0.238, 0.712], [0.902, 0.126], 0.014, {fill: AC, alpha: 0.8});
    M.poly([[0.660, 0.336], [0.760, 0.300], [0.700, 0.404]], {fill: AC, alpha: 0.7});
    // 头 + 后掠鳍
    head(M, C, {y: 0.240, rx: 0.074, ry: 0.072});
    M.poly([[0.5 - 0.062, 0.196], [0.5 - 0.190, 0.062], [0.5 - 0.098, 0.176], [0.5 - 0.030, 0.196]],
      {fill: shade(C.light, 0.04), stroke: shade(C.dark, -0.3), lw: 0.016});
    M.poly([[0.5 + 0.062, 0.196], [0.5 + 0.190, 0.062], [0.5 + 0.098, 0.176], [0.5 + 0.030, 0.196]],
      {fill: shade(C.light, 0.04), stroke: shade(C.dark, -0.3), lw: 0.016});
    // 肩部小翼
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * k.W * 0.60, 0.268], [0.5 + s * (k.SW + 0.030), 0.318], [0.5 + s * (k.SW - 0.010), 0.404], [0.5 + s * k.W * 0.74, 0.430]],
        {fill: shade(C.armor, 0.06), stroke: shade(C.dark, -0.3), lw: 0.018});
    }
  };

  /* 固定炮台 — 三脚架 + 上仰迫击炮，没有腿。 */
  BUILD.turret = (M, C) => {
    const AC = C.accent;
    // 三脚架
    for (const [x1, y1] of [[0.148, 0.912], [0.852, 0.912], [0.5, 0.936]]) {
      M.poly(quad([0.5, 0.628], [x1, y1], 0.058, 0.042), {fill: shade(STEEL_LO, 0.14), stroke: '#1d2027', lw: 0.018});
      M.ell(x1, y1, 0.052, 0.032, {fill: shade(STEEL_LO, -0.06)});
    }
    // 底座
    M.ell(0.5, 0.620, 0.222, 0.116, {grad: GY(shade(C.armor, 0.12), shade(C.dark, 0.08)),
      stroke: shade(C.dark, -0.4), lw: 0.024});
    M.ell(0.5, 0.596, 0.132, 0.070, {fill: shade(C.dark, 0.22)});
    // 炮座
    M.rr(0.5 - 0.170, 0.398, 0.340, 0.202, 0.040,
      {grad: GY(shade(C.light, 0.02), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.4), lw: 0.024});
    M.rr(0.5 - 0.086, 0.352, 0.172, 0.046, 0.018, {fill: C.visor, alpha: 0.9});
    // 上仰的迫击炮管
    barrel(M, C, [0.474, 0.470], [0.398, 0.080], 0.070);
    glowRing(M, 0.400, 0.092, 0.062, 0.040, AC, 0.6);
    // 弹药箱
    M.rr(0.5 + 0.196, 0.508, 0.156, 0.150, 0.030, {fill: shade(C.dark, 0.30), stroke: '#20242c', lw: 0.018});
    M.seg([0.5 + 0.216, 0.556], [0.5 + 0.332, 0.556], 0.018, {fill: AC, alpha: 0.6});
  };

  /* 盾卫 — 举塔盾的步兵：头盔露在盾上方、双腿露在盾下方，所以和「铁壁」不会混。 */
  BUILD.shield = (M, C, o) => {
    const AC = C.accent;
    // 腿
    for (const s of [1, -1]) {
      M.poly(quad([0.5 + s * 0.074, 0.596], [0.5 + s * 0.110, 0.908], 0.096, 0.084),
        {fill: shade(C.armor, -0.14), stroke: shade(C.dark, -0.30), lw: 0.024});
      M.poly([[0.5 + s * 0.026, 0.884], [0.5 + s * 0.190, 0.884], [0.5 + s * 0.206, 0.952], [0.5 + s * 0.014, 0.952]],
        {fill: shade(C.dark, 0.18), stroke: shade(C.dark, -0.36), lw: 0.024});
    }
    // 躯干
    M.poly([[0.5 - 0.126, 0.286], [0.5 + 0.126, 0.286], [0.5 + 0.144, 0.620], [0.5 - 0.144, 0.620]],
      {grad: GY(shade(C.light, -0.08), shade(C.dark, 0.14)), stroke: shade(C.dark, -0.40), lw: 0.028});
    // 头盔（露在盾牌上方）
    head(M, C, {y: 0.198, rx: 0.088, ry: 0.084});
    // 塔盾（遮住躯干，但上下都露出一点机体）
    M.poly([[0.5 - 0.278, 0.700], [0.5 + 0.278, 0.700], [0.5 + 0.294, 0.352], [0.5 + 0.208, 0.276],
            [0.5 - 0.208, 0.276], [0.5 - 0.294, 0.352]],
      {grad: GY(shade(C.light, 0.08), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.48), lw: 0.036});
    // 盾面纵向棱
    M.poly([[0.5 - 0.058, 0.300], [0.5 + 0.058, 0.300], [0.5 + 0.058, 0.676], [0.5 - 0.058, 0.676]],
      {fill: shade(C.armor, 0.12), alpha: 0.75, stroke: shade(C.dark, -0.22), lw: 0.016});
    // 盾徽
    M.poly([[0.5, 0.380], [0.5 + 0.098, 0.462], [0.5, 0.544], [0.5 - 0.098, 0.462]], {fill: AC, alpha: 0.62});
    M.ell(0.5, 0.462, 0.034, 0.034, {fill: shade(C.dark, 0.36)});
    if (o.detail) {
      for (const t of [0.24, 0.50, 0.76]) {
        M.ell(0.5 - 0.262, 0.336 + t * 0.328, 0.019, 0.019, {fill: shade(STEEL_HI, -0.20)});
        M.ell(0.5 + 0.262, 0.336 + t * 0.328, 0.019, 0.019, {fill: shade(STEEL_HI, -0.20)});
      }
    }
    // 顶视观察口
    M.rr(0.5 - 0.068, 0.298, 0.136, 0.028, 0.010, {fill: C.visor, alpha: 0.85});
  };

  /* 追击炮车 — 履带自行火炮：车体明显比高炮台扁宽，两条履带 + 前倾长炮管，
   * 剪影是「一辆车」，和「固定炮台」的三脚架区分开。 */
  BUILD.pursuer = (M, C, o) => {
    const AC = C.accent;
    // 履带（左右各一条，带负重轮）
    for (const s of [1, -1]) {
      const cx = 0.5 + s * 0.318;
      M.rr(cx - 0.112, 0.286, 0.224, 0.664, 0.100,
        {grad: GY(shade(STEEL_LO, 0.04), shade(STEEL_LO, -0.30)), stroke: '#14171c', lw: 0.030});
      for (let i = 0; i < 5; i++) {
        M.ell(cx, 0.352 + i * 0.140, 0.062, 0.052, {fill: shade(STEEL_LO, 0.12)});
        M.ell(cx, 0.352 + i * 0.140, 0.026, 0.022, {fill: shade(STEEL_LO, -0.24)});
      }
    }
    // 车体（扁而宽）
    M.poly([[0.5 - 0.216, 0.276], [0.5 + 0.216, 0.276], [0.5 + 0.230, 0.560],
            [0.5 + 0.202, 0.876], [0.5 - 0.202, 0.876], [0.5 - 0.230, 0.560]],
      {grad: GY(shade(C.light, -0.02), shade(C.dark, 0.16)), stroke: shade(C.dark, -0.44), lw: 0.030});
    // 前部斜面装甲
    M.poly([[0.5 - 0.216, 0.276], [0.5 + 0.216, 0.276], [0.5 + 0.170, 0.196], [0.5 - 0.170, 0.196]],
      {fill: shade(C.light, 0.10), stroke: shade(C.dark, -0.36), lw: 0.026});
    // 炮管：向前上方倾斜，末端有大型炮口制退器
    const A = [0.5 - 0.030, 0.330], B = [0.5 + 0.096, 0.052];
    barrel(M, C, A, B, 0.076);
    M.rr(B[0] - 0.086, B[1] - 0.030, 0.172, 0.074, 0.022, {fill: shade(STEEL_LO, 0.16), stroke: '#20242c', lw: 0.020});
    // 观察窗
    M.rr(0.5 - 0.120, 0.212, 0.240, 0.042, 0.016, {fill: C.visor, alpha: 0.92});
    // 排气
    glowRing(M, 0.5 + 0.150, 0.860, 0.090, 0.032, AC, 0.6);
    // 警示条
    M.seg([0.5 - 0.150, 0.812], [0.5 + 0.060, 0.812], 0.030, {fill: AC, alpha: 0.55});
  };

  /* 战斗机 — 俯视飞机：尖机首、后掠主翼、双垂尾、尾部喷焰。 */
  BUILD.fighter = (M, C) => {
    const AC = C.accent;
    // 主翼
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.062, 0.320], [0.5 + s * 0.452, 0.646], [0.5 + s * 0.430, 0.742], [0.5 + s * 0.070, 0.598]],
        {grad: GG(shade(C.light, 0.08), shade(C.dark, 0.10), 0.5, 0.45, 0.5 + s * 0.44, 0.70),
         stroke: shade(C.dark, -0.3), lw: 0.02});
      // 翼尖挂架
      M.poly(quad([0.5 + s * 0.330, 0.586], [0.5 + s * 0.392, 0.660], 0.038, 0.030), {fill: shade(STEEL_LO, 0.14)});
      // 尾翼
      M.poly([[0.5 + s * 0.058, 0.706], [0.5 + s * 0.222, 0.856], [0.5 + s * 0.204, 0.906], [0.5 + s * 0.062, 0.812]],
        {fill: shade(C.armor, 0.06), stroke: shade(C.dark, -0.3), lw: 0.016});
    }
    // 机身
    M.poly([[0.5, 0.038], [0.5 + 0.082, 0.280], [0.5 + 0.096, 0.640], [0.5 + 0.074, 0.902],
            [0.5 - 0.074, 0.902], [0.5 - 0.096, 0.640], [0.5 - 0.082, 0.280]],
      {grad: GY(shade(C.light, 0.10), shade(C.dark, 0.12)), stroke: shade(C.dark, -0.36), lw: 0.022});
    // 座舱
    M.ell(0.5, 0.268, 0.048, 0.098, {fill: C.visor, alpha: 0.92});
    // 进气道
    for (const s of [1, -1]) M.poly(quad([0.5 + s * 0.046, 0.430], [0.5 + s * 0.058, 0.600], 0.036, 0.030), {fill: shade(C.dark, 0.26)});
    // 引擎喷焰
    glowRing(M, 0.5, 0.900, 0.084, 0.036, AC, 0.85);
    M.ell(0.5, 0.940, 0.048, 0.034, {fill: AC, alpha: 0.55});
  };

  /* 炮击机 — 自行榴弹炮：方正车体 + 粗短炮管 + 展开的驻锄。 */
  BUILD.artillery = (M, C) => {
    const AC = C.accent;
    // 驻锄（外侧支撑）
    for (const s of [1, -1]) {
      M.poly(quad([0.5 + s * 0.190, 0.640], [0.5 + s * 0.436, 0.836], 0.070, 0.058),
        {fill: shade(STEEL_LO, 0.16), stroke: '#1d2027', lw: 0.018});
      M.poly([[0.5 + s * 0.410, 0.836], [0.5 + s * 0.474, 0.902], [0.5 + s * 0.396, 0.904]], {fill: shade(STEEL_LO, -0.06)});
      // 负重轮
      for (const t of [0.28, 0.55, 0.82]) {
        M.ell(0.5 + s * (0.176 + 0.052), 0.470 + t * 0.400, 0.058, 0.052, {fill: shade(STEEL_LO, 0.06)});
        M.ell(0.5 + s * (0.176 + 0.052), 0.470 + t * 0.400, 0.024, 0.022, {fill: shade(STEEL_LO, -0.24)});
      }
    }
    // 车体
    M.poly([[0.5 - 0.212, 0.372], [0.5 + 0.212, 0.372], [0.5 + 0.198, 0.898], [0.5 - 0.198, 0.898]],
      {grad: GY(shade(C.light, -0.06), shade(C.dark, 0.16)), stroke: shade(C.dark, -0.38), lw: 0.024});
    // 前装甲斜面
    M.poly([[0.5 - 0.212, 0.372], [0.5 + 0.212, 0.372], [0.5 + 0.166, 0.300], [0.5 - 0.166, 0.300]],
      {fill: shade(C.light, 0.08), stroke: shade(C.dark, -0.3), lw: 0.02});
    // 炮塔（偏右）
    M.rr(0.5 - 0.052, 0.318, 0.240, 0.196, 0.044,
      {fill: shade(C.armor, 0.04), stroke: shade(C.dark, -0.4), lw: 0.022});
    // 粗炮管
    barrel(M, C, [0.620, 0.376], [0.780, 0.060], 0.078);
    // 近防机枪
    barrel(M, C, [0.336, 0.446], [0.278, 0.286], 0.030);
    // 观察窗
    M.rr(0.5 - 0.150, 0.410, 0.140, 0.040, 0.016, {fill: C.visor, alpha: 0.9});
    // 排气
    glowRing(M, 0.5, 0.884, 0.108, 0.036, AC, 0.55);
  };

  /* 重装要塞 — 2×2：六角重甲据点 + 双炮塔 + 履带 + 能量屏障。 */
  BUILD.fortress = (M, C) => {
    const AC = C.accent;
    // 履带底盘
    M.rr(0.088, 0.788, 0.824, 0.166, 0.070,
      {grad: GY(shade(STEEL_LO, 0.10), shade(STEEL_LO, -0.26)), stroke: '#16191e', lw: 0.026});
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      M.ell(0.5 + s * 0.300, 0.830 + (i - 1.5) * 0.030, 0.030, 0.036, {fill: shade(STEEL_LO, 0.02)});
    }
    // 主体装甲（六角）
    M.poly([[0.5, 0.062], [0.5 + 0.372, 0.214], [0.5 + 0.442, 0.586], [0.5 + 0.286, 0.822],
            [0.5 - 0.286, 0.822], [0.5 - 0.442, 0.586], [0.5 - 0.372, 0.214]],
      {grad: GY(shade(C.light, -0.02), shade(C.dark, 0.16)), stroke: shade(C.dark, -0.44), lw: 0.030});
    // 内层装甲
    M.poly([[0.5, 0.148], [0.5 + 0.286, 0.266], [0.5 + 0.334, 0.566], [0.5 + 0.216, 0.760],
            [0.5 - 0.216, 0.760], [0.5 - 0.334, 0.566], [0.5 - 0.286, 0.266]],
      {fill: shade(C.armor, 0.04), alpha: 0.85, stroke: shade(C.dark, -0.2), lw: 0.018});
    // 双炮塔
    for (const s of [1, -1]) {
      M.ell(0.5 + s * 0.230, 0.410, 0.146, 0.132,
        {grad: GY(shade(C.light, 0.12), shade(C.dark, 0.06)), stroke: shade(C.dark, -0.42), lw: 0.024});
      barrel(M, C, [0.5 + s * 0.230, 0.392], [0.5 + s * 0.210, 0.098], 0.062);
      glowRing(M, 0.5 + s * 0.230, 0.410, 0.062, 0.056, AC, 0.45);
    }
    // 中央头部
    M.rr(0.5 - 0.098, 0.436, 0.196, 0.116, 0.034, {fill: shade(C.dark, 0.24), stroke: shade(C.dark, -0.4), lw: 0.020});
    M.rr(0.5 - 0.072, 0.456, 0.144, 0.038, 0.014, {fill: C.visor, alpha: 0.95});
    // 胸口屏障发生器
    M.ell(0.5, 0.672, 0.104, 0.064, {fill: AC, alpha: 0.75});
    // 能量屏障（六边形轮廓）
    M.poly(hexPts(0.5, 0.470, 0.500, 0.470, Math.PI / 2), {stroke: AC, lw: 0.028, alpha: 0.40});
    // 角部铆钉
    for (const [x, y] of [[0.14, 0.30], [0.86, 0.30], [0.20, 0.74], [0.80, 0.74]]) {
      M.ell(x, y, 0.030, 0.030, {fill: shade(STEEL_HI, -0.20)});
    }
  };

  /* 指挥舰 — 3×3 飞行 Boss：长舰体 + 舰桥 + 三对炮塔 + 尾部喷焰。 */
  BUILD.flagship = (M, C) => {
    const AC = C.accent;
    // 侧翼稳定鳍
    for (const s of [1, -1]) {
      M.poly([[0.5 + s * 0.230, 0.520], [0.5 + s * 0.470, 0.640], [0.5 + s * 0.462, 0.726], [0.5 + s * 0.226, 0.640]],
        {grad: GG(shade(C.light, 0.04), shade(C.dark, 0.12), 0.5, 0.58, 0.5 + s * 0.46, 0.68),
         stroke: shade(C.dark, -0.35), lw: 0.022});
      glowRing(M, 0.5 + s * 0.452, 0.682, 0.052, 0.062, AC, 0.7);
      // 炮塔（每侧 3 座）
      for (const ty of [0.300, 0.430, 0.560]) {
        M.ell(0.5 + s * 0.196, ty, 0.070, 0.062,
          {grad: GY(shade(C.light, 0.14), shade(C.dark, 0.08)), stroke: shade(C.dark, -0.4), lw: 0.020});
        barrel(M, C, [0.5 + s * 0.196, ty - 0.020], [0.5 + s * 0.352, ty - 0.066], 0.042);
      }
    }
    // 舰体
    M.poly([[0.5, 0.022], [0.5 + 0.170, 0.118], [0.5 + 0.212, 0.400], [0.5 + 0.196, 0.880],
            [0.5 + 0.140, 0.948], [0.5 - 0.140, 0.948], [0.5 - 0.196, 0.880], [0.5 - 0.212, 0.400],
            [0.5 - 0.170, 0.118]],
      {grad: GY(shade(C.light, 0.02), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.45), lw: 0.028});
    // 甲板
    M.poly([[0.5, 0.116], [0.5 + 0.104, 0.196], [0.5 + 0.130, 0.404], [0.5 + 0.116, 0.856],
            [0.5 - 0.116, 0.856], [0.5 - 0.130, 0.404], [0.5 - 0.104, 0.196]],
      {fill: shade(C.armor, 0.06), alpha: 0.9});
    // 舰桥塔
    M.rr(0.5 - 0.090, 0.596, 0.180, 0.244, 0.038,
      {grad: GY(shade(C.light, 0.16), shade(C.dark, 0.06)), stroke: shade(C.dark, -0.42), lw: 0.024});
    M.rr(0.5 - 0.070, 0.628, 0.140, 0.044, 0.016, {fill: C.visor, alpha: 0.95});
    M.rr(0.5 - 0.056, 0.694, 0.112, 0.034, 0.014, {fill: C.visor, alpha: 0.8});
    // 舰首舰炮
    M.ell(0.5, 0.170, 0.086, 0.074, {grad: GY(shade(C.light, 0.18), shade(C.dark, 0.06)),
      stroke: shade(C.dark, -0.42), lw: 0.022});
    barrel(M, C, [0.5, 0.156], [0.5, 0.030], 0.058);
    // 机库线
    for (const s of [1, -1]) M.seg([0.5 + s * 0.070, 0.856], [0.5 + s * 0.070, 0.930], 0.020, {fill: AC, alpha: 0.6});
    // 尾部喷焰
    for (const dx of [-0.104, 0, 0.104]) glowRing(M, 0.5 + dx, 0.946, 0.056, 0.030, AC, 0.85);
  };

  /* 陨石残骸 — 不规则岩块（中立）。 */
  BUILD.debris = (M, C) => {
    M.poly([[0.30, 0.108], [0.672, 0.068], [0.912, 0.322], [0.880, 0.664],
            [0.664, 0.916], [0.318, 0.888], [0.096, 0.606], [0.132, 0.268]],
      {grad: GY(shade(C.light, 0.06), shade(C.dark, 0.18)), stroke: shade(C.dark, -0.35), lw: 0.026});
    // 亮面
    M.poly([[0.30, 0.108], [0.672, 0.068], [0.640, 0.330], [0.256, 0.360]],
      {fill: shade(C.light, 0.22), alpha: 0.7});
    // 陨石坑
    M.ell(0.560, 0.600, 0.116, 0.092, {fill: shade(C.dark, 0.10), stroke: shade(C.dark, -0.2), lw: 0.016});
    M.ell(0.300, 0.680, 0.068, 0.054, {fill: shade(C.dark, 0.10)});
    M.ell(0.720, 0.360, 0.052, 0.044, {fill: shade(C.dark, 0.10)});
  };

  /* ==========================================================================
   *  底板（我方方块 / 敌方圆形，保持原有形状语义）
   * --------------------------------------------------------------------------
   * 底板要**明显比机体暗**，机体才跳得出来；再配一圈阵营色的细边。
   * ======================================================================== */

  /* kind: 'square' | 'circle' | 'none' */
  function platePrims(C, kind, detail) {
    if (kind === 'none' || !kind) return [];
    const M = B();
    const deep = mix(C.dark, '#070910', 0.58);          // 很暗的底
    const deepHi = mix(C.dark, '#0d1220', 0.30);
    const rim = shade(C.light, -0.10);
    const edge = '#05070b';
    if (kind === 'circle') {
      M.ell(0.5, 0.5, 0.474, 0.474, {grad: GG(deepHi, deep, 0.26, 0.18, 0.76, 0.86),
        stroke: edge, lw: 0.060});
      M.ell(0.5, 0.5, 0.452, 0.452, {stroke: rim, lw: 0.030, alpha: 0.85});
    } else {
      M.rr(0.02, 0.015, 0.96, 0.965, 0.155, {grad: GG(deepHi, deep, 0.26, 0.18, 0.76, 0.86),
        stroke: edge, lw: 0.060});
      M.rr(0.062, 0.056, 0.876, 0.876, 0.112, {stroke: rim, lw: 0.030, alpha: 0.85});
    }
    return M.list;
  }

  /* ==========================================================================
   *  几何变换（放大 / 缩小 / 平移整个图标）
   * ======================================================================== */

  function xformPrims(prims, sx, sy, dx, dy) {
    const P = p => [p[0] * sx + dx, p[1] * sy + dy];
    return prims.map(pr => {
      const q = Object.assign({}, pr);
      if (pr.lw != null) q.lw = pr.lw * (sx + sy) / 2;
      if (pr.t === 'p') q.pts = pr.pts.map(P);
      else if (pr.t === 'e') {
        const c = P([pr.cx, pr.cy]);
        q.cx = c[0]; q.cy = c[1]; q.rx = pr.rx * sx; q.ry = pr.ry * sy;
      } else if (pr.t === 'r') {
        const c = P([pr.x, pr.y]);
        q.x = c[0]; q.y = c[1]; q.w = pr.w * sx; q.h = pr.h * sy;
        q.r = (pr.r || 0) * (sx + sy) / 2;
      } else if (pr.t === 's') {
        q.a = P(pr.a); q.b = P(pr.b);
      }
      if (pr.grad) {
        q.grad = { g: pr.grad.g.map(P), st: pr.grad.st.map(s => [s[0], s[1]]) };
      }
      return q;
    });
  }

  /* ==========================================================================
   *  Canvas 后端：把绘制指令画到 2D 上下文上
   * --------------------------------------------------------------------------
   * 坐标按「单位空间」做了一次 ctx.scale(size, size)，所以线宽、渐变都能直接
   * 用单位空间的数值，和 tools/render-art.mjs 的离线光栅化器读同一份数据。
   * ======================================================================== */

  function pathPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function pathRR(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    if (r <= 0) { ctx.rect(x, y, w, h); return; }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function styleOf(ctx, p) {
    if (p.grad) {
      const g = ctx.createLinearGradient(p.grad.g[0][0], p.grad.g[0][1], p.grad.g[1][0], p.grad.g[1][1]);
      for (const s of p.grad.st) g.addColorStop(s[0], s[1]);
      return g;
    }
    return p.fill;
  }

  function drawPrimCanvas(ctx, p) {
    const a = p.alpha == null ? 1 : p.alpha;
    if (a !== 1) ctx.globalAlpha = a;

    if (p.t === 's') {
      ctx.strokeStyle = styleOf(ctx, p);
      ctx.lineWidth = p.lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.a[0], p.a[1]);
      ctx.lineTo(p.b[0], p.b[1]);
      ctx.stroke();
    } else {
      if (p.t === 'p') pathPoly(ctx, p.pts);
      else if (p.t === 'e') { ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2); ctx.closePath(); }
      else if (p.t === 'r') pathRR(ctx, p.x, p.y, p.w, p.h, p.r || 0);
      if (p.fill || p.grad) { ctx.fillStyle = styleOf(ctx, p); ctx.fill(); }
      if (p.stroke && p.lw) {
        ctx.strokeStyle = p.stroke; ctx.lineWidth = p.lw;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    if (a !== 1) ctx.globalAlpha = 1;
  }

  /* 把一组绘制指令画到 (x, y) 为左上角、边长 size 的方框里 */
  function draw(ctx, prims, size, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    for (const p of prims) drawPrimCanvas(ctx, p);
    ctx.restore();
  }

  /* 把一组绘制指令变成纯色「剪影」，只用来描外轮廓 */
  function silhouette(prims, color) {
    return prims.map(p => {
      const q = Object.assign({}, p);
      q.grad = null;
      if (p.fill || p.grad) q.fill = color;
      if (p.stroke) q.stroke = color;
      return q;
    });
  }

  /* 预渲染成离屏 canvas。
   * 画布**不是正方形**：单位空间的 1×1（图标盒）放在画布**底部**的正方形区域里，
   * 上方留一点余量，这样机体可以「高出格子」站在格子上（像 SD 高达那样），
   * 而不是被硬塞进一格。
   *   boxPx        图标盒的渲染边长（像素）
   *   opts.headroom 上方额外余量，占图标盒的比例（默认 0.08）
   *   opts.size     图标的**显示**尺寸，用来决定细节等级
   *   opts.outline  外描边颜色（建议开启，见 build 的说明）
   */
  function makeSprite(id, opts, boxPx) {
    opts = opts || {};
    const box = Math.max(8, Math.round(boxPx || 96));
    const hr = opts.headroom == null ? 0.08 : opts.headroom;
    const W = box, H = Math.round(box * (1 + hr));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const prims = build(id, Object.assign({}, opts, {size: opts.size || box}));
    draw(g, prims, box, 0, H - box);        // 图标盒底部对齐画布底部
    return cv;
  }

  /* ==========================================================================
   *  光照后处理：统一光轴 + 两段硬边的赛璐璐明暗
   * --------------------------------------------------------------------------
   * 原来每个图元自己带一个渐变，方向各不相同，看起来就像「各画各的」。
   * 这里把所有渐变重做成**同一根光轴上的两段硬边明暗**：
   *   - 光源固定在左上方（LIGHT 指向光源）；
   *   - 明暗分界线（terminator）是全体共用的一个位置，所以整个机体像被同一盏灯照着；
   *   - 分界线是硬的（中间没有过渡），这是赛璐璐上色的关键特征；
   *   - 颜色仍然取自原来渐变的明暗两端，所以不同材质的色相不会串。
   * 纯色填充（能量光、面罩、贴花）不动。
   * ======================================================================== */

  const LIGHT = {x: -0.55, y: -0.835};        // 指向光源

  function lum(hex) {
    const c = hex2rgb(hex);
    return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
  }

  /* 图元在单位空间里的代表点与范围（只用于决定明暗分界） */
  function primPts(p) {
    if (p.t === 'p') return p.pts;
    if (p.t === 'e') return [[p.cx - p.rx, p.cy - p.ry], [p.cx + p.rx, p.cy - p.ry],
                             [p.cx - p.rx, p.cy + p.ry], [p.cx + p.rx, p.cy + p.ry]];
    if (p.t === 'r') return [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]];
    if (p.t === 's') return [p.a, p.b];
    return [[0.5, 0.5]];
  }

  function celShade(prims) {
    // 1) 先求全体沿光轴的投影范围，再定下一个共用的明暗分界线
    let lo = Infinity, hi = -Infinity;
    for (const p of prims) {
      if (!p.grad) continue;
      for (const q of primPts(p)) {
        const t = q[0] * LIGHT.x + q[1] * LIGHT.y;
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
    }
    if (!isFinite(lo) || hi - lo < 1e-6) return prims;
    const term = lo + (hi - lo) * 0.54;        // 分界线：略偏向暗侧，主体更亮

    return prims.map(p => {
      if (!p.grad) return p;
      const pts = primPts(p);
      let pLo = Infinity, pHi = -Infinity, vLo = null, vHi = null;
      for (const q of pts) {
        const t = q[0] * LIGHT.x + q[1] * LIGHT.y;
        if (t < pLo) { pLo = t; vLo = q; }
        if (t > pHi) { pHi = t; vHi = q; }
      }
      if (pHi - pLo < 1e-6) return p;

      // 2) 明暗两端取原渐变里最亮 / 最暗的颜色，保住材质色相
      let lit = null, dark = null, lMax = -1, lMin = 2;
      for (const s of p.grad.st) {
        const L = lum(s[1]);
        if (L > lMax) { lMax = L; lit = s[1]; }
        if (L < lMin) { lMin = L; dark = s[1]; }
      }
      if (!lit || !dark || lit === dark) return p;
      // 压成两段：亮面稍微提亮，暗面压得更暗，对比拉大才有赛璐璐味
      const LIT = shade(lit, 0.10);
      const DRK = mix(shade(dark, -0.22), dark, 0.35);

      // 3) 分界线在这块图元上的参数位置
      const frac = (term - pLo) / (pHi - pLo);        // 0 = 全暗，1 = 全亮
      const q = Object.assign({}, p);
      if (frac <= 0) {                                 // 整块在暗面
        q.grad = null; q.fill = DRK;
      } else if (frac >= 1) {                          // 整块在亮面
        q.grad = null; q.fill = LIT;
      } else {
        // 硬边：把两个 stop 放在同一位置
        const b = +(1 - frac).toFixed(4);
        q.grad = {g: [vLo, vHi], st: b <= 0.001 ? [[0, LIT], [1, LIT]]
          : b >= 0.999 ? [[0, DRK], [1, DRK]]
          : [[0, DRK], [b, DRK], [b, LIT], [1, LIT]]};
        q.fill = null;
      }
      return q;
    });
  }

  /* ==========================================================================
   *  对外接口
   * ======================================================================== */

  /* 从 mech 名（游戏里 u.mech）取图标 id。 */
  const ICON_BY_MECH = {
    B1:'B1', B2:'B2', M1:'M1', M2:'M2', M3:'M3',
    CB1:'CB1', CB2:'CB2', CB3:'CB3', CB4:'CB4',
    量产机:'grunt', 猎犬:'hound', 无人机:'drone', 铁壁:'ironwall', 突击兵:'raider',
    固定炮台:'turret', 盾卫:'shield', 追击炮车:'pursuer', 战斗机:'fighter',
    炮击机:'artillery', 重装要塞:'fortress', 指挥舰:'flagship', 陨石残骸:'debris',
  };

  const NAMES = {
    B1:'雷萨 · B1（近卫）', B2:'蕾卡 · B2（尖兵）', M1:'Feena · M1（辅助）',
    M2:'阿布拉德 · M2（重装）', M3:'Iris · M3（辅助）',
    CB1:'刹那 · CB1（近卫）', CB2:'洛克昂 · CB2（狙击）', CB3:'阿雷路亚 · CB3（特种）',
    CB4:'提耶利亚 · CB4（德天使）', CB4N:'提耶利亚 · 纳德雷形态',
    grunt:'量产机', hound:'猎犬', drone:'无人机', ironwall:'铁壁', raider:'突击兵',
    turret:'固定炮台', shield:'盾卫', pursuer:'追击炮车', fighter:'战斗机',
    artillery:'炮击机', fortress:'重装要塞', flagship:'指挥舰', debris:'陨石残骸',
  };

  const ROLE_OF = {
    B1:'近卫', B2:'尖兵', M1:'辅助', M2:'重装', M3:'辅助',
    CB1:'近卫', CB2:'狙击', CB3:'特种', CB4:'特种', CB4N:'特种',
  };

  /* 势力名 → 调色板键。**加新势力只需要在这里加一行 + 在 PAL 里加一套颜色**，
   * 不用碰任何图标。游戏侧读的是这张表（不再用旧的 ICON→势力 映射）。 */
  const FACTION_PAL = {
    '影世界': 'ying',
    '月球王国': 'moon',
    '天人': 'cb',
    '克莱因派': 'clyne',
    '预防者': 'prev',
    'ATX': 'atx',
    '秘银': 'mithril',            // v0.26 势力名「米斯里尔」改为「秘银」（Claude 改）
  };

  /* 旧接口：图标 id → 调色板键（只有对照表 / 渲染工具还在用） */
  const FACTION_OF = {
    B1:'ying', B2:'ying', M1:'moon', M2:'moon', M3:'moon',
    CB1:'cb', CB2:'cb', CB3:'cb', CB4:'cb', CB4N:'cb',
  };

  /* 主入口：build(id, {pal, plate, size, lod, inset, outline}) -> 绘制指令数组
   *   pal   ：调色板对象（见 PAL），或 PAL 里的键名
   *   plate ：'square' | 'circle' | 'none'，底板（画在图标下面）
   *   size  ：图标盒子的像素边长，用来自动决定细节等级
   *   lod   ：'s' | 'm' | 'l'，不传就按 size 推断（≤26 小、≤46 中、其余大）
   *   inset ：机体相对底板的缩放，圆形底板会自动缩到 0.84 以免出格
   *   outline：外描边颜色（推荐传）。把剪影在 8 个方向各偏移一份垫在本体下面，
   *            机体互相重叠时靠这圈暗边才分得开。outlinePx 控制粗细（默认 0.021）
   *   cel   ：默认 true。统一光轴的两段硬边赛璐璐明暗，设 false 可关掉
   */
  function build(id, o) {
    o = o || {};
    let C = o.pal || PAL.enemy;
    if (typeof C === 'string') C = PAL[C] || PAL.enemy;

    // 细节等级：小尺寸下把铆钉、细线这类东西去掉，保证 22px 还看得清
    let lod = o.lod;
    if (!lod) {
      const s = o.size || 96;
      lod = s <= 26 ? 's' : s <= 46 ? 'm' : 'l';
    }
    const opt = {pal: C, lod, detail: lod !== 's', fine: lod === 'l', plate: o.plate, size: o.size};

    const out = platePrims(C, o.plate, opt.detail);

    const fn = BUILD[id];
    if (!fn) return out;

    // 把「战斗分类」的颜色注入调色板，机体画胸口核心时会用到
    const CC = Object.assign({}, C);
    CC.core = ROLE_COL[o.role] || C.accent;
    opt.pal = CC;

    const M = B();
    fn(M, CC, opt);
    let body = M.list;

    // 统一光照：把所有渐变重做成同一根光轴上的两段硬边赛璐璐明暗
    if (o.cel !== false) body = celShade(body);

    // 小尺寸下把所有描边加粗：细线在 22px 会直接消失，反而变糊
    if (lod === 's') {
      body = body.map(p => {
        if (p.lw == null) return p;
        const q = Object.assign({}, p);
        q.lw = p.lw * 1.5;
        return q;
      });
    }

    // 内缩：圆形底板下机体缩小一点，方形底板下几乎不动
    let inset = o.inset;
    if (inset == null) inset = o.plate === 'circle' ? 0.84 : o.plate === 'square' ? 0.94 : 1;
    if (inset !== 1) {
      body = xformPrims(body, inset, inset, 0.5 * (1 - inset), 0.5 * (1 - inset));
    }

    /* 外描边：把整个剪影在 8 个方向各偏移一份垫在本体下面，等于给机体套一圈暗边。
       机体互相重叠时这圈边是「还分得开」的关键。放在几何层做，
       游戏里的 Canvas 后端和离线光栅化器看到的就是同一个结果。 */
    if (o.outline) {
      const col = o.outline === true ? '#05070d' : o.outline;
      const r = o.outlinePx == null ? 0.021 : o.outlinePx;
      const sil = silhouette(body, col);
      const ring = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        for (const p of xformPrims(sil, 1, 1, Math.cos(a) * r, Math.sin(a) * r)) ring.push(p);
      }
      body = ring.concat(body);
    }

    return out.concat(body);
  }

  const ids = Object.keys(BUILD);

  return {
    VERSION, PAL, ROLE_COL, NAMES, ROLE_OF, FACTION_OF, FACTION_PAL, ICON_BY_MECH,
    build, ids, platePrims, shade, mix, hex2rgb, rgb2hex, B,
    draw, makeSprite,
    // 供测试 / 预览使用
    _geom: {quad, mir, hexPts, polyPts, ringPts, GY, GG, STEEL, STEEL_HI, STEEL_LO, GUN},
  };
});
