# Search image upgrade after the MCP origin fix: go for owner pastes

Verified on 2026-10-17, approximately 01:59–02:02 UTC. This supersedes the
origin blocker in the [Q49 receipt](../20261017-mcp-launch-q49/README.md).
The owner authorized upgrading the two search roles to the image deployed on
the page instances. No Coolify settings or live proxy files were changed.

## Readiness verdict: go

Both page instances and both search roles now run:

```text
ghcr.io/alp82/goodwatch-webapp:f8e37568ffb3f870be0016915beccb5334554d73
Image ID: sha256:a4fd429605950bf33b5c04561c9fc12ed87dd5125760471af0937e774023a3b1
Registry digest: sha256:2cb645b76c27b00e93fb42816f335af13fd1bb5acc3fa5a08de642cc13659152
```

The current main commit `f8e37568` contains the shared `isAddressedTo` fix.
The target tag was read from healthy page containers on both hosts, and the
matching image was already present on vector1. No image pull was necessary.

- Search A was upgraded first, starting at 01:59:55 UTC. Health and query-model
  readiness passed before the MCP check. An initial fetch-based probe failed;
  the explicit HTTP probe below passed at 02:01:01. B was left unchanged until
  that pass. The rollout monitor checked B's unchanged container ID and readiness
  200 throughout the A recreation (at least five recorded startup samples).
- Search B was upgraded second, starting at 02:01:10, and passed health,
  query-model readiness, environment equality and the MCP challenge at 02:01:42.
  Search A retained its new container ID and served readiness 200 on all seven
  monitoring samples during the B upgrade.
- Both new containers are healthy with zero restarts. All 14 required auth/MCP
  values plus `REC_CONNECTOR` match the running vector1 page instance by SHA-256
  comparison. No environment values or secret fingerprints were emitted.
- Both return readiness 200 and **anonymous POST `/mcp` → 401**, using Node's
  explicit `http.request` with `Host: goodwatch.app`, `X-Forwarded-Proto: https`,
  `Content-Type: application/json` and body `{}`. Each response contains:

  ```text
  WWW-Authenticate: Bearer error="invalid_token", error_description="Missing Authorization header", scope="mcp:read", resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"
  ```

Receipts: [A rollout](upgrade-search-a.jsonl),
[A explicit-header verification](verify-search-a.jsonl),
[B rollout and verification](upgrade-search-b.jsonl).
The first A probe used `fetch`; the successful checks use `http.request` and
record the actual outgoing Host header. A was not recreated again for the
corrected probe. The [upgrade script](upgrade-one.py) includes a read-only
`--verify-only` mode for that check.

## Persistent deployment record and backup

Before editing, saved vector1's `.env` to:

```text
/root/.config/goodwatch/mcp-image-upgrade-20261017T015934Z/search.env.before
```

Root-owned file mode 0600, directory mode 0700. The current `.env` remains
root-owned 0600. **Only `SEARCH_COMMIT` changed**; every other file byte is
preserved, including catalog credentials, permanent auth material, flags and
allocator settings. The Compose file itself did not need modification: it
already resolves the image through `SEARCH_IMAGE` and `SEARCH_COMMIT`.

Both resolved Compose images match the running target image, and both runtime
`SEARCH_COMMIT`/`SOURCE_COMMIT` entries match its tag. Every configured Compose
environment entry matches its running container by hash. A later recreate will
therefore keep `f8e37568` rather than rolling back to the old tag.
[Preparation receipt](image-preparation.json),
[final deployment record](final-deployment-record.json),
[preparation script](prepare-image.py).

## Public smoke checks

- Public anonymous `POST https://goodwatch.app/mcp` → **401** with the same
  protected-resource metadata challenge. This still reaches the page instances
  until the owner pastes the search routing. [Response](public-mcp.json).
- `https://goodwatch.app/.well-known/oauth-protected-resource/mcp` → **200**,
  canonical resource `https://goodwatch.app/mcp`.
- `https://goodwatch.app/.well-known/oauth-authorization-server/api/auth` →
  **200**, issuer `https://goodwatch.app/api/auth`.
  [Metadata checks](public-metadata.json).

## Final owner paste inputs: unchanged

The four live proxy files (search and page/balance on both hosts) remain
**byte-identical** to the captures used by the successful 71-search/38-balance
suites. The two paste files retain their tested SHA-256 hashes and still match
current main after private-address substitution and preservation of abio's
live www middleware. No proxy YAML or suite change was necessary, so the full
proxy suites were not rerun. The new image was verified with the production
health and MCP probes above. [Live-file revalidation](proxy-revalidation.json).

1. **Vector1 first:** Coolify → Servers → vector1 → Proxy → Dynamic
   Configurations → existing `goodwatch-search-instance.yaml`. Replace the
   full content with:

   ```text
   /tmp/gw-mcp-launch-pr595/docs/implementation/auth/cratedb-production/20261017-mcp-launch-q49/vector1-goodwatch-search-instance.paste.yaml
   ```

   [Full vector1 text](../20261017-mcp-launch-q49/vector1-goodwatch-search-instance.paste.yaml).
   SHA-256: `3cfb2d5ea6f06aaf8c6bb67b64471a65831adbf8b88059fd5e47b7f8210e3e85`.
   After save, the agent reads back the YAML, checks proxy/role health, and
   verifies a private request from abio with `Host: goodwatch.app`,
   `X-Gw-Role: search` and forwarded HTTPS reaches `/mcp` with the correct 401
   challenge. Public `/mcp` remains on page routing at this stage; check page
   traffic and both metadata URLs as well.
2. **Abio second:** Coolify → Servers → abio → Proxy → Dynamic Configurations →
   existing `goodwatch-search.yaml`. Replace the full content with:

   ```text
   /tmp/gw-mcp-launch-pr595/docs/implementation/auth/cratedb-production/20261017-mcp-launch-q49/abio-goodwatch-search.paste.yaml
   ```

   [Full abio text](../20261017-mcp-launch-q49/abio-goodwatch-search.paste.yaml).
   SHA-256: `2b6e1efad58493b401af9e4481dd67c2323ce7a815f1f4cccba568465dc58aec`.
   Keep the included `gw-webapp-www-to-apex` middleware exactly once. After
   save, the agent compares the YAML, requires public POST `/mcp` → 401 with
   discovery, confirms search-role request counters increase, and verifies
   metadata/page routing, the existing search paths and HTTP/HTTPS www-to-apex
   301 redirects with path/query preservation.

Save each existing configuration; no proxy restart is needed. No paste or
post-paste production check has occurred in this turn.

The [root-only proxy rollback copies and restoration order](../20261017-mcp-launch-q49/README.md#root-only-rollback-locations)
remain valid because the live proxy bytes are unchanged: restore saved abio
content first, then vector1 content. Do not delete abio's search file, because
it owns the required www middleware.

## Remaining acceptance

The fresh upgrade and anonymous discovery gates pass. The preceding Q49 table,
flags, store and routing-test evidence remains applicable. Production OAuth
client/token creation, authenticated `tools/list`, actual read/write/ranked
tool calls and refresh remain owner-account step 3.3 and were not performed.
The owner pastes are the remaining step before routing `/mcp` to the roles.

This receipt is committed only to the existing PR #595 branch,
`alp82/529-map-members-goodwatch-mcp-on-self-hosted-better`. No main change was
needed in this turn; the origin fix was already deployed by the owner.
