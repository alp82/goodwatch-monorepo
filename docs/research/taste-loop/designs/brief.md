# Design brief: a research loop for taste, recommendations and score prediction that truly works

You are one of four independent designers (Fable 5.1, Opus 5.5, GPT-6 Astra, GPT-6.1 Sol; all high effort, working
separately). Your design will be merged with the others into the plan a NEW session starts from. Do not coordinate.

## The verdict you are designing from

Read, in /home/alper/projects/goodwatch-monorepo/docs/research/taste-prediction/:
- `README.md`: three rounds of experiments. Read section 11 first ("After review"): it is the verdict.
- `next-branches.md`: the merged branches from three independent reviews, what to stop, where reviewers disagree.
- `reviews/`: the three full reviews.
- `lab/`: the old harness (`harness.py`), briefs (`README.md`, `ROUND1.md`, `ROUND2.md`), all agent code, `ledger.jsonl`.
Product context: `CONTEXT.md` (glossary; use its terms), `AGENTS.md`, `docs/implementation/recommendation-experience/README.md`,
`goodwatch-webapp/app/server/taste/` and `taste-portrait/`.

The verdict in five lines: (1) the old loop optimized rating error on random holdouts of titles members already
chose to watch; that is not the product's task, is optimistic forward in time, and its locked set is spent; (2)
recommendation quality was never measured; (3) the error floor (how consistent a member is with themselves) is
unknown; (4) what survived: standardized fingerprints, pooling across members for short histories, a calibrated
risk as a research output; (5) all reviewers said: stop model sweeps on the same ratings, measure the right thing,
obtain new information.

## How the old loop was run, and what went wrong operationally

- Orchestrator: Claude Opus 5.5 (1M context) in Claude Code at low reasoning effort, in one long session. It built a
  data file once (read-only pull from production Crate and Qdrant), a harness, briefs as markdown files, and
  launched general-purpose subagents in parallel (5, then 3, then 2), each with one direction and its own folder.
  It kept a locked quarter of ratings outside the agents' folder and scored finalists on it itself.
- What worked: one shared harness and data file; one direction per agent; a written brief per round carrying
  forward what held; the orchestrator re-scoring on held-out data, which caught a 0.757-development / 0.899-locked
  failure.
- What went wrong: the benchmark itself (above); round briefs published locked results, so later rounds adapted to
  them; no pre-registration, so each agent ran many unledgered sweeps; agents' "wins" used different output
  conventions and different skill baselines; subagents could not save their REPORT.md (the Write tool refused), so
  reports lived only in chat; module-name clashes between agents' folders corrupted one locked scoring run until
  each predictor ran in its own process; agents left stray wait-loops and exceeded the 5-minute run budget on a
  shared 8-core machine (load 13 to 17); the data file and locked ratings live in a temporary session folder and
  will be gone; the orchestrator ran no analysis of its own that would have caught the time-order problem; three
  independent model reviews at the END found what a review at the START would have.
- Reviewers found real errors by running small analyses themselves (forward-in-time split, Want to See stand-in,
  sequel false positives). Review by a different model was worth more than another round.

## Available means

- Models: Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 (Claude Code Agent tool; subagent model and effort
  low/medium/high/xhigh/max selectable per agent; Workflow scripts for deterministic fan-out; a fresh subagent knows
  only its prompt). Via the codex CLI: gpt-6-astra, gpt-6.1-sol (`codex exec -m <model> -c model_reasoning_effort=...`,
  read-only sandbox, web search). The orchestrator can be any Claude model at any effort; it pays for a long session.
- Data: production Crate and Qdrant are readable from this machine (read only; never write to production from
  research). Tables are listed in `reviews/brief.md`. `lab/build_pack.py` and `lab/add_scores.py` rebuild the old
  data file; it lacks user_not_interested, user_watch_state, user_watch_log, user_import_item, Want to See dates.
  Scale: about 230 members with ratings, about 9,000 ratings, median member 15 ratings, one member (the owner) with
  about 1,000. The owner is available to answer questions, re-rate titles and judge lists. Recruiting 20 to 30 other
  members is possible but slow. Product instrumentation (new tables, PostHog events) can be built but ships through
  normal development, not inside a research session.
- Machine: 8 cores, shared with other sessions; Python with numpy, scipy, sklearn only.
- You may run small read-only analyses on the old data file while it exists:
  `<scratchpad>/lab/pack.pkl` via `harness.Data()` (run python from
  `<scratchpad>/lab`). Do not write there or in the repository. Do not query production.

## What to deliver

Your final message is the deliverable: one markdown document, complete, no preamble, that a new session could start
from. Sections, in this order:

1. **Goal.** One paragraph: what the loop is trying to achieve, stated as outcomes for members, and what it
   explicitly is not trying to do. Then the two or three decisions the loop must be able to make (for example "does
   scorer A replace today's taste on Discover") and the evidence that would settle each.
2. **Benchmark setup.** Concrete enough to implement on day one:
   - the tasks (for example forward-in-time rating prediction, ranking of unseen titles, calibration, taste
     description), each with its exact protocol, labels, eligible titles and members, and primary and guard metrics;
   - splits and the rule for a final test that cannot be spent (who may see what, when; what replaces the locked
     quarter; how new ratings enter);
   - fixed baselines and one output convention; how uncertainty is reported (paired differences, what is resampled);
   - what counts as a win, a null and a stop, decided before running;
   - the data pull: which tables and columns, what must be added to the old pull, how provenance (imports, bulk
     sessions) is handled, where the data file lives so it survives the session, privacy rules;
   - what cannot be measured offline at all and needs members or instrumentation, and the smallest version of each.
3. **The loop.** Phases in order, with what each produces and its exit test. Which branches from
   `next-branches.md` go in which phase, which are dropped, and what you add. Include the first three concrete
   work items for the new session, each small enough to finish in a few hours, with acceptance checks.
4. **Orchestration.** Your recommendation, with reasons and the trade-off in cost:
   - which model and reasoning effort should orchestrate, and why not the alternatives;
   - which models and efforts for which subagent roles (builder, experimenter, reviewer, red team, writer), and
     where a different model family must be used on purpose;
   - how many agents at once, how briefs are written, what an agent must hand back and in what form (files, schema),
     how results are verified before they are believed, how pre-registration and the ledger work, when independent
     review happens (before, during, after), how to stop agents from overfitting or over-running, and how state
     survives across sessions (what is written to the repository, where);
   - failure modes of the old loop and the specific mechanism that prevents each.
5. **Kickoff prompt.** The exact text the owner pastes into a new session to start the loop, self-contained,
   pointing at the files to read.
6. **Risks and open questions** the owner must decide before or during the first session, each with your
   recommended answer.

Be decisive: pick one design, name alternatives only to say why they lose. Write plainly: short sentences, define
terms, give numbers with what they measure. Where you verified something on the data file, say so.
Also save the same document to `<scratchpad>/design/<your name>.md` (fable.md, opus.md, astra.md or sol.md)
if you can write there; if a write tool refuses, use a shell heredoc.
