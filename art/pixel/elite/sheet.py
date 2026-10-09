import sys, importlib
from PIL import Image
from mm import render
names = sys.argv[2:]
k = 6; cw = 24*k + 10
sh = Image.new('RGBA', (4*cw + 10, len(names)*cw + 10), (47, 61, 44, 255))
for j, n in enumerate(names):
    m = importlib.import_module(n)
    views = [render(m.FRONT, m.PAL), render(m.SIDE, m.PAL), render(m.BACK, m.PAL), render(m.SIDE, m.PAL, flip=True)]
    for i, im in enumerate(views):
        sh.alpha_composite(im.resize((24*k, 24*k), Image.NEAREST), (10 + i*cw, 10 + j*cw))
sh.save(sys.argv[1])
