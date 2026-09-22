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

## Round 3 (2026-09-23): the pools were the problem

The user pointed at Game of Thrones missing for "fantasy with dragons" and Blade Runner and The Fifth Element missing for "scifi with cars". Diagnosis with `scripts/ranking-lab-tiers.ts` and a one-off recall script (deleted):

- **The cosine prefetch is a poor candidate generator for sparse queries.** Cosine divides by the title's vector norm, so a title that scores high on many dimensions besides the queried ones ranks below flat titles. Game of Thrones has fantasy 10, spectacle 10, world immersion 10, wonder 8, contemporary realism 0 (5 of 5 bands) and sits at cosine rank 2788 of a 2000-point prefetch. Blade Runner is at 2656 and Mad Max: Fury Road at 2616 on "scifi with cars", all 3 of 3.
- **Top tiers are bigger than the prefetch.** 3198 titles hit all five bands on "fantasy with dragons", 2276 hit all three on "scifi with cars". The prefetch holds an arbitrary 2000 of them; roughly half of the best hundred by count are outside it.
- **The texts don't contain the words.** Neither Game of Thrones' essence text nor its synopsis contains "dragon". Its trope names do ("Our Dragons Are Different", "Dragon Rider"), and the keywords column exists, but the keyword and trope search only runs when the text pool has fewer than 100 rows.
- **"scifi" finds nothing in text.** No alias to "sci-fi" or "science fiction". Not addressed here.

A `min_should` prefetch per tier (all hits, one miss, two misses; 1000 each by cosine) plus the formula costs 60 to 140 ms from Node, the same as the cosine prefetch. Forcing the keyword and trope search costs 0.3 to 3 s on Crate for the dragon and car queries; that trope-name query needs work before production.

The capture now holds both candidate sources (cosine, tiers, both) and the text pool with and without keyword and trope evidence. New controls: vector candidates, keyword and trope evidence weight, popularity tiebreak.

Watch-title ranks under production, concrete leads on today's pools, and the recall preset (leads + tiers + keyword/trope evidence at half weight):

| Query | Title | Prod | Leads | Recall |
| --- | --- | --- | --- | --- |
| fantasy with dragons | How to Train Your Dragon | 7 | 30 | 8 |
| fantasy with dragons | The Hobbit: Desolation of Smaug | 8 | 40 | 9 |
| fantasy with dragons | House of the Dragon | 23 | 48 | 10 |
| fantasy with dragons | Game of Thrones | absent | absent | 92 |
| scifi with cars | Death Race | 1 | 1 | 5 |
| scifi with cars | The Fifth Element | absent | absent | 13 |
| scifi with cars | Blade Runner | absent | absent | absent |
| sunglasses at night | They Live | 1 | 1 | 1 |
| like groundhog day | Groundhog Day / Palm Springs | 1 / 2 | 1 / 3 | 1 / 3 |
| time travel complex | Predestination / Primer | 1 / 2 | 1 / 3 | 1 / 3 |
| complete nonsense | Kung Fu Panda | 1 | 96 | 96 |
| feel good cooking show | Cooku with Comali | 1 | 11 | 28 |

- Tiers plus evidence fix the dragon query outright: the top ten are all dragon titles. Game of Thrones enters but only at 92, because about 900 titles in the top tier have a higher weighted sum and its only evidence is trope names.
- Keyword and trope evidence at full weight floods: Death Race fell from 1 to 76 on "scifi with cars". Half weight keeps it at 5.
- Blade Runner still never appears: no "car" in its texts, tropes, or keywords, and it's not in the top three tiers by cosine within the tier. Only the union of pools showed it (159), and the union buries Groundhog Day under Barbie and Willy Wonka. Union stays out.
- Popularity tiebreak at half a unit: small, mixed. It lifted Inception and The Walking Dead into the top six of "scifi with cars". Not recommended.
