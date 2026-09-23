# Search arena playground

Type any search and see production next to `r6` (round 6: `r5` plus style neighbours for person / studio style
queries and alternate cuts folded, `harness/run6.py` FINAL; not a contract winner), `r5` (round 5: `r4-combo-fast` plus person and studio boosts,
`harness/run5.py` FINAL) and the round-4 finalists (`r4-combo-fast`, still the accepted winner, and `r4-combo`,
both `harness/run4.py` FINAL), top 20 each. For a query that names a person or studio, the r5 column shows the
detected entity, the intent (filmography, style or both), the residual query and the centroid titles.

Start it from `docs/prototypes/search-arena`:

```sh
.venv/bin/python playground/serve.py
```

Then open http://localhost:8765. Startup takes about 25 s: it loads the catalog, the embeddings and the query
models, and builds the sparse indexes. `--port N` picks another port.

## What happens on a search

- A query from `queries.json` (matched after lowercasing and collapsing whitespace) uses its arena capture in
  `data/captures/<id>.json`. Grades from `results/grades.json` show as badges (0-3).
- Any other query uses `data/captures/adhoc/<hash>.json`. On a miss the server runs
  `goodwatch-webapp/scripts/arena-capture.ts --adhoc "<query>" --out <file>` once. That run takes about 1-15 s,
  depending on how long production search takes. It is read-only against production, like the arena captures:
  it reads the reading cache but never writes it, and it never calls `recordSearchHistory`. A fresh Jev reading
  costs about $0.0003 and is kept in that file, so repeating the query is free. The header shows the spend.
- The production column is the list captured at that time. The two finalists are ranked locally, which takes
  about 50-150 ms each.

## What the columns show

- A yellow row is in only one of the three columns.
- Click a row to see its details:
  - the weighted z-score components (`emb`, `fp`, `sparse/text`, `facet`, `coverage`, `ref agree`, `prior`,
    and `era/neg` for the remaining era and negation terms),
  - the discovery score and rank,
  - the title bonus and its match,
  - the essence tags and essence text.
- Under each finalist's header you see the reference title and the titles excluded with it, the coverage units,
  any spelling fixes and the era.
- Production rows show the cosine, weighted sum and combined score, plus production's own reasons.

## Limitations

- Ad-hoc queries have no grades, intent or anchors.
- The production list is a snapshot from the moment of capture. To refresh it, delete the ad-hoc file.
- New query embeddings are cached in `playground/cache/`. The server never writes `data/query-emb-*.json`.
- If Jev fails, production falls back to basic search. In that case only the production column is shown.
