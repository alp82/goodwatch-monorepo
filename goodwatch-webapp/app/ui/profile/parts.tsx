// Pieces every profile page shares: buttons, the member's score chip, posters from TMDB paths, the score spread, the
// owner's links to the private pages, the notice for a hidden part, and the "You" tag a signed-in visitor sees on
// titles they rated too.
import { ArrowTopRightOnSquareIcon, CheckIcon, LockClosedIcon, ShareIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import type { ProfileTitle } from "~/domain/profile"
import type { Score } from "~/server/scores.server"
import { WRAP, tmdbImage } from "~/ui/my-pages/bits"
import { getVibeColorValue } from "~/utils/ratings"

export const TILE = "rounded-2xl bg-white/[0.04] ring-1 ring-white/10"
export const AMBER_BUTTON =
	"inline-flex min-h-10 items-center gap-1.5 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-4 text-sm font-black text-gray-950 hover:brightness-110"
export const QUIET_BUTTON =
	"inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/[0.06] px-4 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"

export const count = (n: number) => n.toLocaleString("en-US")
export const vibe = (score: number) => getVibeColorValue(Math.max(1, Math.min(10, Math.round(score))) as Score)

/** A TMDB poster or backdrop path at a size; null stays null. */
export const posterUrl = (path: string | null, size = "w342") => (path ? tmdbImage(path, size) : null)
export const backdropUrl = (path: string | null, size = "w1280") => (path ? tmdbImage(path, size) : null)

/** "Mar 4, 2025", in UTC so server and browser agree. */
export const shortDate = (iso: string | null) =>
	iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No date"

/** The member's own score in its strip colour, as on Your scores. */
export function ScoreChip({ score, size = "md" }: { score: number | null; size?: "sm" | "md" }) {
	if (!score) return null
	return (
		<span
			className={`inline-flex items-center justify-center rounded-lg font-black tabular-nums text-gray-950 ring-2 ring-white/80 ${size === "sm" ? "h-6 min-w-7 px-1 text-xs" : "h-8 min-w-9 px-1.5 text-sm"}`}
			style={{ background: vibe(score) }}
			title={`Scored ${score}`}
		>
			{score}
		</span>
	)
}

/** A poster sized by its box. */
export function PosterImg({ title, className = "" }: { title: Pick<ProfileTitle, "poster">; className?: string }) {
	const src = posterUrl(title.poster)
	return src ? (
		<img src={src} alt="" loading="lazy" decoding="async" className={`aspect-[2/3] w-full bg-white/5 object-cover ${className}`} />
	) : (
		<span className={`block aspect-[2/3] w-full bg-white/10 ${className}`} />
	)
}

/** A poster that links to its title, with the owner's score in the corner. */
export function ScoredPoster({ title, showScore = true }: { title: ProfileTitle; showScore?: boolean }) {
	return (
		<Link to={title.href} className="group relative block" title={`${title.title}${title.year ? ` (${title.year})` : ""}`}>
			<PosterImg
				title={title}
				className="rounded-lg shadow-lg ring-1 ring-white/10 transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transition-none"
			/>
			{showScore && (
				<span className="absolute -right-1.5 -bottom-1.5">
					<ScoreChip score={title.score} size="sm" />
				</span>
			)}
		</Link>
	)
}

/** Copies the profile address (or opens the share sheet on touch devices); says "Link copied" for a moment. */
export function ShareButton({ handle, className = AMBER_BUTTON }: { handle: string; className?: string }) {
	const [copied, setCopied] = useState(false)
	const onClick = async () => {
		const url = `https://goodwatch.app/u/${handle}`
		try {
			if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
				await navigator.share({ title: `@${handle} on GoodWatch`, url })
				return
			}
			await navigator.clipboard.writeText(url)
		} catch {
			return
		}
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}
	return (
		<button type="button" onClick={onClick} className={className}>
			{copied ? <CheckIcon className="size-4" aria-hidden /> : <ShareIcon className="size-4" aria-hidden />}
			{copied ? "Link copied" : "Share profile"}
		</button>
	)
}

/** Ten bars, one per score, each in its score's colour; a bar can jump to its tier. */
export function SpreadBars({
	spread,
	average,
	onPick,
	height = "h-20",
}: {
	spread: number[]
	average?: number | null
	onPick?: (score: number) => void
	height?: string
}) {
	const most = Math.max(1, ...spread)
	return (
		<div className="flex flex-col gap-1">
			<div className={`relative flex ${height} items-end gap-1`}>
				{spread.map((n, i) => {
					const bar = (
						<span
							className="block w-full rounded-sm opacity-90 transition-opacity group-hover:opacity-100"
							style={{ height: `${Math.max(4, (n / most) * 100)}%`, background: vibe(i + 1) }}
						/>
					)
					return onPick ? (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
							key={i}
							type="button"
							disabled={!n}
							onClick={() => onPick(i + 1)}
							className="group flex h-full flex-1 cursor-pointer items-end disabled:cursor-default"
							aria-label={`${n} titles scored ${i + 1}`}
						>
							{bar}
						</button>
					) : (
						// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
						<span key={i} className="flex h-full flex-1 items-end">
							{bar}
						</span>
					)
				})}
				{average != null && (
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/80"
						style={{ left: `${((average - 0.5) / 10) * 100}%` }}
					>
						<span className="absolute -top-5 -translate-x-1/2 rounded bg-white px-1 text-[10px] font-black text-gray-950">
							{average}
						</span>
					</span>
				)}
			</div>
			<div className="flex gap-1 text-[10px] font-bold tabular-nums text-gray-500" aria-hidden>
				{spread.map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: always the ten scores
					<span key={i} className="flex-1 text-center">
						{i + 1}
					</span>
				))}
			</div>
		</div>
	)
}

