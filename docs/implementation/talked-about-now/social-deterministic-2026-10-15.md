# LLM-free social matcher — 2026-10-15

Owner decision (Q17, #537): no extra cost, so social discovery matches titles without OpenRouter.
`f/social/deterministic` replaces the LLM extraction and identity gate in `f/social/ingest`.
`f/social/matcher` (LLM) stays in the repo but is no longer called.

## Rules

- **YouTube:** a unique official catalog video ID links directly (unchanged).
- **Mentions** come from the headline only: quoted titles, whole headline segments that are Title Case, ALL-CAPS runs, capitalised runs. Bluesky uses the linked article card (the quality gate only passes posts that link the 17 editorial outlets).
- A mention must equal a catalog title, original title or alternative title exactly (normalised).
- **Second signal** for one-word titles and names shared by several catalog entries: a release year in the headline (not the publication year), a cast/crew name from our own data in the post, a season number (series), the official video ID, or the URL slug. Names shared by more than 30 entries are dropped.
- Never linked: reference titles ("a ‘Succession’ star", "‘Ted Lasso’s Cristo…", "vom Regisseur von…", "‘Below’-Star"), subtitled works ("Harry Potter: Castle Chronicles" ≠ "Harry Potter"), person names, headline furniture ("Sneak Peek"), Broadway/stage headlines, old versions when a reboot/remake is announced, game-only articles. Only the first title links unless the headline lists works.

## Precision (bar: ≥ 90 % per source)

Hand-labelled evidence from 2026-10-14 (posts the LLM matcher had linked; independent labels):

| Source | Deterministic right / linked | Recall of LLM-right links | LLM matcher (right / wrong / unsure) |
|---|---:|---:|---|
| YouTube | 23 / 23 (100 %) | 23 / 45 | 45 / 4 / 1 |
| RSS | 22 / 22 (100 %)¹ | 21 / 44 | 44 / 3 / 3 |
| Bluesky | 10 / 11 (91 %) | 10 / 42 | 42 / 5 / 3 |

¹ One link the LLM did not make (‘American Doctor’ in a DOC NYC short-list headline), judged right.

Fresh production posts that pass the quality gate (read-only Windmill preview, 976 posts; reviewed by the cloud orchestrator that wrote the rules, so not independent): [evidence](evidence/social-deterministic-fresh-2026-10-15.json)

| Source | Posts | Links | Right | Wrong | Unsure | Precision |
|---|---:|---:|---:|---:|---:|---:|
| YouTube | 108 | 38 | 37 | 1 | 0 | 97 % |
| RSS | 400 | 82 | 77 | 4 | 1 | 95 % |
| Bluesky | 400 | 2 | 2 | 0 | 0 | 100 % |
| Mastodon | 68 | 0 | – | – | – | – |

Wrong: ‘Game of Thrones’ as a comparator, ‘The Last Airbender’ (2005 film) in an Avatar franchise piece, a ‘True Detective’ moment, The Big Bang Theory in a Chuck Lorre memoir piece, and Night City (2015) on a Cyberpunk teaser.

Recall roughly halves against the LLM matcher. Bluesky volume is tiny because the card title must name the work.

## Re-running

`goodwatch-flows/tools/social_deterministic_eval.py CACHE.json POSTS.json` scores the labelled evidence offline; the cache holds the catalog rows, credits and official video IDs for the evidence posts, fetched read-only through a Windmill preview that runs `DeterministicMatcher.lookup/people/official`.
