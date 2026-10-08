/* ---------- 战术挑战（关卡对话维护，统筹 10-08 建脚手架） ----------
   作者 10-08：规则试玩场「基本达到设计预期」，肉鸽暂停；下一步做手工关卡。
   做法沿用规则试玩场（05b）：小地图、每关一道题、开场提示写「这关考什么」。
   - 关卡写进下面的 CHALLENGE_STAGES，键名用 ch_ 开头（例如 ch_01），code 用 CH-01 这样的编号；
   - 字段和 LEVELS 一样：name, w, h, rows（可以用 05b 的 rtRows(w, h, marks) 生成）, allies:[{mech, x, y, facing, lv}]
     （mech 可以是正式角色代号，也可以是大众脸 G1–G6）或者 formation + rosterList + spots + hangar + maxDeploy（要机库时），
     enemies:[{t, x, y, facing, lv?, guardZone?}], waves, zone, victory, goalText, winText, summary, tips:[{on:'turn:1', text}]；
   - 敌人可以写 guardZone:N（守卫型：我方进入 N 格内才启动，v0.40.3 接线）；
   - 敌人模板和数值归规则对话，这里只决定放什么、放哪、朝哪、几级、几波。
   - 写完跑 tests/challenge.js（打开每一关、检查站位和报错）。
   下面的登记代码不用改：开场菜单「战术挑战」和顶栏关卡菜单会自动列出所有关卡。 */
const CHALLENGE_STAGES = {
};
Object.assign(LEVELS, CHALLENGE_STAGES);
{
  const og = document.createElement('optgroup'); og.label = '战术挑战（每关一道题）';
  for (const [k, L] of Object.entries(CHALLENGE_STAGES)){ const o = document.createElement('option'); o.value = k; o.textContent = L.name; og.appendChild(o); }
  if (og.children.length){ const sel = document.querySelector('#levelSel'); sel.insertBefore(og, sel.querySelector('optgroup[label="工具"]')); }
}
