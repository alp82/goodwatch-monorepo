// Which looping pixel effect hovers over an island, by its grouping and name.

import type { EffectIsland } from "./types"

export interface Ambient {
	/** pixelfx effect id. */
	id: string
	opts?: Record<string, unknown>
	/** What it shows, for reading the table. */
	label?: string
}

const CANDY = ["#3a1a5a", "#7a3cc8", "#ff6ab4", "#ffd24a", "#ffffff"]
const ERA: Record<string, string[]> = {
	"1970s": ["#3a1606", "#8a3a0c", "#e07a1c", "#ffc860", "#fff2d0"],
	"1980s": ["#2a0636", "#8a1a8a", "#ff3cc8", "#3cf0ff", "#ffffff"],
	"1990s": ["#062a2a", "#106a6a", "#2ad0b0", "#c8a0ff", "#ffffff"],
	"2000s": ["#0e1630", "#2a4a8a", "#6aa0e8", "#c8dcff", "#ffffff"],
	"2010s": ["#1a0e30", "#4a2a8a", "#9a6cff", "#ffc0f0", "#ffffff"],
}

/** By "group:name" first (lowercased), then by name alone. */
const BY_KEY: Record<string, Ambient> = {
	// moods
	"mood:funny": { id: "cinema/amb-confetti", label: "confetti" },
	"mood:cozy": { id: "cinema/amb-fireflies", label: "fireflies" },
	"mood:romantic": { id: "cinema/amb-hearts", label: "floating hearts" },
	"mood:thrilling": { id: "cinema/amb-embers", label: "rising embers" },
	"mood:tense": { id: "cinema/amb-lightning", label: "lightning flicker" },
	"mood:scary": { id: "cinema/amb-bats", label: "bats" },
	"mood:sad": { id: "cinema/amb-rain", label: "a little rain cloud" },
	"mood:dark": { id: "cinema/amb-wisps", label: "shadow wisps" },
	"mood:trippy": { id: "cinema/amb-neon", label: "neon rainbow squiggles" },
	"mood:deep": { id: "cinema/amb-bubbles", label: "thought bubbles" },
	"mood:magical": { id: "cinema/amb-arcane", label: "arcane sparkles" },
	"mood:quirky": { id: "cinema/amb-swirl", label: "curls and zigzags" },
	// themes
	// a soft red/blue wash alternating left and right, like patrol lights in a film
	"theme:crime": { id: "cinema/amb-policewash", label: "patrol light wash" },
	"theme:mystery": { id: "cinema/amb-question", label: "question marks" },
	"theme:war": { id: "cinema/amb-embers", label: "embers" },
	"theme:true stories": { id: "cinema/amb-grain", label: "old film grain" },
	"theme:history": { id: "cinema/amb-grain", label: "old film grain" },
	"theme:growing up": { id: "cinema/amb-petals", label: "spring petals" },
	"theme:family": { id: "cinema/amb-fireflies", label: "fireflies" },
	"theme:the mind": { id: "cinema/amb-bubbles", label: "thought bubbles" },
	"theme:showbiz": {
		id: "cinema/amb-spotlight",
		label: "premiere searchlights",
	},
	"theme:sports": { id: "cinema/amb-confetti", label: "confetti" },
	"theme:money": { id: "cinema/amb-coins", label: "banknotes and coins" },
	"theme:future": { id: "cinema/amb-glints", label: "sci-fi blips" },
	"theme:fantasy": { id: "cinema/amb-arcane", label: "arcane sparkles" },
	"theme:politics": { id: "cinema/amb-flashbulbs", label: "press flashbulbs" },
	// styles
	"style:animated": {
		id: "cinema/amb-bubbles",
		opts: { palette: CANDY },
		label: "candy bubbles",
	},
	"style:spectacle": { id: "cinema/amb-spotlight", label: "searchlights" },
	"style:stylized": { id: "cinema/amb-neon", label: "neon squiggles" },
	"style:music": { id: "cinema/amb-notes", label: "music notes" },
	"style:slow burn": { id: "cinema/amb-embers", label: "embers" },
	"style:fast-paced": {
		id: "cinema/amb-lightning",
		label: "lightning flicker",
	},
	"style:nonlinear": { id: "cinema/amb-swirl", label: "curls" },
	"style:graphic": { id: "cinema/amb-wisps", label: "shadow wisps" },
	"style:documentary": { id: "cinema/amb-grain", label: "film grain" },
	"style:talky": { id: "cinema/amb-speech", label: "speech bubbles typing" },
	// occasions
	"occasion:family": { id: "cinema/amb-fireflies", label: "fireflies" },
	"occasion:party": { id: "cinema/amb-confetti", label: "confetti" },
	"occasion:kids": {
		id: "cinema/amb-bubbles",
		opts: { palette: CANDY },
		label: "candy bubbles",
	},
	"occasion:comfort": { id: "cinema/amb-snow", label: "soft snow" },
	"occasion:background": { id: "cinema/amb-snow", label: "soft snow" },
	"occasion:easy watch": { id: "cinema/amb-petals", label: "petals" },
	"occasion:binge": {
		id: "cinema/amb-episodes",
		label: "next episode, autoplay",
	},
	// decades
	"decade:before 1970": { id: "cinema/amb-grain", label: "old film grain" },
	"decade:1970s": {
		id: "cinema/amb-disco",
		opts: { palette: ERA["1970s"] },
		label: "disco flecks, amber",
	},
	"decade:1980s": {
		id: "cinema/amb-disco",
		opts: { palette: ERA["1980s"] },
		label: "disco flecks, neon",
	},
	"decade:1990s": {
		id: "cinema/amb-disco",
		opts: { palette: ERA["1990s"] },
		label: "disco flecks, teal",
	},
	"decade:2000s": {
		id: "cinema/amb-disco",
		opts: { palette: ERA["2000s"] },
		label: "disco flecks, chrome",
	},
	"decade:2010s": {
		id: "cinema/amb-disco",
		opts: { palette: ERA["2010s"] },
		label: "disco flecks, violet",
	},
	"decade:2020s": { id: "cinema/amb-glints", label: "sci-fi blips" },
	// countries
	"country:japan": { id: "cinema/amb-petals", label: "cherry petals" },
	"country:south korea": { id: "cinema/amb-petals", label: "petals" },
	"country:united kingdom": { id: "cinema/amb-rain", label: "drizzle" },
	"country:united states": {
		id: "cinema/amb-fireworks",
		label: "red, white and blue fireworks",
	},
	"country:canada": {
		id: "cinema/amb-leaves",
		label: "tumbling autumn leaves",
	},
	"country:india": {
		id: "cinema/amb-diyas",
		label: "floating lamps and marigold petals",
	},
	"country:france": { id: "cinema/amb-fizz", label: "champagne fizz" },
	"country:germany": { id: "cinema/amb-gears", label: "brass clockwork gears" },
	"country:australia": { id: "cinema/amb-surf", label: "curling surf" },
	"country:spain": { id: "cinema/amb-sun", label: "a warm turning sun" },
	"country:türkiye": { id: "cinema/amb-lanterns", label: "mosaic lanterns" },
	"country:italy": { id: "cinema/amb-beam", label: "an old projector beam" },
	"country:belgium": { id: "cinema/amb-pop", label: "comic-book pops" },
	"country:rest of world": {
		id: "cinema/amb-planes",
		label: "paper planes looping",
	},
}

/** The ambient effect for an island; a gentle twinkle in its own color when nothing fits. */
export function ambientFor(
	island: Pick<EffectIsland, "name" | "group" | "color">,
): Ambient {
	const name = island.name.trim().toLowerCase()
	const hit =
		BY_KEY[`${(island.group ?? "").toLowerCase()}:${name}`] ??
		Object.entries(BY_KEY).find(([k]) => k.endsWith(`:${name}`))?.[1]
	if (hit) return hit
	return {
		id: "cinema/amb-twinkle",
		opts: { palette: twinkleRamp(island.color) },
		label: "twinkle in its color",
	}
}

function twinkleRamp(hex: string): string[] {
	const n = Number.parseInt(
		(hex || "#9ab").replace("#", "").padEnd(6, "0").slice(0, 6),
		16,
	)
	const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
	const at = (k: number) =>
		`#${c
			.map((v) =>
				Math.round(k < 0.5 ? v * (k * 2) : v + (255 - v) * ((k - 0.5) * 2))
					.toString(16)
					.padStart(2, "0"),
			)
			.join("")}`
	return [at(0.15), at(0.35), at(0.55), at(0.78), at(0.97)]
}
