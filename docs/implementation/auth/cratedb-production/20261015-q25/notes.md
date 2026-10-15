# Q25 production upgrade — in progress

Owner go Q25: complete crate-03, then crate-01, to pinned 5.10.16; crate-02 already upgraded. PR #589 runtime commit ebe8581f is present on both page containers and both search roles. Restore validation remains waived for this patch only. Known legitimate tables are accepted; real health/recovery/decommission gates remain. No auth-user/table, HBA, app/config, firewall or table-setting changes.

All 93 initial health rows GREEN, all 956 copies STARTED, all 21 node checks pass; 478 logical shards have copies on two distinct nodes. Master crate-01 last. Graceful timeout verified 2h, force=false, PRIMARIES; administrative HTTP 7500s / outer SSH 7530s. Actual process exit is an independent gate.

Fresh snapshot goodwatch-db-backup-v2.pre_auth_547_20261015035349 SUCCESS: CREATE 03:56:05.389–03:56:21.687 UTC (16.298s). Retained 18 unique BLOB files / 126,677,290 bytes with SHA1/size verification, protected on crate-01 under /root/cratedb-maintenance/547-20261015035349/blob-artifacts. Existing backup lock serialized creation.

Crate-03 staged with only the pinned image changed in rendered Compose; same data/mounts/private ports/runtime settings. Graceful decommission sent through crate-02. Read-only health observer, exact-window client logs/HTTP metrics and public GET probes active. No owned write probe is created in this upgrade-only window.
