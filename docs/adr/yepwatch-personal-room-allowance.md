# YepWatch personal room creation allowance

Owner-approved 2026-11-11: replace the shared 20-room capacity with 10 rooms created at a time per person. Joining other people's rooms does not consume this allowance.

Creation attribution is separate from current hosting. An account uses one allowance across devices and login sessions. A guest uses a random installation identifier in protected native storage, or an HttpOnly browser cookie. Signing in uses the verified account identifier; a request cannot choose someone else's account. Guest identifiers are not authentication grants. Different guest installations or clearing browser storage create different guest allowances; no IP fingerprint is used. Previously created guest rooms are not retroactively assigned to a newly signed-in account.

A reservation lasts until the room's fixed six-hour expiry. Leaving, host transfer, starting another round and rejoining do not release or transfer the reservation. Existing rooms are grandfathered through their original capacity records. The old control row and fingerprint remain intact; its 20-room setting applies only to legacy admission paths. The shared per-minute admission and command budgets remain separate abuse controls.

New allowances use independent primary-key CAS rows, each containing at most ten live reservations, plus a fixed room proof for retries and room operations across processes. Account and guest identifiers are HMACed with the existing service key. Enforcement never uses a search count. Unknown acknowledgements retain reservations conservatively and require exact retries; expiry is not extended. The minute retention job removes expired allowance metadata using fresh primary-key reads and CAS deletes so a concurrent renewal survives cleanup.

Install the additive [migration](../../goodwatch-webapp/app/server/yepwatch/migrations/20261111-personal-room-limit.sql), including runtime table grants, before deploying the API. Preserve the room key and all live data. Production keeps two replicas. `provision-creation-quota --apply` is the operator DDL alternative; grants remain an administrative step. The personal limit is configured by `YEPWATCH_PROPOSAL_ROOMS_PER_PERSON` (default 10); do not change the legacy fingerprint settings to install this change.

Validation uses a disposable Crate database for independent instances, concurrent creation, the 10-room boundary, lost acknowledgements, fixed retries, a full legacy pool, separate account/device identity, and cleanup/renewal races. HTTP and native client tests cover identifier persistence and scope.
