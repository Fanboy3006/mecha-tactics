import sys; sys.path.insert(0,'.')
from parts import HEAD, BODY, pad
def compose(f, cls, view):
    h=HEAD[f][view]; b=BODY[cls][view]
    grid=[['.']*16 for _ in range(16)]
    for y,r in enumerate(b):
        assert len(r)==16,(cls,view,y,len(r),r)
        for x,ch in enumerate(r):
            if ch!='.': grid[y+6][x]=ch
    for y,r in enumerate(h):
        assert len(r)==16,(f,view,y,len(r),r)
        for x,ch in enumerate(r):
            if ch!='.': grid[y][x]=ch
    return [''.join(r) for r in grid]
