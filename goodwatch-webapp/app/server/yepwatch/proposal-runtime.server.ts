import {
	REVISION_CHANNEL,
	paths,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import {
	configuredContinuousMembers,
	continuousGoodwatchCatalog,
} from "./continuous-runtime.server.ts"
import { crateSql, CrateRoomRepository } from "./repository.server.ts"
import type { ProposalRoom } from "./proposal-types.ts"
let handler: ReturnType<typeof createProposalHandler> | undefined
let repair: ReturnType<typeof setInterval> | undefined
export function stopProposalRepair() {
	if (repair) clearInterval(repair)
	repair = undefined
}
/** New explicit namespace/table/config. No DDL, issuer startup or OAuth registration. */
export async function proposalRuntimeHandler(request: Request) {
	if (!handler) {
		const {
			YEPWATCH_PROPOSAL_CRATEDB_ORIGIN: origin,
			YEPWATCH_PROPOSAL_CRATEDB_USERNAME: username,
			YEPWATCH_PROPOSAL_CRATEDB_PASSWORD: password,
			YEPWATCH_PROPOSAL_SECRET: secret,
			YEPWATCH_PROPOSAL_GATEWAY_SECRET: gatewaySecret,
			YEPWATCH_PROPOSAL_ALLOWED_ORIGINS: allowed,
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
						message: "YepWatch proposal runtime not configured",
						retryable: false,
					},
				},
				{ status: 503, headers: { "cache-control": "private, no-store" } }
			)
		const repository = new CrateRoomRepository<ProposalRoom>(
			crateSql(origin, username, password),
			secret,
			"doc.yepwatch_room_v3"
		)
		const origins = allowed.split(",").map((s) => s.trim())
		const callback = process.env.YEPWATCH_MEMBER_CALLBACK_URL
		if (
			process.env.AUTH_YEPWATCH_RESOURCE &&
			(!callback || new URL(callback).pathname !== paths.memberCallback)
		)
			throw new Error(
				"Proposal member callback requires explicit protocol3 allowlist configuration"
			)
		const members = configuredContinuousMembers(repository, origins)
		const service = new ProposalService(
			repository,
			proposalCatalog(continuousGoodwatchCatalog(members)),
			secret,
			async (event) => {
				const { getRedisCluster } = await import("../../utils/cache")
				const redis = getRedisCluster()
				if (!redis) throw new Error("Revision bus unavailable")
				await redis.publish(REVISION_CHANNEL, JSON.stringify(event))
			}
		)
		handler = createProposalHandler(service, {
			serviceSecret: gatewaySecret,
			allowedOrigins: origins,
			members,
		})
		let working = false
		repair = setInterval(() => {
			if (working) return
			working = true
			void service
				.repair()
				.catch(() => {})
				.finally(() => (working = false))
		}, 2000)
		repair.unref()
	}
	return handler(request)
}
