// PROTOTYPE - throwaway (#541). Pieces the "Talked about now" variants share: the reason chip, the move badge, the
// row's head, a rail that scrolls sideways, the three content cards (a click-to-load video facade, a post, a
// headline) and a sparkline. Each variant lays them out its own way.
import { Link } from "@remix-run/react"
import { type ReactNode, useRef, useState } from "react"
import { startTitleHref } from "~/ui/living-room/BelowRoom"
import {
	type Headline,
	type HotTitle,
	type Post,
	UPDATED,
	type Video,
	type Why,
	type WhyKind,
	heatOf,
	hotOf,
} from "./data"

export const img = (path: string, size = "w185") =>
	`https://image.tmdb.org/t/p/${size}${path}`

export const hrefOf = (title: HotTitle) =>
	startTitleHref({
		media_type: title.media_type,
		tmdb_id: title.tmdb_id,
		title: title.title,
	})

export const DISPLAY = { fontFamily: "var(--lrb-font)" }

const KIND: Record<WhyKind, { tone: string; icon: ReactNode }> = {
	trailer: {
		tone: "bg-rose-500/15 text-rose-100 ring-rose-400/35",
		icon: (
			<svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
				<path d="M5 3.5v9l7-4.5z" fill="currentColor" />
			</svg>
		),
	},
	top10: {
		tone: "bg-amber-400/15 text-amber-100 ring-amber-300/40",
		icon: (
			<span className="rounded-[3px] bg-amber-300 px-[3px] text-[8.5px] font-black leading-[12px] text-black">
				10
			</span>
		),
	},
	news: {
		tone: "bg-sky-500/15 text-sky-100 ring-sky-400/35",
		icon: (
			<svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
				<path
					d="M2 12l4-4 3 3 5-6M10 5h4v4"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		),
	},
	season: {
		tone: "bg-violet-500/15 text-violet-100 ring-violet-400/35",
		icon: (
			<svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
				<path
					d="M3 6h10M3 9.5h10M3 13h10M5 3h6"
					stroke="currentColor"
					strokeWidth="1.7"
					strokeLinecap="round"
				/>
			</svg>
		),
	},
	release: {
		tone: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/35",
		icon: (
			<svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
				<path
					d="M2.5 5.5h11v2a1.5 1.5 0 000 3v2h-11v-2a1.5 1.5 0 000-3z"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
			</svg>
		),
	},
}

export function WhyIcon({ kind }: { kind: WhyKind }) {
	return <>{KIND[kind].icon}</>
}

/** The reason a title is in the row, as a chip: icon and two words. */
export function WhyChip({ why, small = false }: { why: Why; small?: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${KIND[why.kind].tone} ${small ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs"}`}
		>
			{KIND[why.kind].icon}
			{why.label}
		</span>
	)
}

/** Up, down or new since yesterday. Color is never alone: an arrow or the word says it too. */
export function Move({ move }: { move: HotTitle["move"] }) {
	if (move === "new")
		return (
			<span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-black">
				NEW
			</span>
		)
	if (move === 0)
		return (
			<span className="text-[11px] font-bold text-neutral-500" title="Same place as yesterday">
				=
			</span>
		)
	const up = move > 0
	return (
		<span
			className={`text-[11px] font-bold ${up ? "text-emerald-400" : "text-neutral-500"}`}
			title={`${up ? "Up" : "Down"} ${Math.abs(move)} since yesterday`}
		>
			{up ? "▲" : "▼"}
			{Math.abs(move)}
		</span>
	)
}

export function RowHead({
	title = "Talked about now",
	eyebrow = "Trending this week",
	right,
}: { title?: string; eyebrow?: string; right?: ReactNode }) {
	return (
		<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
			<div>
				<p className="lrb-eye">{eyebrow}</p>
				<h2 id="talked-title" className="mt-1.5" style={{ fontSize: "clamp(1.6rem, 4vw, 2.25rem)" }}>
					{title}
				</h2>
			</div>
			{right ?? (
				<p className="text-xs text-neutral-500">
					{UPDATED} · the same for everyone
				</p>
			)}
		</header>
	)
}

/** A row that scrolls sideways: snap on touch, two round arrow keys from 640 px. */
export function Rail({
	children,
	className = "",
	gap = "gap-4",
}: { children: ReactNode; className?: string; gap?: string }) {
	const ref = useRef<HTMLUListElement>(null)
	const by = (dir: number) =>
		ref.current?.scrollBy({
			left: dir * ref.current.clientWidth * 0.8,
			behavior: "smooth",
		})
	const arrow = (dir: number) => (
		<button
			type="button"
			onClick={() => by(dir)}
			aria-label={dir < 0 ? "Scroll back" : "Scroll on"}
			className="hidden h-10 w-10 place-items-center rounded-full bg-white/5 text-white ring-1 ring-inset ring-white/15 hover:bg-white/10 hover:ring-amber-300/60 sm:grid"
		>
			{dir < 0 ? "←" : "→"}
		</button>
	)
	return (
		<div className={className}>
			<ul
				ref={ref}
				className={`-mb-2 flex snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${gap}`}
			>
				{children}
			</ul>
			<div className="mt-1 hidden justify-end gap-2 sm:flex">
				{arrow(-1)}
				{arrow(1)}
			</div>
		</div>
	)
}

/** "About East of Eden": a content card's link to the title it is about. */
export function About({ about }: { about: number }) {
	const title = hotOf(about)
	return (
		<Link
			to={hrefOf(title)}
			discover="none"
			className="group flex min-w-0 items-center gap-2 text-xs text-neutral-400"
		>
			<img
				src={img(title.poster_path, "w92")}
				alt=""
				width={18}
				height={27}
				loading="lazy"
				className="h-[27px] w-[18px] shrink-0 rounded-[3px] object-cover"
			/>
			<span className="truncate">
				About <b className="font-semibold text-neutral-200 group-hover:text-amber-300">{title.title}</b>
			</span>
		</Link>
	)
}

const PLATFORM_DOT: Record<string, string> = {
	YouTube: "bg-[#ff3b30]",
	Bluesky: "bg-[#1185fe]",
	Mastodon: "bg-[#6364ff]",
}

function Platform({ name }: { name: string }) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
			<i className={`h-2 w-2 rounded-full ${PLATFORM_DOT[name] ?? "bg-neutral-400"}`} />
			{name}
		</span>
	)
}

