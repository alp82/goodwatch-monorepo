"""scores agent's recommended predictor: cont.py (pooled leader + personal audience/critic lean) through the badscores
output shape (rating distribution from the point score, band-weighted median, alpha 0.5), as in pooled/h_shape.py."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import sfeats, smodel
shape = sfeats.load(os.path.join(sfeats.LAB, 'agents', 'badscores', 'shape.py'), 'badscores_shape')
_cont = smodel.make(extra='lean')
def predict(D, user, tr_idx, tr_y, te_idx):
    return shape.shape_point(lambda a, b, c: _cont(D, user, a, b, c), tr_idx, tr_y, te_idx, alpha=0.5)
