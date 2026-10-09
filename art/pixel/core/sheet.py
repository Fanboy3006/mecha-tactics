import sys
from PIL import Image, ImageDraw
from mm import render
from chars import C
k = 5; cw = 20*k + 8; ids = list(C)
cols = 2  # 每行两台角色（各四向）
rowsN = (len(ids)+1)//2
sh = Image.new('RGBA', (cols*(4*cw+20), rowsN*cw + 8), (47, 61, 44, 255))
for idx, cid in enumerate(ids):
    c = C[cid]; ox = (idx % 2)*(4*cw+20); oy = (idx//2)*cw
    vs = [render(c['front'], c['pal']), render(c['side'], c['pal']), render(c['back'], c['pal']), render(c['side'], c['pal'], flip=True)]
    for i, im in enumerate(vs): sh.alpha_composite(im.resize((20*k, 20*k), Image.NEAREST), (ox + 8 + i*cw, oy + 8))
sh.save(sys.argv[1])
