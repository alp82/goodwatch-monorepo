## Agent skills

### Issue tracker
Use GitHub Issues in alp82/goodwatch-monorepo.
See docs/agents/issue-tracker.md.

### Triage labels
Use the five standard triage labels.
See docs/agents/triage-labels.md.

### Domain docs
Use single-context domain documentation.
See docs/agents/domain.md.

## Git worktrees

- Before repository work, run `git fetch origin main`. Base new task branches and worktrees on the fetched `origin/main`; preserve existing local work.
- Before shipping, fetch again and integrate `origin/main`, then run the checks affected by the integration.
- After shipping, move to a retained checkout and remove the task's clean, idle worktree and its local branch once its commits are reachable from `origin/main`.
- For wider cleanup, remove only clean, idle worktrees and local branches fully merged into `origin/main`. Preserve dirty, unmerged, locked, or active worktrees and branches, and report what remains.
- Preserve local configuration and other non-reproducible ignored files before removal. Use `git worktree remove` and `git branch -d`; avoid forced deletion. Remote branch deletion needs explicit authorization.

## Infrastructure

### Firewall rules
Every firewall rule on every host carries a short comment that names the owner and the purpose.
Example: `gw-webapp: coolify network to local Qdrant HTTP`.
See docs/worker-firewall.md.

### Local dev servers use the production databases
`goodwatch-webapp/.env` points at the production databases: CrateDB, Postgres, Redis, Qdrant and Supabase.
A local dev server started with it reads and writes live data, and its background jobs (for example the import cleanup) run against production.
Before you start the webapp locally, decide whether writes are acceptable for the task. If they aren't, use an isolated local setup or a read-only database user, and turn off the background jobs.
