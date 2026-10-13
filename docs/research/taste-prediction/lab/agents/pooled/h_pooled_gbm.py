"""Hierarchical ridge blended with the per-member boosted trees; the trees get weight 0.5 * n / (n + 100), none under 20 ratings."""
import preds
predict = preds.pooled_gbm
