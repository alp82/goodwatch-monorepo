# Ranking lab. Throwaway prototype

Question: which ranking configuration for the D4 search orders titles best, and how should vector results combine with text hits?

Open `index.html` directly (or with `?q=<query index>&preset=<id>`). Nine captured queries, seven presets, and controls for the score bands, primary key, tiebreak, evidence cap, and the vector-plus-text combination. Every change re-ranks in the browser and shows each row's rank under the production preset. Nothing persists.

## Capture

From `goodwatch-webapp`, on branch `proto/range-count-ranking` (the capture script needs the branch-only `prototypeParts` export and the `textPool` field):

```sh
npx vite-node scripts/ranking-lab-capture.ts capture.json "complete nonsense" "tarkovsky" ...
python docs/prototypes/ranking-lab/build.py capture.json
```

Per query the capture holds the 2000-point cosine prefetch with the used dimension scores, the Crate text pool with its evidence, and titles for both. Jev readings come from the cache, so capture costs nothing. Timings in the header are the capture's own.

## Answers so far (2026-09-23, 14 queries)

Presets kept: production, range count with flat cap, concrete-aware cap, concrete phrase leads, concrete leads plus mood union, text pool only. Dropped after the first sweep: near-miss credit (neutral to negative), count-plus-sum blend (needs a span of several units before it does anything), strict bands 7/3 (fixed tarkovsky but cost the concrete queries: They Live 1 to 14, Primer 2 to 10), plain union (Grand Budapest Hotel led "like groundhog day"), RRF ("Zoom" led "feel good cooking show").

Watch-title ranks, production first, then range count with flat cap, then concrete phrase leads:

| Query | Title | Prod | Count | Leads |
| --- | --- | --- | --- | --- |
| complete nonsense | Kung Fu Panda: The Dragon Knight | 1 | 96 | 96 |
| complete nonsense | Tim and Eric | 6 | 1 | 1 |
| tarkovsky | Stalker | 9 | 28 | 28 |
| tarkovsky | Begotten | 1 | 24 | 24 |
| feel good cooking show | Cooku with Comali | 1 | 286 | 11 |
| fantasy with dragons | How to Train Your Dragon | 7 | 23 | 31 |
| like groundhog day | Groundhog Day / Palm Springs | 1 / 2 | 1 / 3 | 1 / 3 |
| time travel complex | Predestination / Primer | 1 / 2 | 1 / 2 | 1 / 3 |
| sunglasses at night | They Live | 1 | 1 | 1 |
| scifi with cars | Death Race | 1 | 1 | 1 |

- The phrase concreteness that the search already computes separates the two failure modes cleanly: "complete nonsense" and "tarkovsky" read as mood, all five new queries and "cooking show" as concrete.
- "Concrete phrase leads" (count 6/4, mood evidence capped at one unit, concrete evidence one unit per text hit up to three) is the best of the set: it keeps the nonsense fix, restores Cooku with Comali, and leaves the concrete queries within a rank or two of production.
- Adding the union for mood phrases on top changes only "complete nonsense", where The Last Sharknado appears at 12. Cheap to add, low stakes.
- Two open losses against production: Stalker and Begotten on "tarkovsky" (count cliff at one dimension scoring 5), and How to Train Your Dragon on "fantasy with dragons" (7 to 31; the text hits tie and the count separates less than the sum did). Both are the count-versus-sum trade-off, not the evidence rule.
