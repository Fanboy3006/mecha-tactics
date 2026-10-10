"""把像素画原稿打包成游戏用的素材块，写进 art/mech-icons.js 末尾的 PIXEL 段（自动生成，勿手改）。
用法：cd art/pixel && python3 build_pixel.py
内容：机体精灵（精锐 24px / 骨干 20px / 坦克 32px / 其他 16px，三个朝向）+ 地形图集（16px 一格）。"""
import io, base64, json, sys, os, importlib
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def strip(views):   # 三个朝向拼成一条：front | side | back
    w, h = views[0].size; s = Image.new('RGBA', (w*3, h))
    for i, v in enumerate(views): s.alpha_composite(v, (i*w, 0))
    return s
SPR = {}   # key -> {s: 尺寸, img: 三向条带}
BY_MECH = {}
# ---------- 精锐 24px ----------
sys.path.insert(0, os.path.join(HERE, 'elite'))
import mm as mmE
ELITE = {'B1':'rasa', 'M1':'feena', 'CB1':'setsuna', 'S1':'lacus', 'W1':'heero', 'A1':'kyosuke', 'U7':'sousuke'}
for mech, mod in ELITE.items():
    m = importlib.import_module(mod)
    SPR[mech] = dict(s=24, fx=mod, img=uri(strip([mmE.render(m.FRONT, m.PAL), mmE.render(m.SIDE, m.PAL), mmE.render(m.BACK, m.PAL)])))
    BY_MECH[mech] = mech
sys.path.remove(os.path.join(HERE, 'elite'))
for k in list(sys.modules):
    if k in ('mm',) or k in ELITE.values(): del sys.modules[k]
# ---------- 骨干 20px（坦克 32px） ----------
sys.path.insert(0, os.path.join(HERE, 'core'))
import mm as mmC
from chars import C
for cid, c in C.items():
    vs = [mmC.render(c[v], c['pal']) for v in ('front', 'side', 'back')]
    SPR[cid] = dict(s=vs[0].size[0], img=uri(strip(vs)))
    BY_MECH[cid] = cid
sys.path.remove(os.path.join(HERE, 'core'))
# ---------- 其他 16px：势力头 × 职业机身 ----------
sys.path.insert(0, HERE)
import parts
from parts import M
parts.HEAD['drill'] = dict(   # 演习（大众脸 G1–G6）：一字护目镜的标准头
 front=M(["........","......oo",".....oaa",".....oww",".....oee",".....obb","......od"]),
 back =M(["........","......oo",".....oaa",".....oaa",".....obb",".....obb","......od"]),
 side=["................",".......oooo.....","......oaaaao....","......oaawwo....","......obbweo....","......obbbbo....",".......oddo....."])
from compose import compose
FAC = {
 'ying':  ('#9a86d6','#5f4f96','#352a5e','#d9b8ff','#ff5ad1'),
 'moon':  ('#c4d3e6','#7d92ad','#46566e','#eaf6ff','#7fe6ff'),
 'cb':    ('#5fb59a','#2c7663','#173f36','#9ff3e0','#7dff9a'),
 'clyne': ('#e6a3c3','#a85d80','#5c2f47','#ffe3f0','#7fd0ff'),
 'prev':  ('#e3c06a','#a8822c','#5e4614','#fff1c4','#7fe6ff'),
 'atx':   ('#a7afbd','#6e7684','#3b414d','#ff8a5c','#ff8a5c'),
 'mith':  ('#8ea468','#54683a','#2c3a1d','#ffd98a','#ffd766'),
 'drill': ('#9fd2ff','#4f95e0','#2a4f9a','#eaf6ff','#fff27a'),
}
FAC_OF = {'影世界':'ying','月球王国':'moon','天人':'cb','卫星国防军':'clyne','预防者':'prev','ATX':'atx','秘银':'mith','演习':'drill'}
CLS_OF = {'近卫':'guard','尖兵':'striker','指挥':'command','重装':'heavy','狙击':'sniper','特种':'special'}
CORE_COL = {'heavy':'#8fd0ff','guard':'#ff9a86','sniper':'#ffa8dd','command':'#cfa8ff','striker':'#ffd766','special':'#7fe6ff'}
BASE = {'o':'#141622','w':'#f4f4f4','l':'#c9ccd6','g':'#8b8fa3','k':'#4b4f63','y':'#ffd766','r':'#ff9a3d'}
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
def grid_img(rows, pal):
    im = Image.new('RGBA', (16, 16))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': im.putpixel((x, y), hx(pal[ch]))
    return im
for f, (a, b, d, x, e) in FAC.items():
    for c in CLS_OF.values():
        pal = dict(BASE, a=a, b=b, d=d, x=x, e=e, c=CORE_COL[c])
        SPR[f + '_' + c] = dict(s=16, img=uri(strip([grid_img(compose(f, c, v), pal) for v in ('front', 'side', 'back')])))
