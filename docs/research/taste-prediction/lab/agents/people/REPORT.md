# people: who made a title and where it sits

Bottom line: for the owner, who made a title adds nothing measurable once the public scores and the 74 attributes are known.
The best predictor ties the baseline on owner `mae`, is slightly better on `macro_mae`, and is clearly better for the 22 other members.

## 1. Scored (harness, 10-fold owner, 5-fold others; all in ledger.jsonl)

| name | owner mae | macro_mae | rho | mae_bad | auc_bad | others skill | others rho |
|---|---|---|---|---|---|---|---|
| baseline: boosted trees on attributes + facts | 0.818 | 1.045 | 0.550 | 1.65 | 0.852 | 0.096 | 0.395 |
| people: baseline + extra structured facts (`x_facts.py`) | 0.812 | 1.040 | 0.565 | 1.65 | 0.855 | 0.098 | 0.409 |
| people: facts + monotone scores + column sampling (`x_mono.py`) | 0.816 | 1.038 | 0.562 | 1.63 | 0.855 | 0.110 | 0.425 |
| **people: facts + monotone scores + franchise stage (`best.py`)** | 0.819 | 1.033 | 0.563 | 1.61 | 0.855 | **0.119** | **0.436** |
| FAILED: member person effects as tree features (`x_people_te.py`) | 0.816 | 1.050 | 0.560 | 1.67 | 0.859 | 0.102 | 0.412 |
| FAILED: best + cast/director/writer effects in stage 2 (`x_people_stage2.py`) | 0.824 | 1.039 | 0.559 | 1.62 | 0.851 | 0.115 | 0.438 |

Averaged over three different 10-fold splits of the owner (not in the ledger): baseline mae 0.821 / macro 1.051 / rho 0.545;
best.py mae 0.818 / macro 1.031 / rho 0.557. So on the owner: mae unchanged, macro_mae about 0.02 lower (at the noise edge), rho about +0.01.

## 2. Files

- Best predictor: `agents/people/best.py` (imports `pf.py` and `pf2.py` from the same folder; no cache files needed; about 4 minutes with `--others`).
- `pf.py`: rating-free facts and entity groups (cast, director, writer, producer, composer, cinematographer, franchise, title-name family,
  studio, recommendation neighbours, genre x era and other interactions) and fold-safe target encoding.
- `pf2.py`: franchise position features and catalog-based people priors.
- Caches (`cache_E.pkl`, `cache_M4.pkl`, `oof_base.pkl`) only speed up my experiment scripts (`exp*.py`, `diag.py`, `scan.py`, `taste.py`); nothing scored depends on them.

## 3. What worked, what failed

Worked (small, but consistent):
- Franchise effect per member, in a second linear stage on the trees' out-of-fold errors: the shrunk mean error of the member's other rated
  films of the same franchise (leave-one-out). Others' skill 0.110 -> 0.119 on the final first stage (+0.008 on an earlier one, paired over 22 members t = 2.6);
  17 of 22 members get a positive weight. It is concentrated in members who rate whole franchises alike (leave-one-out correlation between a
  film's error and its franchise siblings' error is +0.59 pooled over other members).
- Public-score columns constrained to be non-decreasing plus sampling half the columns per split: others' skill 0.098 -> 0.110, rho 0.409 -> 0.425.
  Owner unchanged. This is regularisation, not a taste signal; other agents can reuse it for free.
- Extra facts (user score vs critic score, IMDb vote count, Metacritic user score, runtime, popularity, certificate, sequel keyword, flags):
  owner rho +0.015, others rho +0.014, mae within noise. The columns that track the trees' errors across members are the user-side scores
  (goodwatch user score positive for 86% of members, IMDb vote count 82%).
- Sequel facts in the second stage (sequel keyword, years since the first film): owner mae_bad 1.65 -> 1.61, macro about -0.01. Weak: the
  trees' remaining error on sequel-keyword titles is -0.17 +/- 0.10.

Failed (all within +/- 0.01 mae of the baseline, none repeatable):
- Member-specific person effects (cast with billing weights, top-3 cast, director, writer, producer, composer, cinematographer, any person),
  shrunk, fold-safe, either as tree features or as a second-stage correction. Leave-one-out correlation between a title's tree error and the
  shrunk error of its people, owner: cast +0.07, director +0.03, writer -0.02, producer 0.00, composer -0.07. That is under 1% of error variance.
  For other members cast and writer correlate +0.15 to +0.21, yet adding them still does not raise skill reliably (t about 1).
- Studio effects (owner correlation -0.10 to -0.13, i.e. nothing), title-name families (same information as franchise id, weaker).
- Neighbours in TMDB's recommendation / similar lists as a member-specific signal: correlation with the tree error about 0.
- Target-encoded interactions (genre x decade, genre pairs, animation method x genre, certificate x genre, flag x genre, highlight x genre,
  highlight pairs, 5-year era, language): trees already find these from the raw columns; encodings add noise.
- Rating-free people priors from the catalog (a director's or cast's average public score on their other titles, number of credits):
  owner mae -0.006 but others' skill -0.010. Not kept.
