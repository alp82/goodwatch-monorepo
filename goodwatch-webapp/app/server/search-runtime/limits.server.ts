import { processRole } from "../role.server.ts"
import { availableParallelism } from "node:os"

type Env = Record<string, string | undefined>

export const SEARCH_MAX_IN_FLIGHT_DEFAULT = 4

// At production's 700 to 800 ms p50, four in flight is about five searches per second. The footprint measurement
// kept warm page p95 at 272 ms at that rate on four cores with two encoder threads. One person changing filters
// quickly can hold two or three slots for a moment.
export function searchInFlightLimit(env: Env = process.env): number {
	const value = Number(env.SEARCH_MAX_IN_FLIGHT)
	return Number.isSafeInteger(value) && value > 0
		? value
		: SEARCH_MAX_IN_FLIGHT_DEFAULT
}

// A search role: on four cores, one encoder with two threads held 10 ranked searches per second where four threads
// held 5, and a role never used more than three cores (docs/search-role.md has the link to the benchmark).
const SEARCH_ROLE_ENCODER_THREADS_DEFAULT = 2

// Otherwise half the cores, at most four. On four cores, two threads beat four for pages and search: warm page p95 fell from
// 1,520 ms to 272 ms at five searches per second, and four threads were no faster than two. At eight cores and above
// it stays at four, the value production ran with.
export function encoderThreads(
	env: Env = process.env,
	cores = availableParallelism(),
): number {
	const value = Number(env.SEARCH_ENCODER_THREADS)
	return Number.isInteger(value) && value >= 1 && value <= 64
		? value
		: processRole(env) === "search"
			? SEARCH_ROLE_ENCODER_THREADS_DEFAULT
			: Math.min(4, Math.max(1, Math.floor(cores / 2)))
}

// Without the storage key every search is a basic search, so the query models are never used.
export function readingsConfigured(env: Env = process.env): boolean {
	return /^[a-fA-F0-9]{64}$/.test(env.SEARCH_STORAGE_KEY ?? "")
}
