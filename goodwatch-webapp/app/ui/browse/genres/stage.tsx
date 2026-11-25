// What the genres pickers share: one
// genre picked at a time, the keys that move the pick, and what opens with it (the genre's card with its kinds, then
// picks beyond the obvious. A picker only draws
// itself, and says whether it sits above the card ("below") or beside it on a laptop ("side").
import { MotionConfig } from "framer-motion"
import {
	type ComponentType,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react"
import { FOCUS, WRAP, wash } from "~/ui/browse/index"
import { GLIDE_T } from "~/ui/browse/motion"
import type { BrowseViewProps } from "~/ui/browse/view"
import type { AtlasData, AtlasGenreSummary } from "~/server/browse/genres.server"
import { useGenrePanels } from "./use-genre-panels"
import { GenreOpen } from "~/ui/browse/genres/open"
import { GenrePicks } from "~/ui/browse/genres/picks"
import { GenresHead } from "~/ui/browse/genres/pieces"

export interface PickerProps {
	genres: AtlasGenreSummary[]
	/** The picked genre's slug. */
	at: string
	/** The biggest genre's title count, for sizes honest to it. */
	max: number
	pick: (slug: string) => void
	intent: (slug: string) => void
	cancelIntent: () => void
	/** Arrow keys, Home and End on any genre control. */
	onKey: (e: KeyboardEvent<HTMLElement>) => void
	/** The picker's scrolling box, if it has one: the picked genre is kept in view inside it. */
	box: RefObject<HTMLDivElement>
	kind: BrowseViewProps["address"]["kind"]
	/** The page's address builder, for a picker's own links. */
	to: BrowseViewProps["to"]
}

/** Props every genre control spreads: a tab in one tablist, reachable by the keys, found by `data-genre`. */
export const tabProps = (p: PickerProps, slug: string) => ({
	type: "button" as const,
	role: "tab" as const,
	"aria-selected": slug === p.at,
	tabIndex: slug === p.at ? 0 : -1,
	"data-genre": slug,
	onClick: () => p.pick(slug),
	onFocus: () => p.intent(slug),
	onBlur: p.cancelIntent,
	onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
		if (event.pointerType === "mouse" || event.pointerType === "pen") p.intent(slug)
	},
	onPointerLeave: p.cancelIntent,
	onKeyDown: p.onKey,
})

/** The control of a genre that is on screen (a picker may draw a genre twice, one per breakpoint). */
const shownControl = (slug: string) =>
	[...document.querySelectorAll<HTMLElement>(`[data-genre="${slug}"]`)].find(
		(el) => el.offsetParent !== null,
	)

/** A genre's most telling word: the first that doesn't repeat its name (Romance → not "romantic"). */
export const tellingWord = (g: AtlasGenreSummary) =>
	g.words.find((w) => !w.word.toLowerCase().startsWith(g.place.label.toLowerCase().slice(0, 4))) ??
	null

export function GenreStage({
	data,
	address,
	to,
	kicker,
	title,
	lede,
	Picker,
	layout = "below",
}: BrowseViewProps<AtlasData> & {
	kicker: string
	title: ReactNode
	lede: ReactNode
	Picker: ComponentType<PickerProps>
	/** "side": from a laptop up the picker is a column beside the card (a phone still stacks them). */
	layout?: "below" | "side"
}) {
	const kind = address.kind
	const { at, panel, failed, pick: choose, intent, cancelIntent } = useGenrePanels(data, kind)
	const cardBox = useRef<HTMLDivElement>(null)
	const picksBox = useRef<HTMLDivElement>(null)
	const [reserved, setReserved] = useState<{ card: number; picks: number } | null>(null)
	function pick(slug: string) {
		if (slug !== at && cardBox.current && picksBox.current) {
			setReserved({
				card: cardBox.current.getBoundingClientRect().height,
				picks: picksBox.current.getBoundingClientRect().height,
			})
		}
		choose(slug)
	}
	useEffect(() => {
		const reset = () => setReserved(null)
		window.addEventListener("resize", reset)
		return () => window.removeEventListener("resize", reset)
	}, [])
	const box = useRef<HTMLDivElement>(null)
	const g = data.genres.find((x) => x.place.slug === at) ?? data.genres[0]
	const max = Math.max(...data.genres.map((x) => x.n), 1)

	const onKey = (e: KeyboardEvent<HTMLElement>) => {
		const i = data.genres.findIndex((x) => x.place.slug === at)
		const by =
			e.key === "ArrowRight" || e.key === "ArrowDown"
				? 1
				: e.key === "ArrowLeft" || e.key === "ArrowUp"
					? -1
					: 0
		const end = e.key === "Home" ? 0 : e.key === "End" ? data.genres.length - 1 : -1
		if (!by && end < 0) return
		e.preventDefault()
		const next = data.genres[end >= 0 ? end : (i + by + data.genres.length) % data.genres.length]
		pick(next.place.slug)
		shownControl(next.place.slug)?.focus({ preventScroll: true })
	}
	// The picked genre stays in view when the picker scrolls sideways.
	useEffect(() => {
		const el = box.current
		const control = shownControl(at)
		if (!el || !control || !el.contains(control) || el.scrollWidth <= el.clientWidth) return
		const a = el.getBoundingClientRect()
		const b = control.getBoundingClientRect()
		if (b.left >= a.left + 24 && b.right <= a.right - 24) return
		el.scrollTo({
			left: el.scrollLeft + b.left - a.left - (a.width - b.width) / 2,
			behavior: "smooth",
		})
	}, [at])

	if (!g) return null
	const side = layout === "side"
	const picker = (
		<Picker
			genres={data.genres}
			at={g.place.slug}
			max={max}
			pick={pick}
			intent={intent}
			cancelIntent={cancelIntent}
			onKey={onKey}
			box={box}
			kind={kind}
			to={to}
		/>
	)
	const opened = (
		<>
			<div
				ref={cardBox}
				role="tabpanel"
				aria-busy={!panel && !failed}
				aria-label={g.place.label}
				className={`relative rounded-2xl p-5 ring-1 ring-white/10 sm:p-7 ${side ? "max-lg:mt-6" : "mt-8"} ${GLIDE_T}`}
				style={{
					minHeight: reserved?.card,
					background: `linear-gradient(180deg, ${wash(g.color, 12)} 0%, rgb(255 255 255 / 0.02) 70%)`,
					boxShadow: `inset 0 2px 0 ${g.color}`,
				}}
			>
				<GenreOpen
					g={g}
					panel={panel}
					kind={kind}
					to={to}
					pending={
						<output className="mt-3 block text-sm text-gray-400">
							{failed ? (
								<>
									Couldn’t load this genre.{" "}
									<button
										type="button"
										className={`rounded text-amber-300 underline ${FOCUS}`}
										onClick={() => pick(at)}
									>
										Try again
									</button>
								</>
							) : (
								"Loading…"
							)}
						</output>
					}
				/>
			</div>
			<div ref={picksBox} className="mt-10 mb-16" style={{ minHeight: reserved?.picks }}>
				{panel && <GenrePicks g={panel} />}
			</div>
		</>
	)
	return (
		<MotionConfig reducedMotion="user">
			<GenresHead kicker={kicker} title={title} lede={lede} />
			<div className={WRAP}>
				{side ? (
					<div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
						<div className="lg:sticky lg:top-28">{picker}</div>
						<div className="min-w-0">{opened}</div>
					</div>
				) : (
					<>
						{picker}
						{opened}
					</>
				)}
			</div>
		</MotionConfig>
	)
}
