import type { RestBudget } from "./rest-limit.server.ts"

// Existing REST fixtures exercise transport behavior without touching the application's cache.
export const unlimitedRestBudget: RestBudget = {
	take: async () => 0,
	pause: async () => {},
}
