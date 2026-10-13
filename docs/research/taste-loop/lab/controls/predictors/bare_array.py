"""Contract canary: returns a bare array instead of the dict the contract asks for. The harness must reject it."""
import numpy as np


def predict(view):
    return np.full(len(view['targets']['title']), 7.0)
