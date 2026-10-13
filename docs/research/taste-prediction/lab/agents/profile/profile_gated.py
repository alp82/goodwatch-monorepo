"""The readable profile with the rating-count gates from the sample-size study: well made from 40 ratings, everything else from 80."""
import lib
GATES = {'quality': 40, 'gap': 80, 'kinds': 80, 'facts': 80, 'themes': 80}
def predict(D, user, tr_idx, tr_y, te_idx): return lib.fit(D, tr_idx, tr_y, {'min_ratings': GATES}).predict(te_idx)
