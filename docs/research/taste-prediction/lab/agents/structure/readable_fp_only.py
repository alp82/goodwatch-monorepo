"""Readable profile on the fingerprint alone: the eight craft attributes (quality), then one offset per region of title space."""
from common import chain, regions, cols
def predict(D, user, tr_idx, tr_y, te_idx):
    G = regions(D, 6)[0]
    return chain([D.Z[:, cols(D)[0]], G - G.mean(0)], tr_idx, tr_y, te_idx)[0]
