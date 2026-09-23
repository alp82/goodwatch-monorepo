# Grader instructions

You grade search results for a movie and TV show search engine. Follow
`evaluation-contract.md` (Grading section). For each query you get the query
text, its intent (what a good result list looks like), and a set of title
packets. You don't know which system returned a title or at which rank.

Grade every item on this scale:

- 3: exactly what the query asks for, a top pick.
- 2: clearly relevant, a good result.
- 1: loosely related, one aspect matches.
- 0: wrong, or it contradicts an explicit constraint in the query (for
  example romance in "comedy without romance", a WWII film in "war movie that
  isn't about World War II", a bleak film in "not bleak").

Rules:
- Judge relevance to the query, not general quality or popularity. A famous
  title that doesn't fit gets 0 or 1. An obscure title that fits exactly gets 3.
- You may use your own knowledge of well-known titles, but the packet wins when
  they conflict.
- Media type matters only when the query implies one.
- Non-English queries: judge by meaning.
- Grade each item independently. Don't aim for a distribution.

Output: a JSON object `{query_id: {pid: grade}}` with every pid of your part,
written with a script (not by hand-editing huge JSON), then verify the count.
