(() => {
'use strict';
const N = 40, TS = 22;
let MW = 40, MH = 40, SC = 1;
const COL = {
  plain:'#3b4a37', plainDot:'#45553f', forest:'#264530', forestTree:'#1b3524',
  mountain:'#5b4e40', mountainPeak:'#7a6a57', water:'#1f3d5c', wave:'#2f5679', chasm:'#07090c', crack:'#2a2f38', cliff:'#2b2622', cliffEdge:'#6b5f52', abyss:'#0d0718', abyssRing:'#5e2f94',
  grid:'rgba(0,0,0,.22)', ally:'#4f95e0', enemy:'#d9564b', acted:'#56606b',
  move:'rgba(90,160,230,.40)', atk:'rgba(224,90,79,.38)', threat:'#e9a23b', map:'rgba(233,162,59,.42)'
};
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
let SPEED = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));
const inb = (x,y) => x>=0 && y>=0 && x<MW && y<MH;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const DIR8 = [[-1,-1,'↖'],[0,-1,'↑'],[1,-1,'↗'],[-1,0,'←'],null,[1,0,'→'],[-1,1,'↙'],[0,1,'↓'],[1,1,'↘']];
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ri = (r,a,b) => a + Math.floor(r()*(b-a+1));

