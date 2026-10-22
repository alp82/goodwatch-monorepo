// Start: a member's home on the TV. Watch next is the big tile, a selection of the member's own picks (their posters
// fanned, the next one first); beside it a tile each for Popular, Discover, Search and Taste, and under them Your
// taste and What is GoodWatch?. Every tile opens a TV screen; nothing here leaves the TV. The white G of the
// navigation and the Remote's Home key come back here.
//
// The headline stays the start page's H1 for the page's outline (`HomeHeading`), read out but not drawn: Start's
// tiles say what the TV offers.
//
// On the phone Start is two pages, nothing scrolls: Watch next and a tile each for Popular, Discover, Search and
// Taste, then (by the arrow) Your taste, My shows and What is GoodWatch?.
import { useContext, useRef } from "react"
// A file of its own, not inlined into the script: Start is a member's home, and an inlined copy, shared with the
// title page's, became a script that every guest's start page and every title page loaded.
import fingerprintIcon from "~/img/fingerprint-72.webp?no-inline"
import { AREAS, AREA_COLOR } from "~/ui/details/fingerprint/area-colors"
import { assetUrl } from "~/utils/asset-url"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	CornerBar,
	Img,
	Item,
	PHONE_FOOT,
	PHONE_HEAD,
	PHONE_SIDE,
	PageArrow,
	jumpItem,
	keySize,
	useTvView,
} from "../kit"
import type { TvHomeData, TvTonightPick } from "../tv-home"
import { HOME_HEADLINE, HomeHeading } from "./Home"

/** The six moods of the TV's Discover, by their colours. */
const MOOD_HUES = ["#facc15", "#f472b6", "#fb7185", "#fb923c", "#f87171", "#a78bfa"]

/** A selection, not one title: the picks' posters fanned in a shallow arc, the next one first and outlined. */
function PosterFan({
	posters,
	width,
	step,
	top,
}: { posters: readonly string[]; width: number; step: number; top: number }) {
	const n = posters.length
	const mid = (n - 1) / 2
	const total = width + (n - 1) * step
	return (
		<span
			aria-hidden
			className="absolute inset-x-0"
			style={{ top, height: width * 1.5 + 20 }}
		>
			{posters.map((path, i) => (
				<span
					key={path}
					className={`absolute overflow-hidden rounded-[10px] bg-[#161a24] shadow-[0_12px_30px_rgba(0,0,0,.6)] ${i === 0 ? "ring-2 ring-amber-400" : "ring-1 ring-black/40"}`}
					style={{
						width,
						height: width * 1.5,
						left: `calc(50% - ${total / 2}px + ${i * step}px)`,
						top: (i - mid) ** 2 * 2.2,
						transform: `rotate(${(i - mid) * 2.5}deg)`,
						zIndex: n - i,
					}}
				>
					<Img src={tmdbImageUrl(path, "w185")} className="h-full w-full" />
				</span>
			))}
		</span>
	)
}

/** The phone's second page of Start. */
const SECOND = ["start:taste", "start:shows", "start:about"]

