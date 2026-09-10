# Anonymous homepage cache refresh

`POST /api/internal/homepage-warmup` refreshes only the shared German/English
homepage showcase: Inception, The Office, Spirited Away and Breaking Bad.
It accepts no query parameters or request body. Send an `Authorization: Bearer`
header containing the deployment's `HOMEPAGE_WARMUP_SECRET` (at least 32
characters). Store the same value as the secret Windmill variable
`f/utils/homepage_warmup_secret`; never put it in job arguments or logs.

The endpoint calls the existing showcase and detail functions with cache reads
bypassed. It validates all four identities and usable display fields before
replacing the normal `cached-showcase-examples` country-DE entry. The value
format and 24-hour TTL match ordinary requests. The existing cache-miss fallback,
rendering and personalized request paths remain unchanged.

A five-minute Redis lease prevents simultaneous refresh computation. Its key
uses the existing cache key as a Redis Cluster hash tag. A Lua operation verifies
ownership, replaces the entry, and confirms its exact value and TTL atomically.
Expired owners cannot publish. Computation failure leaves the old entry intact;
Redis errors fail visibly. Release only removes the invocation's own lease.

Successful responses contain `status: refreshed`, fixed country/language, four
identities, `computed_at`, `ttl_seconds: 86400`, and `write_verified: true`.
The Windmill job requires all these fields, rejects redirects, and has a
330-second request timeout within its 360-second job timeout. Any incomplete
response or HTTP/transport failure fails the job without logging credentials.

## Deployment and operation

1. Set the shared secret in the webapp runtime environment and Windmill secret
   storage. Deploy the webapp and the updated
   `f/utils/visit_goodwatch_and_populate_cache` script.
2. Run that script with empty arguments. Confirm the structured result and read
   the existing Redis entry: four expected identities, matching timestamp and
   approximately 86,400 seconds remaining. HTTP 200 alone is insufficient.
3. Replace the existing `f/utils/visit_goodwatch_schedule` schedule with
   `0 0 0/12 * * *`, timezone `Europe/Berlin`, pointing to the same script with
   empty arguments. Enable it only after successful endpoint verification.
4. Manually verify cold population, a subsequent normal cache hit, refresh of an
   expiring entry, unauthorized rejection, overlap rejection, and preservation
   of a known good value on incomplete computation or Redis failure. Do not add
   automated webapp tests; the webapp's AGENTS.md prohibits them.

Validation before deployment: webapp typechecking retains the same 292 existing
diagnostics, with no added or removed errors after normalizing line shifts.
The Python worker passes Pyright. Production acceptance requires the deployment
steps above; a reviewed code change alone does not establish live cache warming.
