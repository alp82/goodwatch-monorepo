# Actual Claude MCP App captures

Captured 2026-10-20 from hosted Claude using the populated disposable reviewer account and production release `5faa8365`. These are browser screenshots clipped to actual App frames, captured through CDP at 2x/3x scale; no generated/mock UI or private account identifiers are included. The screenshots contain catalog imagery and synthetic reviewer taste/progress only. No recording was made.

- `watch-next.png` (1472 × 600): installed `/goodwatch:watch-tonight` skill, prompt “what should I watch tonight from my streaming services.” Actual `get_tonight` response shows Severance S1 E4.
- `discover.png` (1472 × 968): same prompt, actual `discover_titles` response. Streaming claims must use returned offers, not model knowledge.
- `title-search.png` (1461 × 1593): read-only App display check with `search_titles({"query":"The Matrix","limit":3})`. The current alphabetically ordered lookup returns matching titles, not necessarily the exact title first. This limitation is recorded in the test report; the screenshot preserves the real result.

All eight App-producing tools loaded without display errors after refreshing the connection and reloading the browser tab. Existing tabs can retain pre-fix tool metadata; use a fresh conversation after reload. Only the tool response is captured; prompts are supplied here separately.
