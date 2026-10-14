# Implement selected-language media content with variant F

> Scope amended by the owner on 2026-10-14 (Q1–Q3): page prose/FAQ/fingerprint/taste/essence translation is outside this release; canonical English readers remain, and prose resources/jobs/schema were removed. Media fields and season/episode text remain localized. Season/episode migration and bounded ingestion are approved only after main, coordinated by the owner. See [current decisions](media-language-decisions.md), [surface matrix](media-language-surface-matrix.md) and [rollout](media-language-rollout.md). Original phase wording below records the earlier plan.
Handover date: 2026-10-14. The user selected F: “F is great! create a handover for a new session to build it”. This session produced documentation only; implementation starts in a fresh session.

## Start here

1. Read root `AGENTS.md`, `CONTEXT.md` and the [research inventory](../research/media-language-localization.md). The research is the authoritative technical reference for readers, storage, caches, ingestion, constraints and validation; check cited code against the implementation checkout before changing it.
2. Read the local worktree [F behaviour reference](/home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/HANDOVER-F.md) and [README](/home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/README.md). Use the pinned archive commands below for the committed source independent of that worktree. F is the primary design reference. Rebuild its interaction in production components; do not merge or cherry-pick the full prototype branch.
3. Resolve the policy inputs below before dependent implementation. Independent locale, presentation and persistence seams can progress meanwhile. Follow repository issue/triage conventions before any issue work.

User model preference: **Opus 5.5 via Claude Code for UX/design; GPT 6.1 Sol for backend, algorithms and research**. Route work accordingly where available; surface unavailable models rather than silently substituting.

## Settled scope and interaction

- Translate all media content across relevant surfaces: movie/show titles, posters, descriptions and taglines; season/episode text; generated FAQ, fingerprint/taste narratives and essence prose. Navigation, buttons, filters and settings stay **English**. Translate vocabulary within content prose while keeping interface controls English.
- Start from browser language; an explicit saved choice wins over the browser. Browser default clears the explicit choice and follows the browser again. Normal live title/list/profile links use the **recipient's** effective language.
- Availability country and presentation language are independent. Language never changes or suggests country. An explicitly picked language survives later country picks: French → Japan → Spain stays French. Country can offer an optional language companion; it never selects one automatically.
- F puts one compact country/language pair beside Share in the existing sticky title header. It opens a compact modal with **Country / Titles** tabs, one fixed-height list at a time, reopening the last tab. Titles includes Browser default. Where-to-watch names the country; its alternate-country actions enter the same preview flow.
- A pick closes the dialog and previews on the **current title inline**. Closing without a pick changes nothing. The pair marks unsaved values; a compact **Keep this? / Keep / Undo** question anchors beneath it without shifting the layout. Using the page, scrolling or selecting Rent retains the preview and question. Reopening the dialog retains them too.
- The question offers an initially unticked companion when applicable. Keep persists the intended pair in one atomic boundary. Undo before Keep restores the saved pair; success offers Undo of the whole saved pair through the same persistence boundary. Save failure retains the preview, the previous saved pair and an announced Retry state. During saving, Undo/dismissal are unavailable.

F selection approves this interaction, not every fixture, fallback, storage assumption or edge case. Opus's final review (`S0c:P4wz7:G5ugv`, 2026-10-14 08:51 Europe/Berlin) reports no F handover blockers and verifies explicit-language survival, preview retention, pair Keep/Undo and failure retention. These are prototype observations, not production verification.

## Production fixes and remaining decisions

Implement these fixes explicitly:

- Disable the pair and all alternate-country/pick entry points while a save is in flight, or deliberately queue picks with visible state. The prototype can silently lose a pick made during saving.
- Browser default confirmation and toast must say **follow browser**, with the current resolved language only as context; “Saved German” wrongly implies an explicit German choice.
- Use real radios for mutually exclusive companion alternatives, with an explicit way to decline; a single optional companion can remain a checkbox. The mock suggestion table and one-line slot do not establish multilingual-country policy.
- Name the actual save destination in confirmation/success copy: this device for guests, account for members, consistent with the chosen persistence contract.

Decisions still open:

