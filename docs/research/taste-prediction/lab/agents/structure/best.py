"""Best predictor: average of (quality, linear taste, member-specific similarity) and the boosted trees on attributes plus title facts."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'baselines'))
import gbm_facts, metric_kernel
def predict(D, user, tr_idx, tr_y, te_idx):
    return 0.5 * metric_kernel.predict(D, user, tr_idx, tr_y, te_idx) + 0.5 * gbm_facts.predict(D, user, tr_idx, tr_y, te_idx)