/** A page's body under the compact head. */
export function Body({ children }: { children: ReactNode }) {
	return <div className={`${WRAP} flex flex-col gap-6 pt-5 pb-32 text-white`}>{children}</div>
}

export function Segmented<T extends string>({
	value,
	onChange,
	options,
	label,
}: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
	return (
		<div
			className="flex max-w-full overflow-x-auto rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 [scrollbar-width:none]"
			role="radiogroup"
			aria-label={label}
		>
			{options.map(([key, text]) => (
				<button
					key={key}
					type="button"
					role="radio"
					aria-checked={key === value}
					onClick={() => onChange(key)}
					className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap tabular-nums ${key === value ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"}`}
				>
					{text}
				</button>
			))}
		</div>
	)
}

export function SortSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
	return (
		<label className="flex items-center gap-2 text-sm text-gray-400">
			Sort
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as T)}
				className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-gray-100 ring-1 ring-white/15"
			>
				{options.map(([key, text]) => (
					<option key={key} value={key}>
						{text}
					</option>
				))}
			</select>
		</label>
	)
}

/** The owner's way to the private page that changes what this page shows. */
export function OwnerPageLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link to={to} className={`${QUIET_BUTTON} min-h-9`}>
			{children}
			<ArrowTopRightOnSquareIcon className="size-4 text-gray-400" aria-hidden />
		</Link>
	)
}

/** What a viewer sees in place of a part the owner keeps to themselves or to members. */
export function HiddenPart({ handle, part, members }: { handle: string; part: string; members: boolean }) {
	return (
		<div className={`${TILE} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
			<LockClosedIcon className="size-6 text-gray-500" aria-hidden />
			<p className="text-lg font-bold text-gray-100">
				{members ? `@${handle} shares ${part} with members` : `@${handle} keeps ${part} to themselves`}
			</p>
			<p className="max-w-md text-sm text-gray-400">
				{members
					? "Sign in or create a free account to see it, and how your taste compares."
					: "Members choose which parts of their profile are public. This one is private."}
			</p>
			{members && (
				<Link to="/sign-up" rel="nofollow" className={AMBER_BUTTON}>
					Sign up free
				</Link>
			)}
		</div>
	)
}

/** One row of a title list: poster, title and year, kind, the owner's score, and the visitor's when they rated it. */
export function TitleRow({ title, lead, you }: { title: ProfileTitle; lead?: ReactNode; you?: number | null }) {
	return (
		<li className="flex items-center gap-3 py-2">
			{lead}
			<span className="block w-10 shrink-0">
				<PosterImg title={title} className="rounded" />
			</span>
			<span className="min-w-0 flex-1">
				<Link to={title.href} className="block truncate font-semibold text-gray-100 hover:text-white">
					{title.title}
				</Link>
				<span className="block truncate text-xs text-gray-500">
					{title.year ?? "–"} · {title.mediaType === "movie" ? "Movie" : "Show"}
				</span>
			</span>
			{you != null && (
				<span className="flex items-center gap-1 text-[11px] font-bold text-sky-200" title={`You scored it ${you}`}>
					You <ScoreChip score={you} size="sm" />
				</span>
			)}
			{title.score != null && <ScoreChip score={title.score} size="sm" />}
		</li>
	)
}

/** A poster in a grid with its name under it, and an optional mark over the poster. */
export function GridPoster({ title, caption, mark }: { title: ProfileTitle; caption?: ReactNode; mark?: ReactNode }) {
	return (
		<li className="relative min-w-0">
			<Link to={title.href} className="group block">
				<span className="relative block">
					<PosterImg title={title} className="rounded-lg ring-1 ring-white/10 transition group-hover:ring-white/30" />
					{mark}
				</span>
				<span className="mt-1.5 block truncate text-xs font-semibold text-gray-200">{title.title}</span>
				{caption && <span className="block truncate text-[11px] text-gray-500">{caption}</span>}
			</Link>
		</li>
	)
}

/** A signed-in visitor's own score on a poster they rated too: a "You 9" tag in the bottom-left corner. */
export function YouMark({ score }: { score: number | null | undefined }) {
	if (!score) return null
	return (
		<span
			className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-md bg-gray-950/90 py-0.5 pr-0.5 pl-1.5 text-[10px] font-bold text-sky-200 ring-1 ring-sky-400/60"
			title={`You scored it ${score}`}
		>
			You
			<span
				className="inline-flex h-4 min-w-4 items-center justify-center rounded px-0.5 text-[10px] font-black text-gray-950"
				style={{ background: vibe(score) }}
			>
				{score}
			</span>
		</span>
	)
}
