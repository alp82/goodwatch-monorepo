// PROTOTYPE - throwaway.
// The round-1 closed questions (laugh, plot or characters, half-watch, date night, scare, feel good) as FAQ cards.
import {
	ArrowsRightLeftIcon,
	EyeIcon,
	FaceSmileIcon,
	HeartIcon,
	MoonIcon,
	SunIcon,
} from "@heroicons/react/24/outline"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import type React from "react"
import { useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { Bars, HEX, Meter, type Pillar } from "~/ui/details/DetailsFingerprint"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"
import { FP_FAQ_VARIANTS } from "./variants"

type Media = MovieResult | ShowResult
type Fingerprint = NonNullable<Media["fingerprint"]>
type Scores = F.TitleInput["fingerprint"]["scores"]
type Key = keyof Scores

/** True when the page shows a fingerprint variant that hands its questions to the FAQ. */
export function useFingerprintFaq() {
	const [params] = useSearchParams()
	return FP_FAQ_VARIANTS.includes(params.get("variant") ?? "")
}

/** How many questions the gate adds, for the FAQ's reserved height. */
export function useFingerprintFaqCount(media: Media) {
	return useFingerprintFaq() && media.fingerprint ? fingerprintQuestions(media).length : 0
}

// --- Answers -------------------------------------------------------------------------------------------------------

type Visual =
	| { kind: "slider"; v: number; left: string; right: string; area: Pillar; label: string }
	| { kind: "meter"; tier: number; area: Pillar; word: string }
	| { kind: "chips"; items: string[]; on: string[] }

interface FpQuestion {
	id: string
	q: string
	a: string
	icon: React.ComponentType<{ className?: string }>
	visual: Visual
	evidence: { label?: string; keys: Key[]; area: Pillar }[]
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}
const byScore = (s: Scores, keys: Key[]) => [...keys].sort((a, b) => s[b] - s[a])
const label = (k: Key) => getFingerprintMeta(k).label.toLowerCase()

const HUMOR_WORD: Partial<Record<Key, string>> = {
	situational_comedy: "situational comedy",
	wit_wordplay: "sharp wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe comedy",
	absurdist_humor: "absurd humor",
	satire_parody: "satire",
	dark_humor: "dark humor",
}
const HUMOR_LEVEL = ["no humor", "a touch of humor", "light humor", "funny", "very funny"]

function fingerprintQuestions(media: Media): FpQuestion[] {
	const fp = media.fingerprint as Fingerprint | null | undefined
	if (!fp) return []
	const T = media.details.title
	const noun = media.mediaType === "movie" ? "movie" : "series"
	const s = fp.scores as Scores
	const who = fp.socialSuitability.map((x) => x.name)
	const ctx = fp.viewingContext.map((x) => x.name)
	const out: FpQuestion[] = []

	// Laugh: the Humor area tier, with the two strongest kinds of humor.
	const humor = fp.pillars.Humor
	const humorKeys = byScore(s, Object.keys(HUMOR_WORD) as Key[])
	const kinds = humorKeys.filter((k) => s[k] >= 5).slice(0, 2).map((k) => HUMOR_WORD[k] ?? "")
	const laughVerdict = ["No. It plays it straight.", "Not really. Humor is rare.", "A little.", "Yes.", "Yes, a lot."][humor]
	out.push({
		id: "laugh",
		q: `Will ${T} make me laugh?`,
		a: `${laughVerdict}${kinds.length && humor >= 1 ? ` The humor is mostly ${F.list(kinds)}.` : ""}`,
		icon: FaceSmileIcon,
		visual: { kind: "meter", tier: humor, area: "Humor", word: HUMOR_LEVEL[humor] },
		evidence: [{ keys: humorKeys.slice(0, 4), area: "Humor" }],
	})

	// Plot or characters: weighted character side against weighted plot side; a gap under 1 is "both".
	const character = (s.character_depth * 2 + s.pathos + s.dialogue_centrality) / 4
	const plot = (s.intrigue * 2 + s.spectacle + s.mystery) / 4
	const plotKeys = byScore(s, ["intrigue", "spectacle", "mystery"]).slice(0, 2)
	const charKeys = byScore(s, ["character_depth", "pathos", "dialogue_centrality"]).slice(0, 2)
	out.push({
		id: "drive",
		q: `Is ${T} plot-driven or character-driven?`,
		a:
			plot - character >= 1
				? `Mostly plot-driven. ${F.list(plotKeys.map(label)).replace(/^./, (c) => c.toUpperCase())} carry it more than its characters do.`
				: character - plot >= 1
					? `Mostly character-driven. It leans on ${F.list(charKeys.map(label))} more than on its plot.`
					: "Both, in balance. It gives its characters as much weight as its plot.",
		icon: ArrowsRightLeftIcon,
		visual: { kind: "slider", v: clamp((plot - character) / 8 + 0.5), left: "Characters", right: "Plot", area: "Craft", label: "Characters or plot" },
		evidence: [
			{ label: "Characters", keys: ["character_depth", "pathos", "dialogue_centrality"], area: "Heart" },
			{ label: "Plot", keys: ["intrigue", "spectacle", "mystery"], area: "Energy" },
		],
	})

	// Half-watch: how demanding the two most demanding traits are, softened by the viewing guide.
	const demandKeys = byScore(s, ["complexity", "non_linear_narrative", "philosophical", "ambiguity"])
	const demand = top2(demandKeys.map((k) => s[k]))
	const easyCtx = ctx.some((c) => c === "Background Watch" || c === "Drop-in Friendly")
	out.push({
		id: "half",
		q: `Can I half-watch ${T}?`,
		a:
			demand >= 8
				? `No, it needs your attention.${s.complexity >= 8 ? " The plot is layered, and it's easy to lose the thread." : ""}`
				: demand >= 6
					? easyCtx
						? "Mostly, yes. It asks for some focus, but our viewing guide says you can drop in and out."
						: "Better with focus. It asks for some attention to follow."
					: "Yes. It's easy to follow.",
		icon: EyeIcon,
		visual: { kind: "slider", v: clamp((demand - 2) / 8), left: "Easy watch", right: "Demanding", area: "Craft", label: "Attention" },
		evidence: [{ keys: demandKeys, area: "Craft" }],
	})

	// Date night rests on the viewing guide's flag alone; the answer says so and adds how much romance there is.
	const romance = s.romance
	const love = romance >= 6 ? "Romance is a big part of it." : romance >= 3 ? "Romance plays a supporting part." : "There's little romance in it."
	const family = who.includes("Family Movie Night") || who.includes("Kids")
	const date = who.includes("Date Night")
		? `${romance >= 3 ? "Yes" : "Probably"}. Our viewing guide lists it for date night. ${love}`
		: family
			? `It's better for a family night. Our viewing guide lists it for ${who.includes("Kids") ? "kids and families" : "families"}${who.includes("Partner Watch") ? ", and it also works for couples" : ""}.`
			: who.includes("Partner Watch")
				? `It works for a couple. Our viewing guide lists it for watching with a partner, not for date night. ${love}`
				: `Not really. Our viewing guide doesn't list it for date night${romance >= 6 ? ", despite its romance" : ""}.`
	out.push({
		id: "date",
		q: `Is ${T} good for date night?`,
		a: date,
		icon: HeartIcon,
		visual: { kind: "chips", items: who, on: who.includes("Date Night") || !family ? ["Date Night", "Partner Watch"] : ["Family Movie Night", "Kids", "Partner Watch"] },
		evidence: [{ keys: ["romance", "eroticism"], area: "Heart" }],
	})

	// Scare: the scare trait, with a note when tension or gore is what people will feel instead.
	const scare = s.scare
	const scareNote =
		scare < 6 && s.tension >= 8 ? " It's tense rather than scary." : s.grotesque >= 7 ? " Some images are gruesome." : ""
	out.push({
		id: "scare",
		q: `Will ${T} scare me?`,
		a: `${scare >= 8 ? "Yes. It's genuinely frightening." : scare >= 6 ? "At times. It has some frightening moments." : scare >= 4 ? "Barely. The scares are mild." : "No."}${scareNote}`,
		icon: MoonIcon,
		visual: { kind: "slider", v: clamp(scare / 10), left: "Not scary", right: "Terrifying", area: "Energy", label: "Scare" },
		evidence: [{ keys: byScore(s, ["scare", "tension", "uncanny", "grotesque"]), area: "Energy" }],
	})

	// Feel good: hopeful against bleak.
	const mood = s.hopefulness - s.bleakness
	out.push({
		id: "after",
		q: `Will I feel good after watching ${T}?`,
		a:
			mood >= 3
				? `Yes. It's an uplifting ${noun} that leaves you hopeful.`
				: mood <= -3
					? `Probably not. Its tone is bleak${s.melancholy >= 7 ? " and sad" : ""}.`
					: "Mixed feelings. It balances dark and hopeful moments.",
		icon: SunIcon,
		visual: { kind: "slider", v: clamp(mood / 16 + 0.5), left: "Bleak", right: "Hopeful", area: "Heart", label: "Tone" },
		evidence: [{ keys: byScore(s, ["hopefulness", "wholesome", "bleakness", "melancholy"]), area: "Heart" }],
	})
	return out
}

// --- Cards ---------------------------------------------------------------------------------------------------------

function AnswerVisual({ v }: { v: Visual }) {
	if (v.kind === "meter")
		return (
			<div className="mt-4 flex items-center gap-3">
				<Meter tier={v.tier} p={v.area} />
				<span className="text-sm text-gray-300">{v.word.charAt(0).toUpperCase() + v.word.slice(1)}</span>
			</div>
		)
	if (v.kind === "chips") {
		// The flags the answer rests on first, then a few others; the full list stays in the fingerprint section.
		const shown = [...v.items.filter((w) => v.on.includes(w)), ...v.items.filter((w) => !v.on.includes(w))].slice(0, 5)
		const more = v.items.length - shown.length
		return v.items.length ? (
			<div className="mt-4 flex flex-wrap items-center gap-1.5">
				{more > 0 && <span className="order-last px-1 text-sm text-gray-400">and {more} more</span>}
				{shown.map((w) => (
					<span
						key={w}
						className={`rounded-full px-2.5 py-1 text-sm ${v.on.includes(w) ? "bg-emerald-400/20 font-semibold text-emerald-100" : "bg-white/8 text-gray-300"}`}
					>
						{w}
					</span>
				))}
			</div>
		) : null
	}
	return (
		<div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
			<span className="text-gray-400">{v.left}</span>
			<span role="img" aria-label={`${v.label}: ${Math.round(v.v * 100)}% of the way from ${v.left.toLowerCase()} to ${v.right.toLowerCase()}`} className="relative h-3 rounded-full bg-white/8">
				<span className="absolute inset-y-0 left-1/2 w-px bg-white/15" aria-hidden="true" />
				<span
					className="absolute top-1/2 h-3.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40"
					style={{ left: `calc(18px + ${v.v} * (100% - 36px))`, background: HEX[v.area] }}
					aria-hidden="true"
				/>
			</span>
			<span className="text-gray-400">{v.right}</span>
		</div>
	)
}

function FpQuestionCard({ x, scores, wide }: { x: FpQuestion; scores: Scores; wide: boolean }) {
	const [open, setOpen] = useState(false)
	const id = `faq-fp-${x.id}`
	const Icon = x.icon
	return (
		<article className={`flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 sm:p-6 ${wide ? "md:col-span-2" : ""}`}>
			<span className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-200">
				<Icon className="h-5 w-5" />
			</span>
			<div className="min-w-0 grow">
				<h3 className="text-lg font-semibold leading-snug">{x.q}</h3>
				<AnswerVisual v={x.visual} />
				<p className="mt-3 text-gray-300 leading-relaxed">
					{x.a}{" "}
					<button
						type="button"
						aria-expanded={open}
						aria-controls={id}
						onClick={() => setOpen(!open)}
						onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
						className="inline-flex cursor-pointer items-center gap-0.5 rounded text-sm text-gray-400 underline decoration-white/30 underline-offset-2 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						{open ? "Hide traits" : "Why"}
						<ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
					</button>
				</p>
				{open && (
					<div id={id} className="mt-4 grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] motion-safe:animate-[faqfp_150ms_ease-out]">
						<style>{"@keyframes faqfp{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"}</style>
						{x.evidence.map((ev) => (
							<div key={ev.label ?? "traits"}>
								<p className="mb-2 text-xs font-semibold text-gray-400">{ev.label ? `${ev.label} side` : "Based on these traits"}</p>
								<Bars attributes={ev.keys.map((k) => ({ key: k, score: scores[k] }))} color={HEX[ev.area]} />
							</div>
						))}
					</div>
				)}
			</div>
		</article>
	)
}

// The fingerprint questions go after these facts; the rest of the facts follow them.
const BEFORE = ["stream", "worth", "rated", "length"]
const WIDE = ["stream", "tropes"]

/** The FAQ section with the fingerprint questions merged in. `card` renders one of the existing questions. */
export function FaqWithFingerprint({
	media,
	faqs,
	card,
}: {
	media: Media
	faqs: TitleQuestion[]
	card: (f: TitleQuestion, wide: boolean) => React.ReactNode
}) {
	const fps = fingerprintQuestions(media)
	const scores = (media.fingerprint?.scores ?? {}) as Scores
	const items: ({ fact: TitleQuestion } | { fp: FpQuestion })[] = [
		...faqs.filter((f) => BEFORE.includes(f.id)).map((fact) => ({ fact })),
		...fps.map((fp) => ({ fp })),
		...faqs.filter((f) => !BEFORE.includes(f.id)).map((fact) => ({ fact })),
	]
	// An odd card out at the end spans both columns so the grid has no hole.
	const narrow = items.filter((x) => !("fact" in x && WIDE.includes(x.fact.id)))
	const last = narrow.length % 2 === 1 ? narrow[narrow.length - 1] : null
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((x) => {
			const { q, a } = "fact" in x ? x.fact : x.fp
			return { "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }
		}),
	}
	return (
		<section>
			<h2 className="text-2xl font-bold">
				Questions about <MediaText value={presentedText(media.details, "title", media.details.title)} />
			</h2>
			<p className="mt-1 text-gray-400">Quick answers from GoodWatch data.</p>
			<div className="mt-6 grid gap-4 md:grid-cols-2">
				{items.map((x) =>
					"fact" in x ? (
						<FactSlot key={x.fact.id}>{card(x.fact, x === last)}</FactSlot>
					) : (
						<FpQuestionCard key={x.fp.id} x={x.fp} scores={scores} wide={x === last} />
					),
				)}
			</div>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
		</section>
	)
}

const FactSlot = ({ children }: { children: React.ReactNode }) => <>{children}</>
