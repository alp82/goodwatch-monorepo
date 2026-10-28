// PROTOTYPE - throwaway. Round 4 variant 7: "Find a filter" results, grouped by the bar segment each filter lives in.
// Each segment column is the real filter search (<FilterGroups query>) showing only that segment's groups (hidden by
// CSS, by their `filter-group-<key>` ids), plus the few filters the sheet's search doesn't list (Not seen yet, Length,
// Scores by source, Critics vs audiences). A column with nothing to show hides itself; with no match anywhere, the
// text can go to Search instead. Empty, it shows every filter by segment, one tap to find it.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import { NotSeenSwitch } from "~/ui/filter-bar/controls"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../kit"
import { OneCard, type Pieces, SEG_LABEL, type SegKey, useKeepTop } from "./R4-7-parts"

type FindSeg = Exclude<SegKey, "search">
const FIND_SEGS: FindSeg[] = ["mood", "streaming", "watched", "more"]

const SEG_GROUPS: Record<FindSeg, string[]> = {
	mood: ["moods", "type", "anime", "genres"],
	streaming: ["services"],
	watched: ["notSeenYet", "minScore", "released"],
	more: [
		"themes",
		"styles",
		"runtime",
		"minMatch",
		"sourceScores",
		"scoreGap",
		"similarTo",
		"people",
		"loved",
		"disliked",
		"productionCountries",
		"ageLimit",
	],
}

/** Filters the sheet's search doesn't list, found by their words. */
const OWN: { seg: FindSeg; k: "notSeenYet" | "runtime" | "sourceScores" | "scoreGap"; title: string; words: string }[] = [
	{ seg: "watched", k: "notSeenYet", title: "Not seen yet", words: "not seen yet watched unwatched new" },
	{ seg: "more", k: "runtime", title: "Length", words: "length runtime short long minutes duration episodes" },
	{ seg: "more", k: "sourceScores", title: "Scores by source", words: "scores by source imdb rotten tomatoes metacritic" },
	{ seg: "more", k: "scoreGap", title: "Critics vs audiences", words: "critics vs audiences audience gap disagree" },
]
const ownMatches = (q: string) =>
	OWN.filter((o) => o.title.toLowerCase().includes(q) || o.words.split(" ").some((w) => w.startsWith(q)))

/** Every filter by segment, for the empty field: the label, and what to type to find it. */
export const FIND_INDEX: Record<FindSeg, { label: string; query: string }[]> = {
	mood: [
		{ label: "Mood", query: "Mood" },
		{ label: "Movies or shows", query: "Movies or shows" },
		{ label: "Genre", query: "Genre" },
		{ label: "Anime", query: "Anime" },
	],
	streaming: [
		{ label: "Streaming services", query: "Streaming services" },
		{ label: "Netflix", query: "Netflix" },
	],
	watched: [
		{ label: "Not seen yet", query: "Not seen yet" },
		{ label: "Score", query: "Score" },
		{ label: "Released", query: "Released" },
	],
	more: [
		{ label: "About", query: "Theme" },
		{ label: "Style", query: "Style" },
		{ label: "Length", query: "Length" },
		{ label: "Taste match", query: "Taste match" },
		{ label: "Scores by source", query: "Scores by source" },
		{ label: "Critics vs audiences", query: "Critics vs audiences" },
		{ label: "Similar to", query: "Similar to" },
		{ label: "Cast and crew", query: "Cast and crew" },
		{ label: "Loved, Disliked", query: "Loved" },
		{ label: "Production country", query: "Production countries" },
		{ label: "Age and content", query: "Age & content" },
	],
}

const sel = (keys: string[]) => keys.map((k) => `[aria-labelledby="filter-group-${k}"]`).join(",")

function findCss(scope: string) {
	const rules = FIND_SEGS.map((s) => {
		const mine = sel(SEG_GROUPS[s])
		return [
			`.${scope} .f-col-${s} > div > section:not(:is(${mine})) { display: none }`,
			`.${scope} .f-col-${s} > .py-10 { display: none }`,
			`.${scope} .f-wrap-${s}:not(:has(.f-col-${s} > div > section:is(${mine}), .f-own > section)) { display: none }`,
		].join("\n")
	})
	const any = FIND_SEGS.map((s) => `.f-col-${s} > div > section:is(${sel(SEG_GROUPS[s])})`).join(", ")
	rules.push(`.${scope}:has(${any}, .f-own > section) .f-none { display: none }`)
	return rules.join("\n")
}

