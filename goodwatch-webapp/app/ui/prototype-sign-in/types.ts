// PROTOTYPE - throwaway. Shared types and helpers for the /sign-in redesign variants.
import { seededRandomSin } from "~/utils/random"

export type SignInTitle = {
	key: string
	type: "movie" | "show"
	title: string
	year: number
	poster: string
	backdrop: string
	score: number
}

export type VariantProps = { titles: SignInTitle[]; form: React.ReactNode }

/** Deterministic shuffle so server and client render the same order. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
	const out = [...items]
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(seededRandomSin(seed + i * 7.31) * (i + 1))
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

/** Repeats the list until it has at least n entries. */
export function fill<T>(items: T[], n: number): T[] {
	if (!items.length) return []
	const out: T[] = []
	while (out.length < n) out.push(...items)
	return out.slice(0, n)
}
