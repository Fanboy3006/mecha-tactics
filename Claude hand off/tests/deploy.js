/* v0.39 部署区域：首发 + 机库、部署格、派出当回合不能移动、尖兵前线中继、指挥 4 格内撤回、辅助改名指挥 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  const errs = [];
  const p = await b.newPage({viewport:{width:1400,height:900}}); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.waitForTimeout(300); await p.click('#titleRun'); await p.waitForTimeout(300);
  await p.click('#endDlg [data-v="近卫"]'); await p.waitForTimeout(300); await p.click('#endDlg [data-v="B1"]'); await p.waitForTimeout(300);
  await p.evaluate(() => {
    const g = window.__game, A = g.data.ALLY_T, R = g.RUN;
    for (const [m, lv] of [['M3', 9], ['B2', 8], ['CB2', 7], ['S3', 6], ['W1', 5]]){ if (R.units.some(u => u.mech === m)) continue; const u = g.makeUnit(A.find(t => t.mech === m), 'ally', 0, 0); for (let i = 1; i < lv; i++) g.levelUp(u); R.units.push(u); }
    R.units.forEach(u => { if (u.mech === 'B1') while (u.lv < 10) g.levelUp(u); });
    g.setSpeed(0.01); g.STAGES['ISW-1-N-1'].obj = 'annihilate'; g.runBattle('battle', 'ISW-1-N-1');
  });
  await p.waitForTimeout(600); await p.click('#btnForm', {timeout:3000}).catch(() => {});
  await p.waitForFunction(() => window.__game.units.some(u => u.side === 'enemy'), null, {timeout:8000}).catch(() => {});
  await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const g = window.__game, out = {}, us = g.units, H = () => g.HANGAR, field = () => us.filter(u => u.side === 'ally');
    out.cls = g.data.ALLY_T.find(t => t.mech === 'M3').tags.战斗分类 === '指挥' && !g.data.ALLY_T.some(t => t.tags.战斗分类 === '辅助');
    out.cap = g.LV.maxDeploy; out.field = field().length; out.hangar = H().length; out.total = g.RUN.units.length;
    out.split = out.field === out.cap && out.field + out.hangar === out.total;
    // 场上满了：不能派出
    const h0 = H()[0];
    out.fullBlock = !!h0 && !g.deployTiles || !document.querySelector(`[data-hangar="${h0.uid}"]`) || document.querySelector(`[data-hangar="${h0.uid}"]`).disabled;
    // 撤回：指挥 4 格内可以，离远了不行
    const cmd = field().find(u => u.tags.战斗分类 === '指挥'), other = field().find(u => u !== cmd);
    out.hasCmd = !!cmd;
    if (cmd && other){
      const ox = other.x, oy = other.y;
      other.x = cmd.x + 20; other.y = cmd.y; const far = g.canRetreat(other); other.x = ox; other.y = oy;
      out.farNo = !far;
      other.x = cmd.x + 1; other.y = cmd.y + 1; if (!g.canRetreat(other)) { other.x = cmd.x; other.y = cmd.y + 2; }
      out.nearYes = g.canRetreat(other);
      await g.doRetreat(other);
      out.retreated = H().includes(other) && !us.includes(other) && other.retreatTurn === g.turn;
    }
    // 派出：撤回的这台本回合不能派；换别人可以；派出后当回合不能移动
    const nxt = H().find(u => u.retreatTurn !== g.turn);
    const tiles = g.deployTiles(nxt);
    out.tiles = tiles.length;
    g.startDeploy(nxt); const t = tiles[0];
    out.deployed = g.doDeploy(t.x, t.y) && us.includes(nxt) && nxt.deployTurn === g.turn && nxt.enterT === g.turn && nxt.enterB === g.BATTLE_ID;
    out.noMove = g.S.mode === 'menu' && g.S.noUndo;
    g.select(nxt); out.reachSelf = g.S.reach.length === 1 && g.S.reach[0].x === nxt.x;
    out.retNoRedeploy = !document.querySelector(`[data-hangar="${other.uid}"]`) || document.querySelector(`[data-hangar="${other.uid}"]`).disabled;
    // 前线中继：尖兵插下后，周围成为部署格
    const sc = field().find(u => u.tags.战斗分类 === '尖兵') || (() => { const u = H().find(x => x.tags.战斗分类 === '尖兵'); return u; })();
    out.scout = !!sc && g.canRelay(sc);
    if (sc && us.includes(sc)){
      for (let i = 0; i < 30 && (sc.x < 12); i++){ sc.x++; }
      g.select(sc); await g.doRelay(sc);
      const any = H()[0];
      out.relay = g.RELAYS.has(sc.uid) && !!any && g.deployTiles(any).some(q => Math.abs(q.x - sc.x) + Math.abs(q.y - sc.y) <= 2);
    }
    // v0.39.2 全图部署（迪奥 W2 试玩；v0.40.19 起流星小队五人都有，对照组要挑没有全图部署的机体）：部署格远多于普通机体，且不在敌方控制区
    const duo = g.makeUnit(g.data.ALLY_T.find(t => t.mech === 'W2'), 'ally', 0, 0); H().push(duo);
    const dt = g.deployTiles(duo), nt = g.deployTiles(H().find(u => u !== duo && u.w === 1 && u.h === 1 && !u.abilities.includes('globalDeploy')) || nxt), zs = g.zocSet(duo);
    out.global = duo.abilities.includes('globalDeploy') && dt.length > nt.length * 3 && !dt.some(q => zs.has(q.y*40 + q.x));
    H().splice(H().indexOf(duo), 1);
    // 场上清空但机库有人：不判负
    const keep = field().slice(); keep.forEach(u => { us.splice(us.indexOf(u), 1); H().push(u); });
    g.checkEnd(); out.defeatEmpty = g.over;
    return out;
  });
  check('辅助职业改名为指挥', r.cls, JSON.stringify(r));
  check('首发 = 场上上限，其余进机库', r.split);
  check('场上满了不能派出', r.fullBlock);
  check('撤回：指挥 4 格内可以，远了不行', r.hasCmd && r.nearYes && r.farNo && r.retreated);
  check('派出到部署格，当回合不能移动', r.deployed && r.noMove && r.reachSelf && r.tiles > 0);
  check('刚撤回的机体本回合不能再派出', r.retNoRedeploy);
  check('尖兵前线中继：周围成为部署格', r.scout && r.relay);
  check('全图部署：迪奥可以派到地图任意空格（不进控制区）', r.global);
  check('场上一台都没有就算输（机库里有人也一样）', r.defeatEmpty);
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
