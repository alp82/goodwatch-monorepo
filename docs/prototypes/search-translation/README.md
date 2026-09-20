# Translation before D4+ — throwaway, awaiting human review

Open `review.html` directly. It is self-contained, makes no network requests, and stores nothing. Review the five native requests, translations, accepted English/native baselines, and measured fallback results. Select either model. State walkthroughs demonstrate English bypass, translation, failure and a **simulated** warm cache.

## Measured findings (2026-09-21)

Five paired cases from the accepted evaluation set: German suspense (long and short), Spanish grounded crime series, French rich people behaving badly, Turkish tired/warm/funny. English controls run freshly as well as preserving the accepted capture. The locked D4+ entry point was unchanged; an isolated export/route exercises native Jev + Qdrant without text retrieval on translation failure. No Crate writes.

| Translator | Median added wall time | Range | Actual reported USD / 1,000 translations |
|---|---:|---:|---:|
| Gemini 2.5 Flash Lite | 367 ms | 308–738 ms | $0.01282 |
| GPT-4.1 nano | 853 ms | 794–892 ms | $0.01430 |

Ten actual translations cost $0.0001356 combined (provider-reported usage; Jev/search costs separate in raw results). Single observations per pair/model, no latency percentile claim. The translated D4+ calls added 1.03–1.24 seconds from this dev machine, so sequential totals exceed the earlier translation-only estimate. No production budget acceptance is implied.

**Agent assessment, not user judgment:** prefer nano provisionally because Gemini omitted the first Turkish clause (“my head is very tired”). Nano retained the tiredness and all explicit clauses in these five inputs. Both translate German “spannend” as “exciting”; whether the resulting relevance is good enough needs the user. Identical title order is not a requirement. English top-ten overlap for nano was 1/10, 0/10, 8/10, 8/10 and 1/10; these are diagnostics, not relevance scores. The review page shows every new result explicitly. Spanish exclusions (animation, magical detectives and movies) must still be reviewed; no automated semantic judgment substitutes for that review.

The vector-only fallback returned 20 results in all five cases (1.14–1.47 seconds HTTP). It calls the unchanged native attribute and dimension readers and the existing weighted Qdrant retrieval with an empty text query. This isolates the proposed fallback; the runner explicitly invokes it rather than inducing a real provider outage. Timeout integration remains implementation work. The fallback may sacrifice concrete text intent and inherits the baseline's documented result-hygiene limitations.

## Detection and caching proposal

Offline Lingua 2.x with the five evaluated languages adds no remote call. Raw highest-confidence classification caught all five non-English fixtures but mislabeled English “cozy” as Turkish (0.466 confidence, margin 0.119). Do **not** ship the raw detector policy used for this diagnostic. A candidate gate of non-English confidence >= 0.8 and margin >= 0.2 skips all 20 English description cases and translates all five non-English cases here. This threshold was selected after inspecting this set, so it is not independent validation. Ambiguous queries would skip translation; short foreign and mixed-language requests require a larger evaluation before claiming support. Title lookup keeps the original query and bypasses translation. Locale alone is not proof of request language. This Python library is an experimental comparator, not a selected webapp runtime dependency.

Use a separate translation entry alongside the interpretation cache, keyed by exact normalized original request, detector policy/language set, translation model identity and prompt version. Store original text, detected language and translated text. Successful translated English text can feed the existing versioned Jev interpretation cache, sharing identical interpretations when the English text is identical. Preserve original text in history. Do not cache timeout/failure as a successful translation or poison the normal reading key with fallback results. The review's cache walkthrough is in-memory simulation; no persistent cache has been implemented. Pin a versioned provider model for production; the measured API model IDs and catalog canonical slugs are preserved in `results.json`.

## Reproduce

```sh
python -m venv /tmp/goodwatch-translation-venv
/tmp/goodwatch-translation-venv/bin/pip install lingua-language-detector==2.2.0
/tmp/goodwatch-translation-venv/bin/python docs/prototypes/search-translation/run.py
python docs/prototypes/search-translation/render.py
```

Requires the existing dev server at localhost:3003, the isolated `prototype.search-translation` route and fallback export, the accepted evaluation artifacts, and the existing root `.env` OpenRouter credential. Never print or commit credentials. Re-running incurs small provider/Jev charges and overwrites this experiment's results, not the accepted baseline. Captured source hashes are in `results.json`; source snapshots are under `source/`. Search data are live and Jev uses the existing mutable alias, so exact replay is not guaranteed. English cache warmth was not explicitly controlled; measured HTTP timings include dev/network overhead.

## Pending decision

The ticket explicitly says “Review the comparison with the user.” The accepted baseline policy requires review of new results. No new human judgments have been invented. User must judge whether nano's five translated result lists preserve relevance and exclusions, and whether the measured delay is acceptable; otherwise iterate or choose a narrower launch policy. Do not close the ticket, deploy this prototype, or treat title overlap as proof of regression/pass.

## Sources

- [Live model catalog](https://openrouter.ai/api/v1/models), retrieved during run; pricing and canonical slugs captured.
- [Lingua implementation and detection limits](https://github.com/pemistahl/lingua-py).
- [Language independence research](https://github.com/alp82/goodwatch-monorepo/issues/106).
- [Accepted evaluation baseline](https://github.com/alp82/goodwatch-monorepo/issues/116).

## Verification

All 10 translated searches, five fresh English controls and five vector fallbacks completed. Chromium smoke check found five comparison sections, working model selection, cache/failure state transitions, no page errors and no horizontal overflow at 390px. Chrome DevTools MCP was unavailable in this session, so local Chromium via Playwright was used for this bounded artifact check. No automated test suite was added. The accepted D4+ function was not edited; only the separate fallback export and dev-only route were added.
