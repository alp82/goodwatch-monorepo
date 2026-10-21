// A title's details: what Watch next and Popular leave out. Its poster and name, its tagline and facts, the
// GoodWatch score with every source score, its synopsis, a short preview of its fingerprint (the headline and the
// two readings that say most, ui/details/fingerprint/standout.ts) that opens all readings, where it streams, and one
// row of keys: Watch (a native link to the service, in a new tab), Trailer, Want to See and Seen it. Its page is the
// title page (the Expand key). The details rise in over the picture as the screen arrives.
//
// The keys and rows are the machine's (`tvItems`): the keys first, then the fingerprint, then Where to watch's
// rows (`offer:<n>`, native links) and its row to all services (`where`). Without a direct offer, Watch says Where
// to watch and opens the title's page. Trailer and Fingerprint are lazy panels with their own history entry; Back
// restores the invoking key. A chunk the TV asks for on first use (screen-code.tsx).
//
// On the phone the title's name and facts stand in the bar at the top, where they stay while the details scroll
// under them with the focus; the keys stand in one row that pages sideways. Every key is a touch target, 44 px or
// more on the phone's screen (`keySize` in kit.tsx).
import { lazy, Suspense } from "react"
import { useProductExposure } from "~/telemetry/useProductAnalytics"
import { composeHeadline } from "~/ui/details/fingerprint/headline"
import { AREA_COLOR } from "~/ui/details/fingerprint/areas"
import { standoutReadings } from "~/ui/details/fingerprint/standout"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { RatingChipRow } from "~/ui/details/hero/RatingChips"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Expand, Frame, Img, Item, backdropSize, keySize, useReport, useTvView } from "../kit"
import { type TvOffer, primaryOffer, whereRows } from "../title-extras"
import {
	type TvTitleOnScreen,
	parseTvTitleKey,
	seenLabel,
	titleKicker,
	wantLabel,
} from "../tv-title"
import { type TvTitleReport, useTvTitle } from "../use-tv-title"

const TitlePanel = lazy(reloadOnStaleChunk(() => import("./TitlePanel")))

/**
 * The title's data: its card, the person's marks and the title's effects (use-tv-title.ts). Draws nothing. The
 * scene mounts it once while the address names a title or its rating, and gets what it holds through `report`.
 * It is in this chunk, so the title's data costs no request of its own and nothing in the page's first view.
 */
export function TitleData({
	report,
	...title
}: Parameters<typeof useTvTitle>[0] & {
	report: (title: TvTitleReport | null) => void
}) {
	const current = useTvTitle(title)
	const ref = current.title ? parseTvTitleKey(current.title.key) : null
	useProductExposure("title opened", current.title?.key ?? null, {
		source: "living_room",
		surface: "title",
		tmdb_id: ref?.tmdbId,
		media_type: ref?.mediaType,
	})
	useReport(report, current)
	return null
}

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string, large: number, small: number) =>
	name.length > 18 ? small : large

const OFFER_KIND: Record<string, string> = {
	flatrate: "Stream",
	flatrate_and_buy: "Stream",
	free: "Free",
	ads: "With ads",
}

/** The analytics a service's link carries: the click is the product event "streaming service clicked". */
function offerData(
	offer: TvOffer,
	on: TvTitleOnScreen,
): Record<string, string | number> | undefined {
	const title = on.title
	if (!title || !on.extras) return undefined
	return {
		"data-product-event": "streaming service clicked",
		"data-provider-id": offer.id,
		"data-tmdb-id": title.tmdb_id,
		"data-media-type": title.media_type,
		"data-country": on.extras.country,
		"data-offer-type": offer.type,
	}
}

/** The fingerprint in short: its headline in one colour, and two readings as a word on a quiet track. */
function Preview({ fingerprint, P }: { fingerprint: F.TitleInput; P: boolean }) {
	const headline = composeHeadline(fingerprint)
		.map((segment) => segment.text)
		.join("")
	const fs = P ? 17 : 18
	return (
		<>
			<span
				className={`line-clamp-2 font-bold leading-[1.12] text-white/90 ${P ? "text-[19px]" : "text-[21px]"}`}
			>
				{headline}
			</span>
			<span className="mt-4 grid" style={{ rowGap: fs * 0.7 }}>
				{standoutReadings(fingerprint).map(({ scale, position, word }) => (
					<span
						key={scale.name}
						role="img"
						aria-label={`${scale.name}: ${word}, between ${scale.left} and ${scale.right}`}
						className="block leading-tight"
						style={{ fontSize: fs }}
					>
						<span className="flex items-baseline justify-between gap-3">
							<span className="text-white/60">{scale.name}</span>
							<span className="whitespace-nowrap font-semibold">{word}</span>
						</span>
						<span
							aria-hidden
							className="relative mt-2 block rounded-full bg-white/[.14]"
							style={{ height: 4 }}
						>
							<span
								className="absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full"
								style={{
									left: `${position * 100}%`,
									width: fs * 0.62,
									height: fs * 0.62,
									background: AREA_COLOR[scale.area],
									boxShadow: "0 0 0 3px rgba(0,0,0,.55)",
								}}
							/>
						</span>
					</span>
				))}
			</span>
		</>
	)
}

