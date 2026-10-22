/** Explicit SELECT-only catalog smoke, private memory room; no production room writes. */
import { randomBytes } from "node:crypto"
import { ContinuousService } from "./continuous-service.server.ts"
import { ContinuousMemoryRepository } from "./continuous-test-support.ts"
if (process.env.YEPWATCH_CONTINUOUS_REAL_SMOKE !== "1")
	throw new Error("Explicit real read smoke required")
if (process.env.YEPWATCH_LOAD_LOCAL_ENV === "1") process.loadEnvFile(".env")
const { goodwatchReads, goodwatchCatalog } = await import(
	"./goodwatch.server.ts"
)
const { createContinuousCatalog } = await import("./continuous-catalog.ts")
const { enrichContinuousCandidates } = await import(
	"./continuous-presentation.server.ts"
)
const base = createContinuousCatalog(goodwatchReads, goodwatchCatalog.metadata)
const service = new ContinuousService(
	new ContinuousMemoryRepository(),
	base,
	"real-catalog-memory-smoke-secret-at-least-32",
)
const a = await service.create({
	contractVersion: 2,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname: "Local real read smoke",
})
const id = a.credential.roomId
const credential = {
	participantId: a.credential.participantId,
	token: a.credential.token,
}
await service.command(id, credential, {
	commandId: "configure_real",
	sequence: 1,
	command: {
		type: "setup",
		expectedContextVersion: 1,
		screens: [
			{
				id: "tv",
				label: "TV",
				country: "DE",
				serviceIds: [8],
				confirmed: true,
			},
		],
		constraints: {
			kinds: ["movie", "show_start"],
			maxMinutes: null,
			moods: [],
		},
		screenId: "tv",
	},
})
const s = await service.read(id, credential)
const started = await service.command(id, credential, {
	commandId: "start_real",
	sequence: 2,
	command: {
		type: "start",
		expectedRosterVersion: s.shared.rosterVersion,
		expectedContextVersion: s.shared.contextVersion,
		hostReady: true,
	},
})
const candidates = await enrichContinuousCandidates(
	started.snapshot.shared.candidates,
	"DE",
)
console.log(
	JSON.stringify({
		check: "continuous_real_catalog",
		country: "DE",
		services: [8],
		kinds: ["movie", "show_start"],
		candidates: candidates.map((c) => ({
			id: c.id,
			title: c.title,
			kind: c.identity.kind,
			backdrop: !!c.backdropUrl,
			trailer: !!c.trailerUrl,
			genres: c.genres?.length ?? null,
			score: c.goodwatchScore ?? null,
			scope: c.availability[0]?.scope,
		})),
	}),
)
process.exit(0)
