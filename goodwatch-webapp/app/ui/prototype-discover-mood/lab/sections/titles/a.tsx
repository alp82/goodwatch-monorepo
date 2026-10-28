// PROTOTYPE (Discover lab, titles a): 16's lanes, fixed. Three lanes: Search (run the text, with a live preview of
// what it returns), Titles (each found title with Similar to, Loved, Disliked and its page), Picked (every picked
// title by use, removable). One place per title, so "Like this" and "Similar to" are no longer two things.
import { FilmIcon, MagnifyingGlassIcon, SparklesIcon, Square2StackIcon } from "@heroicons/react/20/solid"
import { EXAMPLE_PROMPTS } from "../../../kit"
import { PosterThumb, TitleRowsLoading, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import {
	CurrentSearch,
	EXAMPLE_KEYS,
	ExampleRow,
	LaneHead,
	PickedGroups,
	PreviewLine,
	PreviewPosters,
	RunButton,
	TITLE_EXAMPLES,
	UseButtons,
	useKnown,
	useSearchPreview,
	useTitleUses,
} from "./shared"

export function TitlesA({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const asking = typed.length >= 2
	const titles = useQuickTitles(text)
	const preview = useSearchPreview(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const lane = phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-5 py-5"

	return (
		<div className={phone ? "flex flex-col gap-8" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)]"}>
			<div className={`${lane} ${phone ? "" : "border-r border-white/[0.06] pl-6"}`}>
				<LaneHead icon={<SparklesIcon />}>Search</LaneHead>
				{typing ? (
					<div className="flex flex-col gap-3">
						<RunButton text={typed} onRun={() => runSearch(typed)} />
						<div className="px-1">
							<PreviewLine p={preview} />
							<div className="mt-2">
								<PreviewPosters p={preview} n={phone ? 5 : 7} w={phone ? 52 : 50} />
							</div>
						</div>
					</div>
				) : d.q ? (
					<div className="flex flex-col gap-2">
						<CurrentSearch d={d} />
						{EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
							<ExampleRow key={p} icon={<MagnifyingGlassIcon />} text={p} onClick={() => runSearch(p)} />
						))}
					</div>
				) : (
					<div className="flex flex-col">
						{EXAMPLE_PROMPTS.slice(0, 6).map((p) => (
							<ExampleRow key={p} icon={<MagnifyingGlassIcon />} text={p} onClick={() => runSearch(p)} />
						))}
					</div>
				)}
			</div>

			<div className={`${lane} ${phone ? "" : "border-r border-white/[0.06]"}`}>
				<LaneHead icon={<FilmIcon />}>Titles</LaneHead>
				{!asking ? (
					<div className="flex flex-col">
						{TITLE_EXAMPLES.map((t) => (
							<ExampleRow key={t} icon={<FilmIcon />} text={t} onClick={() => setText(t)} />
						))}
					</div>
				) : titles.found.length > 0 ? (
					<div className={titles.loading ? "opacity-70 transition-opacity" : ""}>
						{titles.found.slice(0, 5).map((t) => (
							<div
								key={t.key}
								className={`flex min-w-0 rounded-xl px-2 hover:bg-white/[0.045] ${phone ? "flex-col gap-2 py-2" : "h-[66px] items-center gap-3"}`}
							>
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<PosterThumb poster={t.poster} title={t.title} />
									<span className="min-w-0">
										<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
										<span className="block text-[12px] text-gray-500">
											{[t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}
										</span>
									</span>
								</div>
								<div className={phone ? "pl-12" : ""}>
									<UseButtons k={t.key} uses={uses} onUse={() => known.remember(t)} open={liveTitleUrl(t)} size={phone ? "sm" : "md"} />
								</div>
							</div>
						))}
					</div>
				) : titles.loading ? (
					<TitleRowsLoading n={5} />
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No title called “{typed}”</p>
				)}
			</div>

			<div className={`${lane} ${phone ? "" : "pr-6"}`}>
				<LaneHead icon={<Square2StackIcon />}>Picked titles</LaneHead>
				{uses.picked.length > 0 ? (
					<PickedGroups uses={uses} known={known.known} w={phone ? 56 : 52} />
				) : (
					<div className="flex flex-col">
						{EXAMPLE_KEYS.slice(0, 2).map((t) => (
							<ExampleRow key={t.key} icon={<Square2StackIcon />} text={`Similar to ${t.title}`} onClick={() => uses.toggle("similarTo", t.key)} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}
