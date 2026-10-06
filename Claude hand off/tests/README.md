# tests（Playwright 浏览器测试，Claude 维护）

需要 Node.js 和 Playwright：

```bash
npm i playwright
npx playwright install chromium
node tut1_playthrough.js
```

所有脚本都用 `page.setContent()` 加载 `../src/artifact-fragment.html`；输出最后一行 `ERRS []` 表示页面没有报错。

| 脚本 | 内容 |
|---|---|
| `tut1_playthrough.js` / `tut2_flank_bot.js` / `tut3_terrain_sim.js [mountain\|air]` | 教学 1–3 |
| `keys_space.js` / `keys_esc.js` | 空格快捷操作、Esc 撤回 |
| `defense_bot.js` | 大规模防卫战（需要几分钟） |
| `trials_run.js` + `trial_bot_inpage.js` | 34 个角色试玩关 |
| `run_bot.js [分队] [步数] [1=耐久999]` + `run_bot_inpage.js` | 肉鸽整局 |
| `run_quit.js` | 肉鸽「撤退」「放弃本局」在浏览器自带弹窗被拦截时仍然可用（有断言） |
| `mode_switch.js` | 默认进入肉鸽；菜单分组（最后是「工具」）；肉鸽打到一半切走再切回，接着打同一战（7 项断言） |
| `class_mech.js` | 分类通用机制：DASH、援护攻击、援护防御、进攻援护（有断言） |
| `editor.js` | 关卡编辑器：刷地形、加敌人和波次、试打、编辑原型关、导出 JSON（有断言） |
| `chest.js` | v0.30 补给箱：肉鸽战斗生成补给箱、我方能攻击、击破有掉落；开局源碳结晶 20（有断言） |
| `relics.js` | v0.31 藏品：常驻加成、双刃代价、叠层、混编 / 孤狼、出击上限、HP%、敌方减益（有断言） |
| `objectives.js` | v0.32 关卡改造：梯队配兵、难度曲线、出击上限 4、坚守 / 斩首 / 突破的胜利判定和增援（有断言） |
| `audio_cues.js` | 音频接线：各场景的曲子、Boss 判定、胜利号角、M 键静音（有断言） |
| `gen_stage_table.js` | 重新生成 `docs/肉鸽关卡表.md` |

DSH 那边的浏览器起不来，可以用 `tools/boot-smoke.mjs` 和 `tools/render-game.mjs` 代替。
