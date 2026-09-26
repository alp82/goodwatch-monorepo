# TV Tropes recovery review: run-2026-09-26c

Mark a recovered row `ok` only after checking that the page is this title (same work, year and medium).
Rows passed by the `known_url` rule (title and a near year, medium from the namespace) need the closest look.
Then run `import_tvtropes_recovered.py build-manifest` (docs/tvtropes.md).

## Recovered titles (1)

| media | tmdb_id | title | year | page | tropes | source | introduction | verdict |
|---|---|---|---|---|---|---|---|---|
| movie | 8880 | Che: Part Two | 2008 | Film/Che | 14 | shared_page (strict) | Che is a 2008 film directed by Steven Soderbergh about the life of Ernesto "Che" Guevara, based on his memoirs. It stars Benicio del Toro as Che, alongside Demián Bichir as Fidel Castro, Rodrigo Santoro as Raul Castro, and many others. The film is divided into two parts. The first covers the entiret | ok (owner 2026-09-26: Film/Che covers both parts; same page as Che: Part One, replayed from run-2026-09-26b without a request) |

## Other outcomes (0)

| media | tmdb_id | title | status | detail |
|---|---|---|---|---|
