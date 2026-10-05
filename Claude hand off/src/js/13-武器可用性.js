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
function canHit(u, w, t, ax=u.x, ay=u.y){
  if (!ATTACK_FIRES.includes(w.fire)) return false;
  const rg = effRange(u, w), d = distU(u, t, ax, ay);
  if (d < rg[0] || d > rg[1]) return false;
  if (d > 3 && t.side !== u.side && hasStealth(t)) return false;
  if (w.fire === 'direct' && !losClear(u, ax, ay, t)) return false;
  return true;
}
const targetsFor = (u,w) => units.filter(e => e.side !== u.side && e.hp > 0 && canHit(u,w,e));

