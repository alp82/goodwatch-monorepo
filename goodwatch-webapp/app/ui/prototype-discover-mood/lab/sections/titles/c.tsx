// PROTOTYPE (Discover lab, titles c): one list for everything the text can mean. First row runs it as the search
// (with its live count and first posters), then the titles by that name with their uses inline, then people by that
// name (adds them to Cast and crew). Everything picked, titles and people, sits together on the right.
import { FilmIcon, MagnifyingGlassIcon, UserIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { EXAMPLE_PROMPTS } from "../../../kit"
import { PRIVATE, PosterThumb, TitleRowsLoading, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { SuggestChips, cardTitle } from "./ghi-parts"
import { PersonTile, PickedFace, usePeople } from "../people/shared"
import {
	CurrentSearch,
	LaneHead,
	PickedGroups,
	PreviewLine,
	PreviewPosters,
	UseButtons,
	useKnown,
	useSearchPreview,
	useTitleUses,
} from "./shared"

function Kind({ icon }: { icon: ReactNode }) {
	return <span className="grid w-5 shrink-0 place-items-center text-gray-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
}

const EXAMPLES: { kind: "search" | "title" | "person"; text: string }[] = [
	{ kind: "search", text: EXAMPLE_PROMPTS[0] },
	{ kind: "search", text: EXAMPLE_PROMPTS[1] },
	{ kind: "search", text: EXAMPLE_PROMPTS[3] },
	{ kind: "title", text: "Severance" },
	{ kind: "title", text: "Dune" },
	{ kind: "person", text: "Greta Gerwig" },
]

export function TitlesC({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const asking = typed.length >= 2
	const titles = useQuickTitles(text)
	const people = usePeople(d, text)
	const preview = useSearchPreview(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const nTitles = phone ? 4 : people.found.length ? 3 : 4
	const nPeople = phone ? 3 : 2
	const anyPicked = uses.picked.length + people.chosen.length > 0

	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px]"}>
			<div className={phone ? "flex flex-col gap-1" : "flex min-h-0 flex-col gap-1 overflow-hidden px-6 py-4"}>
				{typing ? (
					<div
						className={`flex min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-3 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-400/[0.18] ${phone ? "flex-col items-stretch gap-2 py-3" : "h-[84px]"}`}
					>
						<button
							type="button"
							onClick={() => runSearch(typed)}
							className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-xl text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<Kind icon={<MagnifyingGlassIcon />} />
							<span className="min-w-0 flex-1">
								<span className="flex min-w-0 items-baseline gap-2">
									<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
									<span className={`brand-header min-w-0 truncate text-[19px] text-white ${PRIVATE}`}>{typed}</span>
								</span>
								<PreviewLine p={preview} />
							</span>
						</button>
						<span className={phone ? "pl-8" : "shrink-0"}>
							<PreviewPosters p={preview} n={phone ? 5 : 6} w={42} />
						</span>
					</div>
				) : d.q ? (
					<CurrentSearch d={d} />
				) : null}

				{!asking ? (
					<div className={d.q ? "mt-2" : ""}>
						{EXAMPLES.slice(0, d.q ? 3 : 6).map((e) => (
							<button
								key={e.text}
								type="button"
								onClick={() => (e.kind === "search" ? runSearch(e.text) : setText(e.text))}
								className="flex h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="text-amber-400/70">
									<Kind icon={e.kind === "search" ? <MagnifyingGlassIcon /> : e.kind === "title" ? <FilmIcon /> : <UserIcon />} />
								</span>
								<span className="truncate">{e.text}</span>
							</button>
						))}
					</div>
				) : (
					<>
						{titles.found.length > 0 ? (
							<div className={titles.loading ? "opacity-70 transition-opacity" : ""}>
								{titles.found.slice(0, nTitles).map((t) => (
									<div
										key={t.key}
										className={`flex min-w-0 rounded-xl px-3 hover:bg-white/[0.045] ${phone ? "flex-col gap-2 py-2" : "h-[60px] items-center gap-3"}`}
									>
										<span className="flex min-w-0 flex-1 items-center gap-3">
											<Kind icon={<FilmIcon />} />
											<PosterThumb poster={t.poster} title={t.title} className="h-[48px] w-8" />
											<span className="min-w-0">
												<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
												<span className="block text-[12px] text-gray-500">
													{[t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}
												</span>
											</span>
										</span>
										<span className={phone ? "pl-[76px]" : ""}>
											<UseButtons k={t.key} uses={uses} onUse={() => known.remember(t)} open={liveTitleUrl(t)} size="sm" />
										</span>
									</div>
								))}
							</div>
						) : titles.loading ? (
							<TitleRowsLoading n={2} />
						) : null}
						{people.found.length > 0 && (
							<div className={`${phone ? "" : "grid grid-cols-2 gap-1"} ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
								{people.found.slice(0, nPeople).map((p) => (
									<div key={p.id} className="flex min-w-0 items-center gap-1 pl-3">
										<Kind icon={<UserIcon />} />
										<div className="min-w-0 flex-1">
											<PersonTile p={p} on={people.has(p.id)} onToggle={() => people.toggle(p)} size={36} />
										</div>
									</div>
								))}
							</div>
						)}
						{!titles.loading && !people.loading && titles.found.length === 0 && people.found.length === 0 && (
							<p className="px-3 py-2 text-[13px] text-gray-500">No title or person called “{typed}”</p>
						)}
					</>
				)}
			</div>

			{(!phone || anyPicked) && (
				<div className={phone ? "" : "min-h-0 overflow-y-auto border-l border-white/[0.06] px-5 py-5"}>
					{anyPicked && <LaneHead>Picked</LaneHead>}
					{anyPicked ? (
						<div className="flex flex-col gap-4">
							<PickedGroups uses={uses} known={known.known} w={44} row={!phone} />
							{people.chosen.length > 0 && (
								<div>
									<div className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-gray-300">
										<UserIcon className="h-3.5 w-3.5" aria-hidden />
										Cast and crew
									</div>
									<div className="flex flex-wrap gap-2 px-1">
										{people.chosen.map((id) => (
											<PickedFace key={id} id={id} p={people.known(id)} onRemove={() => people.remove(id)} />
										))}
									</div>
								</div>
							)}
						</div>
					) : (
						!phone && (
							<div className="flex flex-col items-start gap-2 pt-1">
								<SuggestChips
									titles={d.cards.slice(0, 3).map(cardTitle)}
									use="loved"
									onPick={(t) => {
										known.remember(t)
										uses.toggle("loved", t.key)
									}}
								/>
							</div>
						)
					)}
				</div>
			)}
		</div>
	)
}

