import { RoomError } from "./errors.ts"
import { blendPrivateRanks } from "./continuous-member-ranking.ts"
import { REVISION_CHANNEL } from "../../../packages/yepwatch-contracts/continuous.ts"
import { yepwatchOAuthEnvironment } from "../auth/yepwatch-oauth-policy.ts"
import { createContinuousHandler } from "./continuous-http.server.ts"
import { ContinuousService } from "./continuous-service.server.ts"
import { ContinuousMembers } from "./continuous-members.server.ts"
import { centralMemberIssuer } from "./continuous-member-issuer.server.ts"
import {
	goodwatchMemberPrefill,
	goodwatchSavedProgress,
} from "./continuous-member-reads.server.ts"
import { sharedSavedContinuations } from "./continuous-saved-progress.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { goodwatchReads, goodwatchCatalog } from "./goodwatch.server.ts"
import { enrichContinuousCandidates } from "./continuous-presentation.server.ts"
import { crateSql, CrateRoomRepository } from "./repository.server.ts"
import type {
	ContinuousRoom,
	ContinuousRepository,
	ContinuousCatalog,
} from "./continuous-types.ts"
export function configuredContinuousMembers(
	repository: ContinuousRepository,
	origins: string[],
): ContinuousMembers | undefined {
	const config = yepwatchOAuthEnvironment(process.env)
	if (!config) return
	const issuerOrigin = process.env.BETTER_AUTH_URL
		? new URL(process.env.BETTER_AUTH_URL).origin
		: undefined
	const callbackUrl = process.env.YEPWATCH_MEMBER_CALLBACK_URL
	if (
		!issuerOrigin ||
		!callbackUrl ||
		!config.redirectUris.includes(callbackUrl)
	)
		throw new Error(
			"YepWatch member callback/central issuer must be explicitly configured",
		)
	return new ContinuousMembers(
		repository,
		centralMemberIssuer({ ...config, issuerOrigin }),
		{ prefill: goodwatchMemberPrefill, progress: goodwatchSavedProgress },
		{
			callbackUrl,
			browserOrigins: origins,
			nativeReturnUri: "yepwatch://auth/callback",
		},
	)
}
export function continuousGoodwatchCatalog(
	members?: ContinuousMembers,
): ContinuousCatalog {
	const base = createContinuousCatalog(
		goodwatchReads,
		goodwatchCatalog.metadata,
		{
			rank: async (room, keys) => {
				if (!members) return keys
				const lists: number[][] = []
				for (const p of room.participants) {
					if (!p.memberGrant) continue
					let userId: string
					try {
						userId = await members.identity(room, p.id)
					} catch {
						continue
					}
					const [
						{ getMemberViewerContext },
						{ loadTaste },
						{ filterTitles },
						{ defaultFilterState },
					] = await Promise.all([
						import("../viewer.server"),
						import("../taste/index.server"),
						import("../title-filter/index.server"),
						import("../../domain/filter-state"),
					])
					const screen = room.screens.find((s) => s.id === p.screenId)
					const viewer = await getMemberViewerContext(
						userId,
						screen?.country ?? "US",
					)
					const taste = await loadTaste(viewer.viewer)
					const state = defaultFilterState({
						onMyServices: false,
						notSeenYet: true,
					})
					const filtered = await filterTitles({
						universe: keys,
						state,
						sort: "popular",
						forYou: viewer.forYou ? "browse" : null,
						taste,
						viewer: {
							...viewer,
							country: screen?.country ?? viewer.country,
							services: screen?.serviceIds ?? [],
						},
					})
					lists.push(filtered.keys)
				}
				return blendPrivateRanks(keys, lists)
			},
			savedContinuations: async (room) => {
				if (!members)
					throw new RoomError(
						"member_required",
						"GoodWatch saved progress reader not configured",
						403,
					)
				const own = await Promise.all(
					room.participants.map((p) => members.progress(room, p.id)),
				)
				return sharedSavedContinuations(own)
			},
		},
	)
	return {
		...base,
		page: async (room) => {
			const page = await base.page(room)
			return {
				...page,
				candidates: await enrichContinuousCandidates(
					page.candidates,
					room.screens.find((s) =>
						room.participants.some((p) => p.screenId === s.id),
					)?.country ?? "US",
				),
			}
		},
	}
}
let handler: ReturnType<typeof createContinuousHandler> | undefined
let repair: ReturnType<typeof setInterval> | undefined
export function stopContinuousRepair() {
	if (repair) clearInterval(repair)
	repair = undefined
}
export async function continuousRuntimeHandler(request: Request) {
	if (!handler) {
		const {
			YEPWATCH_CONTINUOUS_CRATEDB_ORIGIN: origin,
			YEPWATCH_CONTINUOUS_CRATEDB_USERNAME: username,
			YEPWATCH_CONTINUOUS_CRATEDB_PASSWORD: password,
			YEPWATCH_CONTINUOUS_SECRET: secret,
			YEPWATCH_CONTINUOUS_GATEWAY_SECRET: gatewaySecret,
			YEPWATCH_CONTINUOUS_ALLOWED_ORIGINS: allowed,
		} = process.env
		if (
			!origin ||
			!username ||
			password === undefined ||
			!secret ||
			!gatewaySecret ||
			!allowed
		)
			return Response.json(
				{
					error: {
						code: "busy",
						message: "Continuous YepWatch runtime not configured",
						retryable: false,
					},
				},
				{ status: 503, headers: { "cache-control": "private, no-store" } },
			)
		const repository = new CrateRoomRepository<ContinuousRoom>(
			crateSql(origin, username, password),
			secret,
			"doc.yepwatch_room_v2",
		)
		const origins = allowed.split(",").map((s) => s.trim())
		const members = configuredContinuousMembers(repository, origins)
		const service = new ContinuousService(
			repository,
			continuousGoodwatchCatalog(members),
			secret,
			async (event) => {
				const { getRedisCluster } = await import("../../utils/cache")
				const redis = getRedisCluster()
				if (!redis) throw new Error("Revision bus unavailable")
				await redis.publish(REVISION_CHANNEL, JSON.stringify(event))
			},
		)
		handler = createContinuousHandler(service, {
			serviceSecret: gatewaySecret,
			allowedOrigins: origins,
			members,
		})
		let running = false
		repair = setInterval(() => {
			if (running) return
			running = true
			void service
				.repair()
				.catch(() => {})
				.finally(() => {
					running = false
				})
		}, 2000)
		repair.unref()
	}
	return handler(request)
}
