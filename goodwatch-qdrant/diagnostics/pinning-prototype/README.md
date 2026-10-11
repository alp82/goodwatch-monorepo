# Uninstalled mapped-data pin prototype

This backend prototype tests preventive file-page locking. It has not been installed or used to pin production or the diagnostic clone. A successful pin state is not application latency acceptance. The frozen three-cycle production backup observation continues independently.

`pin.py` opens regular single-link files read-only, discovers current `SEEK_DATA`/`SEEK_HOLE` ranges, rounds and merges pages, and uses `PROT_READ | MAP_SHARED` mappings. Only selected data pages receive `mlock`; full sparse holes are excluded. Partial data-page boundaries necessarily include the rest of that page. `mincore` checks residency without reading mapped bytes. Selection hashes cover file identities and complete raw extent ranges; they do not freeze contents or eliminate concurrent truncation races.

`runtime.py` verifies the fixed source image, exact mounts/resources, actual Qdrant executable, PID and process start ticks before and after a pass. Clone mode additionally requires the task labels and exact loopback publication. Deleted mappings are excluded and retired while unchanged healthy locks remain held. Replaced files or changed ranges reconcile individually. A source restart releases previous locks and verifies that only the helper process joins the current Qdrant cgroup. The helper uses its own instance lock, independently of the backup job lock.

Four classes are selected by the proposed rule: vector, graph, sparse and other. Payload files are measured but excluded unless an explicit reviewed policy includes them. These classes infer roles from filenames; they are not proof of which component a particular query accesses. Payload index/storage coverage must therefore remain visible in held-out results. Inventories fail above 20,000 distinct mapped files or 65,536 extents in one file rather than silently truncating coverage.

Production policy requires an additional-lock reserve of the archive size plus 2 GiB and an emergency floor of 1.5 GiB. Existing unchanged locks may remain when the archive consumes the reserve; crossing the emergency floor releases them. Locked-byte limits, `RLIMIT_MEMLOCK`, and mapped-data plus actual anonymous/kernel memory are checked before additions. Raising the helper's own memlock limit requires an explicit option. This arithmetic is a necessary guard, not proof that every existing cached page is charged to the target cgroup: earlier restore/archive processes can retain different memory charges.

Initial and additional locking require unchanged OOM, memory-max and CPU-throttle counters. Runtime exposes a narrowly scoped capability for a separately reviewed clone-pressure controller: only an explicit clone pressure pass with zero newly locked bytes and unchanged selection may report a memory-max increment without dropping the pins. OOM and throttling still fail. The normal runner does not enable this capability, and held-out query windows must remain strict. Pressure success must never be labeled initial pin success.

At the authorized read-only clone inventory on 2026-10-11, the four selected classes covered 1,725,227,008 page-rounded bytes; anonymous memory was 2,262,941,696 bytes and kernel memory 41,725,952 bytes. Their sum was 4,029,894,656 bytes under the unchanged 6 GiB clone cap. Including payload would increase selected pages to 4,068,966,400 bytes, leaving insufficient reliable cap margin. Host available memory was 4,468,654,080 bytes, below the production archive-plus-2-GiB reserve. These measurements do not authorize relaxing the production policy or increasing the clone cap.

The experiment plan remains pending review. It must use the existing task-owned archive for bounded read-only pressure or a separately reviewed smaller scratch budget. An additional archive-sized file would exceed the existing disk allocation guard. No global cache flush, production warming, Qdrant restart, resource change, search-history write, or paid lookup is part of this prototype. Freeze the helper and selection-rule hashes before selecting held-out requests; report missing coverage dimensions truthfully. Capture initial locking, pressure and held-out query resource windows separately, with source continuity, complete residency, exact result-set/per-ID score parity and ordering parity recorded independently.

Run local fixtures from the repository root:

```sh
python3 -m unittest discover -s goodwatch-qdrant/diagnostics/pinning-prototype
```

`daemon.py` with no arguments prints a prepared-only record and performs no inspection. Its explicit `measure` action calls the readonly inventory without creating a pin manager or moving the helper into a cgroup. Its `pin` action remains pending runtime validation. The daemon exits after the configured lifetime or a termination signal and releases its mappings; the cleanup result must be checked separately from its preceding stopping record.

There is no reviewed frozen configuration yet. Review an exact `mapped-data-pin-config.v1` JSON file containing `source`, `policy`, `intervalSeconds`, `lifetimeSeconds` and allowed `actions`. Source fields must pin the current task-owned clone image, exact three binds including the renamed restore fixture, loopback port, 6 GiB memory/swap values and two-CPU limit. The four-class policy explicitly supplies maximum locked bytes, archive size, reserve and emergency floor; payload inclusion is disabled. The daemon hashes the exact JSON bytes as `policySha256`, and hashes the filenames and bytes of `pin.py`, `runtime.py` and `daemon.py` as `codeSha256`. Any source/helper/config change invalidates those reviewed digests. Use `daemon.code_hash()` to compute its canonical code digest; use SHA-256 of the exact configuration bytes for the policy digest.

After exact configuration review and validation, the invocation template is:

```sh
python3 goodwatch-qdrant/diagnostics/pinning-prototype/daemon.py \
  --config REVIEWED_CONFIG --policy-sha256 REVIEWED_POLICY_HEX \
  --code-sha256 REVIEWED_CODE_HEX --action measure
```

A reviewed pin invocation would additionally require `--action pin`; `--raise-own-memlock` authorizes raising only this helper's limit. It is rejected for measure mode. These examples are templates, not executed deployment commands. The daemon currently has no pressure-window activation mechanism; a separate reviewed controller is still required before experiments.

The fixtures use owned temporary files and real small readonly mappings to verify sparse-page accounting, no file writes, partial lock failures, residency failures, successful release, retry after failed unmap, segment replacement without dropping healthy locks, PID/start-time turnover, headroom and limit rejection. Runtime boundaries use local fixtures; they do not issue Qdrant requests or change services. Stop/exit releases the helper's mappings and their locks. A failed `munmap` retains tracking and the instance lock until cleanup succeeds or the helper exits; continuing with untracked locks is forbidden.

Linux documents file-backed locked mappings on the [unevictable LRU](https://cdn.kernel.org/doc/html/latest/mm/unevictable-lru.html), and [mlock/munlock](https://man7.org/linux/man-pages/man2/munlock.2.html) specifies page-rounded locking, limits and release behavior. Those paging guarantees do not promise fixed file contents.
