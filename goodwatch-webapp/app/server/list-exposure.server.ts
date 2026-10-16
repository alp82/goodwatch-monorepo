import { randomUUID } from "node:crypto"
import { TASTE_KEY_VERSION } from "./taste/version.server.ts"
import { upsert } from "../utils/crate.ts"
import type { ViewerContext } from "./viewer.server.ts"
import type { TitleKey } from "../utils/title-key.ts"

import type { PersonalOrderExposure } from "./personal-order/reader.server.ts"

export const EXPOSURE_TITLES = 30
// Bound work retained while Crate is unavailable. The normal Crate timeout also applies to these writes.
const MAX_PENDING = 1000
let pending = 0

export interface ListExposureInput {
	surface: "discover" | "watch-next"
	/** The order actually used, independently of the displayed card match. */
	ordering: "taste-v2" | "personal-order"
	flags: Record<string, boolean>
	personalOrder?: PersonalOrderExposure
	watchNextTiers?: ReadonlyMap<TitleKey, string>
	sort: string
	sortRequested: string | null
	forYou: boolean
	forYouApplied: boolean
	filters: object
	/** Discover's page number; null for Watch next's initial view and later card batches. */
	page: number | null
	/** Distinguishes Watch next's initial view from a later batch. */
	batch: "page" | "cards"
	/** Cards actually returned, in display order, after missing catalog titles were removed. */
	titles: readonly { key: TitleKey; match: number | null }[]
}

/**
 * Records the first 30 cards of a member's page. Returns its id immediately; no client request and no awaited write.
 * Only deployed production servers schedule writes; guests never do. Serialization and Crate run on the next event-loop turn, after the loader returns.
 * A failed write (including a missing table before deployment) is logged and never fails the list request.
 */
export function recordListExposure(
	ctx: ViewerContext,
	input: ListExposureInput,
): string | null {
	// NODE_ENV alone is also production for a local `npm start`. SOURCE_COMMIT is supplied at runtime by
	// Coolify, not baked into the image or set by the local build. Reuse it without adding a release switch.
	if (
		process.env.NODE_ENV !== "production" ||
		!/^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? "") ||
		ctx.viewer.kind !== "member"
	)
		return null
	if (pending >= MAX_PENDING) {
		console.error("List exposure dropped: too many pending writes")
		return null
	}
	try {
		const listId = randomUUID()
		const titles = input.titles.slice(0, EXPOSURE_TITLES)
		const row = {
			user_id: ctx.viewer.userId,
			list_id: listId,
			created_at: new Date(),
			surface: input.surface,
			ordering: input.ordering,
			ordering_flags: { ...input.flags },
			sort: input.sort,
			sort_requested: input.sortRequested,
			for_you: input.forYou,
			for_you_applied: input.forYouApplied,
			filters: input.filters,
			country: ctx.country,
			services: [...ctx.services],
			taste_key_version: TASTE_KEY_VERSION,
			page: input.page,
			batch: input.batch,
			title_keys: titles.map((title) => title.key),
			positions: titles.map((_, i) => i + 1),
			taste_matches: titles.map((title) => title.match),
			// Preserve the historical column for queries across the rollout boundary.
			personal_order_flag_mode: "on",
			personal_order_fallback_reason:
				input.personalOrder?.fallbackReason ?? null,
			personal_order_payload_build_time:
				input.personalOrder?.payloadBuildTime ?? null,
			personal_order_model_hash: input.personalOrder?.modelHash ?? null,
			personal_order_snapshot_version:
				input.personalOrder?.snapshotVersion ?? null,
			personal_order_groups: titles.map(
				(t) => input.personalOrder?.titles.get(t.key)?.group ?? null,
			),
			personal_order_mix_placed: titles.map(
				(t) => input.personalOrder?.titles.get(t.key)?.mixPlaced ?? null,
			),
			watch_next_tiers: titles.map(
				(t) => input.watchNextTiers?.get(t.key) ?? null,
			),
			today_first_100: input.personalOrder?.todayFirst100 ?? null,
			personal_order_first_100: null,
		}
		pending++
		setImmediate(() => {
			void (async () => {
				try {
					await upsert({
						table: "user_list_exposure",
						data: [row],
						conflictColumns: ["user_id", "list_id"],
						ignoreUpdate: true,
					})
				} catch (error) {
					console.error("Recording list exposure failed:", listId, error)
				} finally {
					pending--
				}
			})()
		})
		return listId
	} catch (error) {
		console.error("Scheduling list exposure failed:", error)
		return null
	}
}
