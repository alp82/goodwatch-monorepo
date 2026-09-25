"""export_prototype.py --patch: the prototype with production's vote counts, as the port sees them.

The port reads vote counts from two places: the index build's title table (priors, seeds, name masses, "like X"
titles, and which titles the build indexed) and Qdrant's live payload (the eligibility filter of every query). This
patch gives the prototype both:
  PARITY_TITLE_TABLE  the build's title_table.json.gz: votes and GoodWatch scores of the indexed titles; a snapshot
                      title the build didn't index gets 0 votes (it was below 2,000 votes, adult or deleted then);
  PARITY_VOTES        a snapshot of the live payload ({"votes": {point id: [votes, adult]}}): a query keeps only the
                      titles with at least 2,000 votes there, as the Qdrant filter does.
Titles the snapshot doesn't have (new since 2026-09-23) stay out: the prototype can't rank them.
"""
import gzip, json, os

import numpy as np


def apply(M):
    import context as X
    C = M.C
    cat = C.load()
    tt = json.load(gzip.open(os.environ["PARITY_TITLE_TABLE"]))
    row = {int(p): i for i, p in enumerate(tt["point_ids"])}
    votes = np.zeros(len(cat.ids), cat.votes.dtype)
    gw = np.full(len(cat.ids), np.nan, cat.goodwatch_score.dtype)
    for r, pid in enumerate(cat.ids):
        i = row.get(int(pid))
        if i is not None:
            votes[r] = tt["votes"][i]
            gw[r] = np.nan if tt["goodwatch_scores"][i] is None else tt["goodwatch_scores"][i]
    cat.votes, cat.goodwatch_score = votes, gw
    live = json.load(open(os.environ["PARITY_VOTES"]))["votes"]
    ok = np.array([(live.get(str(int(p))) or [0, None])[0] is not None
                   and (live.get(str(int(p))) or [0, None])[0] >= 2000
                   and (live.get(str(int(p))) or [0, None])[1] is not True for p in cat.ids])
    load_query = X.load_query

    def patched(q, c):
        ctx = load_query(q, c)
        ctx.mask = ctx.mask & ok
        return ctx
    X.load_query = patched
