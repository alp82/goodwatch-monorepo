// One computation of the /stats snapshot: every read, then the build and its completeness check. stats.server.ts
// runs it in the background; scripts/stats-snapshot.ts runs it by hand and prints each statement's time.
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { buildStatsSnapshot, missingParts } from "./build"
import { memberAggregates, memberCounts, memberStats } from "./members"
import {
	type Reader,
	type Timing,
	crateReader,
	limiter,
	readCatalog,
	readMemberTitles,
	readMembers,
} from "./queries.server"

/**
 * Reads everything, builds the snapshot and checks it is complete; a short one throws, so the last one stays. Once
 * `signal` aborts (store.ts's deadline), the statements still to come throw instead of starting.
 */
export async function computeStatsSnapshot(
	db: Reader = crateReader(),
	now = Date.now(),
	signal?: AbortSignal,
): Promise<{ snapshot: StatsSnapshot; timings: Timing[] }> {
	// Four statements at a time at most, catalog and member reads alike.
	const gate = limiter(4, signal)
	const [catalog, members] = await Promise.all([
		readCatalog(db, gate, now),
		readMembers(db, gate),
	])
	const counts = memberCounts(members.visibility)
	const aggregates = memberAggregates(members, counts)
	const titles = await readMemberTitles(db, gate, aggregates)
	const snapshot = buildStatsSnapshot(
		catalog,
		memberStats(members, counts, aggregates, titles, now),
		now,
	)
	const missing = missingParts(snapshot)
	if (missing.length)
		throw new Error(`Stats snapshot is incomplete: ${missing.join(", ")}`)
	return { snapshot, timings: db.timings }
}