/**
 * A video behind its facade: our own picture of the title (TMDB), the platform, the channel and the length. Nothing
 * comes from YouTube until the press; the press is the consent to YouTube, and then the player would mount (here a
 * stand-in: the prototype loads nothing).
 */
export function VideoFacade({
	video,
	className = "",
	about = true,
}: { video: Video; className?: string; about?: boolean }) {
	const [on, setOn] = useState(false)
	return (
		<div className={`flex flex-col gap-2.5 ${className}`}>
			<div className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
				{on ? (
					<div className="absolute inset-0 grid place-items-center bg-black p-4 text-center text-xs text-neutral-400">
						<p>
							<b className="block text-sm text-white">The YouTube player mounts here</b>
							youtube-nocookie.com/embed/… · consent for YouTube saved for this visit
							<button
								type="button"
								onClick={() => setOn(false)}
								className="mt-2 block w-full text-amber-300 underline"
							>
								Back to the facade
							</button>
						</p>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setOn(true)}
						className="group absolute inset-0 text-left"
						aria-label={`Play ${video.label}, loads from YouTube`}
					>
						<img
							src={img(video.still, "w780")}
							alt=""
							loading="lazy"
							className="h-full w-full object-cover opacity-80 transition group-hover:opacity-95"
						/>
						<span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
						<span className="absolute left-3 top-3">
							<Platform name={video.platform} />
						</span>
						<span className="absolute right-3 top-3 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
							{video.duration}
						</span>
						<span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-black shadow-xl transition group-hover:scale-105">
							<svg viewBox="0 0 16 16" className="ml-0.5 h-6 w-6" aria-hidden="true">
								<path d="M5 3v10l8-5z" fill="currentColor" />
							</svg>
						</span>
						<span className="absolute inset-x-3 bottom-2.5">
							<b className="block text-[15px] leading-tight text-white" style={DISPLAY}>
								{video.label}
							</b>
							<span className="text-[11px] text-neutral-300">
								{video.channel} · {video.views} · loads from YouTube
							</span>
						</span>
					</button>
				)}
			</div>
			{about && <About about={video.about} />}
		</div>
	)
}

const initials = (name: string) =>
	name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)

/**
 * A post as our own card: name, handle, text and counts, no avatar and no script from the platform. "Open" goes to
 * the post itself. (Rendering a post's text on our server is one of the lawyer's questions; the other road is a
 * facade like the video's that loads the platform's embed.)
 */
export function PostCard({
	post,
	className = "",
	about = true,
}: { post: Post; className?: string; about?: boolean }) {
	return (
		<article
			className={`flex flex-col gap-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10 ${className}`}
		>
			<div className="flex items-center gap-2.5">
				<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-700 text-xs font-bold text-white">
					{initials(post.name)}
				</span>
				<span className="min-w-0 flex-1 leading-tight">
					<b className="block truncate text-sm text-white">{post.name}</b>
					<span className="block truncate text-xs text-neutral-500">{post.handle}</span>
				</span>
				<Platform name={post.platform} />
			</div>
			<p className="flex-1 text-[14px] leading-snug text-neutral-200">{post.text}</p>
			<div className="flex items-center gap-3 text-xs text-neutral-500">
				<span>♥ {post.likes}</span>
				<span>↩ {post.replies}</span>
				<span>{post.ago}</span>
				<a href="#post" className="ml-auto font-semibold text-neutral-300 hover:text-amber-300">
					Open ↗
				</a>
			</div>
			{about && <About about={post.about} />}
		</article>
	)
}

