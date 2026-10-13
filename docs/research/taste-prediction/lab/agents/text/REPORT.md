# text agent report: what titles are about

## 1. Scores

Harness runs (in `ledger.jsonl`, owner 10-fold, others 5-fold):

| name | owner mae | macro_mae | rho | mae_bad | auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|
| BASELINE boosted trees + title facts | 0.818 | 1.045 | 0.550 | 1.65 | 0.852 | 0.096 | 0.395 |
| **text: trees+text feats blended with ridge stack** (`best.py`) | **0.788** | **1.004** | **0.595** | 1.58 | 0.877 | **0.128** | 0.420 |
| text: trees + 51 text features, no stack (`trees_text.py`) | 0.786 | 0.999 | 0.595 | 1.57 | 0.877 | 0.099 | 0.381 |
| text: baseline trees blended with ridge stack (`stack_only.py`) | 0.814 | 1.044 | 0.557 | 1.66 | 0.857 | 0.129 | 0.426 |

Rig runs (same splits as the harness, not in the ledger; logs `exp*.log`):

| name | owner mae | macro_mae | rho | mae_bad | auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|
| ridge on English embedding alone | 0.908 | 1.226 | 0.414 | 2.06 | 0.777 | 0.065 | 0.307 |
| ridge on multilingual embedding alone | 0.932 | 1.249 | 0.384 | 2.08 | 0.794 | 0.044 | 0.235 |
| ridge on tag space (SVD 96) alone | 0.898 | 1.201 | 0.450 | 2.00 | 0.797 | 0.072 | 0.296 |
| ridge on TF-IDF (essence_text + synopsis) alone | 0.921 | 1.255 | 0.412 | 2.13 | 0.806 | 0.035 | 0.228 |
| ridge on tropes alone | 0.945 | 1.318 | 0.366 | 2.29 | 0.766 | 0.034 | 0.217 |
| ridge on keywords alone | 0.979 | 1.359 | 0.251 | 2.35 | 0.712 | 0.024 | 0.155 |
| ridge on essence tags alone | 0.982 | 1.378 | 0.239 | 2.40 | 0.682 | 0.009 | 0.059 |
| baseline + ridge on baseline residuals (any text space) | 0.819 | 1.045 | 0.550 | 1.65 | 0.853 | 0.094 to 0.103 | 0.39 to 0.40 |
| baseline + embedding-neighbour residuals (k30) | 0.820 | 1.032 | 0.552 | 1.60 | 0.859 | 0.106 | 0.409 |
| trees + sequel flags + pooled text model of other members' taste | 0.813 | 1.043 | 0.565 | 1.66 | 0.854 | not run | not run |
| trees with ridge leave-one-out predictions as features | 0.814 | 1.034 | 0.554 | 1.62 | 0.859 | 0.084 | 0.357 |
| stack, band-balanced weights (bad titles weighted up) | 0.905 | 0.996 | 0.561 | 1.21 | 0.858 | -0.085 | 0.410 |

Trees with one text feature group added, owner mae averaged over three split seeds (baseline 0.821):
sequel flags 0.812, embedding PCA-16 0.810, tag SVD-16 0.813, TF-IDF SVD-16 0.802, multilingual PCA-16 0.828 (worse),
flags + embedding + tags 0.797, flags + embedding + tags + TF-IDF (the chosen set) 0.789, 12 of each 0.786, 24 of each 0.792,
32 of embedding and tags 0.811.

## 2. Files

- Best predictor: `agents/text/best.py` (runs through the harness as is, 139 s with `--others`).
- Cached features: `agents/text/text_feats.npz` (16 MB, read by `best.py`), built from `agents/text/feats.pkl` (40 MB) by
  `agents/text/feats.py`. If the npz is missing, `best.py` rebuilds it (about 30 s).
- Ablations: `trees_text.py`, `stack_only.py`. Analysis: `tags.py` / `tags.log` (tag effects), `explain.py` / `explain.log`
  (themes, significance), `rig.py` (experiment rig).

## 3. What worked, what failed

Worked:
- **Compressed text features inside the trees.** Adding 51 columns to the baseline's trees (3 sequel flags, 16 PCA components
  of the English embedding, 16 SVD components of the tag space, 16 SVD components of the essence_text + synopsis TF-IDF) takes
  the owner from 0.818 / 1.045 / 0.550 to 0.786 / 0.999 / 0.595 (mae / macro / rho). Why I believe it: (a) the gain holds on
  three split seeds (0.821 to 0.789 average, every seed better); (b) paired bootstrap over the 744 held-out predictions gives a
  mean error gain of 0.032 with 95% interval [0.012, 0.053] on seed 0 and 0.038 [0.017, 0.059] on seed 1; (c) each feature
  group helps a little alone and they add up; (d) the gain is largest on bad titles (+0.09), then high (+0.03 to +0.05), then
  middle (+0.02). Caveat: I swept about 25 feature sets and report a round-number one (16 each) that was not the best in the
  sweep; expect some shrinkage on the locked quarter.
- **Blending the trees with a small ridge stack** (title facts, full embedding, tag space; non-negative weights on
  leave-one-out predictions; weight on trees n/(n+300)). This does nothing for the owner but lifts the other members from 0.096
  to 0.128 skill, 18 of 22 members better. Most of that is steadier linear models for members with few ratings (a facts-only
  ridge already gives 0.111 to 0.116); the text ridges add about 0.01 on top.

