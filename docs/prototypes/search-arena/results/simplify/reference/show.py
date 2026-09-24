"""show.py <list name> [<list name2>] <qid> ...: top 10 with grades and own marks."""
import sys, json; sys.path.insert(0,'harness')
import catalog as C, metrics as M
cat=C.load(); G=M.load_grades()
qs=json.load(open('queries.json')) if False else None
names=[a for a in sys.argv[1:] if not ('-' in a and a.split('-')[-1].isdigit())]
qids=[a for a in sys.argv[1:] if a not in names]
L={n:json.load(open(f'results/simplify/lists/{n}.json')) for n in names}
import evalsimp as E
qmap={c.id:c for c in E.contexts()}
for q in qids:
    own=M.own_ids(qmap[q].query) or set()
    print(f'== {q} {qmap[q].query!r}')
    for n in names:
        ids=[x['id'] for x in L[n][q]][:10]
        g=G.get(q,{})
        m=M.graded_query6([x['id'] for x in L[n][q]],g)
        print(f'  [{n}] ndcg {m["ndcg10"]:.3f}')
        for i,p in enumerate(ids):
            r=cat.row_of.get(p)
            print(f'   {i+1:2d} {g.get(p,"?")} {"*" if p in own else " "} {cat.title[r]} ({cat.year[r]})')
