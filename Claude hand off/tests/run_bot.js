const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const squad = process.argv[2] || '近卫', steps = +(process.argv[3] || 600);
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1400,height:900}});
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n').slice(1,3).join(' ')));
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  await p.addScriptTag({content: fs.readFileSync(__dirname + '/run_bot_inpage.js','utf8')});
  if (process.argv[4]) await p.evaluate(() => { window.__boost = true; });
  const r = await p.evaluate(([s,n]) => window.__runbot(n, s), [squad, steps]);
  console.log(JSON.stringify(r, null, 1));
  await p.screenshot({path: __dirname + '/run.png'});
  console.log('ERRS', errs.slice(0,8));
  await b.close();
})();
