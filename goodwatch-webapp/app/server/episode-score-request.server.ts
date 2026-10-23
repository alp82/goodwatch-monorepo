// POST /api/episode-scores (#759): what a member's request to set, change or clear a season, episode or part score
// gets back. Kept apart from the route so it can be tested without Remix.
//   { id: <show id>, scope: "season", season, score }
//   { id, scope: "episode", episodeId, score }
//   { id, scope: "part", key, score }   (a part an import brought; parts aren't created by hand)
// score is 1 to 10, or null to clear. Answers { status, score, previous }, or { error } with 400, 401, 404 or 503.
import type { MemberEpisodeScore } from "../domain/episode-scores.ts"
import {
	isEpisodeScore,
	parseEpisodeScoreTarget,
} from "../domain/episode-scores.ts"
import {
	EpisodeScoreTargetError,
	EpisodeScoresUnavailable,
	type SetEpisodeScoreResult,
	isPartScoreKey,
	setEpisodeScore,
	setPartScore,
} from "./episode-scores.server.ts"

export interface EpisodeScoreAnswer {
	status: number
	body: Partial<SetEpisodeScoreResult> & {
		error?: string
		score?: MemberEpisodeScore | null
	}
}

const fail = (status: number, error: string): EpisodeScoreAnswer => ({
	status,
	body: { error },
})

export async function answerEpisodeScoreRequest(
	userId: string | null | undefined,
	body: unknown,
): Promise<EpisodeScoreAnswer> {
	if (!userId) return fail(401, "Sign in to score seasons and episodes")
	const request =
		body && typeof body === "object" ? (body as Record<string, unknown>) : {}
	const id = request.id
	const score = request.score
	if (
		typeof id !== "number" ||
		!Number.isSafeInteger(id) ||
		id < 1 ||
		!(score === null || isEpisodeScore(score))
	)
		return fail(400, "Send { id, scope, season or episodeId or key, score }")
	try {
		if (request.scope === "part") {
			if (!isPartScoreKey(request.key)) return fail(400, "Send the part's key")
			return {
				status: 200,
				body: await setPartScore(userId, id, request.key, score),
			}
		}
		const target = parseEpisodeScoreTarget(request)
		if (!target)
			return fail(400, "Send { id, scope, season or episodeId or key, score }")
		return {
			status: 200,
			body: await setEpisodeScore(userId, id, target, score),
		}
	} catch (error) {
		if (error instanceof EpisodeScoreTargetError)
			return fail(404, error.message)
		if (error instanceof EpisodeScoresUnavailable)
			return fail(503, error.message)
		throw error
	}
}
