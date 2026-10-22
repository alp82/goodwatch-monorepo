/** Explicit isolated runner: never use retained services or production room writes. */
import { REVISION_CHANNEL } from "../../../packages/yepwatch-contracts/proposal.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts"
import {
	crateSql,
	CrateRoomRepository,
	installRoomTable,
} from "./repository.server.ts"
import { listenYepWatch } from "./node-http.server.ts"
import type { ProposalRoom, ProposalCatalog } from "./proposal-types.ts"
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === "1") process.loadEnvFile(".env")
const mode = process.env.YEPWATCH_LOCAL_CATALOG
if (mode !== "goodwatch" && process.env.YEPWATCH_LOCAL_FIXTURES !== "1")
	throw new Error("Select real catalog or explicit synthetic fixtures")
const secret = process.env.YEPWATCH_SECRET
const serviceSecret = process.env.YEPWATCH_GATEWAY_SECRET
if (!secret || !serviceSecret)
	throw new Error("Independent room and gateway secrets required")
let repository
if (process.env.YEPWATCH_CRATEDB_ORIGIN) {
	const origin = process.env.YEPWATCH_CRATEDB_ORIGIN
	if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
		throw new Error("Loopback room writes only")
	const sql = crateSql(origin, "crate", "")
	if (process.env.YEPWATCH_INSTALL_DISPOSABLE_TABLE === "1")
		await installRoomTable(sql, 0, "doc.yepwatch_room_v3")
	repository = new CrateRoomRepository<ProposalRoom>(
		sql,
		secret,
		"doc.yepwatch_room_v3"
	)
} else repository = new ProposalMemoryRepository()

const redisUrl = process.env.YEPWATCH_REVISION_REDIS_URL
const redis = redisUrl
	? new (await import("ioredis")).default(redisUrl, {
			maxRetriesPerRequest: 1,
			lazyConnect: true,
	  })
	: null
redis?.on("error", () => {})
const origins = (
	process.env.YEPWATCH_ALLOWED_ORIGINS ?? "http://127.0.0.1:8133"
).split(",")
// No issuer startup, fixture reseeding or client registration in this runner.
// Member integration can be injected in the production handler with an explicitly allowlisted v3 callback.
const catalog: ProposalCatalog =
	mode === "goodwatch"
		? (await import("./proposal-catalog.server.ts")).proposalCatalog(
				(
					await import("./continuous-runtime.server.ts")
				).continuousGoodwatchCatalog()
		  )
		: proposalFixtureCatalog
const service = new ProposalService(
	repository,
	catalog,
	secret,
	async (event) => {
		if (!redis) throw new Error("Bus absent")
		await redis.publish(REVISION_CHANNEL, JSON.stringify(event))
	}
)
const server = await listenYepWatch(
	createProposalHandler(service, {
		serviceSecret,
		allowedOrigins: origins,
		secureCookies: false,
	}),
	Number(process.env.YEPWATCH_LOCAL_PORT ?? 15992)
)
let working = false
const timer = setInterval(() => {
	if (working) return
	working = true
	void service
		.repair()
		.catch(() => {})
		.finally(() => {
			working = false
		})
}, 1000)
timer.unref()
console.log(
	`YepWatch PROPOSAL LOCAL API ${
		mode === "goodwatch" ? "REAL CATALOG" : "SYNTHETIC"
	} ${repository.constructor.name} port=${
		(server.address() as { port: number }).port
	}; channel=${REVISION_CHANNEL}`
)
for (const signal of ["SIGTERM", "SIGINT"] as const)
	process.once(signal, () => {
		clearInterval(timer)
		redis?.disconnect()
		server.close()
	})
