# People and studio data schema

Built 2026-09-23 by `scripts/pull_credits.py`. It runs read-only: Crate SELECTs only, through
`scripts/readonly_stores.py`. The script covers the 50,305 eligible catalog titles (`votes >= 2000`; the catalog
has no adult titles): 38,906 movies and 11,399 shows. All files are gzipped and gitignored (`*.gz`).
Raw query results are cached in `data/.credits-raw.pkl.gz`. Delete that file to re-pull.

Sources: `person_worked_on` (crew), `person_appeared_in` (cast), `person`, `movie.production_company_ids`,
`show.production_company_ids`, `show.network_ids`, `production_company`, `network`.
Crate has no `also_known_as` column. `person.original_name` is the only alias.

## `credits.jsonl.gz`

One line per eligible title, in catalog row order.

| field | notes |
|---|---|
| `id`, `media_type`, `tmdb_id`, `title`, `year`, `votes` | from the catalog; `id` is the Qdrant point id |
| `directors` | job `Director`, then `Co-Director`, at most 5. For shows these are episode directors, ordered by `episodes` (descending) |
| `writers` | Writing jobs (Writer, Screenplay, Story, Novel, Teleplay, Characters, ...), one entry per person with merged `jobs`, at most 8. Shows are ordered by `episodes` |
| `creators` | `Creator` credits, at most 4. For a show with none, the top 2 Executive Producer or Writer by episode count, the same as `pull_people.py`. Movies rarely have any (198) |
| `creator_source` | `creator`, `fallback_ep_writer`, or null |
| `cast` | the top 15 by `order_default` (billing order), deduplicated. Each entry adds `order`, `character`, and `episodes` (shows only) |

Each person reference has `{id, name, department (known_for_department), popularity}` plus the role fields above.
Every referenced person has a name.

Coverage:

| | titles | directors | writers | creators | cast | cast ≥ 5 | cast = 15 |
|---|---|---|---|---|---|---|---|
| movies | 38,906 | 38,781 | 37,535 | 198 | 38,405 | 36,871 | 25,480 |
| shows | 11,399 | 9,224 | 8,553 | 9,024 (8,642 fallback) | 11,003 | 8,842 | 2,566 |

Known quirk: the show fallback can rank a producer above the real creator. For Breaking Bad it gives Mark Johnson,
then Vince Gilligan. Gilligan is also the top writer.

## `persons.json.gz`

A JSON object that maps a person id (as a string) to a record:

| field | notes |
|---|---|
| `name`, `original_name` | `original_name` only when it differs from `name` (12,771 people, e.g. 宮崎駿) |
| `department` | TMDB `known_for_department` |
| `popularity` | TMDB person popularity (median 0.74) |
| `credits` | `{cast, director, writer, creator}`: eligible titles per role, counted from `credits.jsonl.gz` (cast = the top 15 only) |
| `titles` | distinct eligible titles in any role |
| `votes_sum` | the sum of `votes` over those titles |

Kept: `titles >= 2`, or `titles == 1` with `popularity >= 5` (156 people). That is 104,929 of 269,011 referenced
people, and 65,690 of them have `titles >= 3`. Departments: Acting 78,066, Writing 14,298, Directing 9,357,
Production 1,876.

Name collisions:
- Among people with ≥ 3 titles, 41.1% (27,030) have a surname that no one else in that group has (suffixes such as
  Jr. are ignored). The most shared surnames are Smith 188, Jones 161, and Williams 158.
- Among all kept people, 876 full names are shared by 2+ people (1,812 people). Among people with ≥ 3 titles, it's
  375 names (768 people), e.g. Brian Cox, Christopher Lloyd, Richard Harris, and James Fox.

## `companies.jsonl.gz`

One line per eligible title: `{id, media_type, tmdb_id, companies: [{id, name, country}], networks}`.
`networks` is a list of the same shape for shows and null for movies. Company order is TMDB's stored order.

47,084 of 50,305 titles have companies (34,511 distinct, all named). 11,099 of 11,399 shows have networks (1,061
distinct). HBO shows up both as a network (196 shows) and as a production company (`HBO` 165, `HBO Films` 110,
`HBO Documentary Films` 120).

The catalog text rarely names studios:
- No keywords for A24, Blumhouse, Ghibli, or Aardman.
- `pixar` appears on 4 titles.
- `marvel cinematic universe (mcu)` appears on 86 titles, and `dc extended universe (dceu)` on 17.
- Trope names are style tropes (`Ghibli Hills` 48, `DreamWorks Face` 35, `Disney Villain Death`) or franchises
  (`Marvel Comics` 8, `HBO` 6), not studio credits.

So studio queries need `companies.jsonl.gz`.