Failed or null:
- **Linear text signal beyond the baseline is zero for the owner.** Ridge on baseline residuals picks the largest penalty in
  every text space. Tag-effect reliability (split-half correlation of per-tag mean ratings, 200 splits) is strong on raw ratings
  (misc flags 0.56, essence-tag words 0.39, essence tags 0.34, keywords 0.23, tropes 0.11), weak after removing the public
  score (0.05 to 0.19) and indistinguishable from zero after the baseline (-0.23 to 0.05). The fingerprint already carries what
  the tags say linearly; the trees' gain comes from thresholds and tails of a few text directions, not from individual tags.
- Individual tropes are too sparse to use directly (6,591 tropes with 5+ owner titles, reliability 0.11 raw).
- Embedding nearest neighbours on residuals, radial kernels, ridge predictions fed to the trees, the multilingual embedding,
  more than 16 components per space: all within noise or worse.
- A pooled text model of what other members like (trained without the test titles): no gain.
- Bad titles: text helps ranking a little (auc_bad 0.852 to 0.877, mae_bad 1.65 to 1.58) but the average prediction for bad
  titles is still 6.1. Text does not fix the shrink-to-the-mean problem. Band-weighted stacking moves mae_bad to 1.21 only by
  wrecking mae (0.905) and others' skill (-0.085).

## 4. The owner's taste in plain terms

Raw tag effects (shrunk points above or below the owner's usual 7.1, n = owner titles with the tag). These hold out of sample
as a description, but the fingerprint already explains them.

Lowers ratings:
- Action spectacle: highlight adrenaline (-0.50, n=220), fast pace (-0.49, n=122), spectacle (-0.46, n=203), genre Action
  (-0.43, n=249); words blockbuster (-0.54), fast-paced (-0.50), explosive (-0.51), chase (-0.55), escapist (-0.54), franchise
  (-0.56), light-hearted (-0.51).
- Sequels: keyword sequel (-0.58, n=102), action hero (-0.42, n=25), secret agent (-0.26); tropes Actionized Sequel, Sequel
  Goes Foreign, In Name Only, Continuity Nod, Sequel Hook.
- Action tropes: Le Parkour (-0.49), Cool Plane (-0.41), Back-to-Back Badasses (-0.38), The Dragon (-0.34), Red Shirt Army
  (-0.34), Disney Death (-0.33).
- Horror (-0.40, n=44), scare and grotesque highlights, PG-13 (-0.34, n=202), background-friendly (-0.29), pure escapism
  (-0.26, n=477).
- Essence tags: historical fantasy (-0.61), escapist entertainment (-0.53), high-octane action (-0.52), family comedy (-0.49),
  comic book adaptation (-0.49), visual spectacle (-0.42, n=50).

Raises ratings:
- Story craft: highlight narrative structure (+0.52, n=39), direction (+0.37), complexity (+0.33), dialogue quality (+0.29);
  words complex (+0.53), storytelling (+0.48), non-linear (+0.47), dialogue (+0.42), narrative (+0.41).
- Ideas and people: philosophical (+0.41), thought-provoking (+0.34, n=406), psychological (+0.32), social commentary (+0.32),
  character depth (+0.31), catharsis (+0.30), Drama (+0.32, n=240).
- Satire and dark comedy: satire (+0.35 keyword, +0.42 word, n=98), dark comedy (+0.26), political satire (+0.37), adult
  animation (+0.29).
- Anime and Japanese titles (+0.44, n=17), TV-MA shows (+0.39), Sci-Fi & Fantasy shows (+0.40).
- Tropes: Protagonist Journey to Villain (+0.45), Unreliable Narrator (+0.40), Black-and-Gray Morality (+0.39), How We Got Here
  (+0.39), Deliberate Values Dissonance (+0.38), Central Theme (+0.37), Riddle for the Ages (+0.36).
- Keywords: parent child relationship (+0.35), detective (+0.26), war (+0.24), based on true story (+0.21).

What the text adds beyond the fingerprint (effect of each text feature in the owner's final trees, 90th vs 10th percentile):
- A "horror, dread, surreal, absurdist, cult" versus "drama, action, crime, justice, procedural" direction: +0.32 points. The
  low end (formulaic high-stakes crime and action drama: Spectre, Fast Five, Air Force One, Creed II) is rated about 0.3 below
  what the baseline expects. Note the contrast with the raw list: horror as a genre is rated low, but strange and unsettling
  titles are rated above expectation once quality and attributes are accounted for.
- Being a sequel: -0.28 points beyond everything else. The bad list is full of late franchise entries (Matrix Revolutions,
  Indiana Jones 4, Mummy 3, Shrek the Third, Rush Hour 3, Lethal Weapon 3, Quantum of Solace, The Last Jedi, both Bourne
  sequels).
- Anime, documentary, philosophical versus superhero, sitcom, teen, comic adaptation: +0.14.
- Procedural, comfort, wholesome versus satire, absurdist, cringe, dark: -0.13.
- Witty mystery and romance versus war, biography, true story: -0.13 (the war and biography side is rated higher).
- High-octane action wording versus character-driven social drama: -0.10 on top of the fingerprint.

## 5. Next steps

1. Hand the 51 text features to whoever owns the final model: they are rating-independent, cheap, and stack with any tree
   model. Check them against the people and franchise agent's features, since "sequel" overlaps with franchise position (entry
   number in a series would be sharper than a flag).
2. Combine with a bad-title objective: text improves the ranking of bad titles (auc 0.877) but not their level; a calibration
   stretch or quantile objective on top of this ranking is where macro_mae should move.
3. Replace generic SVD components with a few named, supervised themes (sequel fatigue, formulaic action-crime, strange and
   unsettling, satire) built from tags, so the product can explain a prediction in words; verify each on the locked quarter
   before trusting it.
