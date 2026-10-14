# Item 013, stage 2: G1 in the webapp behind an owner-only flag

You are the builder (Sol 6.1 via codex exec). Work in the worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/g1-order` (branch `feat/g1-order`, which already has the
exposure log of #525 and stage 1's offline job). Read AGENTS.md and CLAUDE.md; the plan
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/013-g1-port/PLAN.md`
with "Changes after Fable's review" (binding) and `REVIEW-fable.md` there; `docs/implementation/g1-order-stage1.md`
and `docs/implementation/exposure-log/` in your worktree; `goodwatch-flows/windmill/f/sync/copy/g1_order.py` and
`goodwatch-flows/tests/fixtures/g1_order.json`.

## Build

1. **Flag** `REC_G1_ORDER` (off / shadow / preview / on) in `server/features.server.ts` and `utils/features.ts`,
   preview members from `REC_PREVIEW_USERS`.
2. **Reader:** load `g1:v1:<member>` from Valkey (payload as stage 1 writes it), validate model hash and shape, map
   point ids to snapshot rows, cache per member keyed by the payload's build time for 10 minutes. Missing, malformed
   or unmappable payload: today's order, with a logged fallback reason.
3. **Request step:** port stage 1's pure Python request function (F3 over the given list, then the mix refill of the
   first 100) to TypeScript, and test it against every case in `g1_order.json` for exact equality.
4. **Wiring:** Discover's catalogue Best match (the match branch of `filterTitles`, catalogue universe only; ranked
   search and Explorer pools untouched) and Watch next (F3 order; the refill runs within the fitting group after
   Watch next's own grouping). For you under other sorts unchanged. Card taste match unchanged. Under shadow: order
   by today's, compute G1 too, log the first-30 overlap.
5. **Exposure log fields** (add to #525's record and DDL, nullable): fallback reason, payload build time, model hash,
   snapshot version, per title the G1 group and whether the mix placed it, Watch next tier; under G1, today's first
   100 for the same list; under shadow, G1's first 100.
6. **Job triggers:** wire the stage 1 job in Windmill to run for the preview members after each title snapshot
   publish and nightly; a debounced run after a preview member's rating change if the existing pattern allows it
   cheaply (otherwise document it as a follow-up). Do not deploy or run any of it against production.
7. Tests per the repo's conventions; typecheck must show no new diagnostics against the branch base; the relevant
   suites pass; one test that today's order is unchanged when the flag is off.

## Forbidden

Writing to production (Crate, Valkey; both reachable from here: do not touch them); APP_ORIGIN; production mode
locally; installing packages; pushing; PRs; editing the research worktree. Your sandbox cannot write git metadata:
leave changes uncommitted and put the commit message at the end of your final message. Memory is tight: run
typecheck and suites one at a time, check `free -m` first.

## Hand back

At most 30 lines: what was built, fixture parity result, what the owner must do to try it (env settings, DDL,
deploy steps), follow-ups, commit message.
