// Guests' taste, built per request from the guest progress their browser sent. Nothing about it is stored on the
// server; the process keeps the built taste for 10 minutes per distinct set of ratings and Want to See, because the
// quantile table costs about 6 ms and guest-aware endpoints receive the same progress again and again.
import { createHash } from "node:crypto"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import type { GuestProgress } from "~/server/viewer.server"
import { normalizeGuestInteractions } from "~/utils/guest-progress"
import { titleKey } from "~/utils/title-key"
import { type TasteSignals, quantileTable, tasteVector } from "./formula.server"
import { poolCosines, tastePool } from "./pool.server"
import { type BuiltTaste, type Taste, makeTaste } from "./taste.server"

const KEEP_MS = 10 * 60_000
const MAX_KEPT = 1000

const kept = new Map<string, { until: number; built: BuiltTaste }>()

function signalsOf(progress: GuestProgress): TasteSignals {
	const signals: TasteSignals = { ratings: [], wantToSee: [] }
	for (const item of normalizeGuestInteractions(progress.interactions ?? [])) {
		const key = titleKey(item.media_type, item.tmdb_id)
		if (item.type === "score" && item.score)
			signals.ratings.push({ key, score: item.score, at: item.timestamp })
		else if (item.type === "plan")
			signals.wantToSee.push({ key, at: item.timestamp })
	}
	return signals
}

export function loadGuestTaste(
	progress: GuestProgress,
	snapshot: TitleSnapshot,
): Taste {
	const signals = signalsOf(progress)
	const id = createHash("sha256")
		.update(snapshot.version)
		.update(
			JSON.stringify([
				signals.ratings.map((r) => [r.key, r.score]).sort(),
				signals.wantToSee.map((w) => w.key).sort(),
			]),
		)
		.digest("base64url")
	const now = Date.now()
	const hit = kept.get(id)
	if (hit && hit.until > now) return makeTaste(snapshot, hit.built)

	const { vector, ratings, liked } = tasteVector(snapshot, signals)
	const built: BuiltTaste = {
		ratings,
		liked,
		vector,
		quantiles: vector
			? quantileTable(poolCosines(tastePool(snapshot), vector))
			: null,
	}
	kept.delete(id)
	kept.set(id, { until: now + KEEP_MS, built })
	// Drop expired entries, and the oldest beyond the cap (a Map iterates in insertion order).
	for (const [key, entry] of kept) {
		if (entry.until > now && kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return makeTaste(snapshot, built)
}
