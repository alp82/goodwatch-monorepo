import { lazy, Suspense } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { primaryOffer } from "../title-extras"
import { hasGoodwatchScore } from "~/utils/ratings"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
// One title, large: its backdrop is the picture, its name and facts stand at the bottom left over its keys. The
// title screen draws it with Watch, Want to See and Seen it; Tonight draws it with Details and Another one
// (Tonight.tsx). A chunk the TV asks for on first use (screen-code.tsx).
//
// The title screen's actions are the machine's (`tvItems`). A provider offer is a native link. Without a direct
// offer URL, Where to watch opens the title page. Trailer and Fingerprint are lazy panels with their own history
// entry; Back restores the invoking action. Expand keeps its corner at the bottom right.
//
// On the phone the keys are touch targets, 44 px or more on the phone's screen (`keySize` in kit.tsx), and stand
// two to a row: five keys leave the last right cell free, two keys stand in the left column.
// That cell is the Expand key's corner.
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Frame,
	Item,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import {
	type TvKnownTitle,
	type TvTitleOnScreen,
	parseTvTitleKey,
	seenLabel,
	titleKicker,
	wantLabel,
	whereLine,
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
	useReport(report, useTvTitle(title))
	return null
}

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string, large: number, small: number) =>
	name.length > 16 ? small : large

export type TitleKey = {
	id: string
	label: string
	/** A key that has nothing to do right now ("Not streaming"). */
	quiet?: boolean
	href?: string
	linkData?: Record<string, string | number>
	secondary?: boolean
}

export function TitleView({
	name,
	crumb,
	items,
	title,
	heading,
	kicker,
	where,
	line,
	lineLanguage,
	keys,
}: {
	/** The screen's name in the top bar, and what stands under it. */
	name: string
	crumb?: string
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvKnownTitle | null
	/** What stands in the name's place while there is no title to show. */
	heading?: string
	kicker?: string
	/** "On Netflix", or nothing while nobody knows. */
	where?: string | null
	lineLanguage?: string
	line?: string | null
	keys: readonly TitleKey[]
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const shown = title?.title ?? heading ?? ""
	const score = title?.goodwatch_overall_score_normalized_percent
	return (
		<Frame
			name={name}
			crumb={crumb}
			items={items}
			art={
				title?.backdrop_path
					? tmdbImageUrl(title.backdrop_path, backdropSize(canvas))
					: undefined
			}
			dim={0.45}
		>
			<div data-tv-scroll className="h-full overflow-y-auto">
				<div className="flex min-h-full flex-col justify-end">
					{kicker && (
						<div
							className={
								P
									? "text-[18px] text-white/75"
									: "text-[24px] font-bold uppercase tracking-[0.16em] text-white/75"
							}
						>
							{kicker}
						</div>
					)}
					<div
						{...mediaTextAttributes(title ? mediaFieldLanguage(title) : "en")}
						className="mt-2 line-clamp-2 font-bold leading-[0.95] tracking-tight"
						style={{
							fontSize: P ? nameSize(shown, 44, 32) : nameSize(shown, 96, 66),
						}}
					>
						{shown}
					</div>
					<div
						className={`flex flex-wrap items-center ${P ? "mt-2.5 gap-x-5 text-[21px]" : "mt-5 gap-x-7 text-[30px]"}`}
					>
						{hasGoodwatchScore(score) && (
							<span>
								<b>{Math.round(score)}</b>{" "}
								<span className="text-white/65">score</span>
							</span>
						)}
						{title?.match != null && (
							<span>
								<b>{title.match}%</b>{" "}
								<span className="text-white/65">match</span>
							</span>
						)}
						{where && <span className="text-white/80">{where}</span>}
					</div>
					{!P && line && (
						<div
							{...mediaTextAttributes(
								lineLanguage ?? mediaFieldLanguage(title, "tagline"),
							)}
							className="mt-3 line-clamp-2 max-w-[760px] text-[28px] leading-snug text-white/90"
						>
							{line}
						</div>
					)}
					{/* The phone: two keys to a row; the last row's right half is the Expand key's corner. */}
					<div
						className={
							P
								? "mt-3.5 grid grid-cols-2 gap-2"
								: "mt-8 grid max-w-[850px] grid-cols-3 gap-3"
						}
					>
						{keys.map((key) => (
							<Item
								key={key.id}
								id={key.id}
								href={key.href}
								linkData={key.linkData}
								className={`tvc-btn flex items-center justify-center ${key.secondary ? "!bg-black/40 !font-medium ring-1 ring-white/30 [&.tvc-on]:!bg-white" : ""} ${key.quiet ? "[&:not(.tvc-on)]:text-white/55" : ""} ${P ? `min-w-0 px-3 text-[21px] ${keys.length < 3 ? "col-start-1" : ""}` : "h-[64px] min-w-0 px-5 text-[25px]"}`}
								style={P ? { height: keySize(canvas, 52) } : undefined}
							>
								<span className="truncate">{key.label}</span>
							</Item>
						))}
					</div>
				</div>
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
	const title = on.title
	const offer = primaryOffer(on.extras?.offers ?? [], on.mine)
	const keys: TitleKey[] = [
		{
			id: "watch",
			label: offer ? `Watch on ${offer.name}` : "Where to watch",
			href: offer?.url,
			linkData:
				offer && title
					? {
							"data-product-event": "streaming service clicked",
							"data-provider-id": offer.id,
							"data-tmdb-id": title.tmdb_id,
							"data-media-type": title.media_type,
							"data-country": on.extras!.country,
							"data-offer-type": offer.type,
						}
					: undefined,
		},
		{ id: "trailer", label: "Trailer", secondary: true },
		{ id: "want-to-see", label: wantLabel(on.want) },
		{
			id: "seen",
			label: seenLabel(on.score, on.seen, on.episode),
			secondary: true,
		},
		{ id: "fingerprint", label: "Fingerprint", secondary: true },
	]
	return (
		<TitleView
			// The key says which of the two it is before anything else is known.
			name={parseTvTitleKey(on.key)?.mediaType === "show" ? "Show" : "Movie"}
			items={items}
			title={title}
			heading={on.missing ? "GoodWatch doesn't have this title." : undefined}
			kicker={title ? titleKicker(title) : undefined}
			where={
				offer
					? `${offer.type === "ads" ? "Free with ads" : offer.type === "free" ? "Free" : "Streaming"} · ${on.extras!.country}`
					: whereLine(title, on.mine)
			}
			line={title?.tagline}
			keys={keys.filter((key) => items.includes(key.id))}
		/>
	)
}
