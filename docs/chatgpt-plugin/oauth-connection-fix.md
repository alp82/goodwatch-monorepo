# Signed-client OAuth token exchange

On 2026-10-20, the ChatGPT custom connection returned “We couldn't connect your account” after GoodWatch consent. Production access logs showed successful authorization and consent redirects followed by HTTP 503 from `/api/auth/oauth2/token`. No password reset or email-verification change was needed.

An isolated public-client DCR exchange and a reconnect after revocation both succeeded. An isolated client using `private_key_jwt`, the authentication method advertised by ChatGPT's public client metadata, reproduced the 503 without a prior disconnect. A local integration test reproduced the same failure against disposable CrateDB and Valkey.

The OAuth provider creates an `oauthClientAssertion` replay marker with a deterministic hash ID. Better Auth's `generateId: "uuid"` option rejects that supplied non-UUID ID before the strict database adapter receives it. The adapter correctly refused the incomplete record and the HTTP boundary failed closed with 503. The fix uses a UUID-generating function: ordinary records still receive UUIDs, while provider-supplied deterministic IDs survive input transformation. No database migration, permission widening, credential reset or relaxation of replay checks is required.

The regression exercises a real signed client assertion, code exchange after partial consent, preservation of the exact replay-marker ID in CrateDB, rejection of a reused assertion, and refresh-token rotation with a fresh assertion. The auth test runner accepts `AUTH_TEST_NAME_PATTERN` for focused runs. Diagnostic logging was temporary and removed before release.

Reproduction:

```sh
cd goodwatch-webapp
AUTH_TEST_NAME_PATTERN='canonical resource|private_key_jwt' bash scripts/auth-mcp/run.sh
```

This backend regression and direct production verification do not establish that the ChatGPT user-interface reconnect has succeeded. The owner must retry the actual ChatGPT connection after the release and run a representative personal-data tool. Record that result separately.