# 敌方杂兵（地面 1×1）
import grunt16
GP = dict(BASE, a='#ff9e8a', b='#d9564b', d='#8a2630', e='#ff5a7a', c='#ffd766')
g = grunt16.S['grunt']
SPR['enemy_grunt'] = dict(s=16, img=uri(strip([grid_img(g['front'], GP), grid_img(g['side'], GP), grid_img(g['back'], GP)])))
# ---------- 地形图集（16px 一格，16 列） ----------
V = os.path.join(ROOT, 'art', 'vendor', 'ninja-adventure', 'Backgrounds', 'Tilesets')
floor = Image.open(os.path.join(V, 'TilesetFloor.png')).convert('RGBA')
hole = Image.open(os.path.join(V, 'TilesetHole.png')).convert('RGBA')
relief = Image.open(os.path.join(V, 'TilesetRelief.png')).convert('RGBA')
nature = Image.open(os.path.join(V, 'TilesetNature.png')).convert('RGBA')
water = Image.open(os.path.join(V, 'TilesetWater.png')).convert('RGBA')
# 台地顶面原本是浅紫白（雪地用），改成岩石灰绿，带一点抖动
px = relief.load()
for yy in range(relief.height):
    for xx in range(relief.width):
        if px[xx, yy] == (242, 234, 241, 255):
            dark = (xx + yy) % 2 == 0 and (xx*3 + yy*5) % 7 < 2
            px[xx, yy] = (112, 124, 94, 255) if dark else (128, 140, 106, 255)
T = 16; ATL = {}; tiles = []
def put(name, src, tx, ty, w=1, h=1):
    ATL[name] = [len(tiles), w, h]
    for j in range(h):
        for i in range(w): tiles.append(src.crop(((tx+i)*T, (ty+j)*T, (tx+i+1)*T, (ty+j+1)*T)))
    # 多格贴图按行优先连续存放
for i, (tx, ty) in enumerate([(3,11),(2,11),(1,12),(2,12),(3,12),(0,12)]): put('grass%d' % i, floor, tx, ty)
put('dirt', floor, 5, 9)
put('rock', nature, 18, 9); put('rockB', nature, 15, 9); put('bush', nature, 1, 10)
put('treeA', nature, 0, 0, 2, 2); put('treeB', nature, 2, 0, 2, 2); put('boulder', nature, 16, 8, 2, 2)
for yy in range(4):
    for xx in range(4): put('hole%d%d' % (xx, yy), hole, xx, yy)
for yy in range(3):
    for xx in range(4): put('cliff%d%d' % (xx, yy), relief, xx, yy)
for yy in range(6, 10):
    for xx in range(4): put('water%d%d' % (xx, yy), water, xx, yy)
# 重力深渊：自己画的紫色漩涡（两帧）
import math
for fr in range(2):
    im = Image.new('RGBA', (16, 16), (13, 7, 24, 255)); p = im.load()
    for yy in range(16):
        for xx in range(16):
            dx, dy = xx - 7.5, yy - 7.5; r = math.hypot(dx, dy); a = math.atan2(dy, dx)
            v = math.sin(a*2 + r*0.9 + fr*math.pi/2)
            if r < 7.5:
                if v > .55: p[xx, yy] = (94, 47, 148, 255)
                elif v > .1: p[xx, yy] = (52, 26, 92, 255)
            if r < 2: p[xx, yy] = (200, 160, 255, 255) if fr == 0 else (150, 110, 220, 255)
    ATL['abyss%d' % fr] = [len(tiles), 1, 1]; tiles.append(im)
cols = 16; rows = (len(tiles) + cols - 1) // cols
atlas = Image.new('RGBA', (cols*T, rows*T))
for i, t in enumerate(tiles): atlas.alpha_composite(t, ((i % cols)*T, (i // cols)*T))
DATA = dict(v=1, spr=SPR, byMech=BY_MECH, atlas=uri(atlas), atl=ATL, cols=cols)
js = r'''/* ===== PIXEL BEGIN（自动生成：art/pixel/build_pixel.py，请勿手改）===== */
(function (root) {
  'use strict';
  const D = __DATA__;
  const hasImg = typeof Image !== 'undefined';
  const img = {}; let pending = 0; const waiters = [];
  const done = () => { if (--pending === 0) waiters.splice(0).forEach(f => f()); };
  function load(key, src){ if (!hasImg) return; pending++; const i = new Image(); i.onload = () => { img[key] = i; done(); }; i.onerror = done; i.src = src; }
  if (hasImg){ for (const k in D.spr) load(k, D.spr[k].img); load('__atlas', D.atlas); }
  root.MechPixel = {
    data: D, img,
    ready: () => hasImg && pending === 0 && !!img.__atlas,
    onReady(f){ if (this.ready()) f(); else waiters.push(f); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
/* ===== PIXEL END ===== */'''.replace('__DATA__', json.dumps(DATA, ensure_ascii=False, separators=(',', ':')))
src_path = os.path.join(ROOT, 'art', 'mech-icons.js')
src = open(src_path, encoding='utf8').read()
B = '/* ===== PIXEL BEGIN'; E = '/* ===== PIXEL END ===== */'
if B in src:
    a = src.index(B); b = src.index(E) + len(E); src = src[:a].rstrip('\n') + '\n\n' + js + src[b:]
else:
    src = src.rstrip('\n') + '\n\n' + js + '\n'
open(src_path, 'w', encoding='utf8', newline='\n').write(src)
print('精灵', len(SPR), '个；图集', atlas.size, '；mech-icons.js', len(src.encode()) // 1024, 'KB')
