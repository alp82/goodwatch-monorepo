import type {
	MemberProgressResponse,
	MemberPrefill,
} from "../../../packages/yepwatch-contracts/continuous.ts"
import { savedShowIds } from "./continuous-saved-progress.ts"
/** Read-only account adapters. Account id comes from live central grant verification, never request JSON. */
export async function goodwatchMemberPrefill(
	userId: string,
): Promise<MemberPrefill> {
	const { getMemberViewerContext } = await import("../viewer.server")
	const viewer = await getMemberViewerContext(userId, "US")
	return {
		country: viewer.country,
		serviceIds: [...viewer.services],
		savedProgressAvailable: true,
	}
}
export async function goodwatchSavedProgress(
	userId: string,
): Promise<MemberProgressResponse> {
	const [{ getWatchState }, { getShowTrackingPage }, { viewOf }, { utcDay }] =
		await Promise.all([
			import("../tracking.server"),
			import("../show-tracking.server"),
			import("../../domain/tracking/show-page"),
			import("../../domain/tracking/machine"),
		])
	const states = await getWatchState(userId)
	const keys = savedShowIds(states)
	const shows: MemberProgressResponse["shows"] = []
	for (const showId of keys.slice(0, 30)) {
		const page = await getShowTrackingPage(userId, showId, async () => null)
		const view = viewOf({ state: page.state, log: page.log }, page.episodes, {
			today: utcDay(Date.now()),
			running: page.running,
			score: null,
		})
		const next = view.derived.next
		const presented = next ? page.episodes.find((e) => e.id === next.id) : null
		shows.push({
			showId,
			nextEpisode: next
				? {
						tmdbId: next.id,
						season: next.season,
						number: next.number,
						...(presented && "displaySeason" in presented
							? {
									displaySeason: Number(presented.displaySeason),
									displayNumber: Number(presented.displayNumber),
									presentationVersion: page.presentation?.version,
								}
							: {}),
					}
				: null,
		})
	}
	return { source: "goodwatch", shows, limitReached: keys.length > 30 }
}

/** Public display name only; the caller has already verified this account's live grant. */
export async function goodwatchMemberDisplayName(userId: string): Promise<string | null> {
	const { getBetterAuth } = await import("../auth/runtime.server.ts")
	const context = await (await getBetterAuth()).$context
	const user = await context.adapter.findOne<{ name?: string | null }>({
		model: "user",
		where: [{ field: "id", value: userId }],
	})
	return user?.name?.trim() || null
}
