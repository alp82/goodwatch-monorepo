# Catalog snapshot schema

Built 2026-09-23 by `scripts/build_catalog.py`, which runs read-only: a Qdrant scroll of
`media_fingerprint_v1`, then Crate `SELECT ... WHERE tmdb_id IN (...)` on `movie` and `show`.
Counts are in `catalog-stats.json`.

## Scope

Every point in `media_fingerprint_v1` (191,635 points) except adult titles (1 skipped).
There is no vote cutoff. Filter on `votes` yourself; the app's discovery cutoff is `votes >= 2000`.

- 191,634 rows: 110,790 movies and 80,844 shows. 50,305 have `votes >= 2000`.
- Missing fields: `essence_text` 19,590, `keywords` 84,138, `tropes` 159,652.

## `catalog.jsonl.gz`

One JSON object per line, sorted by `id` ascending. Row order is the embedding row order.

| field | source | notes |
|---|---|---|
| `id` | Qdrant point id | 1e12 + tmdb_id for a movie, 2e12 + tmdb_id for a show |
| `tmdb_id`, `media_type` | Qdrant | `movie` or `show` |
| `title`, `original_title`, `year` | Qdrant (`release_year`) | |
| `genres` | Qdrant | TMDB genre names |
| `essence_text`, `essence_tags` | Crate | |
| `synopsis` | Crate | `substr(synopsis, 1, 600)` |
| `keywords` | Crate | TMDB keywords, stored order |
| `tropes` | Qdrant payload `tropes`, else Crate `tropes` | TV Tropes names, stored (alphabetical) order |
| `fingerprint` | Qdrant vector `fingerprint_v1` | 74 floats, L2-normalized, order below |
| `fingerprint_scores` | Qdrant payload `fingerprint_scores_v1` | raw 0..10 ints keyed by dimension |
| `flags` | Qdrant payload | `is_anime`, `production_method` (`Animation` / `Live-Action` / ...), `suitability_*` (11), `context_is_*` (6); booleans or null |
| `votes` | `goodwatch_overall_score_voting_count` | 0 when null |
| `imdb_votes`, `tmdb_votes` | Qdrant rating counts | |
| `goodwatch_score` | `goodwatch_overall_score_normalized_percent` | 0..100 |
| `popularity` | Crate `popularity` | TMDB popularity |
| `imdb_id` | Crate | often null for shows |
| `poster_path` | Qdrant | TMDB poster path |

### Fingerprint dimension order

This is the same order as `VALID_FINGERPRINT_KEYS` in `goodwatch-webapp/app/server/utils/fingerprint.ts`.
The script checked it against the vectors.

```
0 adrenaline 1 tension 2 scare 3 violence 4 romance 5 eroticism 6 wholesome 7 wonder 8 pathos
9 melancholy 10 uncanny 11 catharsis 12 nostalgia 13 situational_comedy 14 wit_wordplay
15 physical_comedy 16 cringe_humor 17 absurdist_humor 18 satire_parody 19 dark_humor 20 fantasy
21 futuristic 22 historical 23 contemporary_realism 24 crime 25 mystery 26 warfare 27 political
28 sports 29 biographical 30 coming_of_age 31 family_dynamics 32 psychological 33 showbiz 34 gaming
35 pop_culture 36 social_commentary 37 class_and_capitalism 38 technology_and_humanity 39 spiritual
40 narrative_structure 41 dialogue_quality 42 character_depth 43 slow_burn 44 fast_pace 45 intrigue
46 complexity 47 rewatchability 48 hopefulness 49 bleakness 50 ambiguity 51 novelty
52 homage_and_reference 53 non_linear_narrative 54 meta_narrative 55 surrealism 56 eccentricity
57 philosophical 58 educational 59 direction 60 acting 61 cinematography 62 editing
63 music_composition 64 world_immersion 65 spectacle 66 visual_stylization 67 pastiche
68 psychedelic 69 grotesque 70 camp_and_irony 71 dialogue_centrality 72 music_centrality
73 sound_centrality
```

Known drift: in 5,367 rows (2.8%), `fingerprint` is not the normalized
`fingerprint_scores`. Their cosine is about 0.95 to 0.97, so one of the two is older (the title
was re-scored). Production search queries `fingerprint`, so use `fingerprint` to reproduce live ranking.

## Subject-matter embedding text

`embedding_text()` in `scripts/embed_catalog.py`. It captures what a title is about (premise,
setting, objects), which complements the mood, tone, and style held in the fingerprint.

```
"{title} ({year}). {genres, comma-joined}. {essence_tags, comma-joined}. {essence_text or synopsis[:600]}.
 Keywords: {keywords[:25]}. Tropes: {tropes[:15]}."
```

- Empty parts are dropped. A title without an essence uses the synopsis in its place.
- The text is 700 characters at the median and 1,089 at p95, so it fits within the 512-token limit.

## Embeddings

| file | model | dim | passage prefix | query prefix |
|---|---|---|---|---|
| `emb-bge-small-en-v1.5.npy` | BAAI/bge-small-en-v1.5 | 384 | none | `Represent this sentence for searching relevant passages: ` |
| `emb-e5-small-v2.npy` | intfloat/e5-small-v2 | 384 | `passage: ` | `query: ` |
| `emb-bge-base-en-v1.5.npy` | BAAI/bge-base-en-v1.5 | 768 | none | `Represent this sentence for searching relevant passages: ` |
| `emb-multilingual-e5-small.npy` | intfloat/multilingual-e5-small | 384 | `passage: ` | `query: ` |

- Each file is float16 with shape `(191634, dim)` and L2-normalized rows, so a dot product is the cosine.
- Row order matches `catalog.jsonl.gz`, and `emb-ids.json` lists the point ids in that order.
- Models were run on the GPU in fp16 with pooling from sentence-transformers: CLS for bge, mean for e5.

## Other files

- `latency.json`: CPU query-embedding latency with 4 threads (see `scripts/latency_and_sanity.py`).
- `sanity.md`: the top 10 per model for 5 probe queries, with `votes >= 2000`.
