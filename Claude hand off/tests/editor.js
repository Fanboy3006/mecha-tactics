/* 关卡编辑器（Claude 维护）：载入、刷地形、放敌人、加波次、自动保存、试打、导出 */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  let bad = 0; const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${label} ${extra}`); };
  await p.waitForTimeout(300);
  await p.selectOption('#levelSel', 'editor'); await p.waitForTimeout(300);
  check('打开编辑器', await p.isVisible('#edCv'));
  await p.selectOption('#edSel', 'ISW-1-N-7'); await p.waitForTimeout(200);
  const box = await p.$eval('#edCv', c => { const r = c.getBoundingClientRect(); return {x:r.x, y:r.y}; });
  const tp = await p.evaluate(() => document.querySelector('#edCv').getBoundingClientRect().width / 26);
  const at = (x, y) => [box.x + (x + .5) * tp, box.y + (y + .5) * tp];
  // 刷地形：拖一条山
  await p.click('[data-tool="paint"]'); await p.click('[data-ter="m"]');
  await p.mouse.move(...at(10, 3)); await p.mouse.down(); for (let y = 3; y <= 8; y++) await p.mouse.move(...at(10, y)); await p.mouse.up();
  // 放两个敌人到第 1 波
  await p.click('[data-tool="enemy"]'); await p.selectOption('#edEtype', 'tank');
  const box2 = await p.$eval('#edCv', c => { const r = c.getBoundingClientRect(); return {x:r.x, y:r.y}; }); Object.assign(box, box2);
  await p.mouse.click(...at(20, 2)); await p.waitForTimeout(100);
  // 加一波，放一个指挥官机
  await p.click('#edAddWave'); await p.waitForTimeout(100);
  await p.click('[data-tool="enemy"]'); await p.selectOption('#edEtype', 'captain');
  const box3 = await p.$eval('#edCv', c => { const r = c.getBoundingClientRect(); return {x:r.x, y:r.y}; }); Object.assign(box, box3);
  await p.mouse.click(...at(22, 10)); await p.waitForTimeout(100);
  const st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__game.editor.store['ISW-1-N-7'])));
  check('刷地形自动保存', st && st.rows.slice(3, 9).every(r => r[10] === 'm'));
  check('第 1 波多了一台重型坦克', st && st.waves[0].enemies.some(e => e.t === 'tank' && e.x === 20 && e.y === 2));
  check('新增第 4 波（含指挥官机；本关 v0.28 起原有 3 波）', st && st.waves.length === 4 && st.waves[3].enemies.some(e => e.t === 'captain'));
  await p.screenshot({path: __dirname + '/editor.png'});
  // 试打
  await p.click('#edTest'); await p.waitForTimeout(400);
  check('试打进入编队', await p.isVisible('#btnForm'));
  await p.click('#btnForm'); await p.waitForTimeout(400);
  const t = await p.evaluate(() => { const g = window.__game; return {lv: g.level, tank: g.units.some(u => u.mech === '重型坦克' && u.x === 20 && u.y === 2), m: g.LV.rows[5][10], waves: g.LV.waves.length}; });
  check('试打用的是编辑后的关卡', t.lv === 'edit' && t.tank && t.m === 'm' && t.waves === 4, JSON.stringify(t));
  // 回编辑器，改动还在
  await p.selectOption('#levelSel', 'editor'); await p.waitForTimeout(300);
  check('回到编辑器、仍是 ISW-1-N-7', await p.evaluate(() => document.querySelector('#edSel').value === 'ISW-1-N-7'));
  // 原型关：教学 2 移动一个敌人
  await p.selectOption('#edSel', 'tut2'); await p.waitForTimeout(200);
  check('原型关可以载入（3 波）', await p.evaluate(() => document.querySelectorAll('.ed-wave').length === 3));
  // 导出
  await p.click('#edExport'); await p.waitForTimeout(300);
  const txt = await p.evaluate(() => document.querySelector('#edOut') && document.querySelector('#edOut').value);
  let ok = false; try { const j = JSON.parse(txt); ok = !!j.edits['ISW-1-N-7'] && j.edits['ISW-1-N-7'].waves.length === 3; } catch(e){}
  check('导出 JSON 正确（肉鸽关的后续波次 3 波）', ok);
  console.log('ERRS', errs); await b.close(); process.exit(bad || errs.length ? 1 : 0);
})();
