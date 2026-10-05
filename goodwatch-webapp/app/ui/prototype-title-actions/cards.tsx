// PROTOTYPE - throwaway. The poster card grid of Discover / For you with the action set on the cards. The card is a
// copy of ~/ui/MovieTvCard.tsx reading the prototype's store; the variants differ in how a card exposes actions:
//   quick          a row of four on hover; on phones press and hold opens a sheet with the full set
//   peek           a click or tap opens the shared title popup
//   menu           a "more" button opens a compact menu; Rate expands the 1-10 strip in place
//   footer-bolder  the four actions always visible in a footer under the poster
import { EllipsisHorizontalIcon, StarIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import { DISCOVER_GRID } from "~/ui/discover/DiscoverGrid"
import Drawer from "~/ui/modal/Drawer"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import { TasteMatchPill } from "~/ui/title-card/TasteMatchPill"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import { extractRatings, getScoreLabelText } from "~/utils/ratings"
import { ACTIONS, ActionSet, ScoreChip, TitleAction, TitleScore } from "./controls"
import { PopupOverlay } from "./popup"
import { type Key, useStore } from "./store"

type PopMode = "score" | "menu" | "full"
type Pop = { key: Key; mode: PopMode; align: "left" | "right" | "center" } | null

const LONG_PRESS_MS = 450
// The filter bar's menu chrome (MENU in ~/ui/filter-bar/motion.tsx) and its item row.
const MENU =
	"rounded-2xl bg-gray-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] text-gray-200"
const ITEM =
	"relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"

export function CardGrid() {
	const s = useStore()
	const [pop, setPop] = useState<Pop>(null)
	const [peek, setPeek] = useState<Key | null>(null)
	const tile = s.undoStyle === "tile"
	const cards = s.cards.filter((card) => tile || !s.isHidden(card.key))

	// A press outside the open card and outside the phone sheet closes the popover.
	useEffect(() => {
		if (!pop) return
		const onDown = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest?.("[data-pop-root]")) setPop(null)
		}
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPop(null)
		document.addEventListener("mousedown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [pop])

	// After press and hold, the sheet slides in under the finger. The press and click that follow lifting the finger
	// would land on the sheet or on the drawer's backdrop, so they are swallowed.
	const held = pop?.mode === "full"
	useEffect(() => {
		if (!held) return
		let timer: ReturnType<typeof setTimeout> | undefined
		const swallow = (e: Event) => {
			e.stopPropagation()
			e.preventDefault()
		}
		const stop = () => {
			window.removeEventListener("click", swallow, true)
			window.removeEventListener("mousedown", swallow, true)
		}
		const release = () => {
			timer = setTimeout(stop, 350)
		}
		window.addEventListener("click", swallow, true)
		window.addEventListener("mousedown", swallow, true)
		window.addEventListener("pointerup", release, { once: true })
		window.addEventListener("pointercancel", release, { once: true })
		return () => {
			clearTimeout(timer)
			stop()
			window.removeEventListener("pointerup", release)
			window.removeEventListener("pointercancel", release)
		}
	}, [held])

	const popCard = pop ? s.T(pop.key) : undefined
	// The drawer locks page scroll while open, so it only opens where it shows (below md).
	const phone = !!pop && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
	const peekCard = peek != null ? s.T(peek) : undefined
	return (
		<>
			{s.variant === "quick" && <p className="mb-2 text-xs text-gray-400 md:hidden">Press and hold a card for its actions.</p>}
			<div className={DISCOVER_GRID} data-card-grid>
				{cards.map((card) =>
					s.isHidden(card.key) ? (
						<HiddenTile key={card.key} card={card} />
					) : (
						<PCard
							key={card.key}
							card={card}
							pop={pop?.key === card.key ? pop : null}
							setPop={setPop}
							onPeek={() => setPeek(card.key)}
						/>
					),
				)}
			</div>
			{cards.length === 0 && <p className="py-10 text-center text-sm text-gray-400">You hid every title here. Bring them back under Hidden titles.</p>}
			{/* Phones: the same content as the card's popover, in the existing bottom drawer. */}
			<Drawer open={phone} onClose={() => setPop(null)}>
				<div data-pop-root className="p-1">
					{pop && popCard && <PopContent card={popCard} mode={pop.mode} quiet={tile} onClose={() => setPop(null)} sheet />}
				</div>
			</Drawer>
			<PopupOverlay card={peekCard ?? null} onClose={() => setPeek(null)} quiet={tile} />
		</>
	)
}

function PCard({ card, pop, setPop, onPeek }: { card: TitleCard; pop: Pop; setPop: (pop: Pop) => void; onPeek: () => void }) {
	const s = useStore()
	const variant = s.variant
	const ref = useRef<HTMLDivElement>(null)
	const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const held = useRef(false)
	const ratings = extractRatings(card)
	const tile = s.undoStyle === "tile"

	const open = (mode: PopMode) => {
		if (pop?.mode === mode) return setPop(null)
		const rect = ref.current?.getBoundingClientRect()
		const grid = ref.current?.closest("[data-card-grid]")?.getBoundingClientRect()
		const align = !rect || !grid ? "center" : rect.left - grid.left < 90 ? "left" : grid.right - rect.right < 90 ? "right" : "center"
		setPop({ key: card.key, mode, align })
	}
	const cancelPress = () => clearTimeout(press.current)
	const quick = variant === "quick"

	return (
		<div
			ref={ref}
			data-pop-root={pop ? "" : undefined}
			data-card={card.key}
			className={`group relative transition-transform duration-100 hover:scale-100 ${pop ? "z-40 scale-100" : "scale-95"}`}
		>
			<div className="@container flex w-full flex-col rounded-lg border-4 border-gray-800 bg-gray-900 hover:border-amber-700/50 hover:bg-gray-800">
				<a
					href={`/${card.media_type}/${card.tmdb_id}`}
					draggable="false"
					className={`relative block ${quick ? "select-none [-webkit-touch-callout:none]" : ""}`}
					onClick={(e) => {
						e.preventDefault()
						if (held.current) {
							held.current = false
							return
						}
						if (variant === "peek") onPeek()
						else s.say(`Opens ${card.title}'s title page (off in this prototype)`)
					}}
					onContextMenu={quick ? (e) => e.preventDefault() : undefined}
					onPointerDown={
						quick
							? (e) => {
									if (e.pointerType === "mouse") return
									held.current = false
									press.current = setTimeout(() => {
										held.current = true
										open("full")
									}, LONG_PRESS_MS)
								}
							: undefined
					}
					onPointerUp={cancelPress}
					onPointerMove={quick ? (e) => (Math.abs(e.movementX) + Math.abs(e.movementY) > 6 ? cancelPress() : undefined) : undefined}
					onPointerCancel={cancelPress}
					onPointerLeave={cancelPress}
				>
					<UserDataOverlay score={s.scoreOf(card.key)} onWishList={s.isWant(card.key)} />
					<RatingOverlay ratings={ratings}>{typeof card.match === "number" && <TasteMatchPill match={card.match} reasons={card.reasons} />}</RatingOverlay>
					{card.services && (
						<StreamingOverlay
							links={card.services.map((sv) => ({ provider_id: sv.id, provider_name: sv.name, provider_logo_path: sv.logo_path })) as never}
						/>
					)}
					<img
						className="pointer-events-none block aspect-[2/3] w-full rounded-md object-cover"
						src={card.poster_path ? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${card.poster_path}` : undefined}
						alt={`Poster for ${card.title}`}
						draggable="false"
					/>
					<div
						className={`absolute bottom-0 hidden min-h-40 w-full items-end overflow-hidden bg-linear-to-t from-black/70 to-transparent px-2 py-2 group-hover:from-black/90 group-hover:via-90% @6xs:flex ${
							quick ? "md:group-hover:pb-13" : ""
						} ${variant === "menu" ? "pr-13" : ""}`}
					>
						<span className="text-sm font-bold text-white transition-transform duration-200 group-hover:-translate-y-1">
							{card.title}
							{card.release_year ? ` (${card.release_year})` : ""}
						</span>
					</div>
				</a>

				{quick && (
					<div
						className={`absolute inset-x-1.5 bottom-1.5 hidden gap-1 rounded-lg bg-gray-900/90 p-1 md:flex md:group-hover:opacity-100 md:focus-within:opacity-100 ${pop ? "md:opacity-100" : "md:opacity-0"}`}
						data-quick-row
					>
						<ScoreChip card={card} onClick={() => open("score")} />
						<TitleAction card={card} kind="want" label="none" size="sm" />
						<TitleAction card={card} kind="seen" label="none" size="sm" />
						<TitleAction card={card} kind="hide" label="none" size="sm" quiet={tile} />
					</div>
				)}

				{variant === "menu" && (
					<button
						type="button"
						aria-label={`Actions for ${card.title}`}
						aria-expanded={!!pop}
						onClick={() => open("menu")}
						className="absolute bottom-2 right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-gray-700/90 text-white hover:bg-gray-600 focus-visible:outline-2 focus-visible:outline-white"
						data-more
					>
						<EllipsisHorizontalIcon className="h-6 w-6" />
					</button>
				)}

				{variant === "footer-bolder" && (
					<div className="flex gap-1 p-1 pt-1.5" data-card-footer>
						<ScoreChip card={card} onClick={() => open("score")} />
						<TitleAction card={card} kind="want" label="none" size="sm" />
						<TitleAction card={card} kind="seen" label="none" size="sm" />
						<TitleAction card={card} kind="hide" label="none" size="sm" quiet={tile} />
					</div>
				)}
			</div>

			{pop && (
				<div
					className={`absolute z-50 hidden md:block ${pop.mode === "menu" ? `bottom-14 w-64 p-1.5 ${MENU}` : "bottom-14 w-80 rounded-2xl border border-white/10 bg-stone-900 p-4 text-white shadow-2xl shadow-black/70"} ${
						pop.align === "left" ? "left-0" : pop.align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
					}`}
					data-card-pop={pop.mode}
				>
					<PopContent card={card} mode={pop.mode} quiet={tile} onClose={() => setPop(null)} />
				</div>
			)}
		</div>
	)
}

function PopContent({ card, mode, quiet, onClose, sheet = false }: { card: TitleCard; mode: PopMode; quiet: boolean; onClose: () => void; sheet?: boolean }) {
	const heading = (
		<h3 className="mb-3 truncate text-sm font-semibold text-gray-300">
			{card.title}
			{card.release_year ? ` (${card.release_year})` : ""}
		</h3>
	)
	if (mode === "score")
		return (
			<>
				{heading}
				<TitleScore card={card} size={sheet ? "full" : "compact"} narrow onDone={onClose} />
			</>
		)
	if (mode === "full")
		return (
			<>
				{heading}
				<ActionSet card={card} form="full" narrow onHide={onClose} quiet={quiet} />
			</>
		)
	return <CardMenu card={card} quiet={quiet} onClose={onClose} sheet={sheet} />
}

function CardMenu({ card, quiet, onClose, sheet }: { card: TitleCard; quiet: boolean; onClose: () => void; sheet: boolean }) {
	const s = useStore()
	const [rating, setRating] = useState(false)
	const key = card.key
	const score = s.scoreOf(key)
	const seen = s.isSeen(key) || score != null
	const row = (kind: keyof typeof ACTIONS, active: boolean, onClick: () => void, disabled = false) => {
		const a = ACTIONS[kind]
		return (
			<button type="button" role="menuitemcheckbox" aria-checked={active} disabled={disabled} onClick={onClick} className={ITEM}>
				<a.Icon className={`h-4 w-4 shrink-0 ${a.tint}`} />
				<span className="grow">{a.off}</span>
				{active && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.active}`}>On</span>}
			</button>
		)
	}
	return (
		<div role="menu" aria-label={`Actions for ${card.title}`} className="flex flex-col">
			{sheet && <p className="truncate px-3 pb-2 text-sm font-semibold text-gray-300">{card.title}</p>}
			<button type="button" role="menuitem" aria-expanded={rating} onClick={() => setRating(!rating)} className={ITEM}>
				<StarIcon className="h-4 w-4 shrink-0 text-yellow-300" />
				<span className="grow">{score ? `Your score: ${getScoreLabelText(score)}` : "Rate"}</span>
				<span className="text-xs font-normal text-gray-500">{rating ? "Close" : score ? "Change" : "1–10"}</span>
			</button>
			{rating && (
				<div className="px-2 pb-2 pt-1">
					<TitleScore card={card} size="strip" header={score != null} onDone={() => setRating(false)} />
				</div>
			)}
			{row("want", s.isWant(key), () => s.toggleWant(key))}
			{row("seen", s.isSeen(key), () => s.toggleSeen(key))}
			{row(
				"hide",
				false,
				() => {
					s.notInterested(key, quiet)
					onClose()
				},
				seen,
			)}
			<div aria-hidden className="mx-3 my-1 h-px bg-white/10" />
			<button
				type="button"
				role="menuitem"
				className={`${ITEM} font-normal text-gray-400`}
				onClick={() => {
					s.say(`Opens ${card.title}'s title page (off in this prototype)`)
					onClose()
				}}
			>
				Open the title page
			</button>
		</div>
	)
}

/** In place of a card after Not interested, while the undo style is "tile". The look of Discover's closing cell. */
function HiddenTile({ card }: { card: TitleCard }) {
	const s = useStore()
	return (
		<div className="flex aspect-[2/3] scale-95 flex-col justify-center gap-2 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10" data-hidden-tile={card.key}>
			<p className="text-sm font-bold text-white">Hidden from your recommendations</p>
			<p className="line-clamp-2 text-xs text-gray-400">{card.title}</p>
			<button
				type="button"
				onClick={() => s.unhide(card.key)}
				className="mt-1 cursor-pointer self-start rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-amber-300 hover:bg-white/20"
			>
				Undo
			</button>
		</div>
	)
}
