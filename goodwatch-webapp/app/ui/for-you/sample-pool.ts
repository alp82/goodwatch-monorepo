// A deterministic synthetic For you page for the development page (dev.for-you-page.tsx): about 900 made-up titles
// with gray posters, a made-up taste with three taste groups, and details answered from the same data. No network.
import {
	FP_KEYS,
	type ForYouDetail,
	type ForYouGuest,
	type ForYouPage,
	type ForYouPool,
	type ForYouTaste,
	type Tier,
	encodeFingerprints,
	familyOf,
} from "~/domain/for-you-page/contract"
import { MOOD_KEYS } from "~/domain/moods"
import { STYLE_KEYS, THEME_KEYS } from "~/domain/themes-styles"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { seededRandomMixed } from "~/utils/random"

const SIZE = 900
const CLUSTERS = 8

const rand = (...parts: (string | number)[]) =>
	seededRandomMixed(`for-you-sample:${parts.join(":")}`)
const pick = <T>(xs: readonly T[], ...parts: (string | number)[]) =>
	xs[Math.floor(rand(...parts) * xs.length)]

const FIRST = [
	"The Quiet",
	"Midnight",
	"Silver",
	"Last",
	"Northern",
	"Paper",
	"Hollow",
	"Golden",
	"Broken",
	"Electric",
	"Little",
	"Burning",
	"Distant",
	"Velvet",
	"Wild",
	"Glass",
]
const SECOND = [
	"Harbor",
	"Kingdom",
	"Summer",
	"Signal",
	"Orchard",
	"Machine",
	"Letters",
	"Season",
	"Horizon",
	"Comedy",
	"Garden",
	"Witness",
	"Frontier",
	"Hotel",
	"Island",
	"Engine",
	"Choir",
]

const GROUPS: ForYouTaste["groups"] = [
	{
		id: "side-1",
		name: "Warm, hopeful stories",
		keys: ["wholesome", "hopefulness", "character_depth", "family_dynamics"],
		count: 42,
	},
	{
		id: "side-2",
		name: "Dark, twisty crime",
		keys: ["crime", "mystery", "tension", "dark_humor"],
		count: 31,
	},
	{
		id: "side-3",
		name: "Big strange worlds",
		keys: ["fantasy", "world_immersion", "surrealism", "spectacle"],
		count: 24,
	},
]

const SERVICES = [
	{ id: 8, name: "Netflix", logo_path: "" },
	{ id: 337, name: "Disney Plus", logo_path: "" },
	{ id: 9, name: "Amazon Prime Video", logo_path: "" },
	{ id: 350, name: "Apple TV Plus", logo_path: "" },
	{ id: 1899, name: "Max", logo_path: "" },
	{ id: 531, name: "Paramount Plus", logo_path: "" },
	{ id: 283, name: "Crunchyroll", logo_path: "" },
]

const LOVED = 14

function makePool(): ForYouPool {
	// Each cluster leans on its own handful of attributes, so recipes find titles that fit them.
	const centers = Array.from({ length: CLUSTERS }, (_, c) =>
		FP_KEYS.map((_, k) => 1 + 6 * rand("center", c, k) ** 2),
	)
	const keys: string[] = []
	const names: string[] = []
	const years: (number | null)[] = []
	const scores: number[] = []
	const steps: number[] = []
	const moods: number[] = []
	const themes: number[] = []
	const styles: number[] = []
	const rows: number[][] = []
	for (let i = 0; i < SIZE; i++) {
		const show = rand("kind", i) < 0.3
		keys.push(`${show ? "show" : "movie"}-${1000 + i}`)
		names.push(`${pick(FIRST, "a", i)} ${pick(SECOND, "b", i)}`)
		years.push(1965 + Math.floor(rand("year", i) * 60))
		scores.push(58 + Math.floor(rand("score", i) * 38))
		steps.push(50 + Math.floor(rand("step", i) * 50))
		const a = Math.floor(rand("c1", i) * CLUSTERS)
		const b = Math.floor(rand("c2", i) * CLUSTERS)
		rows.push(
			FP_KEYS.map((_, k) => {
				if (rand("miss", i, k) < 0.02) return 255
				const base = 0.65 * centers[a][k] + 0.35 * centers[b][k]
				const v = base + (rand("noise", i, k) - 0.5) * 4
				return Math.max(0, Math.min(10, Math.round(v)))
			}),
		)
		const bits = (n: number, name: string, p: number) => {
			let m = 0
			for (let j = 0; j < n; j++) if (rand(name, i, j) < p) m |= 1 << j
			return m
		}
		moods.push(bits(MOOD_KEYS.length, "mood", 0.18))
		themes.push(bits(THEME_KEYS.length, "theme", 0.12))
		styles.push(bits(STYLE_KEYS.length, "style", 0.12))
	}
	return {
		keys,
		names,
		years,
		posters: keys.map(() => ""),
		scores,
		steps,
		moods,
		themes,
		styles,
		fingerprints: encodeFingerprints(rows),
		scope: "everywhere",
	}
}

