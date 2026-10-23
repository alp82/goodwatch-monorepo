# Short YepWatch invitations — 2026-10-23

New production rooms use 16-character Crockford-style keys (80 bits), displayed in `/r/KEY` links. Lowercase, spaces and dashes are accepted for manual entry. Existing signed invitations, room IDs, guest identities and admission retries remain compatible. Historical demo repositories without typed invitation lookup retain signed links.

The separate typed `doc.yepwatch_invitation` table maps a SHA-256 key hash to `room_id` and the original `expires_at`. Resolution uses a full-primary-key lookup and then validates the live room's stored invitation hash. No plaintext key, generic payload, room scan or search refresh is needed. Duplicate mapping writes are proved by key after uncertain acknowledgements; collisions fail without redirecting to another room. Joining also requires the resolved room to match the requested room.

Validation:

- 31 domain/release/member/control tests pass, including short-key normalization, exact admission replay, old-link recovery, expiry and cross-room mismatch.
- Actual disposable Crate relational test passes: immediate cross-instance key lookup, lost mapping acknowledgement, mapping collision, concurrent votes, database restart and decision.
- Actual disposable Crate control test passes: two HTTP instances, capacity, rate budgets, exact recovery, expired typed cleanup and backup/restore with the extra table.
- Release API image builds: `sha256:b01db1f5eeedb03a832e0a930d7ea5478b890fed61d229f522a6da3db3be2228`.
- YepWatch has zero TypeScript diagnostics. The broader imported graph still reports unrelated existing catalog/UI/cache diagnostics; a whole-repository typecheck pass is not claimed.

Applied only the additive invitation-table DDL and runtime grant on the existing cluster before publishing this source. Table health and runtime-role read check passed. No existing rooms, keys, quotas or decisions changed; no application restart or Coolify action performed. New links require deployment of this source. Existing installed clients accept the new strings without rebuilding.

## Six-character follow-up

New rooms now use six uppercase letters/digits excluding 0/O/1/I/L. Atomic primary-key reservations try up to 32 reproducible candidates on collision; existing mappings are never reassigned. Retries preserve the reservation’s original expiry. Sixteen-character and original signed links stay valid. No further schema migration is required.
