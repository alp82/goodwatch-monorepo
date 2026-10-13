"""Control with no other-people signal: baseline boosted trees blended 0.6/0.4 with the member's own ridge."""
import best
def predict(D, user, tr_idx, tr_y, te_idx):
    a = (D, user, tr_idx, tr_y, te_idx); return 0.6 * best._g(*a) + 0.4 * best._own(*a)
