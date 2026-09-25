"""export_prototype.py --patch: rank each query over the TypeScript ranker's candidate pool instead of the prototype's.

PARITY_PORT_JSON names the port's run (search-ranking-run.ts --json, with traces). The prototype still computes every
signal itself; only the set of candidates it scores is the port's. When this reproduces the port's order, the
difference comes from the pool (which titles each top list returned), not from how the port scores them.
"""
import json, os

import numpy as np

_port = None


class _Numpy:
    """simp_combo's `np` with `unique` replaced for the pool: np.unique(np.concatenate(parts)) builds the pool."""

    def __init__(self, M):
        self._M = M
        self.pool = None

    def __getattr__(self, name):
        return getattr(np, name)

    def unique(self, x, *a, **k):
        if self.pool is not None and not a and not k:
            out, self.pool = self.pool, None
            return out
        return np.unique(x, *a, **k)


def apply(M):
    global _port
    _port = {q["id"]: q for q in json.load(open(os.environ["PARITY_PORT_JSON"]))}
    proxy = _Numpy(M)
    M.np = proxy
    rank = M.rank
    cat = M.C.load()

    def patched(ctx, cfg=None):
        q = _port.get(ctx.id)
        if q is not None and q.get("trace"):
            rows = sorted(cat.row_of[i] for i, _ in q["trace"]["candidates"] if i in cat.row_of)
            proxy.pool = np.array(rows, dtype=np.int64)
        try:
            return rank(ctx, cfg)
        finally:
            proxy.pool = None
    M.rank = patched
