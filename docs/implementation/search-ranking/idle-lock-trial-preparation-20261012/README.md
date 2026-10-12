# Inactive idle-only lock/release preparation

This prepares a separate idle-only API for map #100. The CLI reports prepared and refuses reviewed execution. No service, production trial, deployment, query, or resource change occurred.

The policy requires 10 GiB effective availability before locking, 8 GiB during retention, and at most 2 GiB selected allocated data with payload excluded. Its 6 GiB transient allowance is experimental. The archive-based legacy policy remains unchanged; the additive idle policy requires its explicit effective-accounting adapter. A strict journal, bounded callbacks, verified current schedule/job lease and current-hash zero-placement gate remain separate execution prerequisites.

The actual Claude Code Opus 5.5 medium V6 review found no source-level safety blocker and requested an idle-holder EOF fixture or narrower scope. V7 adds that fixture and corrects the scope prose; implementation bytes are unchanged. The V6 review was a source review, not an executed production test. Its model/effort, review and manifest hashes are retained here.

Frozen V7 discovery passed all 161 tests in 54.127 seconds with every manifest hash unchanged before and after the run. The result uses the exact frozen manifest cohort based on f17e1e62. Rebase onto current main preserves newer clone controller/policy changes; this frozen result does not relabel those newer dependencies as tested in that run. The narrow current-main idle/core regression result is recorded separately.

Historical failures remain explicit: V3 had nine failures and one error in named lifecycle fixtures; V5 had a missing public controller fixture packaging error. Existing lifecycle fixtures now acknowledge readiness, use production cleanup time when graceful close is the goal, and separate startup from emergency-release timing. This does not establish baseline-equivalent failure rates. The actual idle EOF fixture fakes source/placement/PinSet interfaces and establishes only the tested lifecycle path, not actual production placement or parent-death behavior.

No latency improvement, backup-time resource fit, future headroom guarantee or seven-day application acceptance is claimed. Issue #406 remains closed; remaining latency work is tracked in #100 and acceptance in #407.

The retained manifest, validation, review provenance and historical records are bound by `provenance.json`. Private contracts and runtime paths are excluded.
