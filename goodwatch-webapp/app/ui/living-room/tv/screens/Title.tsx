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
// On the phone the details are three sections, one at a time and none scrolls (the owner, 2026-10-22): the
// overview (the name in the header, the score, the facts, a short synopsis and the keys), Where to watch (its rows,
// a page at a time) and the fingerprint (the headline, and each group's readings). Each starts with the sections'
// keys; each is a step of its own, so Back returns to the overview (tv-machine.ts, `section`). Every key is a touch
// target, 44 px or more on the phone's screen (`keySize` in kit.tsx).
import { Suspense, lazy } from "react"
import { useTitleOpened } from "~/hooks/useTitleOpened"
import { useProductExposure } from "~/telemetry/useProductAnalytics"
import { AREA_COLOR } from "~/ui/details/fingerprint/areas"
import { composeHeadline } from "~/ui/details/fingerprint/headline"
import { SCALE_GROUPS, readScale } from "~/ui/details/fingerprint/scales"
import { standoutReadings } from "~/ui/details/fingerprint/standout"
import { RatingChipRow } from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Expand,
	Frame,
	Img,
	Item,
	PageArrow,
	PageCount,
	Tab,
	TrailerKey,
	backdropSize,
	keySize,
	phoneSpan,
	useListAnchor,
	usePage,
	usePhone,
	useReport,
	useTvView,
} from "../kit"
import { type TvOffer, primaryOffer, whereRows } from "../title-extras"
import {
	type TvTitleOnScreen,
	parseTvTitleKey,
	seenLabel,
	titleKicker,
	wantLabel,
} from "../tv-title"
import { type TvTitleReport, useTvTitle } from "../use-tv-title"
import { shortSynopsis } from "./short-synopsis"

const TitlePanel = lazy(reloadOnStaleChunk(() => import("./TitlePanel")))

/**
 * The title's data: its card, the person's marks and the title's effects (use-tv-title.ts). Draws nothing. The
 * scene mounts it once while the address names a title or its rating, and gets what it holds through `report`.
 * It is in this chunk, so the title's data costs no request of its own and nothing in the page's first view.
 */
export function TitleData({
	report,
	active,
	...title
}: Parameters<typeof useTvTitle>[0] & {
	report: (title: TvTitleReport | null) => void
	active: boolean
}) {
	const current = useTvTitle(title)
	const ref = current.title ? parseTvTitleKey(current.title.key) : null
	useTitleOpened(ref?.mediaType, ref?.tmdbId, active, ".tvc")
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
function Preview({
	fingerprint,
	P,
}: { fingerprint: F.TitleInput; P: boolean }) {
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
			{items.includes("trailer") && <TrailerKey height={keyH} />}
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
						{extras
							? "No fingerprint for this title yet."
							: "Reading its fingerprint."}
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
						{on.extrasFailed
							? "Where it streams isn't available right now."
							: "Looking for where it streams."}
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
		<ScoreRing media={{ details: title }} size={P ? 44 : 54} label={!P} />
	)
	const kind = title ? titleKicker(title) : ""
	const backdrop = title?.backdrop_path
		? tmdbImageUrl(title.backdrop_path, backdropSize(canvas))
		: undefined
	const lang = mediaFieldLanguage(title)

	if (P) return <PhoneDetails items={items} on={on} />
	return (
		<Frame
			name={title?.media_type === "show" ? "Show" : "Movie"}
			items={items}
			art={backdrop}
			dim={0.55}
		>
			{/* The keys first, as in `tvItems`: they stand at the bottom left, under the details. */}
			<div className="absolute bottom-[40px] left-14 flex items-center gap-3.5">
				{keys}
			</div>
			<div className="tvc-rise absolute left-14 top-0 w-[620px]">
				<div className="flex items-end gap-6">
					{title?.poster_path && (
						<Img
							src={tmdbImageUrl(title.poster_path, "w342")}
							className="h-[231px] w-[154px] shrink-0 rounded-[14px] shadow-[0_18px_40px_rgba(0,0,0,.6)]"
						/>
					)}
					<div className="min-w-0 flex-1 pb-1">
						<div className="text-[19px] font-semibold text-white/70">
							{kind}
						</div>
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
	const P = usePhone()
	// The phone's sections are drawn here; the trailer is a panel on both editions.
	if (P && on.panel !== "trailer") return <PhoneDetails items={items} on={on} />
	// The desktop has no Where to watch section: its overview holds the offers. A phone's section on a window that
	// grew past a phone's (or a link to it) shows the overview, its address kept, so Back keeps its meaning.
	if (on.panel && on.panel !== "watch")
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

// ---------------------------------------------------------------------------------------------------------
// The phone: three sections.

const SECTION_WORDS: Record<string, string> = {
	"section:watch": "Watch",
	fingerprint: "Fingerprint",
}

/**
 * The overview's keys to the other two sections, and the Expand key to the title's page: words, not pills, so the
 * overview's own keys stay the strongest (2026-10-22). In a section the header's Back returns here.
 */
function SectionLinks({ items, end }: { items: readonly string[]; end?: React.ReactNode }) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			{Object.keys(SECTION_WORDS)
				.filter((id) => items.includes(id))
				.map((id) => (
					<Tab key={id} id={id} on={false} label={SECTION_WORDS[id]}>
						{SECTION_WORDS[id]}
						<span aria-hidden className="ml-1.5 text-white/45">
							›
						</span>
					</Tab>
				))}
			{end && <div className="ml-auto">{end}</div>}
		</div>
	)
}

