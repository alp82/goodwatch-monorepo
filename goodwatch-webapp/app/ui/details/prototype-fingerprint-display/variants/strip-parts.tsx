// PROTOTYPE - throwaway. Shared bits for the strip, standouts, rows and tabs variants: title, tagline, area words, top traits, good-for line.
import { Link } from "@remix-run/react"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"

type Scores = F.TitleInput["fingerprint"]["scores"]
type Key = keyof Scores

// Copied from fingerprintText (not exported there).
const FEEL: Partial<Record<string, { adj: string; strong: string }>> = {
	adrenaline: { adj: "thrilling", strong: "pulse-pounding" },
	tension: { adj: "tense", strong: "nerve-racking" },
	scare: { adj: "scary", strong: "terrifying" },
	violence: { adj: "violent", strong: "brutally violent" },
	romance: { adj: "romantic", strong: "deeply romantic" },
	eroticism: { adj: "sensual", strong: "explicitly sexual" },
	wholesome: { adj: "wholesome", strong: "heartwarming" },
	wonder: { adj: "wondrous", strong: "awe-inspiring" },
	pathos: { adj: "moving", strong: "deeply moving" },
	melancholy: { adj: "melancholic", strong: "profoundly sad" },
	uncanny: { adj: "eerie", strong: "deeply unsettling" },
	catharsis: { adj: "cathartic", strong: "cathartic" },
	nostalgia: { adj: "nostalgic", strong: "nostalgic" },
	hopefulness: { adj: "hopeful", strong: "uplifting" },
	bleakness: { adj: "bleak", strong: "relentlessly bleak" },
	slow_burn: { adj: "slow-burning", strong: "slow-burning" },
	fast_pace: { adj: "fast-paced", strong: "breakneck" },
	intrigue: { adj: "intriguing", strong: "gripping" },
	complexity: { adj: "layered", strong: "intricate" },
	ambiguity: { adj: "ambiguous", strong: "open-ended" },
	surrealism: { adj: "surreal", strong: "dreamlike" },
	eccentricity: { adj: "quirky", strong: "eccentric" },
	philosophical: { adj: "philosophical", strong: "philosophical" },
	spectacle: { adj: "spectacular", strong: "epic" },
	psychedelic: { adj: "trippy", strong: "psychedelic" },
	grotesque: { adj: "grotesque", strong: "grotesque" },
	camp_and_irony: { adj: "campy", strong: "gloriously campy" },
}

const AREA_WORDS: Record<string, string[]> = {
	Energy: ["calm", "low-key", "steady energy", "high energy", "relentless energy"],
	Heart: ["emotionally cool", "light on feelings", "some heart", "big heart", "deeply emotional"],
	Humor: ["no humor", "a touch of humor", "light humor", "funny", "very funny"],
	World: ["thin world", "simple world", "solid world", "immersive world", "fully immersive world"],
	Craft: ["rough craft", "plain craft", "solid craft", "strong craft", "masterful craft"],
	Style: ["plain style", "modest style", "clean style", "striking style", "stunning style"],
}

