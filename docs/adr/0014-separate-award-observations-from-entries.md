# Separate award observations from canonical entries

Accepted: 2026-11-06.

TVDB reports useful title award rows, but frequently omits the nominated person, song or ceremony identity. Wikidata contributes explicit people, work qualifiers and ceremony entities, with uneven category coverage. A title/category/year tuple cannot identify an entry: two actors or songs can compete from the same film, while several producers can share a nomination.

Both adapters preserve immutable source evidence and emit `AwardObservation` records. Only a complete source scope replaces its previous active revision. Reconciliation produces entries with internal UUIDs and explicit recipient/work links; source IDs live in crosswalks. Compatible observations can support one entry. Unresolved observations remain available as qualified title or person highlights, without manufacturing recipients or complete award totals.

An edition needs evidence beyond a calendar year. Presentation year and award year remain separate. Work links distinguish the recognized work from its parent/context title. Character associations require explicit source role evidence plus an exact local credit match.

MongoDB owns raw snapshots, versioned observations, identities and reconciliation generations. CrateDB serves title and person projections behind one publication pointer. A complete replacement is written and refreshed before that pointer changes. Failed imports/publications leave the previous snapshot/generation usable. The last two successful serving generations remain available; source evidence is retained for replay.

Coverage defaults to partial. Agreement between incomplete sources does not prove completeness. Existing image pipelines continue to own TVDB actor/character images and TMDB fallback portraits.
