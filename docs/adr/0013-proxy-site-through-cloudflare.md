---
status: proposed
---

# Proxy the site through Cloudflare after accepting the outage dependency

Proposed on October 29, 2026 for [#784](https://github.com/alp82/goodwatch-monorepo/issues/784).
The owner must accept this decision before changing the site's DNS record. No infrastructure changed.

## Context

[ADR 0010](0010-static-hostname-with-server-side-fallback.md) keeps the site's record DNS only.
Only static files depend on Cloudflare's proxy, and the server automatically switches asset URLs to the
origin when its static-host probe fails. Proxying the site's documents changes that failure isolation.

[Regional probes](../research/edge-cache-cloudflare.md#measured-regional-latency) measured origin
connection setup plus TLS plus first byte at 117 ms in Germany and 289–860 ms overseas. Most overseas
cost is connection setup to Germany. A nearby TLS endpoint and upstream connection reuse can help
uncached traffic. Actual gains for members require measurement.

## Proposed decision

After the owner accepts the outage dependency, proxy `goodwatch.app` with Full (strict) TLS and
hostname-scoped caching disabled. This phase needs no Worker. Preserve the static-host rules and
server asset fallback. Configure trusted client-IP forwarding at ingress, validate protocols and
security behavior, and prepare DNS-only rollback before cut-over.

This changes ADR 0010's DNS-only choice for the site's hostname. Its asset routing and automatic
fallback remain in place, but cannot recover a document connection blocked by a Cloudflare outage.

Add a Worker and anonymous HTML caching only in a later phase, after identity hardening,
Cloudflare-specific cache policy, deployment purge, asset-fallback coherence and runtime checks.
Members stay outside shared storage; the navigation cache remains their page-change accelerator.
The [research proposal](../research/edge-cache-cloudflare.md) specifies the phases and gates.

## Consequences

- Cloudflare processes all site traffic, including member cookies and API requests.
- A proxy outage can block documents, members, APIs and MCP. Static-host fallback cannot restore access.
- Misses and member responses still reach Germany. Nearby visitors can see an extra hop.
- DNS-only rollback takes time and depends on DNS propagation and control-plane availability.
  Keep valid direct-origin TLS and a prepared ingress rollback path.
- Proxying alone adds no anonymous HTML storage and promises no Lighthouse or SEO score increase.
- Free Smart Tiered Cache for the existing static host can proceed independently of this decision.
