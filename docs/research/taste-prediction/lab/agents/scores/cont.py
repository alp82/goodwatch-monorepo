"""scores agent, continuous variant: the pooled leader (agents/pooled/best.py) plus a personal audience-versus-critic lean.

Identical to pooled/best.py except for two extra personal numbers: the member's own slope on the audience composite
(IMDb, TMDB, RT audience, Metacritic user; each standardized, weighted by how many votes it rests on) and on the critic
composite (Metacritic, RT critics; zero when a title has no critic score). Both are drawn from the distribution of such
slopes among the other members (EM over D.others(user)), so with few ratings the member starts at the population's lean
and moves to their own as ratings arrive. See smodel.py / sfeats.py.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import smodel
predict = smodel.make(extra='lean')
