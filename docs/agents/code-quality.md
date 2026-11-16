# Coding workflow

Claude Code, Codex, and human contributors use the same repository commands and
`AGENTS.md`. The existing `CLAUDE.md` already points to it.

## Setup

Use Node 24 and npm. From the repository root:

```sh
npm ci
npm --prefix goodwatch-webapp ci
```

The first command installs pinned Oxfmt, Oxlint, lint-staged versions
and enables `.githooks/pre-commit`. The second installs the official TanStack Query
plugin and the webapp's existing dependencies and transport patches. No dev
server, database credentials, or production connection is needed for quality
checks. If a local system libvips makes Sharp try a source build, install with
`SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm --prefix goodwatch-webapp ci`.

In a worktree, install both sets of dependencies there. The installer preserves the existing
pre-commit hook as `pre-commit.goodwatch-previous` in Git's hooks directory and
runs it before the new staged-file check. Other hooks (including git-secrets'
commit-message checks) are untouched. Git's shared `core.hooksPath` is never
changed. Older worktrees without `.githooks/pre-commit` still run their original
hook. Installation is idempotent.

`SKIP_GIT_HOOKS=1 npm ci` installs tools without installing a hook (used in CI).
If you already configure a custom `core.hooksPath`, the installer refuses to
overwrite it: use that installation flag and add `sh .githooks/pre-commit` to your
existing pre-commit hook. To uninstall the default dispatcher, restore
`pre-commit.goodwatch-previous` as `pre-commit` (or remove the dispatcher if there
was no previous hook).

## After editing

From the root or `goodwatch-webapp/`:

```sh
npm run format
npm run check
```

`format` applies Oxfmt to managed files changed since HEAD, including staged and
untracked files. It does not reformat the whole repository. On a branch with
committed changes, use the task's original base commit:

```sh
npm run format -- --base <task-base-commit>
npm run check -- --base <task-base-commit>
```

Explicit filenames are also supported, relative to the current directory.
Use explicit filenames when a checkout contains someone else's edits. Agents
must run relevant application tests as well; this command does not replace them.

| Command | Behavior |
| --- | --- |
| `npm run format` | Format changed managed files |
| `npm run format:check` | Check changed managed files without writes |
| `npm run lint` | Lint all managed JS/TS files; fail on new diagnostics, including warnings |
| `npm run lint:fix -- <files>` | Apply Oxlint's standard fixes, then format; defaults to changed files; review the diff |
| `npm run check` | Changed-file formatting plus full lint and typecheck regression checks |
| `npm run test:tooling` (root) | Test the commands and an actual Git pre-commit hook in disposable repositories |
| `npm --prefix goodwatch-webapp run typecheck` (root) | Raw TypeScript results, including existing debt |

`--all` is available on formatting commands for deliberate mechanical cleanup.
It is not the default workflow. Formatting does not reorder imports or Tailwind
classes. `lint:fix` never enables suggestion or dangerous fixes, and a failed
lint result still fails the command. Automatic fixes can change code: review them.

## Scope and existing debt

This migration covers tracked and new webapp source, scripts, local packages,
and the quality tooling itself. It excludes dependency directories, Python
virtual environments, public assets, build outputs, result/artifact directories
and lockfiles. Prototypes and tests remain linted. YepWatch continues to use
Expo ESLint and its existing typecheck/test commands and CI gates.

The repository had existing lint and type errors before this workflow. They are
recorded explicitly in `scripts/code-quality-baseline.json`; every check prints
the number of remaining baseline diagnostics and any new ones. Baseline matching
uses filename, rule/error code, complete message and occurrence count, not line
number, so formatting and moving lines do not create artificial regressions.
This catches new messages, new files and increased counts, but does not identify
individual occurrences: replacing an old occurrence with an identical one in
the same file can match the same allowance. Review changes and run tests too.

The baseline is an adoption boundary, not a claim that the full project is
error-free. Do not regenerate or increase it to pass a task. Remove allowances
as debt is fixed. The one-time `baseline` command refuses to overwrite it.
CI rejects increases against the event's base commit once a baseline exists.

Existing `biome-ignore` comments are retained as explanations of intentional
code choices; Oxlint does not interpret them. Existing findings are recorded
in the baseline, including those previously suppressed by Biome. For new or
changed suppressions use a narrowly scoped `oxlint-disable-next-line` with the
specific rule and reason. Oxfmt supports `prettier-ignore` for intentional
formatting; the existing format-ignore directives have been migrated.

The official TanStack plugin runs under Oxlint's JS plugin API. Its
`no-void-query-fn` rule is intentionally not enabled: Oxlint does not supply JS
plugins with TypeScript parser services. Custom-hook detection in
`no-rest-destructuring` also lacks that typed extension. Native typed linting
and the TypeScript 7 upgrade remain separate work; the existing Remix/compiler
versions are preserved here.
Experimental React Compiler lint rules are also deferred; the webapp does not
use that compiler. React hook ordering and effect dependency checks are enabled.

## Commit and CI

The pre-commit hook formats and lints staged managed files. lint-staged backs up
the original state, hides unstaged hunks of partially staged files, stages the
formatted result, and restores unstaged edits. A failed check blocks the commit
and rolls back its changes. It does not run the full webapp test suite or contact
databases. Run `npm run check` before committing for the full type regression
check; CI repeats it on a clean install, regardless of hooks.

The Code quality GitHub workflow checks formatting over the entire PR/push range
and checks full-project lint/type regressions. It does not modify source files.
Existing auth and YepWatch workflows remain in place.

VS Code/Cursor users can install the recommended official Oxc extension for
format-on-save and diagnostics. Terminal-based agents need no extension and use
the commands above. There are no Claude- or Codex-specific hooks to drift apart.
