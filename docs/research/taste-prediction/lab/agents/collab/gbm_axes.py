"""Baseline boosted trees blended 0.6/0.4 with a ridge on the other-member consensus + 4 taste axes."""
import best
def predict(D, user, tr_idx, tr_y, te_idx):
    a = (D, user, tr_idx, tr_y, te_idx); return 0.6 * best._g(*a) + 0.4 * best._ax(*a)