function Details({
	items,
	on,
}: {
	items: readonly string[]
	on: TvTitleOnScreen
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const title = on.title
	const extras = on.extras
	const offers = extras?.offers ?? []
	const offer = primaryOffer(offers, on.mine)
	const where = whereRows(offers, on.mine)
	const facts = extras?.facts
	const keyH = keySize(canvas, P ? 50 : 54)
	const rowH = keySize(canvas, 44)
	const name = on.missing
		? "GoodWatch doesn't have this title."
		: (title?.title ?? "")
	const key = (id: string, label: string, extra: string, aria?: string) =>
		items.includes(id) && (
			<Item
				key={id}
				id={id}
				label={aria}
				className={`tvc-btn flex shrink-0 items-center justify-center whitespace-nowrap ${extra} ${P ? "px-5 text-[20px]" : "px-7 text-[23px]"}`}
				style={{ height: keyH }}
			>
				{label}
			</Item>
		)
	const keys = (
		<>
			{items.includes("watch") && (
				<Item
					key="watch"
					id="watch"
					href={offer?.url}
					linkData={offer ? offerData(offer, on) : undefined}
					label={
						offer
							? `Watch on ${offer.name} (opens in a new tab)`
							: "Where to watch, on the title's page"
					}
					className={`tvc-btn tvc-watch flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "px-5 text-[20px]" : "px-7 text-[23px]"}`}
					style={{ height: keyH }}
				>
					{offer ? `Watch on ${offer.name}` : "Where to watch"}
				</Item>
			)}
			{key("trailer", "Trailer", "")}
			{key("want-to-see", wantLabel(on.want), "")}
			{key("seen", seenLabel(on.score, on.seen, on.episode), "")}
		</>
	)
	const fingerprintCard = items.includes("fingerprint") && (
		<Item
			id="fingerprint"
			label="Fingerprint: all readings"
			className="tvc-ring block w-full rounded-[18px]"
		>
			<span
				className={`block rounded-[18px] border border-white/10 bg-black/60 ${P ? "p-3.5" : "p-4"}`}
			>
				<span className="mb-1.5 flex items-center justify-between text-[19px] font-bold">
					<span>Fingerprint</span>
					<span className="text-[17px] font-semibold text-white/55">
						All readings ›
					</span>
				</span>
				{extras?.fingerprint ? (
					<Preview fingerprint={extras.fingerprint} P={P} />
				) : (
					<span className="block text-[18px] text-white/60">
						{extras ? "No fingerprint for this title yet." : "Reading its fingerprint."}
					</span>
				)}
			</span>
		</Item>
	)
	const whereCard = (
		<div
			className={`rounded-[18px] border border-white/10 bg-black/60 ${P ? "p-3.5" : "px-4 py-3.5"}`}
		>
			<div className="mb-2 flex items-center justify-between text-[19px] font-bold">
				<span>Where to watch</span>
				{extras && (
					<span className="text-[15px] font-semibold text-white/45">
						{extras.country} · opens the service
					</span>
				)}
			</div>
			<div className="grid gap-1.5">
				{where.rows.map((o, i) =>
					items.includes(`offer:${i}`) ? (
						<Item
							key={`${o.id}-${o.type}`}
							id={`offer:${i}`}
							href={o.url}
							linkData={offerData(o, on)}
							label={`${o.name}: ${OFFER_KIND[o.type] ?? o.type} (opens in a new tab)`}
							className="tvc-ring flex w-full items-center gap-3 rounded-[10px] bg-white/[.06] pr-3 text-[18px]"
							style={{ height: rowH }}
						>
							{o.logo ? (
								<Img
									src={tmdbImageUrl(o.logo, "w92")}
									className="h-full shrink-0 rounded-[10px]"
									width={92}
									height={92}
								/>
							) : (
								<span className="w-2" />
							)}
							<span className="truncate font-semibold">{o.name}</span>
							<span className="ml-auto text-[15px] text-white/55">
								{OFFER_KIND[o.type] ?? o.type}
							</span>
						</Item>
					) : null,
				)}
				{items.includes("where") && (
					<Item
						id="where"
						className="tvc-ring flex w-full items-center justify-center gap-2 rounded-[10px] px-2 text-[17px] font-semibold text-white/75"
						style={{ height: rowH }}
					>
						{where.rows.length
							? "All services, rent and buy ›"
							: "Not streaming here · rent or buy ›"}
					</Item>
				)}
				{!extras && (
					<span className="text-[17px] text-white/55">
						{on.extrasFailed ? "Where it streams isn't available right now." : "Looking for where it streams."}
					</span>
				)}
			</div>
		</div>
	)
	const chips = facts && (
		<span className={`block origin-left ${P ? "[zoom:1.25]" : "[zoom:1.6]"}`}>
			<RatingChipRow {...facts.scores} />
		</span>
	)
	const ring = title && (
		<ScoreRing
			media={{ details: title }}
			size={P ? 44 : 54}
			label={!P}
		/>
	)
	const kind = title ? titleKicker(title) : ""
	const backdrop = title?.backdrop_path
		? tmdbImageUrl(title.backdrop_path, backdropSize(canvas))
		: undefined
	const lang = mediaFieldLanguage(title)

	if (P)
		return (
			<Frame name={name} crumb={kind} items={items} art={backdrop} dim={0.72} inlineExpand>
				<div data-tv-scroll className="h-full overflow-y-auto [scrollbar-width:none]">
					<div className="tvc-rise grid gap-3 pb-4">
						<div data-tv-row className="-mx-1.5 flex gap-2.5 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none]">
							{keys}
						</div>
						{fingerprintCard}
						<div className="flex items-center gap-3">
							{ring}
							{chips}
						</div>
						{facts?.synopsis && (
							<p className="line-clamp-4 text-[17px] leading-snug text-white/80">
								{facts.synopsis}
							</p>
						)}
						{whereCard}
						{/* Inline at the end, so it never covers the details on a short phone. */}
						{items.includes("expand") && (
							<div className="flex justify-end">
								<Expand />
							</div>
						)}
					</div>
				</div>
			</Frame>
		)
	return (
		<Frame
			name={title?.media_type === "show" ? "Show" : "Movie"}
			items={items}
			art={backdrop}
			dim={0.55}
		>
			{/* The keys first, as in `tvItems`: they stand at the bottom left, under the details. */}
			<div className="absolute bottom-[40px] left-14 flex items-center gap-3.5">{keys}</div>
			<div className="tvc-rise absolute left-14 top-0 w-[620px]">
				<div className="flex items-end gap-6">
					{title?.poster_path && (
						<Img
							src={tmdbImageUrl(title.poster_path, "w342")}
							className="h-[231px] w-[154px] shrink-0 rounded-[14px] shadow-[0_18px_40px_rgba(0,0,0,.6)]"
						/>
					)}
					<div className="min-w-0 flex-1 pb-1">
						<div className="text-[19px] font-semibold text-white/70">{kind}</div>
						<div
							{...mediaTextAttributes(lang)}
							className="mt-1 line-clamp-2 font-extrabold leading-[1.05] tracking-tight [text-wrap:balance]"
							style={{ fontSize: nameSize(name, 48, 40) }}
						>
							{name}
						</div>
						{title?.tagline && (
							<div
								{...mediaTextAttributes(mediaFieldLanguage(title, "tagline"))}
								className="mt-1 line-clamp-1 text-[19px] italic text-white/65"
							>
								{title.tagline}
							</div>
						)}
						{facts?.genres.length ? (
							<div className="mt-2 truncate text-[19px] text-white/80">
								{facts.genres.slice(0, 3).join(", ")}
							</div>
						) : null}
					</div>
				</div>
				<div className="mt-5 flex h-[56px] items-center gap-6 text-[18px]">
					{ring}
					{chips}
				</div>
				{facts?.synopsis && (
					<p className="mt-4 line-clamp-4 text-[19px] leading-[1.45] text-white/80">
						{facts.synopsis}
					</p>
				)}
			</div>
			<div className="tvc-rise absolute right-14 top-[4px] grid w-[430px] gap-3.5">
				{fingerprintCard}
				{whereCard}
			</div>
		</Frame>
	)
}

export default function Title({
	items,
	title: on,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvTitleOnScreen
}) {
	if (on.panel)
		return (
			<Suspense
				fallback={
					<Frame
						name={on.panel === "trailer" ? "Trailer" : "Fingerprint"}
						items={items}
					>
						<p className="text-[26px]">Loading…</p>
						<Item id="close" className="tvc-btn px-6 py-3 text-[24px]">
							Close
						</Item>
					</Frame>
				}
			>
				<TitlePanel title={on} items={items} />
			</Suspense>
		)
	return <Details items={items} on={on} />
}