/** A section's name over its content, as a quiet label: the header has its Back. */
function SectionName({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
	return (
		<div className="flex shrink-0 items-center gap-3 text-[15px] font-bold uppercase tracking-[0.14em] text-white/60">
			{children}
			{end}
		</div>
	)
}

function PhoneDetails({
	items,
	on,
}: { items: readonly string[]; on: TvTitleOnScreen }) {
	const { canvas } = useTvView()
	const title = on.title
	const name = on.missing ? "Not on GoodWatch" : (title?.title ?? "")
	const backdrop = title?.backdrop_path
		? tmdbImageUrl(title.backdrop_path, backdropSize(canvas))
		: undefined
	const section =
		on.panel === "watch"
			? "watch"
			: on.panel === "fingerprint"
				? "fingerprint"
				: "overview"
	return (
		<Frame name={name} items={items} art={backdrop} dim={0.82} inlineExpand>
			<div className="flex h-full flex-col gap-1.5">
				{section === "watch" ? (
					<WatchSection items={items} on={on} />
				) : section === "fingerprint" ? (
					<FingerprintSection items={items} on={on} />
				) : (
					<Overview items={items} on={on} />
				)}
			</div>
		</Frame>
	)
}

function Overview({
	items,
	on,
}: { items: readonly string[]; on: TvTitleOnScreen }) {
	const { canvas } = useTvView()
	const title = on.title
	const extras = on.extras
	const offer = primaryOffer(extras?.offers ?? [], on.mine)
	const keyH = keySize(canvas, 54)
	const synopsis = extras?.facts?.synopsis
	const key = (id: string, label: string, aria?: string) =>
		items.includes(id) && (
			<Item
				key={id}
				id={id}
				label={aria}
				className="tvc-btn flex shrink-0 items-center justify-center whitespace-nowrap px-3 text-[17px]"
				style={{ height: keyH }}
			>
				{label}
			</Item>
		)
	return (
		<>
			<SectionLinks
				items={items}
				end={items.includes("expand") && <Expand compact />}
			/>
			<div className="tvc-rise flex min-h-0 flex-1 flex-col justify-center">
				<div className="flex h-[20px] items-center gap-2 text-[17px] leading-[20px] text-white/85">
					{title && (
						<ScoreRing media={{ details: title }} size={24} label={false} />
					)}
					<span className="whitespace-nowrap">
						{title ? titleKicker(title) : ""}
					</span>
				</div>
				{synopsis ? (
					<p
						{...mediaTextAttributes(mediaFieldLanguage(title, "overview"))}
						className="mt-0.5 line-clamp-2 text-[17px] leading-[19px] text-white/80"
					>
						{shortSynopsis(synopsis)}
					</p>
				) : (
					!extras && (
						<p className="mt-1 text-[17px] leading-[20px] text-white/60">
							{on.extrasFailed
								? "Details aren't available right now."
								: "Reading the details."}
						</p>
					)
				)}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{items.includes("watch") && (
					<Item
						key="watch"
						id="watch"
						href={offer?.url}
						linkData={offer ? offerData(offer, on) : undefined}
						label={
							offer
								? `Watch on ${offer.name} (opens in a new tab)`
								: "Watch: where it streams, on the title's page"
						}
						className="tvc-btn tvc-watch flex shrink-0 items-center justify-center whitespace-nowrap px-4 text-[17px]"
						style={{ height: keyH }}
					>
						{/* "Watch" in the compact TV (2026-10-22); its name says where it leads to a screen reader. */}
						Watch
					</Item>
				)}
				{items.includes("trailer") && (
					<TrailerKey height={keyH} className="!pr-3 !text-[17px]" />
				)}
				{key("want-to-see", wantLabel(on.want))}
				{key("seen", seenLabel(on.score, on.seen, on.episode))}
			</div>
		</>
	)
}

/** Where to watch: two rows a page, an arrow to either side of the page. */
function WatchSection({
	items,
	on,
}: { items: readonly string[]; on: TvTitleOnScreen }) {
	const { canvas } = useTvView()
	const extras = on.extras
	const where = whereRows(extras?.offers ?? [], on.mine)
	const rowH = keySize(canvas, 44)
	const ids = [
		...where.rows
			.map((_, i) => `offer:${i}`)
			.filter((id) => items.includes(id)),
		...(items.includes("where") ? ["where"] : []),
	]
	// Two rows a page upright; four in two columns on a phone's wide canvas. The page holds the row shown last.
	const wide = phoneSpan(canvas) >= 600
	const page = usePage(ids, wide ? 4 : 2, useListAnchor("title-offers", ids))
	return (
		<>
			<SectionName
				end={<PageCount page={page.page} pages={page.pages} className="ml-auto normal-case tracking-normal" />}
			>
				Watch
			</SectionName>
			<div className="flex min-h-0 flex-1 items-center gap-2">
				<div className={`grid min-w-0 flex-1 gap-1.5 ${wide ? "grid-cols-2" : ""}`}>
					{!extras && (
						<span className="text-[18px] text-white/65">
							{on.extrasFailed
								? "Where it streams isn't available right now."
								: "Looking for where it streams."}
						</span>
					)}
					{page.shown.map((id) => {
						if (id === "where")
							return (
								<Item
									key={id}
									id={id}
									className="tvc-ring flex w-full items-center justify-center rounded-[12px] bg-white/[.08] px-3 text-[18px] font-semibold text-white/85"
									style={{ height: rowH }}
								>
									{where.rows.length
										? "All services, rent and buy ›"
										: "Not streaming here · rent or buy ›"}
								</Item>
							)
						const o = where.rows[Number(id.slice("offer:".length))]
						return (
							<Item
								key={id}
								id={id}
								href={o.url}
								linkData={offerData(o, on)}
								label={`${o.name}: ${OFFER_KIND[o.type] ?? o.type} (opens in a new tab)`}
								className="tvc-ring flex w-full items-center gap-3 rounded-[12px] bg-white/[.08] pr-4 text-[18px]"
								style={{ height: rowH }}
							>
								{o.logo ? (
									<Img
										src={tmdbImageUrl(o.logo, "w92")}
										className="h-full shrink-0 rounded-[12px]"
										width={92}
										height={92}
									/>
								) : (
									<span className="w-2" />
								)}
								<span className="min-w-0 flex-1 truncate font-semibold">
									{o.name}
								</span>
								<span className="shrink-0 text-[17px] text-white/65">
									{OFFER_KIND[o.type] ?? o.type}
								</span>
							</Item>
						)
					})}
				</div>
				{page.pages > 1 && (
					<div className="flex shrink-0 flex-col gap-1.5">
						<PageArrow to={page.prev} dir="prev" label="Services before" />
						<PageArrow to={page.next} dir="next" label="More services" />
					</div>
				)}
			</div>
		</>
	)
}

const GROUP_KEYS = [{ name: "Summary" }, ...SCALE_GROUPS]

/** The fingerprint: the summary's headline, or one group's readings, a group a key. */
function FingerprintSection({
	items,
	on,
}: { items: readonly string[]; on: TvTitleOnScreen }) {
	const { canvas } = useTvView()
	const t = on.extras?.fingerprint
	const keyH = keySize(canvas, 54)
	const group =
		Number.isInteger(on.group) && SCALE_GROUPS[on.group as number]
			? (on.group as number)
			: -1
	return (
		<>
			{/* One quiet row: the section's name, then its parts as secondary tabs. The readings have the rest. */}
			<div className="flex shrink-0 items-center gap-1" style={{ height: keyH }}>
				<span className="mr-2 text-[15px] font-bold uppercase tracking-[0.14em] text-white/60">
					Fingerprint
				</span>
				{GROUP_KEYS.map((g, at) => {
					const id = `group:${at - 1}`
					return (
						items.includes(id) && (
							<Tab key={id} id={id} on={group === at - 1} level="secondary">
								{g.name}
							</Tab>
						)
					)
				})}
			</div>
			<div
				className="flex min-h-0 flex-1 flex-col justify-center"
				data-tv-fingerprint
			>
				{!t ? (
					<output className="block text-[18px] text-white/70">
						{!on.extras
							? on.extrasFailed
								? "The fingerprint isn't available right now."
								: "Reading its fingerprint."
							: "No fingerprint for this title yet."}
					</output>
				) : group < 0 ? (
					<p className="line-clamp-3 text-[23px] font-bold leading-[29px]">
						{composeHeadline(t).map((seg, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: the headline's segments have no other identity
								key={i}
								style={{
									color: seg.area
										? AREA_COLOR[seg.area]
										: seg.tone === "muted"
											? "#a8a29e"
											: undefined,
								}}
							>
								{seg.text}
							</span>
						))}
					</p>
				) : (
					<dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
						{SCALE_GROUPS[group].scales.map((sc) => {
							const { word } = readScale(sc, t)
							return (
								<div
									key={sc.name}
									className="flex items-center gap-2 text-[19px] leading-[23px]"
								>
									<span
										aria-hidden
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{ background: AREA_COLOR[sc.area] }}
									/>
									<dt className="shrink-0 text-white/65">{sc.name}</dt>
									<dd className="ml-auto whitespace-nowrap text-right font-semibold">
										{word}
									</dd>
								</div>
							)
						})}
					</dl>
				)}
			</div>
		</>
	)
}
