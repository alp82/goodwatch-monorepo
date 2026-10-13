"""Quality then taste, both linear: public scores first, the 74 attributes on what the scores leave unexplained."""
from common import scores, chain
def predict(D, user, tr_idx, tr_y, te_idx):
    return chain([scores(D), D.Z], tr_idx, tr_y, te_idx)[0]
