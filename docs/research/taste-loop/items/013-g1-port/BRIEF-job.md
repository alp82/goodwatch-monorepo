# Item 013, stage 1: the offline G1 job and its parity test

You are the builder (Sol 6.1 via codex exec). Product code goes in the worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/g1-order` (branch `feat/g1-order`, built on
`feat/exposure-log`). The research reference is in the taste-loop worktree,
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/` (read-only for you):
read `items/013-g1-port/PLAN.md` (with its "Changes after Fable's review", which are binding) and `REVIEW-fable.md`,
`lab/candidates/009/g1_mix.py`, `lab/views.py`, `lab/pull.py` (only what the arrays need), `lab/pack.py`. In the
product worktree read AGENTS.md and CLAUDE.md, `goodwatch-flows/windmill/f/sync/copy/title_snapshot.py` (the
publisher pattern) and how flows read Crate and write Valkey.

## Build (stage 1 only: no webapp change yet)

1. A Windmill Python job (next to the snapshot publisher) that, for a given list of member ids (the preview members;
   at first only the owner, passed as an argument, never "all"):
   - reads, read-only, what `g1_mix.predict` needs: all members' ratings, Want to See, Skip, Not interested, and the
     title columns (fingerprints, scores and counts, release year, media type, language, genres, production method,
     movie series id), building exactly the arrays the research view gives `predict`, with every unrated title in the
     reference pool as a candidate;
   - runs the research code for B3 and B5 unchanged: copy `g1_mix.py`'s B3/B5 functions into the job's module with
     the source file's SHA-256 recorded in a comment and checked by a test; do not edit their maths;
   - publishes per member, keyed by point id (sorted ids plus aligned values): B3 rank, B5 top-half bit (median over
     the candidates, as the research does), movie series id, show bit, animation bit; plus the member's own show and
     animation shares, model hash, snapshot version, others count, build time; to Valkey key `g1:v1:<member>` with a
     TTL. The job writes nothing else.
   - The request-time step (F3 over the filtered list, then the mix refill) as a small pure function in Python too,
     equal to `g1_mix.py`'s, so stage 2 can port it to TypeScript against the same fixtures.
2. **Parity test** (runs offline, no production): build the owner's view with the research harness's own code from
   the pack under `~/goodwatch-research/taste/packs/2026-10-13/` (tier A others, all of the owner's ratings visible,
   every unrated pool title a candidate) and assert that the job's arrays and outputs equal the harness's: B3 ranks
   (float32), the B5 top-half set, F3 groups, the first 100 after the mix, and the rest. Then save small fixtures
   (no member ids, no other members' rows; title keys and component values only) for stage 2's TypeScript test.
   Write where the job's production inputs differ from the harness's (all members instead of tier A, hashed ids) and
   test the job's array builder separately on a small made-up input.
3. Timing and memory for one member, measured on the pack; say what a production run would take.

## Forbidden

Writing to production (no Valkey writes, no Crate writes; production Crate and Valkey are reachable, do not run the
job against them); reading `~/goodwatch-research/taste/gate/`; editing the research worktree; setting APP_ORIGIN;
production mode locally; installing packages beyond what the flows already use (say if numpy/scipy are missing);
pushing; PRs. Committing is the orchestrator's (your sandbox cannot write git metadata): leave changes uncommitted and
write the commit message to the end of your final message.

Memory is tight (16 GB shared): check `free -m` before heavy steps, at most 2 threads, about 3 GB.

## Hand back

At most 30 lines: files, the parity result per component, timing, differences from the harness, open questions for
stage 2, and the commit message.
