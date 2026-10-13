"""Ablation: baseline trees (no text features) blended with the ridge stack (facts, embedding, tags)."""
import best
best.TEXT_IN_TREES = False
predict = best.predict
