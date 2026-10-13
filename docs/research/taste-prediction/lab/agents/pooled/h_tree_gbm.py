"""As h_pooled_gbm, with a second consensus column: boosted trees fitted on all other members (cross-fitted over titles)."""
import preds, pool
predict = preds.blend(pool.make(k=0, own=300., tree=150), preds.gbm)
