# Item 016: live Sides port

October 16, 2026. Build preparation only for #674. No model calls, real reader runs, registration, production
changes, or commits. The real-pack build below is not a research result and is not ready for readers.

## Files and pin

Pinned the locally available `origin/main` at **`9c2ac7f85052fb2d92695dc3667b146a4e4c5032`**. GitHub was
unreachable (`gh issue view 674 --comments` failed), so the local brief is the task specification; no fetch or
remote freshness claim. All changed/new project files are under `docs/research/taste-loop/`.

- `lab/t5/live/prod/`: 13 byte-identical production files: portrait `sides.server.ts`, `person.server.ts`,
  `words.server.ts`, `view.ts`, `families.server.ts`; `domain/moods.ts`, `domain/taste-match.ts`;
  taste `taste.server.ts`, `formula.server.ts`, `pool.server.ts`; `server/utils/fingerprint.ts`,
  `ui/fingerprint/fingerprintMeta.ts`, and `utils/title-key.ts`.
- `lab/t5/live/page/`: five byte-identical evidence files: the Taste index route, `SidesOfYou.tsx`, `parts.tsx`,
  `taste-groups-name.ts`, and the portrait `index.server.ts`. These document rendering and display pruning;
  the impure index/route modules are not executed.
- `lab/t5/live/prod-manifest.json`: resolved commit, original repository paths, SHA-256 for all 18 files,
  stub boundaries, and erased type-only imports.
- `lab/t5/live/{adapter.ts,parity_check.ts,sides.py,tsconfig.json,stubs/}`: isolated Bun adapter, independent
  direct production parity call, pin validation, and the same impure-facade isolation as 015. The taste facade
  reexports pinned pure taste code; availability throws if reached. Snapshot/database type-only imports are
  erased by Bun and need no running loader, database, or Redis implementation.
- `lab/t5/pin_live.py`: reads the resolved commit with `git show`, traverses runtime imports, validates the
  complete closure before replacing a pin, and rejects missing revisions, `*-dirty`, option-like revisions,
  and staged/unstaged/untracked changes under the production app. Lab/docs changes do not prevent re-pinning.
- `lab/t5/live/removal.py`: live-only normalized movie namesakes added to the existing alias/series closure.
- `lab/t5/run.py`, `cases.py`: `--sides 6082cadc|live`, default `6082cadc`; selected fingerprint-order check,
  adapter, removal, freeze/replay, and source manifest. Live artifacts record their selection and full pin.
  A CLI replay with the wrong selection fails. Real live reader registration is explicitly refused.
- `lab/tests/test_t5_live.py`: invented-data parity, template, registry, stripping, removal, pinning,
  source selection, CLI selection, and frozen-content regression checks.

The original `lab/t5/prod/`, `prod-manifest.json`, `adapter.ts`, stubs, and parity adapter are unchanged.
Default and explicit `--sides 6082cadc` builds have identical frozen output. The four synthetic **content**
digests captured before editing match exactly:

| Digest | SHA-256 |
|---|---|
| Input | `8f62e2f426c18dd66fd53123e39968722c2e13693a893cedf552809e618b2d28` |
| Descriptions | `40c517f82a22cadd252ccf4d5864833faee565410b1610801394d5c146b2f039` |
| Cases | `cf1dff7e16c5d98c610c3ffd6c862efcfcaf117e499f98f8bde6603e681c0a80` |
| Prompt | `8fb4b8a4977357e3618b53b7d320f92eecb3c12aa1c90c455fea39680eaf87ca` |

The source digest necessarily changes with the shared runner/selector implementation; it is not relabelled as
015's old source digest. Historical 015 source-locked artifacts still require their original committed runner
for integrity verification. This port reproduces their description/case behavior on the old selection; it does
not rewrite their manifests. The source manifest includes shared Python, prompt, loader/stats, and the selected
adapter, stubs, pinned sources and (for live) page evidence, including `.tsx`. Changing a live pin/page changes
only the live version's digest; changing an old pinned source changes only the old version's digest.

## Text template and exact source lines

Paths and line numbers here refer to the byte-identical files at the pin, also saved in `live/page/`.
`goodwatch-webapp/app/routes/taste._index.tsx:69–78, 100–106` puts the `SidesOfYou` component inside the Taste
frame. This serialization is the **Sides description**, not navigation, the account banner, or other tabs.
The shared label is `Your taste mix` / `Mix` (`ui/taste/taste-groups-name.ts:7–11`); it is page naming, not an
extra generated group description. The picker uses it as an aria label, and shows each group's own name.

The lab walks the picker once, then visits every group in picker order. Production displays one selected panel
at a time (`SidesOfYou.tsx:38–48, 79–92`), so this represents the text available by visiting those panels,
not a claim that all panels are simultaneously on screen. No synthetic group numbers or “Here:” labels are added.

