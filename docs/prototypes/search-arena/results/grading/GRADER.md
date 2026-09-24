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
  Exception: vague and mood queries, where being a good pick is part of the
  fit (see the section below).
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

## Vague and mood queries

Packets with `"rubric": "vague"` belong to queries that name a mood or an occasion but no subject, setting,
person or structure: "cozy", "funny", "bleak", "epic", "mindbending", "wholesome", "complete nonsense",
"something short to watch after work", "with my parents", "brain's fried, something warm and funny", "good first
anime". The ids so far: lab-00, lab-06, core-12, core-18, core-19, core-20, core-21, core-25, core-29, new-14,
new-17, new-18, ho2-20, and in holdout5 (set before any ranker ran on it) h5-01 to h5-08 and h5-28.
Apply this section to them even when a packet lacks the flag.

The user is an adult asking "what should I watch now?". Grade whether the title is a good pick for that moment,
not whether a word of the query appears in its packet.

- 3: a pick you would recommend to most adults for that mood or occasion: it delivers the mood strongly and is
  good and broadly appealing (well made, well liked, easy to get into).
- 2: fits the mood or occasion well, but is a weaker pick: uneven, niche, dated, or appealing to a narrower
  audience.
- 1: matches one surface feature only: a word, a tag, a runtime, a genre, with little of the mood.
- 0: a poor pick for the occasion even if it matches literally, or it contradicts the intent.
- A literal match on one word is not enough. "Short" is satisfied by a sitcom or a brisk 90-minute film, not by
  any short; "furious" or "nonsense" in a title or tag earns nothing by itself.
- Quality and broad appeal count here, unlike the general rule above: of two titles with the same mood, the
  better and more widely enjoyed one gets the higher grade. Obscure, low-rated or amateur-feeling titles
  rarely earn 3. Packets carry no ratings: use your knowledge of well-known titles, and for a title you don't
  know, don't give 3 on mood words in its packet alone.
- Shows made for young children (kids' cartoons, preschool series) are poor picks for an adult, usually 0 or 1,
  unless the query asks for kids ("with my parents" means two generations of adults). Family films adults enjoy
  too (Pixar, Ghibli, Paddington) are graded by mood like anything else. Example for "something short to watch
  after work": an old kids' cartoon with short episodes is 0, a dialogue-free horror short is 1 (short, but not
  an after-work pick), a well-liked sitcom or brisk crowd-pleasing comedy is 2 or 3.
- The query's intent still wins where it is explicit (for example lab-06 allows the Fast & Furious reading;
  core-21 says quality and popularity matter).