// Short one-word-ish cell labels for the strip and tabs.
const SHORT_WORDS: Record<string, string[]> = {
	Energy: ["Calm", "Low-key", "Steady", "High", "Relentless"],
	Heart: ["Cool", "Light", "Some heart", "Big heart", "Very emotional"],
	Humor: ["Serious", "A touch", "Light", "Funny", "Very funny"],
	World: ["Thin", "Simple", "Solid", "Immersive", "Fully immersive"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const areaWord = (p: Pillar, tier: number) => AREA_WORDS[p][tier]
export const shortWord = (p: Pillar, tier: number) => SHORT_WORDS[p][tier]
export const kindOf = (t: F.TitleInput) => (t.mediaType === "movie" ? "movies" : "shows")
export const cleanMood = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")

const feelWord = (s: Scores, k: string) => (s[k as Key] >= 9 ? FEEL[k]?.strong : FEEL[k]?.adj) ?? ""

// The heading of the section, without the big headline.
export function SectionTitle({ t }: { t: F.TitleInput }) {
	return (
		<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
			<img src={assetUrl(fingerprintIcon)} className="h-6 w-auto p-0.5 bg-amber-950/50 rounded-sm" alt="" />
			<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} /> fingerprint
		</h2>
	)
}

function highlightKeys(media: MovieResult | ShowResult): string[] {
	const fp = media.fingerprint as { highlightKeys?: string[] } | null | undefined
	return fp?.highlightKeys ?? []
}

// 2-4 adjectives that the summary sentence doesn't already use.
export function tagline(t: F.TitleInput, media: MovieResult | ShowResult) {
	const s = t.fingerprint.scores
	const feelKeys = Object.keys(FEEL)
	const inSummary = feelKeys
		.filter((k) => s[k as Key] >= 7)
		.sort((a, b) => s[b as Key] - s[a as Key])
		.slice(0, 2)
	const hl = highlightKeys(media)
	const candidates = feelKeys
		.filter((k) => !inSummary.includes(k) && s[k as Key] >= (hl.includes(k) ? 6 : 7))
		.sort((a, b) => s[b as Key] + (hl.includes(b) ? 1 : 0) - (s[a as Key] + (hl.includes(a) ? 1 : 0)))
	const words: string[] = []
	for (const k of candidates) {
		const w = feelWord(s, k)
		if (w && !words.includes(w)) words.push(w)
		if (words.length === 3) break
	}
	// Top up with the strongest areas when the feel words run out.
	const strong = PILLARS.filter((p) => t.fingerprint.pillars[p] >= 3).sort((a, b) => t.fingerprint.pillars[b] - t.fingerprint.pillars[a])
	for (const p of strong) {
		if (words.length >= 3) break
		words.push(areaWord(p, t.fingerprint.pillars[p]))
	}
	return cap(words.join(", "))
}

// The most distinctive traits: the title's highlight keys, else its top scores.
export function topTraits(t: F.TitleInput, media: MovieResult | ShowResult, n = 8) {
	const s = t.fingerprint.scores
	let keys = highlightKeys(media).filter((k) => k in s)
	if (keys.length < 5)
		keys = [...keys, ...(Object.keys(s) as string[]).filter((k) => !keys.includes(k)).sort((a, b) => s[b as Key] - s[a as Key])].slice(0, n)
	return keys.slice(0, n).map((key) => {
		const mood = F.moodsForKeys(t, [key])[0]
		return { key, label: getFingerprintMeta(key).label, description: getFingerprintMeta(key).description, url: mood?.url }
	})
}

export function TraitChip({ trait, size = "sm", className = "" }: { trait: ReturnType<typeof topTraits>[number]; size?: "sm" | "xs"; className?: string }) {
	const cls = `rounded-full border border-white/20 px-2.5 py-1 ${size === "sm" ? "text-sm" : "text-xs"} ${className}`
	return trait.url ? (
		<Link to={trait.url} title={trait.description} className={`${cls} hover:border-white/60 hover:bg-white/5`}>
			{trait.label}
		</Link>
	) : (
		<span title={trait.description} className={`${cls} text-gray-300`}>
			{trait.label}
		</span>
	)
}

// Generic audiences say little; specific occasions first.
const LOW_INFO = ["Adults", "Public Viewing Safe", "Solo Watch", "Intergenerational", "Partner Watch"]
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

export function goodFor(t: F.TitleInput, n = 4) {
	const all = [...t.fingerprint.socialSuitability, ...t.fingerprint.viewingContext].map((x) => x.name)
	const ranked = [...all.filter((x) => !LOW_INFO.includes(x)), ...all.filter((x) => LOW_INFO.includes(x))]
	return { shown: ranked.slice(0, n).map(sentence), rest: ranked.slice(n).map(sentence) }
}

export const firstSkip = (t: F.TitleInput) => F.skipIf(t)[0]

// Strongest area for a default: tier first, then the areas that differ most between titles.
const DEFAULT_ORDER: Pillar[] = ["Humor", "Heart", "Energy", "World", "Style", "Craft"]
export function strongest(t: F.TitleInput): Pillar {
	const tiers = t.fingerprint.pillars
	return [...DEFAULT_ORDER].sort((a, b) => tiers[b] - tiers[a] || DEFAULT_ORDER.indexOf(a) - DEFAULT_ORDER.indexOf(b))[0]
}
