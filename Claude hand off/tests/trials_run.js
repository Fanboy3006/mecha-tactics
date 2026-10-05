const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const only = process.argv[2], turns = +(process.argv[3] || 6), lv = +(process.argv[4] || 0);
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1500,height:950}});
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n')[1]));
  const html = fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8');
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}</style></head><body>${html}</body></html>`);
  await p.addScriptTag({content: fs.readFileSync(__dirname + '/trial_bot_inpage.js','utf8')});
  const levels = (await p.evaluate(() => [...document.querySelectorAll('#levelSel option')].map(o => o.value))).filter(v => only ? v.match(only) : v.startsWith('trial_'));
  for (const lvId of levels){
    const n = errs.length;
    const r = await p.evaluate(([id,t,l]) => window.__bot(id, t, l), [lvId, turns, lv]).catch(e => ({err:e.message}));
    console.log(JSON.stringify(r), errs.length > n ? 'ERR ' + errs.slice(n).join(' ;; ') : '');
  }
  await b.close();
})();
