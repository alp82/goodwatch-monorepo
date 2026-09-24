import os, sys, time, statistics
os.environ.setdefault("HF_HUB_OFFLINE", "1")
sys.path.insert(0, "harness")
import torch, qemb, catalog as C
from concurrent.futures import ThreadPoolExecutor
me = qemb.model(C.EMBEDDINGS["me5s"][1]); bg = qemb.model(C.EMBEDDINGS["bgeb-notitle"][1])
tx_i = "query: funny X shows"; tx_r = "Represent this sentence for searching relevant passages: funny shows"
def e(m, t): return m.encode([t], normalize_embeddings=True)
W = int(os.environ.get("W", 1))
ex = ThreadPoolExecutor(1, initializer=torch.set_num_threads, initargs=(W,))
for _ in range(5): e(me, tx_i); e(bg, tx_r); ex.submit(e, me, tx_i).result()
n = int(os.environ.get("N", 30))
a, b, seq, par, w1 = [], [], [], [], []
for i in range(n):
    t = time.perf_counter(); e(me, tx_i); a.append(time.perf_counter() - t)
    t = time.perf_counter(); e(bg, tx_r); b.append(time.perf_counter() - t)
    t = time.perf_counter(); ex.submit(e, me, tx_i).result(); w1.append(time.perf_counter() - t)
    t = time.perf_counter(); e(me, tx_i); e(bg, tx_r); seq.append(time.perf_counter() - t)
    t = time.perf_counter(); f = ex.submit(e, me, tx_i); e(bg, tx_r); f.result(); par.append(time.perf_counter() - t)
m = lambda v: f"{statistics.median(v)*1000:.1f}/{sorted(v)[int(.95*len(v))-1]*1000:.1f}"
print(f"main threads {torch.get_num_threads()} worker {W}: me5s {m(a)} bge {m(b)} me5s@worker {m(w1)} seq {m(seq)} par {m(par)}", flush=True)
