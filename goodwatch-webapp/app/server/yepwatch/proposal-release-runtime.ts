import { releaseMembers } from "./proposal-release-members.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { ReleaseControl } from "./proposal-release-control.ts"
import {
	API_PREFIX,
	REVISION_CHANNEL,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import { CrateRoomRepository, type Sql } from "./repository.server.ts"
import { checkReleaseStore } from "./proposal-release-store.ts"
import type { ProposalCatalog, ProposalRoom } from "./proposal-types.ts"
import type { ReleaseConfig } from "./proposal-release-config.ts"
export const RELEASE_HEALTH = {
	live: `${API_PREFIX}/health/live`,
	ready: `${API_PREFIX}/health/ready`,
}
export interface ReleaseDependencies {
	sql: Sql
	catalog: ProposalCatalog
	memberCatalog?: (members: ContinuousMembers) => ProposalCatalog
	snapshot(): { count: number; version: string } | null
	catalogProbe(): Promise<void>
	bus: {
		ping(): Promise<unknown>
		publish(channel: string, value: string): Promise<unknown>
	}
	now?: () => number
}
/** No guest identities, fixtures, DDL or fail-open readiness. Normal handler behavior stays in its existing module. */
export function createReleaseRuntime(
	config: ReleaseConfig,
	deps: ReleaseDependencies
) {
	const now = deps.now ?? Date.now
	const repository = new CrateRoomRepository<ProposalRoom>(
		deps.sql,
		config.secret,
		"doc.yepwatch_room",
		true
	)
	const members = config.member ? releaseMembers(repository, config.member) : undefined
	if (members && !deps.memberCatalog) throw new Error("Member catalog adapter required")
	const control = new ReleaseControl(deps.sql, config.control)
	const service = new ProposalService(
		repository,
		members ? deps.memberCatalog!(members) : deps.catalog,
		config.secret,
		async (event) => {
			await deps.bus.publish(REVISION_CHANNEL, JSON.stringify(event))
		},
		Date.now,
		control
	)
	const handle = createProposalHandler(service, {
		serviceSecret: config.gatewaySecret,
		allowedOrigins: [config.publicOrigin],
		secureCookies: true,
		members,
	})
	let draining = false
	let initialized = false
	let checkedAt: number | null = null
	let probing: Promise<void> | undefined
	const checks = {
		snapshot: false,
		catalog: false,
		rooms: false,
		control: false,
		realtime: false,
	}
	async function probe() {
		if (probing) return probing
		probing = (async () => {
			const results = await Promise.allSettled([
				Promise.resolve().then(() => {
					if (!deps.snapshot()?.count) throw new Error("Snapshot not loaded")
				}),
				deps.catalogProbe(),
				checkReleaseStore(deps.sql, config.keyId, config.secret),
				control.check(),
				deps.bus.ping(),
			])
			for (const [i, key] of (
				Object.keys(checks) as (keyof typeof checks)[]
			).entries())
				checks[key] = results[i].status === "fulfilled"
			checkedAt = now()
			if (Object.values(checks).every(Boolean) && !!deps.snapshot()?.count)
				initialized = true
		})().finally(() => {
			probing = undefined
		})
		return probing
	}
	function readiness() {
		const recent =
			checkedAt !== null &&
			now() - checkedAt <= Math.max(15000, config.probeMs * 3)
		const loaded = !!deps.snapshot()?.count
		return {
			ready:
				!draining && recent && loaded && Object.values(checks).every(Boolean),
			status: draining ? "draining" : "running",
			checks: { ...checks, snapshot: loaded },
			sourceCommit: config.sourceCommit,
			contractVersion: 3,
			mode: members ? "member" : "guest",
		}
	}
	async function handler(request: Request) {
		const path = new URL(request.url).pathname
		if (path === RELEASE_HEALTH.live && request.method === "GET")
			return Response.json(
				{ status: "live", sourceCommit: config.sourceCommit },
				{ headers: { "cache-control": "no-store" } }
			)
		if (path === RELEASE_HEALTH.ready && request.method === "GET") {
			const state = readiness()
			return Response.json(state, {
				status: state.ready ? 200 : 503,
				headers: { "cache-control": "no-store" },
			})
		}
		// Keep setup/commands truthful while unavailable: do not admit rooms before any startup preflight succeeded.
		if (!initialized)
			return Response.json(
				{
					error: {
						code: "busy",
						message: "YepWatch is starting; retry shortly",
						retryable: true,
					},
				},
				{ status: 503, headers: { "cache-control": "no-store" } }
			)
		return handle(request)
	}
	const timer = setInterval(() => void probe(), config.probeMs)
	timer.unref()
	let repairing = false
	const repair = setInterval(() => {
		if (repairing || draining || !readiness().ready) return
		repairing = true
		void service
			.repair()
			.catch(() => {})
			.finally(() => {
				repairing = false
			})
	}, 2000)
	repair.unref()
	return {
		handler,
		service,
		probe,
		readiness,
		drain() {
			draining = true
		},
		stop() {
			clearInterval(timer)
			clearInterval(repair)
		},
	}
}
