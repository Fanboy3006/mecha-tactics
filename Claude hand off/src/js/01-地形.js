/* ---------- 地形 ---------- */
const TER = {
  plain:   {name:'平原', cost:1, def:0,  eva:0,  blockLOS:false, groundBlock:false, flyBlock:false},
  forest:  {name:'森林', cost:2, def:10, eva:10, blockLOS:false, groundBlock:false, flyBlock:false},
  mountain:{name:'山地', cost:3, def:20, eva:15, blockLOS:true,  groundBlock:false, flyBlock:false},
  water:   {name:'水域', cost:2, def:0,  eva:0,  blockLOS:false, groundBlock:false, flyBlock:false},
  chasm:   {name:'裂谷', cost:99, def:0, eva:0,  blockLOS:false, groundBlock:true,  flyBlock:false},
};
const FIRE = {melee:'近战', direct:'直射', indirect:'曲射', map:'地图炮', support:'辅助地图炮', passive:'被动', heal:'修理', device:'装置'};
const ATTACK_FIRES = ['melee','direct','indirect'];

