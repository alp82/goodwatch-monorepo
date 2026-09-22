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

## Round 4 (2026-09-23): structured evidence, genre hints, scifi alias

Capture v4: tiers of 2000 (370 ms), exact keyword and whole-token keyword matches, trope hits with global frequency, genres and votes per title, and a branch-only alias so "scifi" also searches "sci-fi" (30 versus 3225 matching texts). Genre decisions from Jev are always empty in the lean question set, so the lab derives genre hints from request words (fantasy, scifi, heist, ...).

- Game of Thrones carries the exact keyword "dragon" and Blade Runner "flying car". Exact keyword at one unit, token keyword at half, trope names at half weighted by rarity: Blade Runner 35 and The Fifth Element 25 on "scifi with cars" (both absent before); Eragon 1, DragonHeart 2, The Dragon Prince 4 on "fantasy with dragons"; Russian Doll 9 on "like groundhog day"; Dark 70 and Tenet 71 on "time travel complex".
- The head of "feel good cooking show" becomes Somebody Feed Phil, The Makanai, Rachael Ray, Worst Cooks in America, Jinny's Kitchen. Cooku with Comali drops to 56.
- Costs: Edge of Tomorrow 17 to 131 and Happy Death Day 36 to 263 on "like groundhog day" (trope rows crowd them); Now You See Me 1 to 7 on the heist query; How to Train Your Dragon 7 to 15.
- Genre hint at half a unit: neutral to small positive (Takers 1 and Now You See Me 3 on the heist query). No downside seen.
- Still no clear winner: the tier tiebreak is decided by evidence counts, and the evidence sources are noisy in both directions.

## Round 5 (2026-09-23): Jev judge, phrase-aware. A winner.

`scripts/ranking-lab-judge.ts` asks Jev to score fit 0..4 for the top 40 of production and of recall + genre, from the essence text only (the question from the earlier combined-search prototype). 75 requests, 215k input tokens for 14 queries, about one cent. `judge.json` holds the scores; `sweep.py` renders presets headlessly.

The judge decides for concrete phrases and is skipped for mood phrases (`winner0` preset: fit at three units per level on concrete, zero on mood, over recall + genre). Against production on the 14 queries:

| Query | Production top 3 | Winner top 3 | Watch titles (prod → winner) |
| --- | --- | --- | --- |
| complete nonsense | Kung Fu Panda, Mechanic: Resurrection, Hardwired | Tim and Eric, Monty Python, Aqua Teen | Kung Fu Panda 1 → 96 |
| feel good cooking show | Cooku with Comali, Home Town, James May | The Makanai, Somebody Feed Phil, James May | Cooku 1 → 7; Home Town 2 → 43 |
| slow burn space horror | Texhnolyze, Galaxy of Terror, Dark Side of the Moon | Dark Side of the Moon, High Life, Alien | High Life 47 → 2; Alien absent → 3; Event Horizon 114 → 5 |
| grief after losing a child | Static, Southcliffe, Trial by Fire | The Child in Time, Rabbit Hole, The Dollmaker | Rabbit Hole 61 → 2; Manchester by the Sea 10 → 38 |
| scifi with cars | Frankenstein Unbound, Clockstoppers, Star Trek Into Darkness | The Last Chase, The Wraith, The Car: Road to Revenge | Death Race absent → 4; Fifth Element absent → 34; Blade Runner absent → 67 |
| fantasy with dragons | Rage of Bahamut, Story of the Voyages, DOTA | DragonHeart, DOTA, Dragons: Race to the Edge | HTTYD 7 → 6; Eragon 22 → 5; Game of Thrones absent → 87 |
| like groundhog day | Groundhog Day, Palm Springs, 12 Days of Christmas Eve | Groundhog Day, Palm Springs, Russian Doll | Russian Doll absent → 3; Edge of Tomorrow 17 → 11 |
| time travel complex | Predestination, Primer, Timecrimes | Predestination, Primer, Déjà Vu | Timecrimes 3 → 19; Dark absent → 104 |
| melancholy lighthouse keeper mystery | The Vanishing, Light Between Oceans, The Lighthouse | The Vanishing, The Returned, Pet Shop of Horrors | Lighthouse 3 → 4; Platform 7 9 → 6 |
| tense heist thriller, not bleak | Now You See Me, Lift, Takers | Lift, Now You See Me, Now You See Me 2 | Takers 3 → 7 |
| sunglasses at night | They Live, Arabian Nights 2, The Kingdom | They Live, Tales from the Crypt, The Midnight After | They Live 1 → 1 |
| tarkovsky (mood) | Begotten, Color of Pomegranates, Knight of Cups | You Won't Be Alone, Dreams, Sonny Boy | Stalker 9 → 28 |
| furious, craty (mood) | unchanged | unchanged | |

Wins on eight queries, ties on three, loses on two: "tarkovsky" (a single word Jev calls not concrete, so no judge runs; with the judge at three units it puts Nostalgia first and Stalker second) and Timecrimes on "time travel complex" (the judge under-reads its essence text).

What the winner is, in production terms:

1. Candidates: cosine prefetch of 2000 plus three `min_should` tier prefetches (all hits, one miss, two misses) at 2000 each. About 370 ms server side.
2. Rank: range count, weighted sum as tiebreak inside one unit, half a unit per matching genre named in the request.
3. Evidence for a concrete phrase: essence text one unit per hit up to three, exact keyword one unit, keyword containing the word half, trope names half weighted by rarity. Mood phrases: essence text capped at one unit, no keyword or trope evidence.
4. Judge for concrete phrases: Jev scores the top 40 from the essence text, fit decides, retrieval breaks ties. Five parallel requests per search. Not run for mood phrases.
5. Word aliases (scifi → sci-fi) before the text search.

Open before production: the trope-name query costs up to 3 s for common words and needs an index or a precomputed table; whether single-word names like "tarkovsky" should count as concrete; the daily Jev budget with the judge on every concrete search.
