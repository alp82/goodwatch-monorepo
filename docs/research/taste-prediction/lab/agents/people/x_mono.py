"""Baseline trees + extra facts, public scores monotone, half the columns per split. No second stage."""
import numpy as np, best
def predict(D, user, tr_idx, tr_y, te_idx):
    C = best._static(D); return best._fit(C, C['X'][tr_idx], tr_y).predict(C['X'][te_idx])
