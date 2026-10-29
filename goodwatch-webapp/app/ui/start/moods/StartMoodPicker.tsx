// The start page's mood picker: My movies' taste picker (watch-next/MoodPicker.tsx, TasteShelf.tsx) with the guest's
// lines. Under the search bar: the mood button ("Any mood" with its color fan, then "Add" or "Change"), the picks as
// poster chips with a reading scrim (a whole mix by its name, then the other words), and "N titles" or "Pick up to
// three". The panel holds "Start with a mix" (the eight mixes, mixes.ts) and then Moods, Themes, and Styles, folded.
//
// The panel (StartMoodPanel.tsx) overlays the page and loads on first use: its code is asked for when the guest
// reaches for the row (a press or focus) or opens it, and a failed load says so in the row with a way to try again.
// Picks keep it open; Done closes it and brings the card into view.
//
// The counts (mood-counts.ts) are the query's results' own while a query is on; only with nothing asked does the open
// picker ask for them. Guests and members alike: "N titles", or "N on your services" with the viewer's services.
import {
	type ComponentType,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { useGuestBody } from "~/ui/discover/useDiscoverBrowse"
import { MoodButton, useRefusalHint } from "~/ui/watch-next/MoodButton"
import type { MoodControl } from "~/ui/watch-next/MoodPicker"
import { PickChip } from "~/ui/watch-next/PickChip"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	type StartQuery,
	type StartResults,
	hasQuery,
} from "../stage/start-query"
import type { StartMoodPanelProps } from "./StartMoodPanel"
import { displayPicks, pickLabel, tapPick } from "./mixes"
import {
	type CountScope,
	type MoodCounts,
	countText,
	countsOfResults,
} from "./mood-counts"
import { startPicker, startShelfLines } from "./start-picker"
import { useMoodCounts } from "./useMoodCounts"
import { usePickerPictures } from "./usePickerPictures"

const loadPanel = reloadOnStaleChunk(() => import("./StartMoodPanel"))

/** The panel's code: asked for by `warm` (on intent) and whenever the picker opens without it. */
function useLazyPanel(open: boolean) {
	const [Panel, setPanel] = useState<ComponentType<StartMoodPanelProps> | null>(
		null,
	)
	const [failed, setFailed] = useState(false)
	const asking = useRef(false)
	const warm = useCallback(() => {
		if (asking.current) return
		asking.current = true
		setFailed(false)
		loadPanel().then(
			(module) => setPanel(() => module.StartMoodPanel),
			() => {
				asking.current = false
				setFailed(true)
			},
		)
	}, [])
	useEffect(() => {
		if (open && !Panel) warm()
	}, [open, Panel, warm])
	return { Panel, failed, warm }
}

export function StartMoodPicker({
	query,
	results,
	scope,
	setPicks,
	clearPicks,
	member,
	onDone,
}: {
	/** The search text and the picks (word ids, up to three; a mix is its parts). */
	query: Pick<StartQuery, "text" | "picks">
	/** The query's results: while a query is on, the counts are theirs (one request per pick change). */
	results: Pick<StartResults, "signature" | "status" | "optionCounts" | "total">
	/** The results' services scope (useStartSearch): the counts' wording follows it. */
	scope: CountScope
	setPicks: (picks: readonly string[]) => void
	clearPicks: () => void
	/** A member asks with their session; a guest sends their progress. */
	member: boolean
	/** Done was pressed: the guest has asked. */
	onDone?: () => void
}) {
	const { picks } = query
	const [open, setOpen] = useState(false)
	const guest = useGuestBody(member)
	const asking = hasQuery(query)
	// With nothing asked yet there are no results to read: the open picker asks for the catalog's counts itself.
	const catalog = useMoodCounts({
		picks,
		ranked: null,
		guest,
		scope,
		active: open && !asking,
	})
	const counts = useHeld(asking ? countsOfResults(query, results) : catalog)
	const pictures = usePickerPictures(open)
	const { Panel, failed, warm } = useLazyPanel(open)
	const [refused, setRefused] = useState<MoodControl["refused"]>(null)
	const picker = useMemo(
		() => startPicker(picks, counts, pictures),
		[picks, counts, pictures],
	)
	const shelf = useMemo(
		() => startShelfLines(picks, counts, scope),
		[picks, counts, scope],
	)
	const control: MoodControl = {
		picker,
		countScope: scope === "mine" ? "on your services" : "titles",
		open,
		setOpen,
		toggle: (id) => {
			const tap = tapPick(picks, id)
			if (tap.refused) setRefused({ name: pickLabel(id), at: Date.now() })
			else setPicks(tap.picks)
		},
		clear: clearPicks,
		refused,
	}
	const row = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	return (
		<>
			<div
				ref={row}
				onPointerDown={warm}
				onFocus={warm}
				aria-busy={open && !Panel && !failed}
				className="-mx-4 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-1"
			>
				<div className="flex h-11 w-max items-center gap-2 lg:h-12">
					<span className="inline-flex shrink-0 rounded-full bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)] [&>button]:h-10 [&>button]:text-[15px] lg:[&>button]:h-11">
						<MoodButton control={control} buttonRef={button} />
					</span>
					{displayPicks(picks).map((id) => (
						<span
							key={id}
							className="inline-flex rounded-xl bg-gray-950/85 shadow-[0_8px_24px_rgb(0_0_0/.45)]"
						>
							<PickChip
								control={control}
								id={id}
								pinned={false}
								scrim
								count={false}
							/>
						</span>
					))}
					<span
						aria-live="polite"
						className="shrink-0 whitespace-nowrap pl-1 text-sm tabular-nums text-gray-300 [text-shadow:0_1px_8px_rgb(0_0_0/.9)]"
					>
						{open && failed ? (
							<>
								The moods didn't load.{" "}
								<button
									type="button"
									onClick={warm}
									className="cursor-pointer font-semibold text-white underline underline-offset-2 hover:text-amber-300"
								>
									Try again
								</button>
							</>
						) : picks.length ? (
							counts ? (
								countText(counts.total, scope)
							) : (
								""
							)
						) : (
							"Pick up to three"
						)}
					</span>
				</div>
			</div>
			{Panel && (
				<Panel
					control={control}
					shelf={shelf}
					anchor={row}
					returnFocus={button}
					onDone={() => {
						setOpen(false)
						button.current?.focus({ preventScroll: true })
						onDone?.()
						if (picks.length)
							requestAnimationFrame(() =>
								document
									.getElementById("start-card")
									?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
							)
					}}
				/>
			)}
			<RefusalLive control={control} />
		</>
	)
}

/**
 * The latest counts, kept while the next ones load (the results of a new pick are on their way), so the tiles'
 * numbers don't blank between taps.
 */
function useHeld(counts: MoodCounts | null): MoodCounts | null {
	const held = useRef<MoodCounts | null>(null)
	if (counts) held.current = counts
	return counts ?? held.current
}

/** Says a refused fourth pick out loud while the panel is closed (its head shows it while open). */
function RefusalLive({ control }: { control: MoodControl }) {
	const hint = useRefusalHint(control)
	return (
		<span className="sr-only" aria-live="polite">
			{control.open ? "" : (hint ?? "")}
		</span>
	)
}
