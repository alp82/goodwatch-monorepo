"""How many ratings before each statement type is reliable: write the profile from a random 20/40/80/160/320 ratings, check on the rest."""
import pickle, warnings, numpy as np
warnings.filterwarnings('ignore')
import validate as V
from harness import Data
D = Data(); SZ = [20, 40, 80, 160, 320]
rows, prof = V.run(D, {}, 40, seed=5, sizes=SZ); pickle.dump((rows, prof), open('val_sizes.pkl', 'wb'))
for N in SZ:
    print(f'\n### written from {N} ratings (members with at least {N + 30}: {len({e["u"] for e in prof if e["N"] == N})})'); V.table(rows, prof, N); V.trust(prof, N)
    print('held-out: owner mae %.3f skill %.3f | others skill %.3f (%d)' % V.skill(prof, N))
