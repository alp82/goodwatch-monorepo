"""Baseline boosted trees with every direct other-people column added: source disagreement, others' signals,
others' ratings of the title, graph embedding, graph-neighbour labels, user-user and item-item neighbours."""
import lib
predict = lib.make(['dis', 'sig', 'ost', 'gemb', 'kg', 'cf'])
