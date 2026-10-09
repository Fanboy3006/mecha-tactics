/* ---------- 武器可用性 ---------- */
/* ---------- v0.39.3 开场冷却（作者 10-08 定，代替「气力解锁武装」） ----------
   - 从这台机体**上场**那一回合开始算（开战就在场 = 第 1 回合；机库派出 / 增援波次 = 出场那回合）；
   - 武器写 startCd:N 就用 N；没写的：大招（Lv20 / Lv30 解锁的武器）默认 3，其他 0；
   - startCd 3 = 上场那回合起 3 个回合不能用（第 1 回合上场 → 第 4 回合可用）。敌我都适用；
   - 减冷却统一走 cutCd(u, n)：普通冷却和开场冷却一起减（以后的击破减冷却、技能、藏品都调它）。 */
const START_CD_ULT = 3;
const startCdOf = w => w.startCd != null ? w.startCd : (w.unlock >= 20 ? START_CD_ULT : 0);
const readyTurnOf = (u, w) => { const sc = startCdOf(w); if (!sc) return 0; const et = u.enterB === BATTLE_ID ? (u.enterT || 1) : 1; return et + sc - (u.cdCutB === BATTLE_ID ? u.cdCut : 0); };
const startWait = (u, w) => Math.max(0, readyTurnOf(u, w) - turn);
const cdBlocked = (u, w) => w.cdLeft > 0 || startWait(u, w) > 0;
function cutCd(u, n = 1){
  u.weapons.forEach(w => { if (w.cdLeft > 0) w.cdLeft = Math.max(0, w.cdLeft - n); });
  if (u.cdCutB !== BATTLE_ID){ u.cdCutB = BATTLE_ID; u.cdCut = 0; }
  u.cdCut += n;
}
function wStatus(u, w, {moved=false, counter=false} = {}){
  if (u.lv < w.unlock) return `Lv${w.unlock} 解锁`;
  if (w.taOnly && !taActive(u)) return 'TRANS-AM 中才能用';   // v0.40.16 天人（17b）
  const sw = startWait(u, w) > 0 ? `第 ${readyTurnOf(u, w)} 回合起` : '';
  if (hasTrait(u,'autoCast') && !counter) return `${sw}行动结束后自动释放`;
  if (w.fire === 'passive') return `被动 · ${sw}行动结束后自动释放`;
  if (counter && (w.fire === 'support' || w.fire === 'heal' || w.fire === 'device')) return '不能用于反击';
  if (w.usesLeft != null && w.usesLeft <= 0) return '次数用尽';
  if (w.cdLeft > 0) return `冷却中（${w.cdLeft}）`;
  if (startWait(u, w) > 0) return `开场冷却 · 第 ${readyTurnOf(u, w)} 回合可用`;
  if (counter && w.fire === 'map') return '不能用于反击';
  if (!counter && moved && !w.afterMove && !(w.taMove && taActive(u))) return '移动后不可用';   // v0.40.16 洛克昂 TRANS-AM 中狙击步枪可以移动后用
  return null;
}
function wv(u, w, key){ let v = w[key]; for (const up of w.upgrades) if (u.lv >= up.lv && up[key] != null) v = up[key]; return v; }
function effRange(u, w){ let r = w.range; for (const up of w.upgrades) if (u.lv >= up.lv && up.range) r = up.range; if (RM() && RM().fog && w.fire === 'direct') r = [r[0], Math.max(r[0], r[1] - 2)]; return r; }
function maxReach(u){ let m = 0; for (const w of u.weapons){ if (u.lv < w.unlock || w.fire === 'passive') continue; m = Math.max(m, effRange(u,w)[1]); } return m; }
/* v0.38 朝向范围（作者 10-07 定）：武器的攻击范围跟着朝向走。
   - 默认形状：近战 = 前方 + 左右两侧（朝向的那一排及以前），远程 = 只有前方（前进方向 ≥ 1 格）；距离仍按射程；
   - 武器可以写 pat:[[前, 侧], …] 自定义形状（朝右时的坐标：前 = 向右几格，侧 = 向下几格，负数向上），这时射程不再起作用；
   - 主动攻击：可以自由转向，打出去时锁定在能打到目标的朝向（canHit 不传 face = 任意朝向都行）；
   - 敌方阶段的反击、压制射击：只能用当前朝向（传 face）。 */
