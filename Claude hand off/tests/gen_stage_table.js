const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route('**/*', r => r.abort());
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${fs.readFileSync(__dirname + '/../src/artifact-fragment.html','utf8')}</body></html>`);
  const md = await p.evaluate(() => {
    const g = window.__game, ET = g.data.ENEMY_T, KN = {battle:'普通作战', elite:'精英作战', guard:'出口守军', source:'侵蚀源', chase:'追击战', final:'终点'};
    const KC = {battle:'N', elite:'E', guard:'G', source:'S', chase:'C', final:'F'};
    let o = `# 肉鸽关卡表 v0.1（自动生成）\n\n> 由游戏数据生成（试作版 v0.17，含分波），每次生成的内容都一样。用于逐关做精细设计：在这份表上改，或者直接告诉 Claude「把 ISW-1-N-3 改成……」。\n\n`;
    o += `## 编号规则\n\n- 格式：**ISW-层-类型-序号**。例如 ISW-1-N-3：第 1 层可能出现的、普通作战类的第 3 关。\n- 类型：N 普通作战、E 精英作战、G 出口守军、S 侵蚀源（第 2 层起）、C 追击战、F 终点。\n- 每层的关卡池：N × 8、E × 3、G × 2、C × 2，第 2、3 层另有 S × 2；终点只有 ISW-4-F-1。共 50 关。\n- 生成大地图时，每个战斗节点会从这一层、这一类的池子里抽一个编号（同一层尽量不重复），走近后能在节点上看到编号；追击战按局的种子从 C 池里选。\n- **分波**：普通作战、侵蚀源、追击战 2 波，精英、出口守军、终点 3 波；第 2 波在第 3 回合到达，第 3 波在第 5 回合到达，清空当前敌人会让下一波提前出现。后续波次里的精英怪（以及 Boss）等级 +2。\n- **随机部分**：「强化增援」侵蚀场会在第 1 波额外加敌人，这部分不在表里。\n- 手工设计时也可以用 \`waves:[{at:3, enemies:[...]}]\` 覆盖第 2 波及以后的波次。\n- **地图**：. 平原、f 森林、m 山地、w 水域、c 裂谷。我方从左侧出击，敌人在右侧。坐标是 (x, y)，从 0 开始。\n\n`;
    o += `## 怎么手工设计一关\n\n在代码里的 \`STAGE_OVERRIDES\` 里按编号覆盖任意字段，没写的字段继续用自动生成的内容：\n\n\`\`\`js\n'ISW-1-N-1': {\n  name: '起始回廊',\n  rows: [ /* 每行一个字符串，宽 26、高 16 */ ],\n  enemies: [{t:'grunt', x:20, y:7}, {t:'sniper', x:24, y:3, lv:5}],\n  affix: null,          // 或者 '护盾'、'强化' 等词缀名\n  spots: [[2,8],[2,6]], // 我方出击点（可选）\n  desc: '开局说明，会在第 1 回合弹出',\n}\n\`\`\`\n\n`;
    const all = Object.values(g.STAGES);
    for (let L = 1; L <= 4; L++){
      o += `## 第 ${L === 4 ? '4 层（终点）' : L + ' 层'}\n\n| 编号 | 名称 | 类型 | 基础等级 | 各波敌人 | 词缀 |\n|---|---|---|---|---|---|\n`;
      const list = all.filter(s => s.layer === L);
      for (const st of list){
        const b = g.buildStage(st, 0);
        const wv = b.waves.map((w, i) => { const cnt = {}; w.enemies.forEach(e => { const n = ET[e.t].mech; cnt[n] = (cnt[n] || 0) + 1; }); return `${i+1}波：` + Object.entries(cnt).map(([n,c]) => c > 1 ? `${n}×${c}` : n).join('、'); }).join('<br>');
        o += `| ${st.code} | ${st.name} | ${KN[st.kind]} | Lv${b.lv} | ${wv} | ${b.affix ? b.affix.name : '—'} |\n`;
      }
      o += `\n`;
      for (const st of list){
        const b = g.buildStage(st, 0);
        o += `### ${st.code} ${st.name}（${KN[st.kind]}）\n\n` + b.waves.map((w, i) => `- 第 ${i+1} 波${w.at ? `（第 ${w.at} 回合到达）` : '（开局）'}：${w.enemies.map(e => `${ET[e.t].mech} Lv${e.lv} (${e.x},${e.y})`).join('、')}\n`).join('') + `- 词缀：${b.affix ? `${b.affix.name}（${b.affix.desc}）` : '无'} · 本关敌人主题：${b.theme.name}\n- 我方出击点：${b.spots.map(([x,y]) => `(${x},${y})`).join(' ')}\n\n\`\`\`\n${b.g.map(r => r.join('')).join('\n')}\n\`\`\`\n\n`;
      }
    }
    return o;
  });
  fs.writeFileSync(__dirname + '/../docs/肉鸽关卡表.md', md); console.log(md.length);
  await b.close();
})();
