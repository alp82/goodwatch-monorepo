import { ChevronDownIcon } from "@heroicons/react/20/solid"
// PROTOTYPE - throwaway.
// Tagline adjectives plus one sentence, then ranked trait chips that expand inline to explain themselves.
import { Link } from "@remix-run/react"
import { useId, useState } from "react"
import fingerprintIcon from "~/img/fingerprint-72.webp"
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { assetUrl } from "~/utils/asset-url"
import type { VariantProps } from "../types"

type Scores = F.TitleInput["fingerprint"]["scores"]
type Key = keyof Scores

// Copied from fingerprintText's FEEL lexicon (not exported). The strong form
// is used only at 10 here, so a 9 in melancholy reads "melancholic", not "profoundly sad".
const FEEL: Partial<Record<Key, [string, string]>> = {
	adrenaline: ["thrilling", "pulse-pounding"],
	tension: ["tense", "nerve-racking"],
	scare: ["scary", "terrifying"],
	violence: ["violent", "brutally violent"],
	romance: ["romantic", "deeply romantic"],
	wholesome: ["wholesome", "heartwarming"],
	wonder: ["wondrous", "awe-inspiring"],
	pathos: ["moving", "deeply moving"],
	melancholy: ["melancholic", "melancholic"],
	uncanny: ["eerie", "deeply unsettling"],
	nostalgia: ["nostalgic", "nostalgic"],
	hopefulness: ["hopeful", "uplifting"],
	bleakness: ["bleak", "relentlessly bleak"],
	slow_burn: ["slow-burning", "slow-burning"],
	fast_pace: ["fast-paced", "breakneck"],
	intrigue: ["intriguing", "gripping"],
	complexity: ["layered", "intricate"],
	ambiguity: ["ambiguous", "open-ended"],
	surrealism: ["surreal", "dreamlike"],
	eccentricity: ["quirky", "eccentric"],
	philosophical: ["philosophical", "philosophical"],
	spectacle: ["spectacular", "epic"],
	psychedelic: ["trippy", "psychedelic"],
	grotesque: ["grotesque", "grotesque"],
	camp_and_irony: ["campy", "gloriously campy"],
	wit_wordplay: ["witty", "razor-witty"],
	absurdist_humor: ["absurd", "wildly absurd"],
	dark_humor: ["darkly funny", "darkly funny"],
}

// Distinctiveness rule. Raw scores favour craft and "quality" traits that most
// well-made titles score high on (direction, acting, editing, rewatchability...),
// so those always lose 3 points. Every highlight key gains 2.5 points (a little
// less further down its list), so the analysis' own picks lead, and a craft
// highlight still ranks behind the distinctive ones. Only traits at 7 or more qualify, the adjusted
// weight must still reach 7 (so most craft 9s drop out), and the list stops at 20.
const COMMON: Key[] = [
	"direction",
	"acting",
	"narrative_structure",
	"dialogue_quality",
	"character_depth",
	"editing",
	"cinematography",
	"music_composition",
	"music_centrality",
	"sound_centrality",
	"world_immersion",
	"rewatchability",
	"dialogue_centrality",
]

function rankTraits(s: Scores, highlights: string[]) {
	return (Object.keys(s) as Key[])
		.filter((k) => s[k] >= 7)
		.map((k) => {
			const h = highlights.indexOf(k)
			const weight =
				s[k] + (h >= 0 ? 2.5 - h * 0.1 : 0) - (COMMON.includes(k) ? 3 : 0)
			return { key: k, score: s[k], weight }
		})
		.filter((x) => x.weight >= 7)
		.sort((a, b) => b.weight - a.weight)
		.slice(0, 20)
}

function tagline(t: F.TitleInput, highlights: string[]) {
	const s = t.fingerprint.scores
	const ranked = (Object.keys(FEEL) as Key[])
		.filter((k) => s[k] >= 7)
		.sort(
			(a, b) =>
				s[b] +
				(highlights.includes(b) ? 2 : 0) -
				(s[a] + (highlights.includes(a) ? 2 : 0)),
		)
		.slice(0, 3)
		.map((k) => FEEL[k]?.[s[k] >= 10 ? 1 : 0] ?? "")
	return [...new Set(ranked)]
}

// The shared summary opens with the same adjectives as the tagline; drop the repeats.
function sentence(t: F.TitleInput, words: string[]) {
	let out = F.summary(t)
	for (const w of words) out = out.replace(new RegExp(`\\b${w},? `), "")
	return out.replace(
		/^(A|An) (\w)/,
		(_, _a, c: string) => `${/[aeiou]/i.test(c) ? "An" : "A"} ${c}`,
	)
}

const STRENGTH = (n: number) =>
	n >= 10
		? "Defining trait"
		: n >= 9
			? "Very strong"
			: n >= 8
				? "Strong"
				: "Noticeable"

// The area a trait belongs to, for its tint: its own area first, then a related one.
function areaOf(k: Key): Pillar | null {
	for (const [p, keys] of Object.entries(F.PILLAR_KEYS))
		if (keys.includes(k)) return p as Pillar
	for (const [p, keys] of Object.entries(F.RELATED_KEYS))
		if (keys.includes(k)) return p as Pillar
	return null
}

const color = (p: Pillar | null) => (p ? HEX[p] : "#a8a29e")
const clean = (l: string) => l.replace(/\s*\p{Extended_Pictographic}.*$/u, "")
const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }
const FIRST = 8

