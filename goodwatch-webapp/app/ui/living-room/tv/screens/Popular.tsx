// Popular: browsing, not a decision. A wall of the member's Popular titles (server/living-room/tv-popular.server.ts:
// the catalog's popularity order with their hidden, seen, skipped and Wishlist titles left out, their services
// first), and beside it the poster with the focus, named, with Trailer and Details right there. The wall keeps the
// row's own order and shows no ranks. Its page is Discover (the Expand key).
//
// The poster with the focus is the one named, and the address names it (tv-machine.ts, `showPick`), so Back from
// its details finds it again. On the phone the wall shows a page of five posters at a time, with an arrow to either
// side; nothing scrolls. A chunk the TV asks for on first use (screen-code.tsx).
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Ambient,
	CornerBar,
	Expand,
	ExpandCorner,
	Img,
	Item,
	PHONE_FOOT,
	PHONE_HEAD,
	PHONE_SIDE,
	PageArrow,
	PageCount,
	TrailerKey,
	backdropSize,
	keySize,
	phoneFit,
	usePage,
	useTvView,
} from "../kit"
import type { TvHomeData } from "../tv-home"
import { pickFacts } from "../tv-title"
import { StreamLine } from "./Tonight"

/** Where the wall's titles come from, in the row's own words (tv-popular.server.ts, `scope`). */
const SOURCE: Record<string, string> = {
	services: "On your services",
	mixed: "Your services first",
	unknown: "Popular on GoodWatch",
	all: "Popular on GoodWatch",
}

export default function Popular({
	items,
	popular,
	pick,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	popular?: TvHomeData["popular"]
	/** The poster named beside the wall, as the URL counts it. */
	pick: number
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const titles = (popular?.titles ?? []).slice(
		0,
		items.filter((id) => id.startsWith("pick:")).length,
	)
	const at = titles.length ? pick % titles.length : 0
	const shown = titles[at]
	const h = keySize(canvas, P ? 54 : 52)
	const ids = titles.map((_, i) => `pick:${i}`)
	// Five posters a page upright, up to eight on a phone's wide canvas; the page holds the pick the address names,
	// so Back from Details comes back to it.
	const page = usePage(ids, phoneFit(canvas, 5, 60, 8), `pick:${at}`)
	if (!shown)
		return (
			<>
				<div className="absolute inset-0 bg-[#0b0d13]" />
				<div
					className={`absolute inset-0 flex flex-col justify-center text-white/70 ${P ? "px-5 pt-[84px] text-[21px]" : "px-14 pt-16 text-[28px]"}`}
				>
					{popular?.failed
						? "Popular titles aren't available right now."
						: "Nothing popular to show right now."}
				</div>
				<ExpandCorner items={items} />
				<CornerBar items={items} />
			</>
		)
	const posters = titles.map((card, i) => (
		<Item
			key={card.key}
			id={`pick:${i}`}
			label={card.title}
			className={`tvc-ring tvc-lift block aspect-[2/3] overflow-hidden bg-[#161a24] ${P ? "h-[78px] shrink-0 rounded-[8px]" : "w-full rounded-[12px]"}`}
		>
			{card.poster_path && (
				<Img
					src={tmdbImageUrl(card.poster_path, P ? "w185" : "w342")}
					className="absolute inset-0 h-full w-full"
				/>
			)}
		</Item>
	))
	const keyClass = `tvc-btn flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "px-4 text-[19px]" : "px-6 text-[23px]"}`
	const trailer = items.includes("trailer") && (
		<TrailerKey height={h} says={`Trailer: ${shown.title}`} />
	)
	const details = items.includes("details") && (
		<Item
			id="details"
			label={`Details: ${shown.title}`}
			className={keyClass}
			style={{ height: h }}
		>
			Details
		</Item>
	)
	const ring = { media: { details: shown } }
	const backdrop = shown.backdrop_path
		? tmdbImageUrl(shown.backdrop_path, backdropSize(canvas))
		: null
	const shade = (
		<div
			className="absolute inset-0"
			style={{ background: "linear-gradient(0deg, rgba(7,8,12,.94), rgba(7,8,12,.72))" }}
		/>
	)
	if (P) {
		// The phone: the poster named over a page of the wall, its keys and the way to Discover under it.
		const posterH = 78
		return (
			<>
				{backdrop && <Ambient src={backdrop} />}
				{shade}
				<div
					className="absolute inset-x-0 bottom-0 flex flex-col justify-end gap-1.5"
					style={{ top: PHONE_HEAD, paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
				>
					<div className="flex items-end gap-3">
						<div className="min-w-0 flex-1">
							<div
								className="truncate font-extrabold leading-[1.15] tracking-tight"
								style={{ fontSize: shown.title.length > 30 ? 18 : shown.title.length > 22 ? 21 : 24 }}
							>
								{shown.title}
							</div>
							<div className="mt-0.5 flex items-center gap-2 text-[16px] leading-tight text-white/75">
								<ScoreRing {...ring} size={24} label={false} />
								<span className="truncate">{pickFacts({ card: shown })}</span>
							</div>
						</div>
						<PageCount page={page.page} pages={page.pages} className="pb-0.5" />
					</div>
					<div className="flex items-center gap-2" style={{ height: posterH }}>
						<PageArrow to={page.prev} dir="prev" label="Previous posters" size={Math.min(h, posterH)} />
						<div className="flex min-w-0 flex-1 justify-center gap-2">
							{page.shown.map((id) => posters[Number(id.slice(5))])}
						</div>
						<PageArrow to={page.next} dir="next" label="More posters" size={Math.min(h, posterH)} />
					</div>
					<div className="flex items-center gap-2" style={{ height: h }}>
						{trailer}
						{details}
						<span className="flex-1" />
						{items.includes("expand") && <Expand />}
					</div>
				</div>
				<CornerBar items={items} />
			</>
		)
	}
	return (
		<>
			{backdrop && <Ambient src={backdrop} />}
			{shade}
			<div className="absolute left-14 top-[108px] w-[720px]">
				<div className="grid grid-cols-5 gap-4">{posters}</div>
			</div>
			<div className="absolute right-12 top-[108px] w-[330px]">
				<div className="text-[17px] font-bold uppercase tracking-[.14em] text-white/55">
					{SOURCE[popular?.scope ?? "all"] ?? SOURCE.all}
				</div>
				<div className="mt-2 flex h-[84px] items-end">
					<div className="line-clamp-2 text-[36px] font-extrabold leading-[1.1] tracking-tight">
						{shown.title}
					</div>
				</div>
				<div className="mt-2 line-clamp-2 h-[50px] text-[19px] leading-snug text-white/75">
					{pickFacts({ card: shown })}
				</div>
				<div className="mt-3">
					<ScoreRing {...ring} size={52} />
				</div>
				<div className="mt-4 h-[32px] text-[19px]">
					<StreamLine services={shown.services} size={30} />
				</div>
				<div className="mt-6 flex items-center gap-3">
					{trailer}
					{details}
				</div>
			</div>
			<ExpandCorner items={items} />
			<CornerBar items={items} />
		</>
	)
}
