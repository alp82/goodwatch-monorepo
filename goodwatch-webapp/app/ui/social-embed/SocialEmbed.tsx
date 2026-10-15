// One click-to-load facade for every social source: YouTube videos and Shorts, Bluesky and Mastodon posts, and news
// headlines. Shared by the title page's "Talked about now" section and the start page's row (map #537).
//
// Before the click a facade sends no request to any third party. It shows the stored text and, for a video, the
// title's own TMDB artwork (image.tmdb.org, which the page uses anyway); no vendor thumbnail. The click is the consent
// for that one item: the button says which company it loads, and the official player (players.tsx) takes the
// facade's place. A news headline has no player: its card is a plain link to the publisher.
//
// Two presentations:
// - `card`: a self-contained card. A video is a 16:9 (a Short 9:16) picture with the button over it.
// - `row`: a line in a feed, text first and a small button.
// The loaded state is the facade's own unless `loaded` and `onLoad` are passed, for a parent that loads several at once.
import { type ReactNode, useState } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import type { SizeRule } from "~/utils/tmdb-image"
import { SocialPlayer, YouTubeFrame } from "./players"
import {
	type SocialEmbedItem,
	type SocialSource,
	VENDORS,
	actionLabel,
	ago,
	consentLine,
	embedTarget,
	hostLabel,
	safeHref,
} from "./target"

export type { SocialEmbedItem, SocialSource } from "./target"

const DOT: Record<SocialSource, string> = {
	youtube: "#ff0033",
	bluesky: "#1185fe",
	mastodon: "#6364ff",
	news: "#f59e0b",
}

