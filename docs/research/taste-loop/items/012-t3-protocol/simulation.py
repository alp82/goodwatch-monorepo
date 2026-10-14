"""Synthetic T3 interval selection and joint planning; never loads research data.

Run: free -m, then python3 -B docs/research/taste-loop/items/012-t3-protocol/simulation.py
Writes aggregate simulation.json beside this source. One process/thread, 768 MiB address-space cap.
"""
import os
import resource
import sys
from pathlib import Path

available_kib = next(int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()
                     if line.startswith('MemAvailable:'))
if available_kib < 1536 * 1024:
    raise SystemExit('Under 1.5 GiB available; wait before running again.')

for name in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS",
             "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "BLIS_NUM_THREADS"):
    os.environ[name] = "1"
sys.dont_write_bytecode = True
resource.setrlimit(resource.RLIMIT_AS, (768 * 1024**2, 768 * 1024**2))

import hashlib
import json
from functools import lru_cache
import numpy as np
import scipy
from scipy.stats import beta, binom, t

SEED = 20261014
REPLICATES = 20000
BATCH = 100
METHODS = {"t": 0.0, "t_floor9": 9.0, "t_floor16": 16.0, "hoeffding": None}
# Categories: Seen low, Seen middle, Seen high, novel WTS, familiar WTS, rejection, Can't tell.
HARM = np.array([1, 0, 0, 0, 0, 1, 0])
HIT = np.array([0, 0, 0, 1, 1, 0, 0])
NOVEL = np.array([0, 0, 0, 1, 0, 0, 0])


@lru_cache(maxsize=64)
def critical(n):
    return float(t.ppf(.975, n - 1))


def interval(values, floor):
    """Row-wise equal-member mean interval, differences bounded in [-10,10]."""
    n = values.shape[1]
    mean = values.mean(axis=1)
    if floor is None:
        width = 20 * np.sqrt(np.log(1 / .025) / (2 * n))
    else:
        width = critical(n) * np.sqrt(np.maximum(values.var(axis=1, ddof=1), floor) / n)
    return mean, np.maximum(-10, mean - width), np.minimum(10, mean + width)


def categories(rng, probabilities, shape, concentration=9):
    # Dirichlet-multinomial clustering: 1+(10-1)/(9+1)=1.9 variance multiplier before overlap.
    probs = rng.dirichlet(np.array(probabilities) * concentration, size=shape[:2])
    return (rng.random(shape)[..., None] > np.cumsum(probs, axis=-1)[:, :, None, :]).sum(axis=-1)


def label(rng, cards, missing, p_absent):
    codes = cards.copy()
    if missing:
        # 10% partial sessions with 40% absent cards; otherwise 5% absent: average 8.5%.
        codes[rng.random(cards.shape) < p_absent[..., None]] = -1
        # 10% of Seen answers lack a rating. Can't tell is an answered, classifiable zero.
        codes[(cards <= 2) & (codes >= 0) & (rng.random(cards.shape) < .10)] = -2
    return codes


def harm_impute(codes):
    known = codes >= 0
    harms = np.where(known, HARM[np.maximum(codes, 0)], 0)
    count = known.sum(axis=-1)
    # Scorer-specific pooled known-slot rate in EACH synthetic study, never across studies.
    population = harms.sum(axis=(1, 2)) / np.maximum(count.sum(axis=1), 1)
    rate = np.divide(harms.sum(axis=-1), count, out=np.broadcast_to(population[:, None], count.shape).copy(),
                     where=count > 0)
    return (harms + (~known) * rate[..., None]).sum(axis=-1)


def probabilities(harm, hit, popular):
    seen = .25 if popular else .05
    seen_low = .05 if popular else .01
    novel = .08 if popular else .12
    p = [seen_low, seen * .20, seen * .80 - seen_low,
         novel, hit - novel, harm - seen_low, 1 - seen - hit - (harm - seen_low)]
    assert min(p) > 0 and abs(sum(p) - 1) < 1e-12
    return np.array(p)