export function Start({
	picks,
	popular,
	waiting,
	failed = false,
	items,
	signal,
}: {
	/** My shows' New episodes signal, on its key. */
	signal?: { badge: string; label: string }
	/** Watch next's picks, the next one first. */
	picks: readonly TvTonightPick[]
	popular?: TvHomeData["popular"]
	/** The picks are still on their way. */
	waiting: boolean
	/** The picks couldn't be read: not the same as an empty Wishlist. */
	failed?: boolean
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const Heading = useContext(HomeHeading)
	// The phone's page: the one with the focus, else the one shown last.
	const lastPage = useRef(0)
	if (SECOND.includes(focused)) lastPage.current = 1
	else if (focused.startsWith("start:")) lastPage.current = 0
	const posters = picks
		.map((pick) => pick.card.poster_path)
		.filter((path): path is string => Boolean(path))
		.slice(0, P ? 5 : 6)
	const next = picks[0]?.card
	const tileHeight = P ? 93 : 192

	const hero = (
		<Item
			id="start:tonight"
			label={
				next
					? `Watch next: ${picks.length} picks, ${next.title} first`
					: "Watch next"
			}
			className="tvc-ring tvc-lift block h-full w-full rounded-[26px]"
		>
			<span className="absolute inset-0 overflow-hidden rounded-[26px] border border-white/[.08] bg-[#151821]">
				{next?.backdrop_path && (
					<Img
						src={tmdbImageUrl(next.backdrop_path, "w780")}
						className="absolute inset-0 h-full w-full opacity-30"
					/>
				)}
				<span className="absolute inset-0 bg-gradient-to-t from-[#0b0d13] via-[#0b0d13]/75 to-[#0b0d13]/35" />
				{posters.length > 0 && (
					<PosterFan
						posters={posters}
						width={P ? 50 : 116}
						step={P ? 29 : 86}
						top={P ? 12 : 30}
					/>
				)}
				<span className={`absolute inset-x-0 bottom-0 ${P ? "px-3 pb-2.5" : "px-7 pb-6"}`}>
					<span
						className={`block font-extrabold leading-none tracking-tight ${P ? "text-[25px]" : "text-[50px]"}`}
					>
						Watch next
					</span>
					<span
						className={`mt-1.5 block text-white/75 ${P ? "text-[16px] leading-tight" : "truncate text-[20px]"}`}
					>
						{next && P ? (
							<>
								{picks.length} {picks.length === 1 ? "pick" : "picks"} for you
								<span className="block truncate text-amber-300">{next.title}</span>
							</>
						) : next ? (
							<>
								{picks.length} {picks.length === 1 ? "pick" : "picks"} for you ·{" "}
								<span className="text-amber-300">{next.title}</span> is up next
							</>
						) : waiting ? (
							"Your picks are on their way."
						) : failed ? (
							"Your picks couldn't load. Try again in a moment."
						) : (
							"Add titles with Want to See, and they show here."
						)}
					</span>
				</span>
			</span>
		</Item>
	)

	const tile = (id: string, name: string, line: string, art: React.ReactNode) =>
		items.includes(id) && (
			<Item
				key={id}
				id={id}
				className={`tvc-ring tvc-lift block w-full ${P ? "rounded-[16px]" : "rounded-[22px]"}`}
				style={{ height: tileHeight }}
			>
				<span className={`absolute inset-0 overflow-hidden border border-white/[.08] bg-[#151821] ${P ? "rounded-[16px]" : "rounded-[22px]"}`}>
					{art}
					<span className={`absolute inset-x-0 bottom-0 ${P ? "px-2.5 pb-2" : "p-5"}`}>
						<span
							className={`block font-extrabold leading-tight tracking-tight ${P ? "text-[19px]" : "text-[28px]"}`}
						>
							{name}
						</span>
						<span
							className={`block truncate text-white/65 ${P ? "sr-only" : "text-[18px]"}`}
						>
							{line}
						</span>
					</span>
				</span>
			</Item>
		)

	const popularPosters = (popular?.titles ?? [])
		.map((card) => card.poster_path)
		.filter((path): path is string => Boolean(path))
		.slice(0, 3)
	const tiles = [
		tile(
			"start:popular",
			"Popular",
			"Titles many people watch",
			// On the phone's shorter tile the fan is smaller, so it ends above the tile's name.
			<span aria-hidden className={`absolute flex ${P ? "right-2 top-2" : "right-4 top-4"}`}>
				{popularPosters.map((path, i) => (
					<span
						key={path}
						className={`relative overflow-hidden rounded-lg shadow-xl ring-2 ring-[#151821] ${P ? "-ml-4 h-[40px] w-[27px]" : "-ml-8 h-[96px] w-[64px]"}`}
						style={{ transform: `rotate(${(i - 1) * 7}deg)`, zIndex: 3 - i }}
					>
						<Img src={tmdbImageUrl(path, "w154")} className="h-full w-full" />
					</span>
				))}
			</span>,
		),
		tile(
			"start:discover",
			"Discover",
			"Moods, themes and styles",
			<span aria-hidden className={`absolute flex flex-wrap ${P ? "left-2.5 top-3 gap-1" : "left-5 top-5 gap-1.5"}`}>
				{MOOD_HUES.map((hue) => (
					<span key={hue} className={`rounded-full ${P ? "h-[10px] w-[10px]" : "h-5 w-5"}`} style={{ background: hue }} />
				))}
			</span>,
		),
		tile(
			"start:search",
			"Search",
			"Titles, moods or a year",
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				className={`absolute text-white/20 ${P ? "right-2 top-2 h-[40px] w-[40px]" : "right-5 top-4 h-[84px] w-[84px]"}`}
			>
				<path
					fill="currentColor"
					d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
				/>
			</svg>,
		),
		tile(
			"start:quiz",
			"Taste",
			"Score what you've seen",
			// The site's fingerprint mark (the title page's Fingerprint heading) over the areas' colours.
			<span aria-hidden className={`absolute flex items-start ${P ? "inset-x-2.5 top-2 gap-2" : "inset-x-5 top-5 gap-3"}`}>
				{/* The areas' colours: a small accent beside the mark, three by two (on the desktop a fifth smaller than
				    they were, the owner, 2026-10-22; the phone's are small already). */}
				<span className={`mt-1.5 grid min-w-0 flex-1 grid-cols-3 ${P ? "auto-rows-[8px] gap-1" : "max-w-[78%] auto-rows-[9px] gap-[5px]"}`}>
					{AREAS.map((area) => (
						<span
							key={area}
							className="rounded-sm"
							style={{ background: AREA_COLOR[area] }}
						/>
					))}
				</span>
				<img
					src={assetUrl(fingerprintIcon)}
					alt=""
					draggable={false}
					className={`shrink-0 ${P ? "h-[38px] w-[38px]" : "h-[72px] w-[72px]"}`}
				/>
			</span>,
		),
	]

	const more = (
		<div className={`flex items-center ${P ? "min-w-0 flex-1 gap-2" : "gap-3"}`}>
			{[
				{ id: "start:taste", label: "Your taste", d: "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z" },
				{
					id: "start:shows",
					label: "My shows",
					d: "M21 6h-7.6l3.3-3.3-.7-.7L12 6 8 2l-.7.7L10.6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm0 13H3V8h18v11Z",
				},
				{
					id: "start:about",
					label: "What is GoodWatch?",
					d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z",
				},
			]
				.filter((key) => items.includes(key.id))
				.map((key) => (
					<Item
						key={key.id}
						id={key.id}
						className={`tvc-btn flex items-center ${P ? "min-w-0 flex-1 flex-col justify-center gap-2 rounded-[16px] px-2 text-center text-[19px] leading-tight" : "h-[50px] gap-2 px-5 text-[19px]"}`}
						style={P ? { height: 120 } : undefined}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24" className={P ? "h-7 w-7 opacity-70" : "h-5 w-5 opacity-70"}>
							<path fill="currentColor" d={key.d} />
						</svg>
						{key.label}
						{key.id === "start:shows" && signal && (
							<>
								<span
									aria-hidden
									className="ml-1 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-sky-300 px-1.5 text-[16px] font-bold leading-none text-black"
								>
									{signal.badge}
								</span>
								<span className="sr-only">{signal.label}</span>
							</>
						)}
					</Item>
				))}
		</div>
	)

	return (
		<>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(120% 90% at 20% 10%, #1a1e2a 0%, #0b0d13 60%, #07080c 100%)",
				}}
			/>
			<Heading className="sr-only">{HOME_HEADLINE}</Heading>
			{P ? (
				<PhonePages page={lastPage.current} items={items} hero={hero} tiles={tiles} more={more} />
			) : (
				<div className="absolute inset-x-12 top-[104px]">
					<div className="grid h-[404px] grid-cols-[1.18fr_1fr] gap-5">
						{hero}
						<div className="grid grid-cols-2 gap-5">{tiles}</div>
					</div>
					<div className="mt-6">{more}</div>
				</div>
			)}
			{/* Last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}

/**
 * The phone's Start, one page at a time: Watch next and four tiles, then the other three keys. The arrow moves the
 * focus to the other page's first key (or last, going back), and the page follows the focus.
 */
function PhonePages({
	page,
	items,
	hero,
	tiles,
	more,
}: {
	page: number
	items: readonly string[]
	hero: React.ReactNode
	tiles: React.ReactNode
	more: React.ReactNode
}) {
	const { canvas } = useTvView()
	const second = SECOND.filter((id) => items.includes(id))
	const first = items.filter((id) => id.startsWith("start:") && !SECOND.includes(id))
	const arrow = keySize(canvas, 54)
	return (
		<div
			className="absolute inset-x-0 bottom-0 flex items-center gap-2"
			style={{ top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
		>
			{page === 0 || !second.length ? (
				<>
					<div className="h-full w-[176px] shrink-0">{hero}</div>
					<div className="grid min-w-0 flex-1 grid-cols-2 gap-2">{tiles}</div>
					{second.length > 0 && (
						<PageArrow to={jumpItem(second[0])} dir="next" label="More: Your taste, My shows, What is GoodWatch?" size={arrow} />
					)}
				</>
			) : (
				<>
					<PageArrow to={jumpItem(first[first.length - 1])} dir="prev" label="Back to Watch next and the screens" size={arrow} />
					{more}
				</>
			)}
		</div>
	)
}
