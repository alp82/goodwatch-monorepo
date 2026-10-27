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

## Infrastructure

### Firewall rules
Every firewall rule on every host carries a short comment that names the owner and the purpose.
Example: `gw-webapp: coolify network to local Qdrant HTTP`.
See docs/worker-firewall.md.

### Local dev servers use the production databases
`goodwatch-webapp/.env` points at the production databases: CrateDB, Postgres, Redis, Qdrant and Supabase.
A local dev server started with it reads and writes live data, and its background jobs (for example the import cleanup) run against production.
Before you start the webapp locally, decide whether writes are acceptable for the task. If they aren't, use an isolated local setup or a read-only database user, and turn off the background jobs.
