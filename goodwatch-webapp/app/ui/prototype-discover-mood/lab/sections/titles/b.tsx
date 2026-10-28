// PROTOTYPE (Discover lab, titles b): posters first. On top, the search with its live preview row. Below, the found
// titles as a poster row (well-known titles while the field is empty); tapping a poster turns it over into its ways
// to use it (Similar to, Loved, Disliked, Open). Picked titles sit at the end of the row, removable.
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import type { TitleKey } from "~/utils/title-key"
import { EXAMPLE_PROMPTS } from "../../../kit"
import { type FoundTitle, POSTER_SM, keyParts, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import {
	CurrentSearch,
	EXAMPLE_KEYS,
	LaneHead,
	PickedGroups,
	PreviewLine,
	PreviewPosters,
	RunButton,
	type TitleUses,
	USE,
	USE_ORDER,
	useKnown,
	useSearchPreview,
	useTitleUses,
} from "./shared"

function useExampleTitles(): FoundTitle[] {
	const names = useTitleNames(
		EXAMPLE_KEYS.map((t) => t.key),
		"",
	)
	return EXAMPLE_KEYS.map((t) => {
		const n = names.byKey.get(t.key)
		const { mediaType, tmdbId } = keyParts(t.key)
		return { key: t.key, title: t.title, year: String(n?.year ?? ""), poster: n?.poster ?? null, mediaType, tmdbId }
	})
}

function TitlePoster({
	t,
	uses,
	open,
	onOpen,
	onUse,
	w,
}: {
	t: FoundTitle
	uses: TitleUses
	open: boolean
	onOpen: (on: boolean) => void
	onUse: () => void
	w: number
}) {
	const on = uses.usesOf(t.key)
	return (
		<div className="shrink-0" style={{ width: w }}>
			<div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/10">
				<button
					type="button"
					onClick={() => onOpen(!open)}
					aria-expanded={open}
					aria-label={t.title}
					className="block h-full w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{t.poster ? (
						<img src={`${POSTER_SM}${t.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />
					) : (
						<span className="grid h-full place-items-center p-1 text-center text-[11px] leading-tight text-gray-400">{t.title}</span>
					)}
				</button>
				{on.length > 0 && !open && (
					<span className="pointer-events-none absolute bottom-1.5 left-1.5 flex gap-1">
						{on.map((u) => (
							<span key={u} className={`grid h-5 w-5 place-items-center rounded-full [&>svg]:h-3 [&>svg]:w-3 ${USE[u].badge}`}>
								{USE[u].icon}
							</span>
						))}
					</span>
				)}
				<AnimatePresence>
					{open && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.12 }}
							className="absolute inset-0 flex flex-col justify-center gap-1 bg-gray-950/90 p-1.5"
						>
							{USE_ORDER.map((u) => {
								const active = uses.has(u, t.key)
								return (
									<button
										key={u}
										type="button"
										aria-pressed={active}
										onClick={() => {
											onUse()
											uses.toggle(u, t.key)
										}}
										className={`flex h-7 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold whitespace-nowrap ring-1 ring-inset cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${
											active ? USE[u].on : "bg-white/[0.08] text-gray-200 ring-white/10 hover:bg-white/[0.16]"
										}`}
									>
										{USE[u].icon}
										{USE[u].label}
									</button>
								)
							})}
							<a
								href={liveTitleUrl(t)}
								target="_blank"
								rel="noreferrer"
								className="flex h-7 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold text-gray-400 outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
								Open
							</a>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<div className="mt-1.5 truncate text-[12px] text-gray-300" title={t.title}>
				{t.title}
				{t.year && <span className="text-gray-500"> · {t.year}</span>}
			</div>
		</div>
	)
}

export function TitlesB({ d, phone, text, runSearch }: SectionProps) {
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const asking = typed.length >= 2
	const quick = useQuickTitles(text)
	const examples = useExampleTitles()
	const preview = useSearchPreview(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const [openKey, setOpenKey] = useState<TitleKey | null>(null)
	const w = phone ? 104 : 112
	const shown = asking ? quick.found.slice(0, phone ? 10 : 8) : examples.slice(0, phone ? 8 : 8)

	return (
		<div className={phone ? "flex flex-col gap-6" : "flex h-full min-h-0 flex-col gap-5 px-6 py-5"}>
			<div className={phone ? "flex flex-col gap-3" : "grid h-[104px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-6"}>
				<div className="min-w-0">
					{typing ? (
						<RunButton text={typed} onRun={() => runSearch(typed)} />
					) : d.q ? (
						<CurrentSearch d={d} />
					) : (
						<div>
							<LaneHead icon={<MagnifyingGlassIcon />}>Search</LaneHead>
							<div className={`flex gap-2 ${phone ? "-mx-4 overflow-x-auto px-4 pb-1" : "flex-wrap"}`}>
								{EXAMPLE_PROMPTS.slice(0, phone ? 6 : 4).map((p) => (
									<button
										key={p}
										type="button"
										onClick={() => runSearch(p)}
										className="h-8 shrink-0 rounded-full bg-white/[0.06] px-3 text-[13px] whitespace-nowrap text-gray-200 cursor-pointer outline-none hover:bg-white/[0.11] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										{p}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
				{typing && (
					<div className="min-w-0">
						<PreviewLine p={preview} />
						<div className="mt-1.5">
							<PreviewPosters p={preview} n={phone ? 6 : 12} w={phone ? 44 : 48} />
						</div>
					</div>
				)}
			</div>

			<div className={phone ? "" : "flex min-h-0 flex-1 gap-6"}>
				<div className="min-w-0 flex-1">
					<LaneHead right={asking && quick.loading ? <span className="text-gray-500">…</span> : undefined}>
						{asking ? `Titles called “${typed}”` : "Titles"}
					</LaneHead>
					<div className={`flex gap-3 ${phone ? "-mx-4 overflow-x-auto px-4 pb-2" : "overflow-hidden"} ${quick.loading && asking ? "opacity-70 transition-opacity" : ""}`}>
						{shown.map((t) => (
							<TitlePoster
								key={t.key}
								t={t}
								w={w}
								uses={uses}
								open={openKey === t.key}
								onOpen={(on) => setOpenKey(on ? t.key : null)}
								onUse={() => known.remember(t)}
							/>
						))}
						{asking && !quick.loading && shown.length === 0 && <p className="px-1 py-3 text-[13px] text-gray-500">No title called “{typed}”</p>}
					</div>
				</div>
				{(!phone || uses.picked.length > 0) && (
					<div className={phone ? "mt-5" : "w-[340px] shrink-0 overflow-y-auto border-l border-white/[0.06] pl-6"}>
						<LaneHead>Picked titles</LaneHead>
						<PickedGroups uses={uses} known={known.known} w={44} row={!phone} showEmpty={!phone} />
					</div>
				)}
			</div>
		</div>
	)
}