- Franchise position columns (entry number, series size, score drop from the first film, rating the member gave the previous entry) in the trees: no gain.

Why I believe the negative result: the diagnostic does not go through the trees at all (it correlates out-of-fold errors with
leave-one-out effects), covers 93% of the owner's titles for cast and 53% for directors, and the owner has 305 cast members with 4+ rated
titles. The names below look meaningful, but they are explained by what those people's films are like (scores, genre, attributes), which
the trees already see.

## 4. What it says about the owner's taste

Owner mean 7.12 over 744 ratings. "vs public" = average gap to what the public score alone predicts.

Raises ratings:
- Directors: Robert Zemeckis (7 films, avg 8.3, +0.6 vs public), Christopher Nolan (10, 7.9), Steven Spielberg (11, 7.8), Robert Rodriguez
  (5, 8.0, +0.9 vs public), Ridley Scott (6, 7.8), Hayao Miyazaki (6, 7.8), David Fincher (7, 7.6), James Cameron (7, 7.6). Writer: Quentin Tarantino (10, 7.8, +0.5).
- Cast: Robert Duvall (6, 8.7, +1.0), Leonardo DiCaprio (13, 7.8, +0.5), John Travolta (6, 8.0, +0.8), Jessica Chastain (6, 8.0),
  Matthew McConaughey (5, 8.2), Kate Winslet (5, 8.2).
- Composers: James Newton Howard (13, 7.7, +0.4), Alan Silvestri (16, 7.4), Thomas Newman (10, 7.5), Joe Hisaishi (6, 7.8).
- Franchises: Back to the Future (8.3), Asterix animated films (7.5), Despicable Me (7.5), Knives Out (7.7).
- Facts: anime (17 titles, avg 8.1), Japanese language (8.1), non-English overall (7.55 vs 7.07), thought-provoking flag (7.48 vs 6.69, +0.17 vs
  public), adult-rated drama (119 titles, 7.8), shows over movies (7.41 vs 7.07, but fully explained by their scores), films of the 1990s
  (+0.23 vs public) and of 2020 onward (7.66, +0.39 vs public). Highlighted for narrative structure (7.9), complexity, philosophical,
  non-linear narrative, psychological, social commentary, satire.

Lowers ratings:
- Sequels: the "sequel" keyword marks 102 titles averaging 6.36 (-0.54 vs public); 25% of them are rated 5 or less, against 7% of everything else.
  By franchise entry: first or standalone 7.25, second 6.68, third 6.16, later 6.47. The owner rates the original well and marks later entries down
  (The Matrix 10 then 6, 5, 7; The Mummy 8, 5, 4; Bourne 8, 5, 5; Ice Age 9, 6, 5; Star Wars 9, 9 then 7, 7, 5, 5; The Hobbit 8, 7, 5).
  This is the opposite of most other members, who rate a franchise alike.
- Producers and directors of 2000s spectacle: Jerry Bruckheimer (15 titles, avg 5.8, -0.8 vs public), Michael Bay (6, 6.0), Roland Emmerich (5, 6.0),
  Paul W. S. Anderson (4, 4.8), J.J. Abrams (3 directed, 5.0, -1.4 vs public), the Farrelly brothers (4, 5.5). Composers Trevor Rabin (8, 5.9) and John Powell (15, 6.4).
- Cast: Seann William Scott (7, 5.6), Orlando Bloom (5, 5.8), Danny Glover (5, 5.8), Angelina Jolie (4, 5.8), Eric Bana (5, 6.0).
- Franchises: Bad Boys (5.3), The Mummy (5.7), Bourne (6.0), Mission: Impossible (6.0), James Bond (15 films, 6.7).
- Facts: action films of 2000-2019 (158 titles, about 6.4), PG-13 action / adventure / thriller (6.4 to 6.5, -0.4 vs public), horror (6.5),
  especially party-style or escapist horror (6.1), pure-escapism flag (6.84 vs 7.61), background-friendly flag (6.79), 2000-2009 overall (6.87, -0.19
  vs public). Highlighted for adrenaline, spectacle, fast pace, scare, grotesque.
- Studios differ too (ids 130 and 2 lowest, 14 and 56 highest), but the pack has no studio names and the effect vanishes once scores are known.

In one sentence: the owner rewards idea-driven, well-constructed films and marks down loud PG-13 franchise product, sequels most of all;
individual names are a symptom of that, not a separate cause.

## 5. Next steps

1. Use the franchise stage and the monotone/column-sampling settings in whatever the final blend is; they are orthogonal to other agents' signals
   and are what lifts the other members (0.096 -> 0.119).
2. Pool people and franchise effects across members instead of per member (a director's effect estimated from everyone who rated them, then a
   per-member weight). Per-member data is too thin: other members show real cast/writer signal (+0.15 to +0.21) that a 60 to 350 rating history cannot pin down.
3. For bad titles, give the bad-title agent the sequel facts (`kw_sequel`, franchise entry number, years since the first film, score drop from
   the first film in `pf2.py`): it is the only fact here that separates the owner's bad titles (25% vs 7%).