function makeTaste(): ForYouTaste {
	const loved: ForYouTaste["loved"] = {}
	const lovedKeys: string[] = []
	for (let j = 0; j < LOVED; j++) {
		const key = `movie-${9000 + j}`
		lovedKeys.push(key)
		loved[key] = {
			title: `${pick(FIRST, "la", j)} ${pick(SECOND, "lb", j)}`,
			year: 1980 + Math.floor(rand("ly", j) * 45),
			poster: null,
			score: 8 + Math.floor(rand("ls", j) * 3),
		}
	}
	const grouped = new Set(GROUPS.flatMap((g) => g.keys))
	const attributes = FP_KEYS.map((key) => {
		const lean = grouped.has(key) ? 0.9 : 0
		const edge =
			Math.round((lean + (rand("edge", key) - 0.45) * 2.6) * 100) / 100
		const tier = Math.max(-3, Math.min(3, Math.round(edge * 1.5))) as Tier
		const carriers = lovedKeys.filter((_, j) => rand("carry", key, j) < 0.2)
		return {
			key,
			label: getFingerprintMeta(key).label,
			family: familyOf(key) ?? "feel",
			edge,
			tier,
			carriers,
		}
	})
	return { subject: "member", attributes, groups: GROUPS, loved }
}

let sample: { pool: ForYouPool; taste: ForYouTaste } | null = null
const sampleData = () => {
	sample ??= { pool: makePool(), taste: makeTaste() }
	return sample
}

/** The page data for a sample member: "ready" with the sample pool, or one of the other states. */
export function samplePage(
	as: "ready" | "guest" | "empty" | "unavailable" = "ready",
): ForYouPage {
	if (as === "guest") return { kind: "guest" }
	if (as === "empty" || as === "unavailable")
		return { kind: "member", status: as }
	const { pool, taste } = sampleData()
	return { kind: "member", status: "ready", pool, taste }
}

const OVERVIEW =
	"A made-up title from the sample pool. Someone leaves home, something goes wrong on the way, and the people they meet change how the story ends. Long enough to fill the story section and clamp."

/** Details for sample keys, after a short wait so the loading state shows. */
export async function sampleDetails(
	keys: string[],
	signal?: AbortSignal,
): Promise<Record<string, ForYouDetail>> {
	await new Promise((r) => setTimeout(r, 350))
	signal?.throwIfAborted()
	const { pool } = sampleData()
	const out: Record<string, ForYouDetail> = {}
	for (const key of keys) {
		const i = pool.keys.indexOf(key)
		if (i < 0) continue
		const movie = key.startsWith("movie-")
		const count = Math.floor(rand("svc", key) * 7)
		out[key] = {
			title: pool.names[i],
			poster: null,
			backdrop: null,
			runtime: movie ? 82 + Math.floor(rand("rt", key) * 80) : 45,
			tagline: null,
			overview: rand("ov", key) < 0.9 ? OVERVIEW : null,
			services: SERVICES.filter((_, j) => j < count),
		}
	}
	return out
}

/**
 * A guest's preview on the sample: the sample taste (an example below the quiz goal, the guest's own from it on),
 * gray posters, and `ratings` guest scores. No network.
 */
export async function sampleGuest(ratings: number): Promise<ForYouGuest> {
	await new Promise((r) => setTimeout(r, 250))
	const { taste } = sampleData()
	return {
		taste: { ...taste, subject: ratings >= 5 ? "guest" : "sample" },
		posters: Array.from({ length: 12 }, () => ""),
		guestRatings: ratings,
	}
}