- Launch locales, region/script negotiation, no-match behavior and per-field fallbacks, including blank translated titles, posters and generated blocks. The six mock languages and English/original fallback orders are placeholders.
- Preview lifetime across navigation, reload, tabs and sign-in; what happens when a companion was accepted and country changes later. The prototype clears an unsaved accepted suggestion on the next country pick; this is evidence, not approved policy.
- Escape scope: the prototype globally discards pending values from any page focus. Prefer handling scoped to the pair/question and respect other controls; agree the behavior. Escape in an open dialog closes only that dialog. Decide whether the anchored question should fold/shrink on phones so content stays readable.
- Member/device conflicts, members without account language, guest-to-account transfer and guest SSR persistence. A server-readable cookie is the research recommendation; precedence and reconciliation remain decisions.
- Confirming an unchanged guessed country, F adaptation for English settings, and existing country-bearing view URLs. Language on live shared pages remains recipient-based.
- Stable crawler/OG and download snapshot locales; translation quality, model/provider, spend cap, demand/backfill priority and refresh policy. Library Title collation/alias matching also needs the research's explicit policy and evaluation.

## Phased implementation seams and exit checks

These are engineering phases, not approval for a permanent title-only, Latin-only or English-prose release.

1. **Policy and bounded evidence.** Record the decisions required by the next slice; verify affected deployed schemas/flows and named-title coverage without broad production scans. Identify deterministic template blocks and immutable model-prose source revisions. Exit: supported-locale/fallback contracts and a bounded translation quality/cost plan are reviewable.
2. **Effective context and preferences.** Create one normalized resolver for country, locale and provenance across SSR, loaders, preview and clients, before cache lookup. Model saved preferences separately from preview, including explicit versus browser-following choice. Replace row-by-row pair writes with a proven atomic record/boundary; use the same boundary for Undo. Provide server-visible guest persistence and consistent member resolution. Exit: reload/first paint agree, failed saves never half-write, and stale preview/save responses cannot replace newer intent.
3. **Presentation and text production.** Batch title/poster overlays over canonical rows; extend adapters to stable season/episode IDs and generated blocks with field language/fallback provenance. Add completeness-safe episode translation ingestion, reviewed FAQ/fingerprint/taste locale resources, and separate source-versioned model-prose translation jobs with quality/retry/spend controls. Exit: required content classes have production paths; no paid generation runs in SSR/search/preview; source changes invalidate stale translations.
4. **F and all readers.** Integrate the real header, where-to-watch and settings with that context, then every reader in the research surface inventory: cards, provisional/final/fallback search, palette, Discover, related/collection, Wishlist, Watch next, My library/My shows, home/taste, person, Explorer, shared pages and agreed static renderers. Update API URLs, TanStack keys, SSR prefetch and locale-bearing caches together. Exit: an explicit matrix accounts for every inventoried field/surface; localized-name lookup and Title sort are evaluated separately from display overlays.
5. **Validation and rollout.** Run the research's meaningful scenarios and relevant existing tests; measure batch reads, cache cardinality, fonts, translation quality/cost and landing budgets. Version page/search/ingestion contracts for mixed-version deployment; plan rollback without deleting translations or saved choices. Exit: role compatibility and the completion checks below pass before declaring full scope done.

Preserve canonical IDs/names/slugs, ranking evidence/order, DNA scores/vectors, watch identity and episode-rating alignment. Apply display overlays **after** canonical ranking and episode matching, without mutating shared cached objects. If present and current, coordinate with the separate [episode-alignment plan](tracking/episode-season-alignment-plan.md). That plan is currently uncommitted coordination evidence, not a settled requirement; localization does not resolve its separate identity policy. Missing translation must never become a title 404 or evidence to delete an episode/other locale. Keep current tracking access gates while allowing guest language selection.

Starting production files (full inventory remains in research): [DetailsHeader](../../goodwatch-webapp/app/ui/details/DetailsHeader.tsx), [WhereToWatch](../../goodwatch-webapp/app/ui/details/hero/WhereToWatch.tsx), [settings action](../../goodwatch-webapp/app/routes/api.user-settings.set.tsx), [settings server](../../goodwatch-webapp/app/server/user-settings.server.ts), [Crate upsert](../../goodwatch-webapp/app/utils/crate.ts), [cache identity](../../goodwatch-webapp/app/server/cache-identity.server.ts), [details](../../goodwatch-webapp/app/server/details.server.ts), [shared cards](../../goodwatch-webapp/app/server/title-cards.server.ts). The current country-picker path persists/navigates on selection; preview needs a read-only setter. Multiple settings rows currently write separately, so one API request does not establish atomicity. Browser-based initial language supersedes ADR 0005's historical country-derived motivation; preserve its independent cache dimensions. Search roles can run older commits (ADR 0011).

