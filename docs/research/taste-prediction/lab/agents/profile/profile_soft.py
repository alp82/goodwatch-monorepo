"""Same statements, but nothing is hidden: quality terms and all six kinds are applied (shrunk) even when too weak to show."""
import lib
def predict(D, user, tr_idx, tr_y, te_idx): return lib.fit(D, tr_idx, tr_y, {'strict': False}).predict(te_idx)
