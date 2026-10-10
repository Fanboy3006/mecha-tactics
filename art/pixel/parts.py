def M(rows):
    out=[]
    for r in rows:
        assert len(r)==8,(r,len(r)); out.append(r+r[::-1])
    return out
def pad(rows,top=0,n=16):
    blank='.'*16
    return [blank]*top + rows + [blank]*(n-top-len(rows))
# ---------------- 头（第 0–6 行）----------------
HEAD = {}
HEAD['cb'] = dict(   # 天人：前掠耳鳍、双眼、白脸
 front=M(["........","...oo.oo","...oxoaa","....oaww","....owew","....obww",".....odd"]),
 back =M(["........","...oo.oo","...oxoaa","....oaaa","....obbb","....obbb",".....odd"]),
 side=["................",".....ooooo......","....oxaaaaao....",".....oaaawwo....",".....obbbweo....",".....obbbwwo....","......odddo....."])
HEAD['moon'] = dict( # 月球王国：骑士头盔 + 白色羽冠 + 一字目镜
 front=M([".......o","......ox","....ooox","...oaaaa","...obeee","...obbbb","....oddd"]),
 back =M([".......o","......ox","....ooox","...oaaax","...obbbx","...obbbb","....oddd"]),
 side=["....oo..........","...oxxoooo......","....oxoaaaao....","....oaaaaaaao...","....obbbbeeeo...","....obbbbbbbo...",".....odddddo...."])
HEAD['ying'] = dict( # 影世界：后掠双角、深色面罩、单条眼光
 front=M(["..o.....","..ox....","...ox.oo","...oxoaa","....oadd","....odde",".....odd"]),
 back =M(["..o.....","..ox....","...ox.oo","...oxoaa","....obbb","....obbb",".....odd"]),
 side=["..o.............","..oxo...........","...oxooooo......","....oxaaaaao....",".....oaddddo....",".....obddeeo....","......odddo....."])
HEAD['clyne'] = dict( # 卫星国防军：两根羽毛状天线、圆润白脸
 front=M(["....o...","....xo.o","....oxoa","....oaaa","....owew","....owww",".....obb"]),
 back =M(["....o...","....xo.o","....oxoa","....oaaa","....oaaa","....obbb",".....obb"]),
 side=["......o.........",".....oxo.o......","......oxoaoo....",".....oaaaaaao...",".....oaaawewo...",".....obbbwwwo...","......obbbbo...."])
HEAD['prev'] = dict( # 预防者：高耸的金色中冠、侧耳、双眼
 front=M([".......o","......ox","...oo.ox","...oaoaa","...oaoew","....owww",".....odd"]),
 back =M([".......o","......ox","...oo.ox","...oaoaa","...oaoaa","....obbb",".....odd"]),
 side=[".......o........","......oxo.......",".....ooxoo......","....oaaaaao.....","....oaaawwoo....","....obbbweeo....",".....obbddo....."])
HEAD['atx'] = dict(  # ATX：方盒头、侧面传感器、整条橙色目镜
 front=M(["........","...ooooo","...oaaaa","..ooaaaa","..okoeee","..ooobbb","....oddd"]),
 back =M(["........","...ooooo","...oaaaa","..ooaaaa","..okobbb","..ooobbb","....oddd"]),
 side=["................","....oooooooo....","....oaaaaaaao...","..ooaaaaaaaao...","..okobbbbeeeo...","..ooobbbbbbbo...","....oddddddo...."])
HEAD['mith'] = dict( # 秘银：后伸天线、宽目镜、灰色侧舱
 front=M(["..o.....","..ko....","...ko.oo","....ooaa","...ogoee","...okobb",".....odd"]),
 back =M(["..o.....","..ko....","...ko.oo","....ooaa","...ogoaa","...okobb",".....odd"]),
 side=["..o.............","..oko...........","...oko.oooo.....",".....ooaaaaoo...",".....ogbbbeeo...",".....okbbbbbo...","......oddddo...."])