export function SourceChip({ item, className = "" }: { item: Pick<SocialEmbedItem, "source" | "url">; className?: string }) {
	const short = item.source === "youtube" && /\/shorts\//.test(item.url)
	return (
		<span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-gray-200 ${className}`}>
			<span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: DOT[item.source] }} />
			{short ? "YouTube Shorts" : VENDORS[item.source].name}
		</span>
	)
}

/** The button that loads the player. Says what loads and from where. */
export function LoadButton({ item, onClick, compact = false }: { item: SocialEmbedItem; onClick: () => void; compact?: boolean }) {
	const video = item.source === "youtube"
	if (compact)
		return (
			<button
				type="button"
				onClick={onClick}
				title={consentLine(item.source)}
				className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-100 hover:bg-white/20"
			>
				{actionLabel(item.source)} · loads {VENDORS[item.source].name}
			</button>
		)
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex cursor-pointer flex-col items-start gap-0.5 rounded-xl bg-white/95 px-3 py-2 text-left text-black shadow-lg ring-1 ring-black/20 transition hover:bg-white active:scale-[.98] motion-reduce:transition-none"
		>
			<span className="inline-flex items-center gap-2 text-sm font-bold">
				<span
					aria-hidden="true"
					className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
					style={{ background: DOT[item.source] }}
				>
					{video ? "▶" : "↧"}
				</span>
				{actionLabel(item.source)}
			</span>
			<span className="text-[11px] leading-tight text-gray-600">{consentLine(item.source)}</span>
		</button>
	)
}

function Byline({ item, now, className = "" }: { item: SocialEmbedItem; now: number; className?: string }) {
	const when = ago(item.publishedAt, now)
	return (
		<span className={`min-w-0 truncate text-xs text-gray-400 ${className}`}>
			{item.author}
			{when && ` · ${when}`}
		</span>
	)
}

const quoted = (item: SocialEmbedItem) => (item.source === "bluesky" || item.source === "mastodon" ? `“${item.text}”` : item.text)

export interface SocialEmbedProps {
	item: SocialEmbedItem
	variant?: "card" | "row"
	/** The title's TMDB backdrop, shown behind a video before its click. */
	art?: string | null
	/** Widths the art is displayed at, for its srcset. */
	artSizes?: SizeRule[]
	/** Controlled loaded state, for a parent that loads several items at once. */
	loaded?: boolean
	onLoad?: () => void
	/** Extra controls on the byline line, such as a "wrong title?" link. */
	actions?: ReactNode
	/** The time ages are counted against. Defaults to now. */
	now?: number
	className?: string
}

export function SocialEmbed({
	item,
	variant = "card",
	art,
	artSizes = [[null, "780px"]],
	loaded: loadedProp,
	onLoad,
	actions,
	now = Date.now(),
	className = "",
}: SocialEmbedProps) {
	const [ownLoaded, setOwnLoaded] = useState(false)
	const loaded = loadedProp ?? ownLoaded
	const load = () => {
		setOwnLoaded(true)
		onLoad?.()
	}
	const target = embedTarget(item)
	const href = safeHref(item.url)
	const playerTitle = `${VENDORS[item.source].name}: ${item.text}`.slice(0, 200)

	if (item.source === "news" || target.kind === "link")
		return <LinkItem item={item} href={href} variant={variant} actions={actions} now={now} className={className} />

	if (variant === "row")
		return (
			<div className={`flex min-w-0 flex-col gap-2 ${className}`} data-social-item={item.id} data-state={loaded ? "loaded" : "facade"}>
				<RowTop item={item} now={now} actions={actions} />
				{loaded ? (
					<div className={target.kind === "youtube" && target.vertical ? "mx-auto w-full max-w-[16rem]" : ""}>
						<SocialPlayer target={target} title={playerTitle} />
					</div>
				) : (
					<>
						<p className="line-clamp-4 text-[15px] leading-snug break-words text-gray-100">{quoted(item)}</p>
						<div className="flex items-center justify-between gap-3">
							<span className="min-w-0 truncate text-xs text-gray-400">{item.author}</span>
							<LoadButton item={item} onClick={load} compact />
						</div>
					</>
				)}
			</div>
		)

	if (target.kind !== "youtube")
		return (
			<div
				className={`flex min-w-0 flex-col gap-3 rounded-2xl bg-white/[.06] p-4 ring-1 ring-white/10 ${className}`}
				data-social-item={item.id}
				data-state={loaded ? "loaded" : "facade"}
			>
				<SourceChip item={item} />
				{loaded ? (
					<SocialPlayer target={target} title={playerTitle} />
				) : (
					<>
						<p className="line-clamp-5 text-[15px] leading-snug break-words text-gray-100">{quoted(item)}</p>
						<Byline item={item} now={now} />
						<div className="mt-auto">
							<LoadButton item={item} onClick={load} />
						</div>
					</>
				)}
				{actions && <div className="flex justify-end">{actions}</div>}
			</div>
		)

	return (
		<div className={`flex min-w-0 flex-col gap-2 ${className}`} data-social-item={item.id} data-state={loaded ? "loaded" : "facade"}>
			<div
				className={`relative overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/10 ${
					target.vertical ? "mx-auto aspect-[9/16] w-full max-w-[22rem]" : "aspect-video"
				}`}
			>
				{loaded ? (
					<div className="absolute inset-0">
						<YouTubeFrame videoId={target.videoId} title={playerTitle} fill />
					</div>
				) : (
					<>
						{art && (
							<TmdbImage
								kind="backdrop"
								path={art}
								sizes={artSizes}
								maxWidth={780}
								className="absolute inset-0 h-full w-full object-cover"
								draggable={false}
							/>
						)}
						<div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
						<div className="absolute inset-x-0 top-0 p-3">
							<SourceChip item={item} className="rounded-full bg-black/60 px-2 py-1" />
						</div>
						<div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 sm:p-4">
							<p className="line-clamp-3 text-sm font-semibold leading-snug text-white sm:text-base">{item.text}</p>
							<Byline item={item} now={now} className="text-gray-300" />
							<div>
								<LoadButton item={item} onClick={load} />
							</div>
						</div>
					</>
				)}
			</div>
			{actions && <div className="flex justify-end">{actions}</div>}
		</div>
	)
}

/** A feed row's first line: the source, the age and the row's own controls. */
function RowTop({ item, now, actions }: { item: SocialEmbedItem; now: number; actions?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<SourceChip item={item} />
			<span className="flex items-center gap-3 text-xs text-gray-500">
				{ago(item.publishedAt, now)}
				{actions}
			</span>
		</div>
	)
}

function LinkItem({
	item,
	href,
	variant,
	actions,
	now,
	className,
}: {
	item: SocialEmbedItem
	href: string | null
	variant: "card" | "row"
	actions?: ReactNode
	now: number
	className: string
}) {
	const host = hostLabel(item.url)
	const headline = (
		<>
			{item.text}
			{href && (
				<span aria-hidden="true" className="text-amber-200/70">
					{" "}
					↗︎
				</span>
			)}
		</>
	)
	if (variant === "row")
		return (
			<div className={`flex min-w-0 flex-col gap-2 ${className}`} data-social-item={item.id}>
				<RowTop item={item} now={now} actions={actions} />
				{href ? (
					<a href={href} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold leading-snug break-words text-gray-100 hover:underline">
						{headline}
					</a>
				) : (
					<p className="text-[15px] font-semibold leading-snug break-words text-gray-100">{item.text}</p>
				)}
				<span className="min-w-0 truncate text-xs text-gray-400">{item.author || host}</span>
			</div>
		)
	return (
		<div className={`flex min-w-0 flex-col gap-2 rounded-2xl bg-amber-950/30 p-4 ring-1 ring-amber-500/20 ${className}`} data-social-item={item.id}>
			<span className="text-xs font-semibold text-amber-200">
				{item.author || host} · {ago(item.publishedAt, now)}
			</span>
			{href ? (
				<a href={href} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold leading-snug break-words text-gray-100 hover:underline">
					{headline}
				</a>
			) : (
				<p className="text-[15px] font-semibold leading-snug break-words text-gray-100">{item.text}</p>
			)}
			<div className="mt-auto flex items-center justify-between gap-3">
				{host && <span className="text-xs text-amber-200/70">{host}</span>}
				{actions}
			</div>
		</div>
	)
}
