# Item 016 brief: port the T5 S adapter to the live Sides of you

For the builder (Codex). Ticket [#674](https://github.com/alp82/goodwatch-monorepo/issues/674). October 16, 2026.

## Situation

Item 015 (#656) ran T5 on the Sides code pinned at `6082cadc` (`lab/t5/prod/`, `lab/t5/prod-manifest.json`,
`lab/t5/adapter.ts`). Production has since rewritten Sides of you (#666, the "taste groups" rename, "Your taste mix").
The owner wants T5 rerun on the live descriptions. Names are being shortened in another thread right now, so this
port targets current `origin/main` and will be re-pinned once more when that lands; build it so re-pinning is one
command plus a parity run.

Read first: `../015-t5-whose-taste/` (`PREREG.md`, `RESULTS.md`, `REPORT.md`, `REPORT-fixes.md`, the three
`REVIEW-fable*.md`), then `lab/t5/` and its tests.

## What to build

1. **Keep 015 reproducible.** Do not change `lab/t5/prod/`, `prod-manifest.json`, `adapter.ts` or anything that
   changes item 015's frozen behavior. Add the live version beside it, for example `lab/t5/live/` (pinned files,
   manifest, adapter, stubs), selected by a `--sides 6082cadc|live` option on `t5.run` (default `6082cadc` so
   015's replay is unchanged). The source digest must cover whichever version a run uses.
2. **Pin script.** `python -m t5.pin_live <commit>`: copies every production file the live `sides.server.ts` needs
   (transitively: `person.server.ts`, `words.server.ts`, `view.ts`, `families.server.ts`, `~/domain/moods`, and
   whatever else) from `git show <commit>:<path>` into `lab/t5/live/prod/`, byte-identical, and writes the manifest
   (commit, path, SHA-256). Stub only impure imports (title snapshot, Redis, database, availability), as 015 did.
3. **Template = what the live page shows.** Find in the live webapp exactly which side text a member sees on the
   Taste page now (group name, traits or labels, examples and their ratings, any line removed such as the share
   line) by reading the route and components that render Sides of you / taste groups. Serialize that and only that,
   text only, in page order. Record in `REPORT-port.md` which component and lines each field comes from. Keep the
   numbers-only control consistent: every number the live text shows, nothing else.
4. **Personal order.** The live `buildSides` takes an `OrderTitles` function (personal order). The lab has no
   personal-order payload at the cutoff. Use the production fallback when no personal order exists, if there is
   one; otherwise a deterministic, rating-free order you document. Never use later ratings.
5. **Named-title registry** for the live text, as before, so removal stays complete (named titles, aliases,
   franchise siblings).
6. **Residual title links** from `../015-t5-whose-taste/REVIEW-fable-result.md`: also remove from all three lists a
   movie whose normalized title equals a named title (show or movie), and same-character films across different
   franchise ids if the pack has a usable signal for that (if not, say so and add only the namesake rule). Apply this
   to the live path only, so 015 is unchanged.
7. **Tests** on made-up data: parity of the adapter against a direct call of the pinned live `buildSides`; template
   fields; numbers-only stripping; registry completeness; namesake removal; `--sides 6082cadc` reproduces 015's
   synthetic digests exactly; the pin script refuses a dirty or missing commit.

## Rules

- No model calls, no reader runs, no registration. You may run `t5.run --sides live build` against the real pack into
  a fresh folder under `~/goodwatch-research/taste/work/t5/` to report coverage, empty share and baselines, but do not
  look at reader answers (there are none) and do not commit member data. Report aggregates only.
- Python: `/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python`; `bun` for TypeScript.
- Work only under `docs/research/taste-loop/`. Do not commit.

## Done when

- `pytest -q docs/research/taste-loop/lab/tests -k t5` passes, including the new tests.
- `REPORT-port.md` in this folder: files, the pinned commit, the template with its source lines, personal-order
  choice, real-pack build aggregates (structural and primary members, empty share, triples, every baseline), and
  what a re-pin after the short names needs.
