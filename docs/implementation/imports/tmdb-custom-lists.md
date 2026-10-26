# TMDB custom lists

The one-time TMDB account import now reads custom lists through the existing v3
session, alongside ratings, Want to See and favorites. Each list goes through the
shared Lists selection, preview, Confirm and Undo. Names, descriptions, typed TMDB
identities and the order returned by TMDB are retained. Empty source lists remain
empty lists. Membership never creates Want to See, scores or watches.

Imported lists start private. A fresh import creates another list; retrying the
same Confirm reuses its list. Undo removes only unchanged, private lists belonging
to that import. Member edits and shared lists remain protected by the existing
list writer and version checks. See [custom list imports](custom-lists.md).

## Acquisition and limits

The owner chose v3/API-key sign-in in [Build Connect TMDB](https://github.com/alp82/goodwatch-monorepo/issues/619).
This change retains that decision and its encrypted one-time session cleanup.
The source reads are `GET /3/account/{account_id}/lists?page=N`, then
`GET /3/list/{list_id}?page=N` with the same session. There are no source writes.
The existing five-minute account deadline, per-request timeout, rate-limit
handling and pacing also cover these requests. The 50,000-item account budget
includes list records and their entries; index and content page counts are capped
at 2,500 each. Failed requests, malformed rows, unexpected list/page identities,
and duplicate typed identities reject the read rather than reporting an empty
list. Changed or mismatched counts produce actionable partial-import warnings.
Unknown media types stay visible as unsupported entries.

This is the v3-accessible list scope. TMDB documents mixed-media/private lists and
per-item comments as v4 improvements; authenticated v4 coverage is not established
by this change. The tested v3 list details carry no per-entry comments; imported
notes are empty. No source-added or viewing dates are invented. A returned `tv`
identity is preserved as a show; that is not a claim that v3 enumerates all mixed
or private lists. Final owner disposition of these limits is recorded on
[Complete TMDB custom-list acquisition through the shared import pipeline](https://github.com/alp82/goodwatch-monorepo/issues/769).

Primary contracts, checked October 26, 2026:

- [Account lists](https://developer.themoviedb.org/reference/account-lists).
- [List details](https://developer.themoviedb.org/reference/list-details).
- [v3 or v4 lists](https://developer.themoviedb.org/reference/v3-or-v4-lists).
- [Private v4 list authentication](https://developer.themoviedb.org/v4/reference/list-details).

## Verification

The initial account-capture test failed before implementation, then passed with
paginated list acquisition. Boundary regressions cover malformed paging, repeated
identities, wrong list identity, excessive page/item counts, unsupported media,
partial warnings and credential-safe failures. The shared service test runs the
TMDB client through preview, Confirm and Undo, checking private list creation,
order and description, preservation of edits, and absence of scores or wishes.
Existing connection tests still verify session deletion before preview.

On October 26, 2026, the actual parser read public TMDB list 1: **68/68** unique
typed identities across **4** content pages, **5** HTTP requests including the
reference read, **0** unsupported rows and **0** count warnings, in **748 ms**.
The account-list index for this check was synthetic. This verifies public content
paging, not an authenticated member's complete list inventory. Aggregate evidence:
[public list check](../../verification/import-wave-2026-10-26/tmdb-public-list.json).

Import/IMDb/import-UI/shared-list regression: **901 passed, 0 failed**. Typecheck
has the same **334 output lines** as the untouched starting commit
`7bdbbb95da7e3a20f229afaeb9acbc7c9289985f`; no diagnostic was added. These are local
checks, not deployment or signed-in member acceptance.
