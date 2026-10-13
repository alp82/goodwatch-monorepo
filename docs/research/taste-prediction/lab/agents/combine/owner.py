"""combine, "owner" operating point: same model as best.py, rare bands count more (alpha 0.75): lowest macro_mae, bad titles get low scores."""
import best
def predict(D, user, tr_idx, tr_y, te_idx): return best.predict(D, user, tr_idx, tr_y, te_idx, alpha=best.ALPHA_OWNER)