function OwnSection({ k, title, children }: { k: string; title: string; children: ReactNode }) {
	const accent = FILTER_ACCENTS[k as keyof typeof FILTER_ACCENTS]
	return (
		<section aria-labelledby={`filter-own-${k}`}>
			<header className="mb-3 flex items-center gap-2.5">
				<span className={`h-3.5 w-1 rounded-full ${accent?.bar ?? "bg-gray-500"}`} />
				<h3 id={`filter-own-${k}`} className="text-[15px] font-bold text-white">
					{title}
				</h3>
			</header>
			{children}
		</section>
	)
}

function SegHead({ s }: { s: FindSeg }) {
	return <h3 className="mb-4 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">{SEG_LABEL[s]}</h3>
}

export function FindResults({
	d,
	pieces,
	phone,
	text,
	onText,
	onPicked,
	onSearch,
}: {
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	text: string
	onText: (t: string) => void
	onPicked: (k: SegKey) => void
	onSearch: (t: string) => void
}) {
	const q = text.trim().toLowerCase()
	const scope = phone ? "find-p7" : "find-d7"
	const root = useRef<HTMLDivElement>(null)
	useKeepTop(root, q, "[class*=f-wrap-]")
	if (!q)
		return (
			<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[1fr_1fr_1fr_2fr] overflow-y-auto px-2 py-5"}>
				{FIND_SEGS.map((s, i) => (
					<div key={s} className={phone ? "" : `px-5 ${i ? "border-l border-white/[0.06]" : ""}`}>
						<SegHead s={s} />
						<div className={s === "more" && !phone ? "grid grid-cols-2 gap-x-4" : "flex flex-col"}>
							{FIND_INDEX[s].map((it) => (
								<button
									key={it.label}
									type="button"
									onClick={() => onText(it.query)}
									className="flex h-9 min-w-0 items-center gap-2 rounded-lg px-2 -mx-2 text-left text-[14px] text-gray-300 cursor-pointer outline-none hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
									<span className="truncate">{it.label}</span>
								</button>
							))}
						</div>
					</div>
				))}
			</div>
		)
	const own = ownMatches(q)
	return (
		<div ref={root} className={`${scope} relative ${phone ? "" : "h-full min-h-0"}`}>
			<style dangerouslySetInnerHTML={{ __html: findCss(scope) }} />
			<div className={phone ? "flex flex-col gap-8" : "flex h-full min-h-0 overflow-hidden"}>
				{FIND_SEGS.map((s) => (
					<div
						key={s}
						onClickCapture={() => onPicked(s)}
						className={`f-wrap-${s} ${phone ? "" : `-ml-px min-h-0 min-w-0 overflow-y-auto overscroll-contain border-l border-white/[0.06] px-6 py-5 ${s === "more" ? "flex-[1.5]" : "flex-1"}`}`}
					>
						<SegHead s={s} />
						<div className="flex flex-col gap-7">
							<FilterGroups data={pieces.groups} query={text} className={`f-col-${s}`} />
							{own.some((o) => o.seg === s) && (
								<div className="f-own flex flex-col gap-7">
									{own
										.filter((o) => o.seg === s)
										.map((o) => (
											<OwnSection key={o.k} k={o.k} title={o.title}>
												{o.k === "notSeenYet" ? <NotSeenSwitch {...pieces.notSeenProps} /> : <OneCard pieces={pieces} k={o.k} />}
											</OwnSection>
										))}
								</div>
							)}
						</div>
					</div>
				))}
			</div>
			<div className={`f-none flex flex-col items-center justify-center gap-3 text-center ${phone ? "py-10" : "absolute inset-0"}`}>
				<p className="text-base font-bold text-white">No filter called “{text.trim()}”</p>
				<button
					type="button"
					onClick={() => onSearch(text.trim())}
					className="flex h-10 items-center gap-2 rounded-full bg-amber-400/[0.12] px-4 text-[14px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MagnifyingGlassIcon className="h-4 w-4 text-amber-300" aria-hidden />
					Search for “{text.trim()}”
				</button>
			</div>
		</div>
	)
}
