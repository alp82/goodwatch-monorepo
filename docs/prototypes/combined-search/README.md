# Combined search prototype — awaiting human review

Question: how does one box distinguish titles and descriptions, and what does it show?

Open `/prototype/combined-search?variant=C` on the existing development server (currently http://localhost:3003). The running workspace has copies of the two prototype modules. This branch preserves them independently. Requires the existing TMDB, Crate, Qdrant, and TypeSafe development credentials. Nothing was deployed and no production database writes were made.

## Confirmed interaction

The user chose title suggestions while typing and description search on Enter. The prototype debounces names by 300 ms, clears submitted results when input changes, and cancels browser requests for superseded inputs. Provider work may already have incurred cost. Example chips fill the box; Enter submits.

## Variants

- A: both searches run on submission; exact catalog names lead, otherwise descriptions. The alternate group is behind a button.
- B: one additional Jev Choice inside the attribute request selects lookup, description, or uncertain. Confidence below a provisional 0.65 shows both. Catalog evidence still orders ambiguous cases. It does not save an inference call: the dimension request runs concurrently.
- C: both groups always visible after submission; exact catalog names lead. Same catalog evidence as A; no routing question.

Name matching normalizes case/punctuation and checks original titles too. This is deliberately a small heuristic, not a validated multilingual matching policy. People appear with TMDB known-for summaries; no full filmography retrieval. Results are review cards, not navigation links. The existing header search is unchanged; placement belongs to the next ticket.

## D4+ preservation

The server module is copied from `prototype/crate-evidence-column` at 26006f1, with the documented `essence_text IS NOT NULL` eligibility correction. The new entry point calls the full attribute reading and short want/avoid reading concurrently, uses the accepted +0.6 / -1.2 thresholds, and invokes the existing two-phrase / mood-gate / wider-evidence ranker. Only variant B adds the experimental routing question. No ranking weights were retuned. The archive still uses jev-latest; production model pinning belongs to the architecture decision.

## Observations, not human ratings

Eight live requests and raw outputs are in [evidence.json](evidence.json). This is a routing check, not the agreed search evaluation baseline.

- Heat, Drive, Her: exact titles returned; Jev routing confidence 0.25, 0.50, 0.50 respectively. Word interpretation cannot replace catalog identity.
- Like Game of Thrones, but sci-fi: Jev selects description at confidence 1.0; returned Farscape: The Peacekeeper Wars, The Expanse, Battlestar Galactica. No reference-title metadata is injected; this does not establish reliable analogy understanding.
- Tom Hanks: catalog returns the person; Jev lookup confidence 0.99. Description results are not a filmography.
- Incepton: catalog returns no names; Jev lookup confidence 0.78. B can lead with an empty group, while C keeps discovery visible. No typo correction has been implemented.
- Game of Th: catalog returns Game of Thrones, but the heuristic only detects exact matches, so submission can lead with descriptions. While typing, only catalog suggestions appear.
- Tense but not bleak: description route confidence 0.98. The existing ranker can still return upcoming titles and sporting events; quality/hygiene is a separate decision.

The eight instrumented description searches took 1,167–1,348 ms locally with 7,612–7,973 input tokens. A separate no-router run of “tense but not bleak” used 7,489 tokens versus 7,621 with routing: +132 tokens in this one comparison. These are single observations, not latency percentiles.

## Verification

Browser smoke check using Playwright (Chrome DevTools MCP unavailable): live names appeared; zero description calls while typing; Enter produced both groups; changing input hid stale descriptions; variant B produced a routing judgment; 390px viewport had no horizontal overflow; no browser page errors. Desktop/mobile screenshots are adjacent. No automated test files were added.

The repository TypeScript check reports existing errors elsewhere; it reports none in the two prototype modules. The initial pnpm invocation attempted a dependency setup and failed; generated untracked pnpm configuration files were removed, and the compiler was run directly.

## Review pending

No variant is accepted and the decision ticket remains open. Suggested starting point: C, because ambiguity stays visible and it needs no extra routing judgment. Review whether both groups feel useful, particularly Heat, Tom Hanks, and Incepton. Decide whether a typo or partial-name match needs special treatment before implementation.