| Order | Text field | Production source under `goodwatch-webapp/app/` |
|---|---|---|
| 1 | `You love {first lowercased name}, and just as much {second lowercased name}.`, when a headline exists | `ui/taste/tabs/SidesOfYou.tsx:52–65` |
| 2 | `What you rate highly, grouped by what it shares, and close to each, what you've barely tried.` | `SidesOfYou.tsx:67–70` |
| 3 | Each group name, in picker order; picker cover images have empty alt text and add no title names | `SidesOfYou.tsx:173–203`, especially 191–199 |
| 4, per panel | `In your taste`, then the group name | `Here`, `SidesOfYou.tsx:234–241` |
| 5 | Up to four example titles and each example's own early rating | `Here`, `SidesOfYou.tsx:243–248`; `RatedPoster`, `parts.tsx:88–104`; `YourScore`, `parts.tsx:47–71` |
| 6 | `Nothing you've barely tried is close to {lowerFirst(name)} yet.` for the S screen's empty edge branch | `SidesOfYou.tsx:99–110` |
| 7 | Each attribute **label**, in production order, without hidden attribute scores | `SideChips`, `SidesOfYou.tsx:345–365`; its position is line 113 |
| 8 | When moods exist, `Open {mood names joined by " + "} in Watch next` | `InWatchNext`, `SidesOfYou.tsx:331–340`; its position is 114–116; names from pinned `domain/moods.ts` |
| 9 | `More of this`, then `Nothing more to suggest here yet.` | `MoreOfThis`, `SidesOfYou.tsx:388–403`; its position is 117–122 |

Example title strings stand in for the poster's title/alt text (`parts.tsx:92,96`) once; the accessibility prefix
“Poster for” is not an additional title. Year, type, public score, group count, group average and loved share
are not shown in this descriptive panel and are not serialized. In particular the old
“percent of loved titles; mean rating” line is gone. Rating tiles use the exact early score, without invented
rounding or a `/10` suffix.

Before serializing, the adapter applies production's display-title availability check and title-derived
franchise pruning, then takes four (`server/taste-portrait/index.server.ts:378–403` using the pinned
`franchiseOf`, `sides.server.ts:312–319`). The named-title registry is built from exactly these displayed
examples, after pruning, with unique sorted keys. Hidden fifth-to-eighth candidates, picker images with empty
alt, and decorative backdrops do not enter the registry.

**Numbers-only:** retain every decimal digit token from those text lines, in line order, strip all words, and
preserve empty line positions. Following this brief's “every number the live text shows”, this includes digits
inside example titles (tested with `1984`); it adds no hidden group statistics or years. This differs from 015's
explicit title-digit stripping, which remains unchanged on `6082cadc`. The `closest_printed_mean` baseline for
live uses the arithmetic mean of the **displayed example rating tiles**, not the unprinted group averages or
counts. If there are no displayed ratings, it is unavailable rather than supplied an invisible mean.

## Snapshot and personal order

The lab keeps 015's normalization and S-only scope: all `in_pool && has_fingerprint` titles, missing attribute
255 as zero, population standard deviation with zero-SD fallback 1, explicit poster facts, no backdrop fact,
and early scores/chosen titles only. Live mood membership is computed by the pinned `moodsOf` from each
title's frozen fingerprint and genres. Nothing is inferred from later personal scores.

As in 015, `person.unseen=[]` omits suggestions/edges. Their production empty-state copy is represented above.
This is parity with the live **S computation under the lab's inputs**, not the entire live recommendation
page: the actual page can have unseen suggestions, availability and its production reference pool. Services
are empty; no “On my services” toggle or alternative service empty-state is fabricated.

`personalOrderOf` returns `undefined` when the flag is off or the payload is unavailable
(`index.server.ts:137–146`). `buildSides` then defaults to `(keys) => keys` (`sides.server.ts:655–658`).
The adapter omits the argument and uses that exact fallback. No personal-order payload is loaded or rebuilt.
Here examples are ranked by the unchanged production early-score/typicality calculation; the optional
personal order affects the omitted suggestion branch, not those examples.

## Residual title links

Live removal repeats explicit alias closure, same-movie-series closure, and normalized namesake removal to a
fixed point. Normalization is Unicode NFKC, casefold, punctuation-to-spaces and collapsed whitespace.
Every movie whose normalized title equals a blocked show or movie title is excluded, including namesakes
reached through aliases/series; closure then removes its aliases/series too. The resulting set is applied to
**all three** later movie lists, before sampling. Synthetic tests demonstrate the former show-to-movie leak
and its removal in anchor and distractor lists, while the old selection retains its original behavior.