def card_study(rng, batch, n, harm_diff, hit_diff=1.0, overlap=2, missing=True):
    pb = probabilities(.25, .20, False)
    pg = probabilities(.25 + harm_diff / 10, .20 + hit_diff / 10, True)
    shared_p = np.minimum(pg, pb)
    shared_p /= shared_p.sum()
    shared = categories(rng, shared_p, (batch, n, overlap)) if overlap else np.empty((batch, n, 0), int)
    # Shared labels are sampled ONCE; marginals remain exactly the registered latent per-ten means.
    g_only = categories(rng, (10 * pg - overlap * shared_p) / (10 - overlap), (batch, n, 10 - overlap))
    b_only = categories(rng, (10 * pb - overlap * shared_p) / (10 - overlap), (batch, n, 10 - overlap))
    # One partial-session state per member, shared by all cards and both scorers.
    p_absent = np.where(rng.random((batch, n)) < .10, .40, .05) if missing else None
    shared = label(rng, shared, missing, p_absent)
    g = np.concatenate([shared, label(rng, g_only, missing, p_absent)], axis=-1)
    b = np.concatenate([shared, label(rng, b_only, missing, p_absent)], axis=-1)
    def count(codes, vector):
        return np.where(codes >= 0, vector[np.maximum(codes, 0)], 0).sum(axis=-1)
    # Shared observed labels cancel; shared UNKNOWN labels have each scorer's imputed rate.
    return (harm_impute(g) - harm_impute(b), count(g, HIT) - count(b, HIT),
            count(g, NOVEL) - count(b, NOVEL))


def rate_record(successes, total):
    # Exact 97.5% one-sided Monte Carlo upper limit (for selection); no asymptotic zero-error claim.
    return {"rate": successes / total, "count": successes, "trials": total,
            "mc_upper975": float(beta.ppf(.975, successes + 1, total - successes)) if successes < total else 1.0}


def calibration():
    rng = np.random.default_rng(SEED)
    rows = []
    for n in (20, 30, 60):
        print(f'Calibration n={n}', flush=True)
        for family in ("diffuse_complete", "diffuse_missing", "concentrated_complete", "concentrated_missing",
                       "skewed_primary", "constant"):
            for effect in (0.0, .5, 1.0):
                counts = {name: [0, 0] for name in METHODS}
                sums = np.zeros(2)
                for start in range(0, REPLICATES, BATCH):
                    batch = min(BATCH, REPLICATES - start)
                    if family.startswith("diffuse"):
                        harm, primary, _ = card_study(rng, batch, n, effect, hit_diff=effect,
                                                     missing=family.endswith("missing"))
                    elif family.startswith("concentrated"):
                        harm = 10 * (rng.random((batch, n)) < effect / 10)
                        # Primary null includes symmetric rare +/-10; alternatives add a +10 atom.
                        u = rng.random((batch, n))
                        primary = 10 * ((u < .05 + effect / 10).astype(float) - (u > .95))
                        if family.endswith("missing"):
                            # All-or-none latent harm/interest: imputation recovers a constant member
                            # whenever >=1 classifiable slot; else scorer-population fallback.
                            known_g = rng.binomial(10, .85, (batch, n))
                            known_b = rng.binomial(10, .85, (batch, n))
                            g = np.where(known_g > 0, harm, np.divide((harm * known_g).sum(axis=1),
                                         np.maximum(known_g.sum(axis=1), 1))[:, None])
                            harm = g  # B2 is zero; every Can't tell would also be a zero.
                            primary *= (known_g + known_b) / 20
                    elif family == "skewed_primary":
                        harm = 10 * (rng.random((batch, n)) < effect / 10)
                        # Null: +1 for 10/11 of members, -10 for 1/11; the observed
                        # all-+1 sample has zero variance yet meets the point floor.
                        primary = np.where(rng.random((batch, n)) < (effect + 10) / 11, 1., -10.)
                    else:
                        harm = np.full((batch, n), effect)
                        primary = harm.copy()
                    sums += [harm.sum(), primary.sum()]
                    for name, floor in METHODS.items():
                        _, _, upper = interval(harm, floor)
                        mean, lower, _ = interval(primary, floor)
                        counts[name][0] += int((upper < 1).sum())
                        counts[name][1] += int(((mean >= 1) & (lower > 0)).sum())
                rows.append({"n": n, "family": family, "effect": effect,
                             "empirical_mean_harm": sums[0] / (REPLICATES * n),
                             "empirical_mean_primary": sums[1] / (REPLICATES * n),
                             "methods": {name: {"safety": rate_record(c[0], REPLICATES),
                                                "primary_pass": rate_record(c[1], REPLICATES)}
                                         for name, c in counts.items()}})
    # Fixed preference: least conservative listed method meeting EVERY boundary MC upper check.
    qualifies = [name for name in METHODS if all(
        row["methods"][name][metric]["mc_upper975"] <= .025
        for row in rows
        for metric in (["safety"] if row["effect"] == 1 else ["primary_pass"] if row["effect"] == 0 else []))]
    # Harm check at +1; primary false-win check at zero. Effect .5 is passage sensitivity.
    return rows, qualifies


