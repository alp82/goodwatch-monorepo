"""best.py through the badscores output shape (rating distribution from the point score, band-weighted median, alpha 0.5)."""
import os, sys, preds
sys.path.insert(0, os.path.join(preds.LAB, "agents", "badscores"))
import shape, best
def predict(D, user, tr_idx, tr_y, te_idx):
    return shape.shape_point(lambda a, b, c: best.predict(D, user, a, b, c), tr_idx, tr_y, te_idx, alpha=0.5)
