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

## Style queries (round 6)

Packets with `"rubric": "style"` belong to queries whose `person_intent` is `style` or `both`: the query names a
person or studio and asks for their style ("tarantino vibes", "kubrick-esque", "edgar wright", "hbo prestige
drama"). For these, grade by fit to that person's or studio's style as the intent describes it (tone, mood, form,
recurring themes), not by who made the title. The `credits` field shows who made each title.

- 3: a top pick for the style. The person's or studio's own typical titles earn 3 unless the intent rules them out
  (for example Lynch's most surreal films in "like david lynch but less weird"). A title by someone else that
  genuinely shares the style also earns 3, the same as the person's own titles.
- 2: clearly shares much of the style, but not all of it.
- 1: shares only a genre or one surface element.
- 0: no real style fit, or contradicts the intent.
- Generic popular titles that share only a genre with the person's work get 0 or 1, however famous they are.
- An atypical title of the person's own (a minor credit, a documentary about them, a film far from the style the
  intent describes) is graded by fit like any other title.
- For `both` queries the intent puts the person's own titles first. That is an ordering preference: still grade
  each title by style fit, so a genuinely similar title by someone else can earn 3.
- Alternate cuts of one film (Redux, Extended, Director's Cut, ...): grade each by itself. The metrics count only
  the first cut in a list.
