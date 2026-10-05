# 测试脚本

需要 Node.js 和 Playwright：

```bash
npm i playwright
npx playwright install chromium
node tut1_playthrough.js
node tut3_terrain_sim.js mountain
node tut3_terrain_sim.js air
node defense_bot.js        # 需要几分钟
```

- 所有脚本都会读取 `../src/artifact-fragment.html`，用 `page.setContent()` 加载。
- 脚本会在当前目录生成截图（`*.png`），可以删除。
- 输出最后一行的 `ERRS []` 表示页面没有报错。
- 这些是开发时的探索性脚本，不是严格的断言测试；改动规则后，请人工核对输出是否合理。