const FACES = ['up','right','down','left'];
/* v0.41 射程形状（作者 10-09）：
   - 直射 = 3 格宽 × 前方 L 格的长条（正前方一列 + 左右各一列），L 按武器最大射程换算：≤4 → 4，5 → 5，≥6 → 6；
     原来有最小射程的（如狙击 3–9）保留：前方第几格 ≥ 最小射程；
   - 曲射 = 以攻击者为顶点的 90° 扇形：前方第 N 格那一排，左右各能打到 N 格；半径 = 武器最大射程，前方 ≥ 最小射程；
   - 近战不变（前方 + 两侧，按菱形射程）；武器写了 pat 的照 pat。 */
const directLen = r => r <= 4 ? 4 : r >= 6 ? 6 : r;
const newShape = w => !w.pat && (w.fire === 'direct' || w.fire === 'indirect');
function facOK(u, w, t, ax, ay, face){
  const [fx, fy] = FACE[face], lx = -fy, ly = fx;   // 侧 = 朝向顺时针转 90°
  const rg = effRange(u, w), fmin = w.fire === 'melee' ? 0 : 1;
  for (const [bx, by] of tilesOf(u, ax, ay)) for (const [tx, ty] of tilesOf(t)){
    const dx = tx - bx, dy = ty - by, f = dx*fx + dy*fy, l = dx*lx + dy*ly;
    if (w.pat){ if (w.pat.some(([a, b]) => a === f && b === l)) return true; continue; }
    if (w.fire === 'direct'){ if (f >= Math.max(1, rg[0]) && f <= directLen(rg[1]) && Math.abs(l) <= 1) return true; continue; }
    if (w.fire === 'indirect'){ if (f >= Math.max(1, rg[0]) && f <= rg[1] && Math.abs(l) <= f) return true; continue; }
    const d = Math.abs(dx) + Math.abs(dy);
    if (d >= rg[0] && d <= rg[1] && f >= fmin) return true;
  }
  return false;
}
const legalFaces = (u, w, t, ax = u.x, ay = u.y) => FACES.filter(f => facOK(u, w, t, ax, ay, f));
/* 攻击时转到哪个朝向：当前朝向能打就不转，其次正对目标，再其次任意一个能打的 */
function pickFace(u, w, t){
  const ok = legalFaces(u, w, t);
  if (!ok.length || ok.includes(u.facing)) return u.facing;
  const d = dirToward(u, t);
  return ok.includes(d) ? d : ok[0];
}
function canHit(u, w, t, ax=u.x, ay=u.y, face=null){
  if (!ATTACK_FIRES.includes(w.fire)) return false;
  const rg = effRange(u, w), d = distU(u, t, ax, ay);
  if (!w.pat && !newShape(w) && (d < rg[0] || d > rg[1])) return false;   // v0.41 直射 / 曲射的距离由形状自己判断（facOK）
  if (!isSure(w) && (face ? !facOK(u, w, t, ax, ay, face) : !FACES.some(f => facOK(u, w, t, ax, ay, f)))) return false;
  if (d > 3 && t.side !== u.side && hasStealth(t)) return false;
  if (w.fire === 'direct' && !losClear(u, ax, ay, t) && !ignoresLos(u, t)) return false;   // v0.40.13 毛的指挥网络：克鲁兹打范围内的敌机无视障碍物（17b）
  return true;
}
const targetsFor = (u,w) => units.filter(e => e.side !== u.side && e.hp > 0 && canHit(u,w,e));

