/* ---------- 零件 ---------- */
const PARTS = {
  // 加工品（移动类，不消耗推进剂）
  wheel:  {name:'报废轮子', kind:'加工品', uses:1, move:'line2', price:3, desc:'沿直线跳 2 格，不消耗推进剂'},
  limb:   {name:'报废假肢', kind:'加工品', uses:1, move:'ring', price:3, desc:'移动到周围一圈（含斜角）的任意节点，不消耗推进剂'},
  hover:  {name:'气垫底座', kind:'加工品', uses:2, move:'ringline', price:5, desc:'报废假肢 + 报废轮子：周围一圈或直线 2 格，不消耗推进剂'},
  exo:    {name:'试作外骨骼', kind:'加工品', uses:2, move:'line3', price:5, desc:'沿直线跳最多 3 格，不消耗推进剂'},
  engine: {name:'标准引擎', kind:'加工品', uses:3, move:'ring', price:4, desc:'相当于能用 3 次的报废假肢'},
  spring: {name:'重弹簧', kind:'加工品', uses:1, move:'step', price:2, desc:'一次不消耗推进剂的普通移动'},
  jet:    {name:'一次性喷气背包', kind:'加工品', uses:1, move:'any', price:8, desc:'不消耗推进剂，移动到地图上任意节点（包括迷雾里的）'},
  bagua:  {name:'小八界', kind:'加工品', uses:1, move:'any', price:9, desc:'传送到任意节点（包括迷雾里的）'},
  thaw:   {name:'老妈的融雪', kind:'加工品', uses:1, move:'fly', price:6, desc:'飞到 3 格内任意已知的非战斗节点，并获得 3 经验'},
  tentacle:{name:'坎诺特的触须', kind:'加工品', uses:1, move:'shop', price:4, desc:'直接前往本层的黑市（会揭开它的位置）'},
  // 自然物（理财）
  bloodcap:{name:'血蕈', kind:'自然物', value:3, price:4, desc:'每次作战后估价 +2，在黑市卖出换氦三'},
  wave:   {name:'浪花', kind:'自然物', value:4, price:4, desc:'每次移动后估价随机变化（−2 ~ +4），在黑市卖出换氦三'},
  // 概念体（自动触发）
  rite:   {name:'河谷祭祈', kind:'概念体', price:6, desc:'（原作效果待查，暂定）每层开始时推进剂上限 +1'},
};
const newPart = k => ({k, uses:PARTS[k].uses || null, value:PARTS[k].value || null});

