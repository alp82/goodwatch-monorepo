"""The readable profile as a predictor: usual rating + the effects of the statements the member would be shown. Nothing else."""
import lib
def predict(D, user, tr_idx, tr_y, te_idx): return lib.fit(D, tr_idx, tr_y).predict(te_idx)
