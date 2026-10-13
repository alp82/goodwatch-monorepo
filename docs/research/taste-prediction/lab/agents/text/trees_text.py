"""Ablation: boosted trees with the 51 text features, no stacking."""
import best
best.STACK = False
predict = best.predict
