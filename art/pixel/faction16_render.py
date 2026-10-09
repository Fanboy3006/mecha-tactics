import sys; sys.path.insert(0,'.')
from compose import compose
from PIL import Image, ImageDraw
FAC={ # armor light/mid/dark, accent x, eye e
 'ying':  ('#9a86d6','#5f4f96','#352a5e','#d9b8ff','#ff5ad1'),
 'moon':  ('#c4d3e6','#7d92ad','#46566e','#eaf6ff','#7fe6ff'),
 'cb':    ('#5fb59a','#2c7663','#173f36','#9ff3e0','#7dff9a'),
 'clyne': ('#e6a3c3','#a85d80','#5c2f47','#ffe3f0','#7fd0ff'),
 'prev':  ('#e3c06a','#a8822c','#5e4614','#fff1c4','#7fe6ff'),
 'atx':   ('#a7afbd','#6e7684','#3b414d','#ff8a5c','#ff8a5c'),
 'mith':  ('#8ea468','#54683a','#2c3a1d','#ffd98a','#ffd766'),
}
CORE={'heavy':'#8fd0ff','guard':'#ff9a86','sniper':'#ffa8dd','command':'#cfa8ff','striker':'#ffd766','special':'#7fe6ff'}
BASE={'o':'#141622','w':'#f4f4f4','l':'#c9ccd6','g':'#8b8fa3','k':'#4b4f63','y':'#ffd766','r':'#ff9a3d'}
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
def img(f,cls,view):
    a,b,d,x,e=FAC[f]; pal=dict(BASE,a=a,b=b,d=d,x=x,e=e,c=CORE[cls])
    v='side' if view=='left' else view
    rows=compose(f,cls,v); im=Image.new('RGBA',(16,16))
    for y,r in enumerate(rows):
        for xx,ch in enumerate(r):
            if ch!='.': im.putpixel((xx,y),hx(pal[ch]))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if view=='left' else im
if __name__=='__main__':
    facs=['ying','moon','cb','clyne','prev','atx','mith']; clss=['guard','striker','command','heavy','sniper','special']
    k=4; cw=16*k+6
    view=sys.argv[2] if len(sys.argv)>2 else 'front'
    sh=Image.new('RGBA',(len(clss)*cw+6,len(facs)*cw+6),(52,70,48,255))
    for j,f in enumerate(facs):
        for i,c in enumerate(clss):
            sh.alpha_composite(img(f,c,view).resize((16*k,16*k),Image.NEAREST),(6+i*cw,6+j*cw))
    sh.save(sys.argv[1])
