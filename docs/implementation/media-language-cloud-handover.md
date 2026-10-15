# Media language: cloud handover

Written 2026-10-15, about 04:15 Berlin, when the owner's laptop went offline. Cloud Claude sessions
(an hourly routine) carry on from here. The GitHub tracking issue linked from the routine prompt
lists each open item and its state. Keep that issue current.

## Where things stand

- Variant F shipped to main and production as `eacb4873`
  ("feat: show movies and shows in the visitor's language (variant F)").
- The ingestion fix is `a05bbf3f`, which uses Crate-compatible preserve-existing upserts in
  `goodwatch-flows/windmill/f/media_language/episode_translations.py`.
- Season and episode translation tables exist in production. Two ingestion runs have completed:

  | Run | Requests | Rows added | Failures |
  |---|---:|---|---:|
  | Breaking Bad and SAO | 216 | 169 season, 3,373 episode | 0 |
  | 200-show cohort | 21,062 | 7,163 season, 102,163 episode | 0 |

  Live pages show localized episode names, for example "Der Einstieg" and "剣の世界".
- Decisions live in `media-language-decisions.md`, page coverage in `media-language-surface-matrix.md`,
  and the rollout plan in `media-language-rollout.md`. The original brief is `media-language-handover.md`.

## Settled scope (owner answers, do not reopen)

- Only media fields are localized: title, poster, overview, tagline, and season and episode names
  and overviews. Page prose stays canonical English. That covers FAQ, fingerprint, taste and
  portrait, essence and every other generated text.
- No paid prose translation. Generated prose uses the English fallback.
- Crawlers, og images and downloads stay canonical English.
- The locale is resolved in this order: the account's pair, then the `gw_loc` cookie, then the browser.
- There are 14 launch locales: en, de, fr, es, it, pt-BR, pt-PT, ja, ko, zh-Hans, zh-Hant, pl, ru, ar.

## What a cloud session can and cannot do

- **Can:** read and change code, run `node --test` (webapp tests are `app/**/*.test.ts`, not
  vitest), run `pnpm`/`tsc`/the build, run the flows' Python tests, and open PRs.
- **Cannot:** reach production Crate, Valkey, Windmill or Coolify. Do not try, and do not run
  ingestion.
- **Must not:**
  - Push to `main`. Pushes to main deploy production and sync the Windmill workspace.
  - Force-push.
  - Change infrastructure, proxy or firewall config.
  - Delete data.
  - Work on one change, push to a `cloud/media-language-<slug>` branch and open a PR against `main`.
    The owner merges.
- **Baseline:** tsc reports 174 diagnostics on main. A change must not raise that count. The full
  webapp suite was 2634 pass / 0 fail at ship.

## Open work (cloud-doable first)

1. **Script budget on movie and show pages.** The pages load 21 scripts against a Lighthouse
   budget of 20 (22 before F). Find a chunk to merge or defer without changing behavior, and
   prove it with the build's chunk list.
2. **Settings save test.** The test for MUST B, the immediate save with Undo, only covers the
   reducer. Add a test at the level of the settings component or route that covers save, Undo,
   the 10 s timeout and the "Couldn't confirm the save" copy, using existing test patterns.
3. **Ingestion bounds.** 170 of the 200 cohort shows hit the per-show caps of 10 seasons and 100
   episodes. Propose and implement configurable caps, or paged continuation, in the flow script
   with tests. Do not run it. The owner runs the backfill.
4. **Regrouped display seasons stay canonical.** Write a design note, and add code only if it is
   small. The proposed identity is `(show_id, alignment_namespace, bucket_key)`.
5. **Explorer localizes only the first 200 titles.** Check whether the cap can rise cheaply or
   localize lazily. Measure before changing it.
6. **Search by localized names and alias matching.** Deferred. Write a plan only, no code.

## Needs the owner (do not attempt)

- Q5: Settings saves each pick immediately, with Undo. Is that OK?
- Crate node 10.0.0.12 timed out twice on the night of 2026-10-14 and recovered on its own.
- Running a larger ingestion backfill after item 3 lands.
- Font check on macOS, Windows, iOS and Android (only Linux was checked).
- Member save flow against production (only unit-tested).