/** A headline that links out to the article. Our words: the source, the headline, how long ago. */
export function HeadlineCard({
	item,
	className = "",
	about = true,
}: { item: Headline; className?: string; about?: boolean }) {
	return (
		<article
			className={`flex flex-col gap-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10 ${className}`}
		>
			<p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-sky-300/90">
				<span>{item.source}</span>
				<span className="font-semibold normal-case tracking-normal text-neutral-500">{item.ago}</span>
			</p>
			<a
				href="#article"
				className="flex-1 text-[17px] font-bold leading-snug text-white hover:text-amber-300"
				style={DISPLAY}
			>
				{item.headline} <span className="text-neutral-500">↗</span>
			</a>
			{about && <About about={item.about} />}
		</article>
	)
}

/**
 * The buzz of the last 14 days, on the title's own scale (the shape is the point; `heat` says how big it is). One
 * series, one hue; the day of the reason is marked. With `hover`, each day answers its value.
 */
export function Spark({
	title,
	width,
	height,
	hover = false,
	mark = true,
}: {
	title: HotTitle
	width: number
	height: number
	hover?: boolean
	mark?: boolean
}) {
	const [at, setAt] = useState<number | null>(null)
	const max = Math.max(...title.buzz)
	const pad = 3
	const x = (i: number) => pad + (i / (title.buzz.length - 1)) * (width - pad * 2)
	const y = (v: number) => height - pad - (v / max) * (height - pad * 2)
	const line = title.buzz.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")
	const area = `${line}L${x(title.buzz.length - 1)},${height}L${x(0)},${height}Z`
	const id = `sg-${title.tmdb_id}-${width}`
	const before = title.buzz.slice(0, Math.max(title.spikeAt, 1))
	const usual = before.reduce((sum, v) => sum + v, 0) / before.length
	const days = (i: number) => {
		const ago = title.buzz.length - 1 - i
		return ago === 0 ? "Today" : ago === 1 ? "Yesterday" : `${ago} days ago`
	}
	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			className="block overflow-visible"
			role="img"
			aria-label={`Buzz over 14 days: ${title.why.label} ${days(title.spikeAt).toLowerCase()}, today ×${heatOf(title).toFixed(1)} the usual`}
			onMouseLeave={() => setAt(null)}
		>
			<defs>
				<linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor="#fcd34d" stopOpacity="0.32" />
					<stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${id})`} />
			{mark && (
				<line
					x1={x(title.spikeAt)}
					x2={x(title.spikeAt)}
					y1={0}
					y2={height}
					stroke="rgba(255,255,255,0.28)"
					strokeDasharray="2 3"
				/>
			)}
			<path d={line} fill="none" stroke="#fcd34d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
			<circle
				cx={x(title.buzz.length - 1)}
				cy={y(title.buzz[title.buzz.length - 1])}
				r="3.5"
				fill="#fcd34d"
				stroke="#111827"
				strokeWidth="2"
			/>
			{hover &&
				title.buzz.map((v, i) => (
					<rect
						// biome-ignore lint/suspicious/noArrayIndexKey: days of a fixed series
						key={i}
						x={x(i) - (width / title.buzz.length) / 2}
						y={0}
						width={width / title.buzz.length}
						height={height}
						fill="transparent"
						onMouseEnter={() => setAt(i)}
					/>
				))}
			{hover && at !== null && (
				<g pointerEvents="none">
					<line x1={x(at)} x2={x(at)} y1={0} y2={height} stroke="rgba(255,255,255,0.5)" />
					<circle cx={x(at)} cy={y(title.buzz[at])} r="4" fill="#fcd34d" stroke="#111827" strokeWidth="2" />
					<foreignObject
						x={Math.min(Math.max(x(at) - 70, 0), width - 140)}
						y={-34}
						width={140}
						height={30}
					>
						<div className="rounded-md bg-neutral-950/95 px-2 py-1 text-center text-[11px] leading-tight text-neutral-200 ring-1 ring-white/15">
							{days(at)} · <b className="text-white">×{(title.buzz[at] / usual).toFixed(1)}</b> the usual
						</div>
					</foreignObject>
				</g>
			)}
		</svg>
	)
}
