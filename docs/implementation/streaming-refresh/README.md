# Streaming refresh implementation

Implements the reviewed [plan](plan.md) on `feat/streaming-refresh`, in an isolated checkout. Production activation and historical repair have not run.

- [Classification and shared provider evidence](https://github.com/alp82/goodwatch-monorepo/issues/776): one conditionally ordered provider observation path, targeted publication, strict parsing and scoped identity resolution.
- [Opened demand and bounded scheduling](https://github.com/alp82/goodwatch-monorepo/issues/777): reuse impression transport and `crawl_priority`; separate opened timestamps, detector bounds, country selection and shared page admission.
- [Bounded identity reconciliation](https://github.com/alp82/goodwatch-monorepo/issues/778): explicit inventory/preview, canonical publisher, private backups and guarded resume/rollback.

The [rollout runbook](rollout.md) gives migration, initialization, shadow/canary, activation and rollback steps. New detector scheduling is disabled; detector defaults to preview and new availability selection defaults to shadow.

[Backend validation](backend-validation.md), [full-suite comparison](backend-test-comparison.json) and [opened-demand validation](opened-demand-validation.json) record the checks and limits. Focused tests and the frontend build pass. The full backend suite, full frontend typecheck and landing budget remain red; the backend comparison found no new failure labels, the TypeScript output is byte-identical to base, and the matched browser comparison found no introduced failure labels. The measured first-view code reserves 1 KiB on five surfaces; unrelated limits remain unchanged. These results do not establish production throughput, freshness or completed shadow days.

The follow-up fixed unsupported Crate migration syntax and BSON `Int64` proof handling, completed monitoring integration, and recorded the exact [deployment preflight](deployment-preflight.md). Live cutover must pause/drain legacy callers before deployment and verify schema/index/gate readbacks.