The frozen pack has **no usable character identity signal**: its cast entries are person IDs, not character
credits (`lab/pull.py:500–522`); detail columns are keywords, tropes, essence fields, synopsis, production IDs,
related-title IDs, fingerprint highlights and age certifications. None supplies character identities.
Shared actors and generic text/related-title links do not certify the same character. Only the requested
namesake addition is implemented; cross-franchise same-character links remain an explicit limitation.
No extra evidence was fetched or inferred from later ratings.

## Real-pack build: aggregates only

Private fresh folder: `~/goodwatch-research/taste/work/t5/run-016-live-port-20261016`.
Only its build inputs, descriptions, frozen cases, source manifest and local build ledger exist; reader
directories/answers were neither read nor created. Directory mode 700, all five files 600. The loader read
only the immutable pack named in the loop manifest, checked its hashes and selected fingerprint key order,
excluded owner and non-A ratings, and did not open the gate or pull/rebuild data. Numeric libraries were
limited to two threads.

| Coverage | Initial build | Required rematch |
|---|---:|---:|
| Structural members | 18 | 18 |
| Empty S among structural members | 0 (0.0%) | 0 (0.0%) |
| Primary members | 13 | **0** |
| Triples | 51 | **0** |
| Anchor list too short after removal | 2 | 2 |
| No feasible distractor pair | 3 | 16 |
| Members lacking all three feasible mean ranks (included in no-pair count) | 0 | 2 |
| Members with a moved split boundary | 2 | 2 |

Descriptions were built for 31 eligible histories; 30 were nonempty and 1 empty (3.2% of all descriptions,
distinct from the structural population). They contain 62 groups and 244 named-example registry entries
summed over descriptions. Removal losses were 274 later rows across structural anchors; this existing
coverage field includes movie-only filtering as well as named/alias/series/namesake exclusion, not just the
new namesake rule. Initial maximum distractor reuse was 12 and mean early-rating match gap 0.169789.

Every baseline is a member-weighted mean, as in 015:

| Baseline | Initial build | Final rematch |
|---|---:|---:|
| Middle displayed-list mean | **42.3077%** | n/a: no cases |
| Closest printed-example rating mean | **40.3846%** | n/a: no cases |
| Media type | 35.2564% | n/a: no cases |
| Always A | 31.4103% | n/a: no cases |
| Always B | 37.1795% | n/a: no cases |
| Always C | 31.4103% | n/a: no cases |

Both mean baselines exceed the unchanged 40% stopping line. The existing one-shot rematch, with all-pair
sampled mean range at most 0.2, retained no anchors with enough feasible balanced ranks. Final `ready=false`;
final-n power and null SDE are unavailable. No caliper widening, alternative rematch, reader run, or inference
about whether live wording carries personal signal follows from this build.

| Frozen build digest | SHA-256 |
|---|---|
| Source | `6d7f5e9c7ccfcf4a9e2f5fad28941f4d90b0c1c66e6fae28a25a0dfc0a6e4e4e` |
| Input | `1330419888451291dd68c994fdbdff2f004d840411b410bd7ff384a3fc0bbc59` |
| Descriptions | `fd83adda7fe4f2808e4ecbd23bc89ea31bd9e1e925c70b39e8fe705168e28c5f` |
| Cases (empty list) | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

The source manifest has 38 entries. A subsequent `checked(root, False)` validated the frozen build without
opening any reader records. All reported member-derived values here are aggregates or digests.

## Re-pin and validation

Use the brief's interpreter, here abbreviated as `$T5_PY`:

```bash
T5_PY=/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python
cd docs/research/taste-loop/lab
"$T5_PY" -m t5.pin_live <short-names-commit>
"$T5_PY" -m pytest -q tests/test_t5_live.py
```

Pinning updates the pure dependency closure, page evidence and manifest together. For a names-only production
change, no adapter edits are needed: names come directly from the pinned builder. The parity test compares
the adapter's raw view with an independently constructed snapshot passed directly to that builder. Recheck
the source-line table if the page changes beyond names. A changed pin invalidates the old live source digest;
build into a **fresh** private folder with `python -m t5.run --sides live --output <fresh-private-folder> build`.
Keep the pre-rematch/final coverage and all baselines; any future experimental design/registration is separate.

From the repository root, the required validation is:

```bash
"$T5_PY" -m pytest -q docs/research/taste-loop/lab/tests -k t5
```

Final validation: **72 passed, 105 deselected in 36.24 seconds**, including the CLI live-build/wrong-version
replay check and the existing synthetic fake-reader/fresh-process replay tests. No real reader was invoked.
`git diff --check` passed, and the original 015 production pin, manifest and adapter have no diff.
