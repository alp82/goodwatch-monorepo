// Popular: browsing, not a decision. A wall of the member's Popular titles (server/living-room/tv-popular.server.ts:
// the catalog's popularity order with their hidden, seen, skipped and Wishlist titles left out, their services
// first), and beside it the poster with the focus, named, with Trailer and Details right there. The wall keeps the
// row's own order and shows no ranks. Its page is Discover (the Expand key).
//
// The poster with the focus is the one named, and the address names it (tv-machine.ts, `showPick`), so Back from
// its details finds it again. A chunk the TV asks for on first use (screen-code.tsx).
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Ambient, CornerBar, Expand, ExpandCorner, Img, Item, backdropSize, keySize, useTvView } from "../kit"
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
	const h = keySize(canvas, P ? 50 : 52)
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
			className="tvc-ring tvc-lift block aspect-[2/3] w-full overflow-hidden rounded-[12px] bg-[#161a24]"
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
		<Item
			id="trailer"
			label={`Trailer: ${shown.title}`}
			className={keyClass}
			style={{ height: h }}
		>
			Trailer
		</Item>
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
	if (P)
		return (
			<>
				{backdrop && <Ambient src={backdrop} />}
				{shade}
				<div
					data-tv-scroll
					className="absolute inset-x-0 bottom-0 overflow-hidden px-3 pt-1.5"
					style={{ top: 78 + h + 12 }}
				>
					<div className="grid grid-cols-5 gap-2">{posters}</div>
					<div className="flex justify-end pb-4 pt-3">
						{items.includes("expand") && <Expand />}
					</div>
				</div>
				{/* The title with the focus stays named at the top while the wall scrolls under it. After the wall in the
				    markup, as in `tvItems`: the posters come first in reading order. */}
				<div
					className="absolute inset-x-3 top-[78px] z-10 flex items-center gap-2.5"
					style={{ height: h + 8 }}
				>
					<div className="min-w-0 flex-1 px-1">
						<div className="truncate text-[22px] font-extrabold leading-tight">
							{shown.title}
						</div>
						<div className="flex items-center gap-2 text-[15px] text-white/70">
							<ScoreRing {...ring} size={24} label={false} />
							<span className="truncate">{pickFacts({ card: shown })}</span>
						</div>
					</div>
					{trailer}
					{details}
				</div>
				<CornerBar items={items} />
			</>
		)
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
