"""badscores operating point alpha=0.5 (see shape.py)."""
import shape
def predict(D, user, tr_idx, tr_y, te_idx): return shape.predict(D, user, tr_idx, tr_y, te_idx, alpha=0.5)
