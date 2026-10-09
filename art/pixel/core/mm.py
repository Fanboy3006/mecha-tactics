# 材质图：每个字符是一种材质。大写/小写字母 = 要打光的材质（亮中暗三色），其余 = 平涂。
# 外轮廓自动描深色线；不同材质交界处，下方 / 右方的像素用自己的暗色，形成内部分隔。
from PIL import Image
OUT = (18, 18, 30, 255)
def hx(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
def M(rows):   # 写左半 12 列，镜像成 24 列
    return [r + r[::-1] for r in rows]
def over(rows, patch):   # patch: 同尺寸的整行，非 '.' 的字符覆盖上去
    out = []
    for r, p in zip(rows, patch):
        out.append(''.join(pc if pc != '.' else rc for rc, pc in zip(r, p)))
    return out
def render(rows, pal, flip=False):
    H = len(rows); W = len(rows[0])
    for r in rows: assert len(r) == W, (len(r), r)
    g = lambda x, y: rows[y][x] if 0 <= x < W and 0 <= y < H else '.'
    im = Image.new('RGBA', (W, H))
    for y in range(H):
        for x in range(W):
            m = g(x, y)
            if m == '.':
                if any(g(x+dx, y+dy) != '.' for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))): im.putpixel((x, y), OUT)
                continue
            p = pal[m]
            if isinstance(p, str): c = hx(p)
            else:
                L, Mi, D = (hx(t) for t in p)
                up, dn, lf, rt = g(x, y-1), g(x, y+1), g(x-1, y), g(x+1, y)
                c = Mi
                if up != m: c = L
                if dn == '.' or rt == '.': c = D
                if (up not in ('.', m) and not isinstance(pal.get(up), str)) or (lf not in ('.', m) and not isinstance(pal.get(lf), str)): c = D
                if up == '.' and dn == '.': c = Mi
            im.putpixel((x, y), c)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
