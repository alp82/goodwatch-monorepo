// Quick list (/taste/quiz?mode=quick): the rating flow's second mode, a table of the titles the person hasn't
// answered, to score what they've seen and mark the rest. Above the table: the mode switch, the taste strip with the
// flow's milestones (and a guest's sign-up line, then the locked panel at the limit), the search of the whole catalog
// and the filters. Under it, the undo bar. State: model.ts; binding: use-quick-list.ts; rows: QuickTable.tsx.
import { useEffect, useState } from "react"
import { activeFilterCount } from "~/domain/my-scores"
import { FilterChips, FiltersButton, FiltersSheet, RowSearch } from "~/ui/my-library/scores/ScoreFilters"
import { WRAP } from "~/ui/my-pages/bits"
import { showsSignUpLine } from "~/ui/rating-flow/flow"
import { LockedPanel, SignUpLine, ghostButton } from "~/ui/rating-flow/parts"
import { WORDS } from "~/ui/rating-flow/words"
import type { ScoringMedia } from "~/ui/scoring/types"
import { FILTER_GROUPS } from "./model"
import { ModeSwitch, QUICK_PATH, TasteStrip, UndoBar, inField, useSelectsRows } from "./parts"
import { QuickTable } from "./QuickTable"
import { useQuickList } from "./use-quick-list"
import { QUICK_WORDS } from "./words"

const NO_STANDING = () => ({ score: 0, changed: false })

export function QuickList({ titles, member }: { titles: ScoringMedia[]; member: boolean }) {
	const q = useQuickList({ titles, member })
	const selects = useSelectsRows()
	const [sheet, setSheet] = useState(false)

	// U takes the latest change back (not while typing).
	const { undo } = q
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (inField(e) || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
			if (e.key !== "u" && e.key !== "U") return
			e.preventDefault()
			undo()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [undo])

	const filtered = activeFilterCount(q.filters) > 0
	const note = q.searchError ?? (q.searchPending ? QUICK_WORDS.searching : null)
	const waiting = !q.ready || (q.rows.length === 0 && (q.loadingMore || q.searchPending))
	return (
		<div className="overflow-x-clip pt-4 pb-40 text-white md:pt-8" data-quick-list>
			<div className={`${WRAP} flex flex-col gap-3`}>
				<div className="flex flex-wrap items-center gap-3">
					<ModeSwitch mode="quick" />
					{q.tally && (
						<div className="min-w-0 flex-1 basis-72 sm:max-w-md md:ml-auto">
							<TasteStrip tally={q.tally} step={q.next} lit={q.lit} />
						</div>
					)}
				</div>
				{q.tally && showsSignUpLine(q.tally, member) && <SignUpLine rated={q.tally.rated} />}
				{q.locked && q.tally && <LockedPanel rated={q.tally.rated} returnTo={QUICK_PATH} />}
				<div className="mt-2">
					<h1 className="text-xs font-bold uppercase tracking-wider text-amber-400/90">{QUICK_WORDS.head}</h1>
					<p className="mt-1 text-sm text-gray-400">{QUICK_WORDS.line}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2.5" data-controls>
					<RowSearch q={q.filters.q} onChange={(text) => q.setFilters((f) => ({ ...f, q: text }))} placeholder={QUICK_WORDS.search} />
					<div className="flex min-w-0 items-center gap-2.5 sm:ml-auto">
						<FiltersButton count={activeFilterCount(q.filters)} expanded={sheet} onClick={() => setSheet(true)} />
					</div>
				</div>
				<FilterChips f={q.filters} set={q.setFilters} />
				<p className={`min-h-4 text-xs ${q.searchError || q.error ? "text-red-300" : "text-gray-500"}`} aria-live="polite" data-note>
					{q.error ?? note}
				</p>
				{waiting ? (
					<p className="py-6 text-sm text-gray-400">{WORDS.loading}</p>
				) : q.rows.length === 0 ? (
					<div className="py-6">
						<p className="text-sm text-gray-400">
							{q.inSearch ? QUICK_WORDS.noResults : filtered ? QUICK_WORDS.noMatch : WORDS.empty}
						</p>
						{!q.inSearch && (q.moreStopped || q.moreFailed) && (
							<button type="button" className={`${ghostButton} mt-4`} onClick={q.lookFurther}>
								{q.moreFailed ? WORDS.tryAgain : QUICK_WORDS.lookFurther}
							</button>
						)}
					</div>
				) : (
					<QuickTable
							rows={q.rows}
							answers={q.answers}
							latest={q.latest}
							leaving={q.leaving}
							back={q.back}
							order={q.order}
							onOrder={q.setOrder}
							selects={selects}
							locked={q.locked}
							busy={q.busy}
							onAnswer={q.answer}
						/>
				)}
			</div>
			<FiltersSheet
				open={sheet}
				onClose={() => setSheet(false)}
				titles={q.sheetTitles}
				f={q.filters}
				set={q.setFilters}
				standingOf={NO_STANDING}
				shown={null}
				only={FILTER_GROUPS}
			/>
			{q.last && (
				<div className="pointer-events-none fixed inset-x-2 bottom-[calc(var(--nav-dock-height,0px)+0.5rem)] z-40 flex justify-center lg:bottom-6">
					<UndoBar label={q.last.label} answer={q.last.answer} busy={q.last.busy} onUndo={q.undo} />
				</div>
			)}
		</div>
	)
}
