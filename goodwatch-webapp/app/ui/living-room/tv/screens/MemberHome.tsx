import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import {
	Ambient,
	CornerBar,
	Img,
	Item,
	Shade,
	backdropSize,
	keySize,
	useTvView,
} from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import { tvTitleKey, type TvHomeData, type TvTonightPick } from "../tv-home"

/** The existing Next pick is the decision; the popular row is a separate way to browse. */
export function MemberHome({
	pick,
	popular,
	failed,
	waiting,
	items,
	signal,
}: {
	pick?: TvTonightPick
	popular?: TvHomeData["popular"]
	failed?: boolean
	waiting: boolean
	items: readonly string[]
	signal?: { badge: string; label: string }
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const compact = P && canvas.h < 400
	const cards = popular?.titles ?? []
	const last = useRef<string | null>(null)
	const at = cards.find((card) => `title:${tvTitleKey(card)}` === focused)
	if (at) last.current = tvTitleKey(at)
	const shown =
		cards.find((card) => tvTitleKey(card) === last.current) ?? cards[0]
	const card = pick?.card
	const backdrop = card?.backdrop_path
	const episode = pick?.episode
	const runtime = episode ? episode.runtime : card?.runtime
	const availability =
		card?.services === null
			? "Availability loading"
			: card?.services?.length
				? `On ${card.services[0].name}`
				: card
					? "Check availability in details"
					: null
	const facts = [
		episode
			? `Next episode · ${episode.code}`
			: card?.wantToSee
				? "From your Wishlist"
				: card
					? "Discover a suggestion"
					: null,
		runtime
			? `${runtime} min${card?.media_type === "show" && !episode ? " episodes" : ""}`
			: null,
		card?.match != null ? `${card.match}% match` : null,
	]
		.filter(Boolean)
		.join(" · ")
	const source =
		popular?.scope === "services"
			? "On your services"
			: popular?.scope === "mixed"
				? "Your services first · includes others"
				: popular?.scope === "unknown"
					? "Wider catalog · availability loading"
					: "Wider catalog"
	const actions = [
		{
			id: "home:next",
			label: episode ? `Next episode · ${episode.code}` : "View details",
		},
		{ id: "home:movies", label: "My movies" },
		{ id: "app:shows", label: "My shows" },
		{ id: "app:tonight", label: "More picks" },
		{ id: "app:discover", label: "Discover" },
		{ id: "app:taste", label: "Taste" },
	]
	return (
		<>
			{backdrop && (
				<Ambient src={tmdbImageUrl(backdrop, backdropSize(canvas))} />
			)}
			<Shade dim={0.55} />
			<h1
				className={`absolute font-bold tracking-tight ${P ? "left-5 top-[28px] text-[26px]" : "left-14 top-10 text-[32px]"}`}
			>
				Watch next
			</h1>
			<div
				className={`absolute flex min-h-0 flex-col ${P ? "inset-x-5 top-[80px] bottom-[10px]" : "inset-x-14 top-[112px] bottom-7"}`}
			>
				<div
					className={`shrink-0 ${compact ? "h-[86px]" : P ? "h-[112px]" : "h-[208px]"}`}
				>
					{card ? (
						<>
							<div
								{...mediaTextAttributes(mediaFieldLanguage(card))}
								className={`font-bold leading-[1.02] tracking-tight ${compact ? "truncate h-[32px] text-[30px]" : P ? "line-clamp-2 h-[58px] text-[30px]" : "line-clamp-2 h-[132px] max-w-[940px] text-[66px]"}`}
							>
								{card.title}
							</div>
							<p
								className={`truncate leading-tight text-white/85 ${P ? "mt-1 text-[18px]" : "mt-2 text-[25px]"}`}
							>
								{facts}
							</p>
							<p
								className={`truncate leading-tight text-white/75 ${P ? "mt-1 text-[18px]" : "mt-1 text-[23px]"}`}
							>
								{availability}
							</p>
						</>
					) : (
						<div
							className={
								compact
									? "text-[20px] leading-tight"
									: P
										? "text-[24px] leading-snug"
										: "max-w-[800px] text-[38px] leading-tight"
							}
						>
							{failed
								? "Your Watch next picks could not be loaded. Open My movies or My shows to try again."
								: waiting
									? "Finding something to watch next…"
									: "No pick yet. Add Want to See titles, or explore Discover."}
						</div>
					)}
				</div>
				<div
					{...{ [TV_ROW_ATTR]: "" }}
					data-home-actions
					className={`flex shrink-0 overflow-hidden ${P ? "-mx-5 gap-2 px-5 py-1" : "-mx-14 gap-3 px-14 py-3"}`}
				>
					{actions
						.filter((a) => items.includes(a.id))
						.map((a) => (
							<Item
								key={a.id}
								id={a.id}
								label={
									a.id === "app:shows" && signal
										? `My shows, ${signal.label}`
										: undefined
								}
								className={`${a.id === "home:next" ? "tvc-btn" : "tvc-act"} flex shrink-0 items-center justify-center whitespace-nowrap ${P ? "px-4 text-[20px]" : "px-6 text-[24px]"}`}
								style={{ height: keySize(canvas, 54) }}
							>
								{a.label}
								{a.id === "app:shows" && signal && (
									<span className="ml-2 rounded-full bg-sky-300 px-2 text-black">
										{signal.badge}
									</span>
								)}
							</Item>
						))}
				</div>
				<section
					aria-label="Popular titles"
					className="flex min-h-0 flex-1 flex-col"
				>
					<div className={`shrink-0 ${P ? "mt-1 h-[48px]" : "mt-3 h-[64px]"}`}>
						<h2
							className={P ? "text-[20px] font-bold" : "text-[24px] font-bold"}
						>
							Popular{" "}
							<span className="font-normal text-white/65">· {source}</span>
						</h2>
						<p
							className={`truncate text-white/80 ${P ? "text-[19px]" : "text-[22px]"}`}
						>
							{shown?.title ??
								(popular?.failed
									? "Popular titles are unavailable. Try Discover."
									: popular
										? "No popular titles to show. Try Discover."
										: "Loading popular titles…")}
						</p>
					</div>
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						data-home-popular
						className={`flex min-h-0 flex-1 overflow-hidden ${P ? "-mx-5 gap-3 px-5 py-1" : "-mx-14 gap-4 px-14 py-3"}`}
					>
						{cards.map((title) => (
							<Item
								key={title.key}
								id={`title:${tvTitleKey(title)}`}
								label={title.title}
								className={`tvc-tile h-full max-h-[156px] shrink-0 bg-[#10131c] ${P ? "" : "aspect-[2/3]"}`}
								style={P ? { width: keySize(canvas, 66) } : undefined}
							>
								{title.poster_path && (
									<Img
										src={tmdbImageUrl(title.poster_path, "w185")}
										className="absolute inset-0 h-full w-full"
									/>
								)}
							</Item>
						))}
					</div>
				</section>
			</div>
			<CornerBar items={items} />
		</>
	)
}
