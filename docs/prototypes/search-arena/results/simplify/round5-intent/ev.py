"""evalsimp CLI over the round-5 query set: dev..holdout4 incl. dev5, without the dev6 queries added at 10:37
(another agent's negation set), so the numbers match the latency runs (133 queries)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "harness"))
import evalsimp as ev
_orig = ev.contexts
def contexts():
    if ev._ctxs is None:
        _orig()
        ev._ctxs = [c for c in ev._ctxs if not c.id.startswith("dev6")]
    return ev._ctxs
ev.contexts = contexts
ev.main(sys.argv[1:])
