"""best.py rounded to whole ratings (same output convention as badscores/round_reg.py)."""
import numpy as np, best
def predict(D, user, tr_idx, tr_y, te_idx): return np.round(best.predict(D, user, tr_idx, tr_y, te_idx))
