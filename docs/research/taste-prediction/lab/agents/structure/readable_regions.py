"""The readable profile as a predictor: public scores (quality), then one offset per region of title space (six regions)."""
from common import scores, chain, regions
def predict(D, user, tr_idx, tr_y, te_idx):
    G = regions(D, 6)[0]
    return chain([scores(D), G - G.mean(0)], tr_idx, tr_y, te_idx)[0]
