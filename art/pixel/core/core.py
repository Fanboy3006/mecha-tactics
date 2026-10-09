# 骨干：20×20，正面写左半 10 列镜像 + 整行补丁（武器等不对称部件）；
# 背面 = 正面左右翻转、脸和眼换成头盔色；侧面整行写（朝右）。
from mm import over
def M(rows): return [r + r[::-1] for r in rows]
BASE = M([
 "..........",
 "..........",
 "......AAAA",
 ".....AAAAA",
 ".....AFFFF",
 ".....AFGFF",
 ".....AFFFF",
 "......AAAA",
 "...NNN.BBB",
 "..NAAANAAA",
 "..NAAANAAC",
 "...NNNBAAA",
 "....AA.BBB",
 "....BB.AAA",
 "......AAA.",
 "......AAA.",
 "......BBB.",
 "......AAA.",
 ".....NAAA.",
 ".....NNNN.",
])
SIDE_BASE = [
 "....................",
 "....................",
 "........AAAAA.......",
 ".......AAAAAAA......",
 ".......AAAAFFFF.....",
 ".......AAAFFGFF.....",
 ".......AAAAFFFF.....",
 "........AAAAAA......",
 "......NNN.BBB.......",
 ".....NAAANAAAA......",
 ".....NAAANAAAAC.....",
 "......NNNBAAAA......",
 ".......AABBBB.......",
 ".......BB.AAA.......",
 ".........AAA.AAA....",
 ".........AAA.AAA....",
 ".........BBB.BBB....",
 ".........AAA.AAA....",
 "........NAAA.NAAA...",
 "........NNNN.NNNN...",
]
def back_of(front):
    rows = [r[::-1] for r in front]
    tr = str.maketrans({'F':'A', 'G':'A', 'E':'A', 'C':'B', 'K':'A'})
    return [r.translate(tr) for r in rows]
def P(*rows):   # 补丁：只写需要的行，其余补空
    rows = list(rows) + ['.'*20] * (20 - len(rows))
    return [r.ljust(20, '.') for r in rows]
