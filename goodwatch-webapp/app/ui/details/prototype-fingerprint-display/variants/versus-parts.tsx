// PROTOTYPE - throwaway.
// Shared bits for the versus, mixer, barcode and recipe variants: scales copied from Sliders, words, nouns, area lookup.
import { Link } from "@remix-run/react"
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import { goodFor } from "./strip-parts"

export type Scores = F.TitleInput["fingerprint"]["scores"]
export type Key = keyof Scores

export const clamp = (v: number) => Math.min(1, Math.max(0, v))
const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}

// --- Two-ended scales (copied from Sliders.tsx) ---

export interface Scale {
	name: string
	area: Pillar
	left: string
	right: string
	words: [string, string, string, string, string]
	value: (s: Scores) => number
	// The traits behind the reading, for a tap-to-see view.
	keys: Key[]
}

export const SCALES: Scale[] = [
	{
		name: "Pace",
		area: "Energy",
		left: "Slow burn",
		right: "Fast",
		words: ["Very slow", "Slow burn", "Steady", "Fast", "Breakneck"],
		value: (s) => clamp((s.fast_pace - s.slow_burn) / 16 + 0.5),
		keys: ["fast_pace", "slow_burn"],
	},
	{
		name: "Tone",
		area: "Heart",
		left: "Bleak",
		right: "Hopeful",
		words: ["Bleak", "Mostly dark", "Mixed", "Mostly hopeful", "Uplifting"],
		value: (s) => clamp((s.hopefulness - s.bleakness) / 16 + 0.5),
		keys: ["hopefulness", "bleakness"],
	},
	{
		name: "Setting",
		area: "World",
		left: "Everyday",
		right: "Otherworldly",
		words: ["Real world", "Grounded", "Heightened", "Otherworldly", "Fantastical"],
		value: (s) =>
			clamp(
				(Math.max(s.fantasy, s.futuristic, s.surrealism) - Math.max(s.contemporary_realism, s.historical, s.biographical)) / 16 +
					0.5,
			),
		keys: ["fantasy", "futuristic", "surrealism", "contemporary_realism", "historical", "biographical"],
	},
	{
		name: "Attention",
		area: "Craft",
		left: "Easy watch",
		right: "Demanding",
		words: ["Easy watch", "Easy to follow", "Some focus", "Demanding", "Very demanding"],
		value: (s) => clamp((top2([s.complexity, s.philosophical, s.non_linear_narrative, s.ambiguity, s.meta_narrative]) - 2) / 8),
		keys: ["complexity", "philosophical", "non_linear_narrative", "ambiguity", "meta_narrative"],
	},
]

export const wordAt = (sc: Scale, v: number) => sc.words[v < 0.15 ? 0 : v < 0.38 ? 1 : v <= 0.62 ? 2 : v <= 0.85 ? 3 : 4]

// One word per area and tier (0-4), copied from Sliders.tsx.
export const AREA_WORD: Record<Pillar, string[]> = {
	Energy: ["Calm", "Low-key", "Steady", "High", "Relentless"],
	Heart: ["Cool", "Reserved", "Warm", "Moving", "Profound"],
	Humor: ["None", "Rare", "Light", "Funny", "Hilarious"],
	World: ["Thin", "Simple", "Solid", "Rich", "Immersive"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

// Narrow phone columns: shorter words for the longest area words.
export const PHONE_WORD: Record<string, string> = { Relentless: "Intense", Masterful: "Superb", Immersive: "Vivid", Hilarious: "Riotous", Reserved: "Cool" }

// --- Which area a trait belongs to (own formula first, then related) ---

// Thinking traits read as craft, not heart.
const AREA_OVERRIDE: Record<string, Pillar> = { philosophical: "Craft", educational: "Craft", spectacle: "Energy" }

export function areaOf(k: string): Pillar {
	if (AREA_OVERRIDE[k]) return AREA_OVERRIDE[k]
	for (const p of PILLARS) if ((F.PILLAR_KEYS[p] as readonly string[]).includes(k)) return p
	for (const p of PILLARS) if ((F.RELATED_KEYS[p] as string[]).includes(k)) return p
	return "World"
}

export const areaColor = (k: string) => HEX[areaOf(k)]

// --- Plain nouns for traits, used by the recipe ---

export const NOUN: Partial<Record<Key, string>> = {
	adrenaline: "adrenaline",
	tension: "tension",
	scare: "fright",
	violence: "violence",
	romance: "romance",
	eroticism: "heat",
	wholesome: "warmth",
	wonder: "wonder",
	pathos: "heartbreak",
	melancholy: "melancholy",
	uncanny: "eeriness",
	catharsis: "catharsis",
	nostalgia: "nostalgia",
	situational_comedy: "comedy",
	wit_wordplay: "wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe",
	absurdist_humor: "absurdity",
	satire_parody: "satire",
	dark_humor: "dark humor",
	fantasy: "fantasy",
	futuristic: "future tech",
	historical: "history",
	crime: "crime",
	mystery: "mystery",
	warfare: "war",
	political: "politics",
	sports: "sport",
	coming_of_age: "growing up",
	family_dynamics: "family",
	psychological: "mind games",
	social_commentary: "social bite",
	class_and_capitalism: "class anger",
	technology_and_humanity: "tech anxiety",
	spiritual: "faith",
	intrigue: "intrigue",
	complexity: "complexity",
	hopefulness: "hope",
	bleakness: "bleakness",
	ambiguity: "ambiguity",
	novelty: "originality",
	surrealism: "surrealism",
	eccentricity: "quirk",
	philosophical: "philosophy",
	spectacle: "spectacle",
	visual_stylization: "style",
	psychedelic: "psychedelia",
	grotesque: "gore",
	camp_and_irony: "camp",
	pastiche: "pastiche",
	slow_burn: "slow burn",
	fast_pace: "speed",
	character_depth: "character",
}

// --- Compact good-for line ---

export function GoodForLine({ t, n = 3, className = "" }: { t: F.TitleInput; n?: number; className?: string }) {
	const good = goodFor(t, n)
	if (!good.shown.length) return null
	return (
		<p className={`text-sm text-gray-300 ${className}`}>
			<span className="font-semibold text-emerald-200">Good for</span> {good.shown.join(" · ").toLowerCase()}
		</p>
	)
}

// Score bars for a handful of traits, high ones in their area color, low ones grey.
export function TraitBars({ keys, s, low = [], color }: { keys: Key[]; s: Scores; low?: Key[]; color?: string }) {
	return (
		<ul className="space-y-2">
			{keys.map((k) => {
				const meta = getFingerprintMeta(k)
				const dim = low.includes(k)
				return (
					<li key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-sm">
						<span className="truncate text-gray-200">{meta.label}</span>
						<span className="tabular-nums text-xs text-gray-400">{s[k]} of 10</span>
						<span className="col-span-2 h-1.5 rounded-full bg-white/8">
							<span
								className="block h-1.5 rounded-full"
								style={{ width: `${s[k] * 10}%`, background: dim ? "#78716c" : (color ?? areaColor(k)) }}
							/>
						</span>
					</li>
				)
			})}
		</ul>
	)
}

export const kindOf = (t: F.TitleInput) => (t.mediaType === "movie" ? "movies" : "shows")
export const cleanMood = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")

export function MoodLink({ url, label, t }: { url: string; label: string; t: F.TitleInput }) {
	return (
		<Link to={url} className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
			{cleanMood(label).toLowerCase()} {kindOf(t)}
		</Link>
	)
}
