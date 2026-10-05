# src（游戏源文件）

**需求单 #1 起，只改这些：**

| 文件 | 内容 |
|---|---|
| `shell.html` | HTML 骨架。`<style>` / `<script>` 标签之间是占位行 `<!-- @include … -->`；ART / AUDIO 两段只留 BEGIN / END |
| `css/main.css` | 游戏 CSS |
| `js/NN-名字.js` | 游戏脚本，按原来的分节注释拆开，按文件名顺序拼接（全局作用域，和拆分前完全一样） |

**生成物，不要手改：** `artifact-fragment.html`、`index.html`。改完源文件跑：

```bash
node tools/build-src.mjs          # 拼出 fragment（并注入 ART / AUDIO），再同步 index.html
node tools/build-src.mjs --check  # 只检查
```

- 加新文件：放进 `js/`，在 `shell.html` 里对应位置加一行 `<!-- @include js/文件名.js -->`。
- 拼接规则在 `tools/assemble-src.mjs`；拆分脚本 `tools/split-src.mjs` 只在第一次用过，**不要再跑**（会用 fragment 覆盖源文件）。
- 文件内容原样拼接，所以一个 js 文件里的变量其他文件都能用（脚本是同一个 `<script>`）。