# ---------------- 机身（第 6–15 行）----------------
BODY = {}
BODY['heavy'] = dict(
 front=M(["oooo.ooo","oaaboabb","oabbobcc","odbdobbb",".oooobdd","...oogoo","...obbbo","..oabbdo","..odddoo","..oooo.."]),
 back =M(["oooo.ooo","oaabokgg","oabbokgl","odbdokrr",".ooooorr","...oogoo","...obbbo","..oabbdo","..odddoo","..oooo.."]),
 side=["..ooooo..ooo....",".oggooaabbaoo...",".oglgoabcccbaoo.",".oglgobbbbbbbbo.",".okkgoddddoooo..","..ooooogoo......","......obbbo.....",".....oabbbdo....",".....oddddoo....",".....ooooo......"])
BODY['guard'] = dict(
 front=M(["........","....oooo","...oaobb","..oabobc","..obdobb","..oo.okd",".....obo","....oabo","....oddo","....ooo."]),
 back =M(["........","....oool","...oaobl","..oaborr","..obdokg","..oo.okd",".....obo","....oabo","....oddo","....ooo."]),
 side=["................",".....oooooo..ow.","....oabcbao.owo.","...oabbbbboowo..","...obbdbaaoooo..","....ooddoooo....",".....obbo.......","....oabbo.......","....oddddo......",".....oooo......."])
BODY['sniper'] = dict(
 front=["................","....ooooooooo...","....oaobcboao...","...oabobbbobao..","...obdoddddodo..","...oo.obbbo.ollo","......ob.bo..olo",".....oabooabo.lo",".....oddoodd..o.","......oo..oo...."],
 back =["................","...oooooooooo...","....oaokkkoao...","...oabogllobao..","...obdorrrodbo..","...oo.obbbo.oo..","......ob.bo.....",".....obaoobao...",".....oddoodd....","......oo..oo...."],
 side=["................","....oooooo......","...oabcbooooooo.","..oabbboklllllwo","..obbbbaggkkkoo.","...oddbooooo....","....obbo........","...oabbo........","...oddddo.......","....oooo........"])
BODY['striker'] = dict(   # 尖兵：背后一对翼片 + 脚底推进器
 front=M(["........","o...oooo","xo.oaobb","oxooabbc",".oxobdbb","..oo.okd",".....obo","....oabo","....orro",".....oo."]),
 back =M(["........","o...oooo","xo.oaokk","oxooabrr",".oxobdrr","..oo.okd",".....obo","....oabo","....orro",".....oo."]),
 side=["................","o.....oooooo....","xo...oabcbao....","oxo.oabbbbbo....",".oxooobdbaao....","..ooooddoooo....",".....obbo.......","....oabbo.......","....orrro.......",".....ooo........"])
BODY['command'] = dict(   # 指挥：肩上天线 + 披风
 front=M(["..o.....","..lo.ooo","..lo.oab","..oooabc","..oddobb","..odoakd","..odoobo","..ooooab","....oddo","....ooo."]),
 back =M(["..o.....","..lo.ooo","..lo.odd","..ooodda","..odddda","..oddddd","..oddddd","..oooddd","....oddo","....ooo."]),
 side=["......o.........","......lo........","....o.loooo.....","...odooabcbo....","...oddoabbbbo...","...odddbbaao....","...oddoddoo.....","...ooooobbo.....","....oabbbdo.....","....ooooo......."])
BODY['special'] = dict(   # 特种：双肩导弹舱
 front=M(["oooo.ooo","ogyoooab","ogyooabc","oggooabb",".oooobdd","....okod","....obbo","...oabbo","...oddoo","...ooo.."]),
 back =M(["oooo.ooo","oggoooab","oggoorrb","oggoorrb",".oooobdd","....okod","....obbo","...oabbo","...oddoo","...ooo.."]),
 side=["..oooo..........","..ogyyooooo.....","..ogyyoabcbo....","..ogggoabbbbo...","..ooooobbbaao...",".....ooddooo....",".....obbbo......","....oabbbo......","....oddddo......",".....oooo......."])
