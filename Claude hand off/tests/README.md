# tests（Playwright 浏览器测试，Claude 维护）

需要 `playwright` + Chromium。脚本用 `page.setContent()` 加载 `../src/artifact-fragment.html`。

| 脚本 | 内容 |
|---|---|
| `tut1_playthrough.js` / `tut2_flank_bot.js` / `tut3_terrain_sim.js` | 教学 1–3 |
| `keys_space.js` / `keys_esc.js` | 空格快捷操作、Esc 撤回 |
| `defense_bot.js` | 大规模防卫战 |
| `trials_run.js` + `trial_bot_inpage.js` | 34 个角色试玩关 |
| `run_bot.js [分队] [步数] [1=耐久999]` + `run_bot_inpage.js` | 肉鸽整局 |
| `gen_stage_table.js` | 生成肉鸽关卡表 |

DSH 那边的浏览器起不来，可以用 `tools/boot-smoke.mjs` 和 `tools/render-game.mjs` 代替。
