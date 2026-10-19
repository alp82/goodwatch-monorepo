# S5 (own read-only requests): work in progress, stopped 2026-10-19

Stopped mid-investigation at the owner's request (usage limit). `DESIGN-S5.md` isn't written yet. Offline findings so far, from the saved client script (structure only, nothing sent to Netflix):

- **Request shape:** Netflix's `PrePersistedQueryLink` sends `extensions.persistedQuery = { id: <document UUID from __meta__.q>, version: 102 }` with no query text (`includeQuery: false`). The full query is resent only on `PersistedQueryNotFound` or `PersistedQueryNotSupported`. A separate sha256 persisted-query link exists, but the UUID path runs first in production. The UUID is a build constant; reading it from outside the page's modules isn't solved (options: hard-code per reviewed build, or reuse the shape of one observed page request).
- **Variables:** `rowId` (section `_id`), `carouselAfterCursor` (base64 position), `carouselPageSize`, `carouselVersion` (last reply's version), `eddEnabled`, plus many image-parameter variables.
- **Method and endpoint:** Apollo default `POST` with a JSON body; endpoint config `shakti.graphql.deployedClientUrl` defaults to same-origin `/graphql` (a cross-origin `sgw.prod.cloud.netflix.com/graphql` is used in another mode).
- **Headers the client adds:** `content-type: application/json`, `x-netflix.context.ui-flavor: akira`, `X-Netflix.Request.Originating.Url` (page URL), `x-netflix.context.operation-name`, `x-netflix.context.app-version` (client build), `x-netflix.context.locales` (page geo model), optional `hawkins-version` and `schema-variant`, plus per-request `x-netflix.request.id`, `x-netflix.request.attempt` and a client-context header. No CSRF token on the GraphQL path was found. Same-origin cookies are sent automatically.
- **Page size:** The client asks for `2 × visible` per page (initial `BASE_CAROUSEL_PAGE_SIZE` 13). Page capabilities declare `maxTotalEntities` 75 for standard carousels and `MAX_CAROUSEL_ENTITIES` elsewhere. The server's maximum for `carouselPageSize` is unknown offline. Whether one request can return the whole row needs a live check.

## Left to do

1. Resolve how an extension would obtain the persisted query UUID and the required headers without token extraction.
2. Decide whether a single large `carouselPageSize` request is allowed, and whether one response is a consistent snapshot (would solve `snapshot_unproven`); otherwise paging speed and back-to-back agreement.
3. Write `DESIGN-S5.md`: safety bar (read-only `CarouselPage` only, same-origin, own credentials only, no mutations, bounded count and rate, abort on unexpected shape, provenance and save rules, counts-only report), risks (terms of use, automated-request detection, persisted-query drift between builds), and the S4 versus S5 comparison with a recommendation.
4. Independent review before anything is built. `diagnostic-v3` stays as is; the owner may still run it to confirm the live endpoint and transport.
