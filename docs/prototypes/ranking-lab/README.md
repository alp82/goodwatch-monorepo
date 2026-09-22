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

## Answers so far (2026-09-22)

- The production preset reproduces the main branch ordering exactly; the range-count preset reproduces the prototype branch.
- Stricter bands (7 / 3) keep the "complete nonsense" fix and bring Begotten back to first on "tarkovsky", with Stalker at 14. This is the only preset that improves both.
- A count-plus-sum blend needs a span of several units before the sum can cross a tier: with 23 query dimensions the observed sum range is wide and one hit is a small fraction of it.
- Near-miss credit (0.5 for one step outside the band) does not rescue Stalker and pushes Kung Fu Panda further down. Neutral to negative.
- Union and RRF surface The Last Sharknado (rank 12) for "complete nonsense", which the text-first path cannot. RRF puts "Zoom" first for "feel good cooking show", so plain RRF is out.
- Cooku with Comali, the previous leader for "feel good cooking show", misses three of eleven bands. No count-based configuration keeps it in the top 100; only the additive text evidence on main did.