export default function Chips({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const highlights = media.fingerprint?.highlightKeys ?? []
	const traits = rankTraits(s, highlights)
	const words = tagline(t, highlights)
	const [open, setOpen] = useState<Key | null>(null)
	const [all, setAll] = useState(false)
	const panelId = useId()
	const shown = all ? traits : traits.slice(0, FIRST)
	const kind = t.mediaType === "movie" ? "movies" : "shows"

	const current = open ? traits.find((x) => x.key === open) : undefined
	const area = current ? areaOf(current.key) : null
	const meta = current ? getFingerprintMeta(current.key) : null
	const moods = current ? F.moodsForKeys(t, [current.key]) : []
	const tier = area ? t.fingerprint.pillars[area] : 0

	return (
		<div
			onKeyDown={(e) => {
				if (e.key === "Escape" && open) {
					setOpen(null)
					document.getElementById(`${panelId}-${open}`)?.focus()
				}
			}}
		>
			<h2 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
				<img
					src={assetUrl(fingerprintIcon)}
					className="h-6 w-auto rounded-sm bg-amber-950/50 p-0.5"
					alt=""
				/>
				<MediaText value={{ text: t.title, lang: t.titleLang ?? "en" }} />{" "}
				fingerprint
			</h2>
			<p className="mt-2 text-3xl font-semibold tracking-tight text-amber-200">
				{words.length
					? `${words.join(", ")}.`.replace(/^./, (c) => c.toUpperCase())
					: `${F.pillarLine(t)}.`}
			</p>
			<p className="mt-2 max-w-3xl text-lg leading-relaxed text-gray-300">
				{sentence(t, words)}
			</p>

			<h3 className="mt-7 text-sm font-semibold text-gray-300">
				Traits that stand out, strongest first
			</h3>
			<ul className="mt-3 flex flex-wrap gap-2">
				{shown.map((x, i) => {
					const p = areaOf(x.key)
					const m = getFingerprintMeta(x.key)
					const on = open === x.key
					return (
						<li key={x.key}>
							<button
								type="button"
								id={`${panelId}-${x.key}`}
								aria-expanded={on}
								aria-controls={panelId}
								onClick={() => setOpen(on ? null : x.key)}
								className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-amber-300 ${i < 3 ? "font-semibold text-white" : "text-gray-100"}`}
								style={{
									borderColor: `color-mix(in srgb, ${color(p)} ${on ? 90 : 40}%, transparent)`,
									background: `color-mix(in srgb, ${color(p)} ${on ? 30 : i < 3 ? 20 : 12}%, transparent)`,
								}}
							>
								<span aria-hidden="true">{m.emoji}</span>
								{m.label}
								<ChevronDownIcon
									className={`h-4 w-4 text-gray-400 transition-transform ${on ? "rotate-180" : ""}`}
									aria-hidden="true"
								/>
							</button>
						</li>
					)
				})}
				{traits.length > FIRST && (
					<li>
						<button
							type="button"
							aria-expanded={all}
							onClick={() => setAll(!all)}
							className="inline-flex h-9 cursor-pointer items-center rounded-full bg-white/5 px-3 text-sm text-gray-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							{all ? "Show fewer" : `+${traits.length - FIRST} more`}
						</button>
					</li>
				)}
			</ul>

			<section
				id={panelId}
				aria-label={meta ? `${meta.label} explained` : "Trait explanation"}
				aria-live="polite"
			>
				{current && meta && (
					<div
						className="mt-3 max-w-3xl rounded-2xl border border-white/10 p-5 motion-safe:animate-[fpchip_150ms_ease-out]"
						style={{
							background: `linear-gradient(135deg, color-mix(in srgb, ${color(area)} 12%, transparent), transparent 65%)`,
						}}
					>
						<style>
							{
								"@keyframes fpchip{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"
							}
						</style>
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<p className="text-lg font-semibold text-white">
								<span aria-hidden="true">{meta.emoji}</span> {meta.label}
							</p>
							<p className="text-sm text-gray-300">
								{STRENGTH(current.score)}
								{area && (
									<span className="text-gray-400">
										{" "}
										· part of {PILLAR_CONFIG[area].emoji} {area}
									</span>
								)}
							</p>
						</div>
						{meta.description && (
							<p className="mt-1 text-gray-300">{meta.description}</p>
						)}
						<div className="mt-3 flex items-center gap-3">
							<span className="h-1.5 flex-1 rounded-full bg-white/8">
								<span
									className="block h-1.5 rounded-full"
									style={{
										width: `${current.score * 10}%`,
										background: color(area),
									}}
								/>
							</span>
							<span className="text-xs tabular-nums text-gray-400">
								{current.score} of 10
							</span>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							{moods.map((m) => (
								<Link
									key={m.url}
									to={m.url}
									className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm hover:border-white/60 hover:bg-white/5"
								>
									{clean(m.label)} {kind}
								</Link>
							))}
							{area && tier >= 2 && (
								<Link
									to={`/discover/${kind}?fingerprintPillars=${area}&fingerprintPillarMinTier=${Math.min(3, tier)}`}
									className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-black hover:brightness-110"
									style={{ background: HEX[area] }}
								>
									More {kind} with {FILTER_WORD[Math.min(3, tier)]}{" "}
									{area.toLowerCase()}
								</Link>
							)}
						</div>
					</div>
				)}
			</section>
		</div>
	)
}
