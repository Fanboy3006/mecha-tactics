/* ---------- 武器可用性 ---------- */
function wStatus(u, w, {moved=false, counter=false} = {}){
  if (u.lv < w.unlock) return `Lv${w.unlock} 解锁`;
  if (hasTrait(u,'autoCast') && !counter) return '行动结束后自动释放';
  if (w.fire === 'passive') return '被动 · 行动结束后自动释放';
  if (counter && (w.fire === 'support' || w.fire === 'heal' || w.fire === 'device')) return '不能用于反击';
  if (w.usesLeft != null && w.usesLeft <= 0) return '次数用尽';
  if (w.cdLeft > 0) return `冷却中（${w.cdLeft}）`;
  if (counter && w.fire === 'map') return '不能用于反击';
  if (!counter && moved && !w.afterMove) return '移动后不可用';
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
function facOK(u, w, t, ax, ay, face){
  const [fx, fy] = FACE[face], lx = -fy, ly = fx;   // 侧 = 朝向顺时针转 90°
  const rg = effRange(u, w), fmin = w.fire === 'melee' ? 0 : 1;
  for (const [bx, by] of tilesOf(u, ax, ay)) for (const [tx, ty] of tilesOf(t)){
    const dx = tx - bx, dy = ty - by, f = dx*fx + dy*fy, l = dx*lx + dy*ly;
    if (w.pat){ if (w.pat.some(([a, b]) => a === f && b === l)) return true; continue; }
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
  if (!w.pat && (d < rg[0] || d > rg[1])) return false;
  if (!isSure(w) && (face ? !facOK(u, w, t, ax, ay, face) : !FACES.some(f => facOK(u, w, t, ax, ay, f)))) return false;
  if (d > 3 && t.side !== u.side && hasStealth(t)) return false;
  if (w.fire === 'direct' && !losClear(u, ax, ay, t)) return false;
  return true;
}
const targetsFor = (u,w) => units.filter(e => e.side !== u.side && e.hp > 0 && canHit(u,w,e));

