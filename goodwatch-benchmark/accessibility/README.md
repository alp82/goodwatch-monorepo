# Accessible control names

Run `control-names.mjs` inside the benchmark Lighthouse image against an isolated local production build. The script checks visible-label matching and control names on phone and desktop title pages and Discover. It requires the controls to exist before auditing them and blocks browser requests outside the local origin and all non-GET requests.

Set `A11Y_BASE_URL` to a loopback origin. Set `A11Y_OUTPUT_DIR` to a writable directory under your benchmark scratch directory. The script writes the axe results to `control-names.json` and exits unsuccessfully if a case has violations. You can override the fixture title path with `A11Y_TITLE_PATH`.

Use the same isolated server environment as the [HTML equivalence check](../html-equivalence/README.md). Never start the webapp with production environment files or service endpoints for this check.