def joint(chosen):
    rng = np.random.default_rng(SEED + 1)
    rows = []
    for n in (20, 30, 60):
        print(f'Joint planning n={n}', flush=True)
        for overlap in (0, 2, 5):
            for gain in (1.0, 1.5):
                counts = np.zeros(6, int)  # primary, safe, guards, joint, fail, inconclusive
                for start in range(0, REPLICATES, BATCH):
                    batch = min(BATCH, REPLICATES - start)
                    # Independent 2% union nonresponse per exposure. Assume no withdrawals or integrity failures.
                    harm, hit, novel = card_study(rng, batch, n, .25, gain, overlap, True)
                    # Own mix and franchise guards are explicit favourable assumptions based on T2a:
                    # bounded synthetic per-member differences; shared member variability with novelty.
                    latent = rng.normal(size=(batch, n))
                    shows = np.clip(-.157 + .16 * latent, -1, 1)
                    animation = np.clip(-.075 + .14 * latent, -1, 1)
                    franchise = np.clip(-.47 + .9 * latent, -9, 9)
                    responders = rng.random((batch, n)) >= .02
                    respondent_counts = responders.sum(axis=1)
                    for nr in np.unique(respondent_counts):
                        if nr < 20:
                            continue
                        select = respondent_counts == nr
                        keep = responders[select]
                        def group(x, floor):
                            return interval(x[select][keep].reshape(-1, nr), floor)
                        mean, low, _ = group(hit, METHODS[chosen])
                        primary = (mean >= 1) & (low > 0)
                        _, harm_low, harm_high = group(harm, METHODS[chosen])
                        safe = harm_high < 1
                        # Planning t proxy for the protocol's 10,000-draw guard bootstrap.
                        guards = group(novel, 0)[2] >= 0
                        for x in (shows, animation, franchise):
                            guards &= group(x, 0)[1] <= 0
                        passed = primary & safe & guards
                        failed = (group(hit, METHODS[chosen])[2] < 1) | (harm_low >= 1) | ~guards
                        counts += [primary.sum(), safe.sum(), guards.sum(), passed.sum(),
                                   failed.sum(), (~passed & ~failed).sum()]
                counts[5] += REPLICATES - counts[3:6].sum()  # Below 20 respondents is inconclusive.
                rows.append({"exposed_n": n, "overlap": overlap, "latent_hit_gain": gain,
                             "latent_harm_gain": .25,
                             **{name: rate_record(int(c), REPLICATES)
                                for name, c in zip(("primary", "safety", "guards", "joint", "fail", "inconclusive"), counts)}})
    return rows


def main():
    rows, qualifies = calibration()
    chosen = qualifies[0] if qualifies else "hoeffding"
    result = {"seed": SEED, "replicates": REPLICATES, "batch": BATCH,
              "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "numpy": np.__version__, "scipy": scipy.__version__, "methods_variance_floors": METHODS,
              "qualifying_methods": qualifies, "chosen": chosen,
              "calibration": rows, "joint": joint(chosen),
              "astra_n60_probability_at_most_two": float(binom.cdf(2, 60, .1)),
              "peak_rss_mib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024}
    Path(__file__).with_name("simulation.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in ("chosen", "qualifying_methods", "peak_rss_mib")}))


if __name__ == "__main__":
    main()
