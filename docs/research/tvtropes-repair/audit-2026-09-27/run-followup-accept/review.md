# TV Tropes recovery review: run-followup-accept

Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).
Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.
Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).

## Recovered titles (1)

| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 431 | Cube | 1998 | Film/Cube1997 | 99 | page_link (reviewed) | Cube is a 1997 Sci-Fi Horror/mystery film directed by Vincenzo Natali. It is the first film in the Cube (Film Series). Seven strangers wake up inside a strange maze made up of interconnected, cubical rooms, some of which are filled with deadly booby-traps. With no memory of how they got there or who | ok |

## Other outcomes (0)

| media | tmdb_id | title | status | detail |
|---|---|---|---|---|
