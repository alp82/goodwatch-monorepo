# Journey deployment and recovery

Verified 2026-09-19, approximately 04:30–04:40 UTC, for [Verify journey deployment access and recovery procedure](https://github.com/alp82/goodwatch-monorepo/issues/93). This is operational preparation, not journey release acceptance. No deployment, production configuration change, token creation, or data restoration was performed.

## Current observations

The following are current read-only observations, not historical inferences or operator assertions:

| Fact | Evidence |
| --- | --- |
| Control plane | Established `root@10.0.0.10` SSH access executes Docker commands; installed Coolify image `coollabsio/coolify:4.3.23`, healthy. |
| Application | UUID `gk4owk8`, GoodWatch project `gw0sg0g`, production environment `v4ccwgowos4oo0okocg0gcck`, URL `https://goodwatch.app`. Read through installed Coolify Eloquent models. |
| Release source | `alp82/goodwatch-monorepo`, branch `main`, configured commit `HEAD`, Nixpacks, base `/goodwatch-webapp`, `npm run build`, `npm run start`. Auto-deploy enabled, no watch-path restriction. A push to main is a potential production release; do not push unfinished integration there. |
| Running code | Coolify deployment `xuzfuntvswnsvzwjxgoy7xir`, finished September 17 at 22:18:50 UTC, commit `58aa7b3683f82ee4ea58f7da1007ee76400a7115`. Actual destination Docker container `gk4owk8-220603116539` uses that exact image tag and reports healthy. |
| Destination | Coolify server `abio`, server ID 1, SSH root at `159.69.247.66:22`. Inspected through Coolify's established destination connection. Direct workstation SSH to that address lacked a trusted host-key entry; no host-key checks were bypassed. |
| Recovery images | Current tag `58aa7b3683f82ee4ea58f7da1007ee76400a7115`, image `2197ae27ac0b`; prior tag `a58efc229ca39f7bc167580654158adc6a88d8b2`, image `270d57ca6998`. Both present on destination. Retention is two images, not disabled; no registry configured. |
| Health/queue | Application `running:healthy`, health check enabled at `/`, zero queued/in-progress application deployments. Public homepage returned 200 with GoodWatch content. This is smoke evidence, not journey acceptance. |
| Operator rights | Installed `ApplicationPolicy` evaluated for existing owner user 0, Alper: deploy=true, manageEnvironment=true, update allowed=true. Root control-plane execution and destination read execution both succeeded. This establishes an available privileged operator route, not a working API credential or browser login. |
| API credential | `/home/alp/.config/coolify/goodwatch.token` returns 401 Unauthenticated for version, application, deployments, teams, and environment reads. It is unusable; no API deployment/write permission is claimed. The historical configuration-write 403 is superseded by this observation. |
| Connectivity | SSH temporarily returned Connection refused during the inspection, then recovered and another authenticated source read succeeded. Recheck immediately before release; do not start a release without a working recovery connection. |
| GitHub | Current CLI identity has repository admin/push rights. Windmill workflow's latest run succeeded at the same `58aa7b3` source revision. No webhook delivery was triggered to test auto-deployment. |

The current healthy image is the pre-journey recovery baseline. Its complete functional correctness has not been newly established; final release must run baseline smoke checks and record the then-current image, rather than assume these identifiers remain current. No usable staging environment was established. Old preview files are not evidence of a running staging environment.

## Private evidence and configuration

Protected directory: `/home/alp/.local/state/goodwatch/journey-release-preparation-20260919` (0700; files 0600). Contains API responses, `operator-metadata.json`, `operator-permissions-images.json`, installed release/rollback/policy/helper source, and `private-config-snapshot.json`. The latter captures application attributes, settings, and environment records/values; SHA-256 `c3165a07a0e8f6220ea020c9c95bd6e3c2e6d3a9e1a118ff59ad202bf532303c`. Keep it private and refresh it before release. It is an application configuration snapshot, not a database or container-image backup.

Configuration includes Crate, Redis, Qdrant, Supabase and TMDB connections plus `HOMEPAGE_WARMUP_SECRET` and `NODE_ENV`. Values are deliberately absent here. Generated application files live under `/data/coolify/applications/gk4owk8` on the destination. Capture current generated compose/runtime configuration privately before any configuration-changing release; preserve file permissions. Do not blindly restore all Eloquent attributes or overwrite later unrelated settings from this preparation snapshot.

## Exact release and restore mechanism

Installed Coolify source was inspected, including `app/Livewire/Project/Application/Rollback.php`, `app/Policies/ApplicationPolicy.php`, `bootstrap/helpers/applications.php`, `app/Jobs/ApplicationDeploymentJob.php`, and `app/Http/Controllers/Api/DeployController.php`.

Coolify's rollback UI authorizes `deploy`, then calls `queue_application_deployment(application: ..., deployment_uuid: ..., commit: <image tag>, rollback: true, force_rebuild: false)`. Nixpacks checks for the retained image before rebuilding; explicit commit SHA is not replaced by branch HEAD. Restore uses **current** configuration, not a historical configuration snapshot. A missing image may enter a rebuild path; verify the exact recovery image still exists before attempting recovery. No rollback drill was executed.

The established root operator can invoke this same installed helper through `docker exec -i coolify php`, with the following PHP body supplied on stdin over authenticated SSH. This is the concrete **future mutating operation**, not a command executed during preparation. Replace the SHA and set the mode only after the release gate has passed. Keep the policy check; do not mint a token or directly edit queue tables.

```php
<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$a = App\Models\Application::where('uuid', 'gk4owk8')->firstOrFail();
$operator = App\Models\User::findOrFail(0);
if (!(new App\Policies\ApplicationPolicy)->deploy($operator, $a)) {
    throw new RuntimeException('Owner deployment permission unavailable');
}
$sha = 'REPLACE_WITH_EXACT_40_CHARACTER_COMMIT';
if (!preg_match('/^[a-f0-9]{40}$/', $sha)) {
    throw new RuntimeException('Explicit commit required');
}
$restore = false; // true only to restore the verified retained image tag
$uuid = new_public_id();
echo json_encode(queue_application_deployment(
    application: $a,
    deployment_uuid: $uuid,
    commit: $sha,
    rollback: $restore,
    force_rebuild: false,
));
```

The PHP bootstrap/model reads and policy checks were exercised without the final queue call. The queue call's exact signature and rollback semantics were verified against installed source, not by making an unnecessary production change. This operator route does not depend on the rejected API token. A user choosing the normal UI instead must establish a real authorized Coolify browser session; none was claimed here.

Monitor the resulting `ApplicationDeploymentQueue` row by deployment UUID through the same read-only operator connection. Require `finished`, matching commit, actual running container image and healthy status; retain errors/logs privately if it fails. `queue_full` or an existing queued deployment is not success. Recheck no competing queued/in-progress deployment and coordinate main pushes before release/restore.

## Release sequence

1. Finish all delivery prerequisites. [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94) owns candidate integration and the full [accepted gates](https://github.com/alp82/goodwatch-monorepo/issues/87#issuecomment-5721672847): browser scenarios, build, no new TypeScript diagnostics, and contemporaneous comparable Lighthouse checks.
2. Record exact candidate SHA and changed runtime surfaces. Fetch/compare actual production history before integration; the live SHA was not present in this local branch's object database during preparation. Publishing to a non-main branch does not establish a release. Coordinate any main update with auto-deployment and Windmill triggers; do not let a premature main push bypass the gates or produce competing deployments.
3. Recheck SSH/operator policy, destination health, empty deployment queue, current running SHA/image, configuration, and retained image inventory. Retention is only two: preserve/export the designated known-good image before repeated attempts can prune it. Record its full image identity and a fresh private configuration snapshot. Verify its baseline smoke behavior and final-candidate persisted-state compatibility before proceeding.
4. Publish the accepted candidate through the coordinated main trigger, or queue the exact published candidate SHA using the verified operator helper. Record the returned deployment UUID and verify the actual deployed SHA/image. Never use an unrecorded moving HEAD as acceptance evidence.
5. Repeat all required desktop/mobile production journey and account checks with controlled fixtures. HTTP 200 and Coolify success do not replace those checks.
6. On a blocking failure, halt competing release attempts, verify the recorded image remains available, and invoke the same helper with that image's commit and `rollback: true`. Restore only configuration keys that require recovery, using the private pre-release snapshot and preserving unrelated changes. Verify finished deployment, actual image/health and production smoke behavior. Keep the journey release open; fix and revalidate before retrying.

## Recovery coverage and external surfaces

| Surface | Recovery boundary |
| --- | --- |
| Deployed webapp/Remix code | Retained Coolify image and queue helper above. Does not restore settings or user data. |
| Configuration | Separate private snapshot; compare current values, restore only scoped changed settings through authorized configuration management, then redeploy. No configuration write was necessary to verify preparation. |
| Browser progress | Browser local/session storage cannot be recovered by container rollback. Final candidate must demonstrate older/newer-code compatibility and preserve pending transfer evidence; do not clear user storage as a deployment recovery step. |
| Account/handoff data | Crate/Supabase writes and authentication state outlive container releases. Preserve new user activity. Any data repair needs a scoped, reconciled approach; this ticket neither snapshots all account data nor authorizes a blind database restore. Final release owns candidate-specific compatibility. |
| Windmill/publication | Separate deployment and recovery. Main changes under `goodwatch-flows/**` trigger `.github/workflows/push-windmill-workspace.yml` (also manual dispatch); `[WM]` push commits skip its job. `--keep-deleted` preserves absent deployed entries; variables, secrets, resources and resource types are skipped. Export affected live definitions, locks, schedules and relevant external configuration privately before a flow release; coordinate source/lock restoration, publication/data compatibility and schedule state independently of the webapp. A workflow success does not prove consumer compatibility or restore published data. Require this only when the final candidate changes these surfaces. Availability publication delivery is an explicit prerequisite for this journey. |

## Browser and controlled-account handoff

Chrome DevTools MCP 1.3.0 remains installed. The old bridge process had stopped; restarting `/tmp/goodwatch-handoff-88/bridge.py` restored `/tmp/goodwatch-handoff-88/bridge.sock`. Actual `list_pages`, navigation to localhost:3003 and a desktop Lighthouse snapshot succeeded. Report: `/tmp/goodwatch-release93-lighthouse/report.{json,html}` (accessibility 89, best practices 100, SEO 100). This establishes tool availability only; snapshot supplies no performance/navigation score and is not the final comparison baseline. The restarted browser listed only a new blank page: earlier page numbers/sessions must be re-established rather than assumed alive.

Existing and confirmed-new account credentials still exist with mode 0600 at `/tmp/goodwatch-handoff-88/credentials.json` and `/tmp/goodwatch-transfer90/new-account-credentials.json`. Reuse their normal sign-in and scoped fixture setup/cleanup instructions in [AccountTransfer.md](../../../goodwatch-webapp/app/ui/onboarding/AccountTransfer.md#controlled-fixture-handoff), coordinated with [Verify authenticated guest handoff and import recovery](https://github.com/alp82/goodwatch-monorepo/issues/88). These accounts are now existing accounts; a genuinely new signup requires a new authorized alias and normal confirmation. Do not claim this preparation repeated account acceptance or that local sessions carry over to production.

The [explicit authenticated Google callback acceptance item](https://github.com/alp82/goodwatch-monorepo/issues/94#issuecomment-5739320644) remains open. An authorized controlled Google login is needed for that release check; provider-entry navigation is insufficient. Preserve fixtures until production verification finishes, then remove only owned test rows through authenticated app APIs and sign out. No provider credentials or confirmation links belong in committed evidence.
