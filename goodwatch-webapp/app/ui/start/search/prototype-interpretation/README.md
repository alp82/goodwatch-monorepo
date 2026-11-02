# THROWAWAY: search interpretation UI

Question: how should a person distinguish applied Discover filters, fingerprint
preferences, remaining search text and assumptions without reading the original
query back as a row of ambiguous chips?

Three variants of the grouped B direction run on the current start page, with its
existing query, auth and results. The component is lazy-loaded behind a DEV-only
`?variant=B1|B2|B3|I1|I2|I3` gate. It saves nothing.

With the project's normal local development environment, run:

```sh
npm run dev -- --host 127.0.0.1 --port 3003
```

Open:

- B1, soft color chips: <http://127.0.0.1:3003/?variant=B1&example=dense>
- B2, colored dots and underlines: <http://127.0.0.1:3003/?variant=B2&example=dense>
- B3, separate Lean toward / Avoid groups: <http://127.0.0.1:3003/?variant=B3&example=dense>

Round 3 compares inputs while holding the chosen B2 readout constant:

- I1, original single-line input: <http://127.0.0.1:3003/?variant=I1&example=dense>
- I2, up to three lines with Search beside the field: <http://127.0.0.1:3003/?variant=I2&example=dense>
- I3, composer with a label and actions below: <http://127.0.0.1:3003/?variant=I3&example=dense>

The I-series switcher cycles only these three inputs. Existing B-series links
remain available for the prior comparison. All inputs retain the host's pause,
Enter and Search-button commit rules. Textareas accept Shift+Enter as a newline;
Enter submits, with IME composition left alone. I2 caps at three lines; I3 caps
at five lines. Longer text scrolls inside the field. The prototype lets the
start-page content flow vertically so the larger fields cannot overlap results.

B2 now collapses more than six filters into a count plus Show all / Show less,
leaving the fingerprint visible. The I-series uses a concise empty state. The
redundant Your search badge is removed. Constraint-relaxation buttons remove
the corresponding interpreted phrases from
the current query, update the composer, and rerun the start-page search. They
stay on `/`, clear the explicit preview, and preserve the other query text and
mood picks. They do not predict which constraint caused zero results. The local
interpretation response exposes `appliedPhrases: {parameter, phrase}[]` from the
engine's applied proposals; the dense fixture supplies its own source phrases.
Only constraints with available source phrases offer this action. Edit search
returns focus to the field. The Empty state switcher button toggles an explicitly
labeled preview
(`&preview=empty`) without replacing the real query or results. Turn it off to
see the host's actual results again. The chosen filters remain inspectable.

The user preferred B's grouped hierarchy. This round restores the existing
fingerprint dimension colors, softened with muted backgrounds and text mixing.
Negation has a minus marker and strike-through; B1 and B2 additionally say Not,
while B3 separates avoided qualities under its own heading.

The dense review fixture contains 17 filters and 16 fingerprint qualities,
including four avoided qualities. It is deliberately illustrative: it tests
wrapping and hierarchy rather than parser accuracy or recommendation quality.
The readout labels it Density example and State exposes the fixture source.
On small screens the crowded readout scrolls within the search panel.
Legacy A and B links map to B1; C maps to B3. The original round is captured in
commit 7ec33acc5.

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

Verdict: the user selected B2 (color notes), with applied filters shown last,
after remaining search text and fingerprint preferences. The user requested
implementation of long-query suggestions and an input comparison. I1/I2/I3
were compared; the user selected I3 (the composer).
The user also removed Pick up to three. The recommendation panel now explains
its purpose: Personalize your recommendations / Pick three titles you’ve seen
and loved. Its randomization button explicitly says Random mood, including on
phones. This action changes the search mood; it does not select loved titles.
The chosen direction is captured here for the production rewrite. The comparison
variants and switcher remain restricted to development. The prototype's capture branch is
`prototype/search-interpretation-ui`, with context in issue #726.
