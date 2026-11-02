# THROWAWAY: search interpretation UI

Question: how should a person distinguish applied Discover filters, fingerprint
preferences, remaining search text and assumptions without reading the original
query back as a row of ambiguous chips?

Three structurally different variants run on the current start page, with its
existing query, auth and results. The component is lazy-loaded behind a DEV-only
`?variant=A|B|C` gate. It saves nothing.

With the project's normal local development environment, run:

```sh
npm run dev -- --host 127.0.0.1 --port 3003
```

Open:

- A: <http://127.0.0.1:3003/?variant=A&q=low+budget+scary+dark>
- B: <http://127.0.0.1:3003/?variant=B&q=low+budget+scary+dark>
- C: <http://127.0.0.1:3003/?variant=C&q=low+budget+scary+dark>

A uses typed constraint capsules and different fingerprint/text shapes.
B separates filters, fingerprint and search text into labelled rows.
C starts as a compact summary and expands into a receipt of interpreted values.

The floating bar changes the variant (or use left/right arrow keys outside fields),
selects example phrases, opens the searchable 58-example catalog of every current
filter family, and exposes the full relevant state. Click a token to inspect its
meaning. The catalog previews the selected variation. All of its data is marked
as review fixtures; live query interpretation and fingerprint readings are used
when available, with fixture fallback so this captured prototype works without
the experimental interpretation endpoint. Result cards still come from the host.

Directions already established by the user's request:

- Combine release-year bounds into `Released 1990–1999`.
- Use constraint names and values: `Seasons ≥ 7`, not `7+ seasons`.
- Keep bare `100` as literal search text rather than silently requiring GW ≥ 100.
- Show the chosen budget bound (`Budget < $5M`); explain the chosen preset in
  details rather than adding `(guess)` to the chip. The numerical cutoff is still
  an interpretation of the vague words. Explicit source-score thresholds remain
  explicit requests. Assumptions such as a guessed audience age or the direction
  of controversial ratings are marked with ≈ and explained on inspection.

Verdict: awaiting the user's visual review. No variant has been selected or
promoted. Rewrite the selected design as production code; remove the DEV gate and
losing variations from main after selection. The prototype's capture branch is
`prototype/search-interpretation-ui`, with context in issue #726.