## Completion checks

- F works on desktop/phone and keyboard: no control-induced layout shifts, dialog/focus return, optional companion, Browser default wording, scoped Escape policy, save destination, in-flight protection, Retry and whole-pair Undo.
- Guest/member first paint, saved-over-browser precedence, browser negotiation/region/script, country-only versus language-only changes, navigation/sign-in conflict policy and recipient-language sharing agree across server/client.
- Every inventoried surface uses the same resolver and truthful fallback provenance. Warm/simultaneous locale caches, streams, SSR prefetch and API keys cannot leak language; unsupported/missing translations never poison title existence.
- Ranking and canonical episode alignment remain unchanged; localized names/overview/tooltips and Next episode render only after matching. Partial fetches retain unseen entities/locales; library pagination and alias lookup meet the agreed contract.
- Generated resources/blocks preserve facts and source revisions, validate language/placeholders/numbers, track retry costs and obey spend controls. Mixed-script/RTL text, element language, fonts, canonical/SEO and static-image identities satisfy agreed policies.

## Durable prototype sources and preview

Local archive: branch **`ghostex/de374ad4`**, commit **`04d3e5fe`**. It is **local only, not pushed**; GitHub cannot serve these sources. A fresh clone needs the commit transferred into its repository before access. The clickable links here open the existing local prototype worktree; the following commands read the pinned commit from the same repository independently of that worktree or server:

```bash
git show 04d3e5fe:docs/prototypes/media-language/HANDOVER-F.md
git show 04d3e5fe:docs/prototypes/media-language/README.md
git show 04d3e5fe:goodwatch-webapp/app/ui/prototype-media-language/variant-f.tsx
```

The [F source](/home/alper/projects/goodwatch-monorepo-de374ad4/goodwatch-webapp/app/ui/prototype-media-language/variant-f.tsx) uses `round2.tsx` (pair/overlay/focus), `model.tsx` (mock store/resolver), `parts.tsx` (lists), `host.tsx` (host page) and `fixtures.ts`/`fixture-text.ts` (samples) in the same directory. The dev-only route is `goodwatch-webapp/app/routes/prototype.media-language.tsx`; `docs/prototypes/media-language/drive-round2.mjs` is the browser walkthrough. Archived reports say 91/91 checks passed; this documentation session did not rerun them.

Source screenshots: [desktop dialog](/home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/f-dialog-desktop.jpg), [inline confirmation](/home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/f-confirm-desktop.jpg), [phone dialog](/home/alper/projects/goodwatch-monorepo-de374ad4/docs/prototypes/media-language/f-open-phone.jpg). Original worktree: `/home/alper/projects/goodwatch-monorepo-de374ad4`.

Temporary live preview: <http://100.71.215.115:3138/prototype/media-language?variant=F&bar=small>. Its session-owned servers and `/tmp` snapshot can disappear. For restart, use the runnable **Running the preview** commands in archived `HANDOVER-F.md` (or README's **How to open it** command), pointing the source at an archive checkout and serving an unedited copy. Use the provided tailnet proxy for remote viewing; it suppresses the real app shell's analytics. No server was started or checked for this handover.

## Paste-ready new-session instruction

```text
Implement selected-language media content in /home/alper/projects/goodwatch-monorepo.
Read AGENTS.md, CONTEXT.md, docs/implementation/media-language-handover.md and
docs/research/media-language-localization.md first. The user chose variant F;
translate all media, season/episode and generated content; keep interface English.
Use git show 04d3e5fe:docs/prototypes/media-language/HANDOVER-F.md and the archived
README/variant-f.tsx as design evidence. This archive is local only, not pushed;
a fresh clone needs commit transfer before access. Rebuild production components; do not
merge/cherry-pick the full ghostex/de374ad4 prototype branch. Follow the handover's
phases, explicit production fixes and completion checks. Browser default,
saved-over-browser precedence, recipient-language live links and F's inline
preview/Keep/Undo are settled. Resolve only the remaining policy dependencies;
do not silently approve fixtures or fallback/storage assumptions. Preserve
canonical ranking/episode alignment, unrelated workspace work and repo conventions.
Prefer Opus 5.5 via Claude Code for UX/design and GPT 6.1 Sol for backend/algo/research.
Start with current-code verification and the effective context/persistence seams;
carry the full surface inventory through implementation and meaningful validation.
```
