// The small pieces of the "New on your services" pages (#489 Part C), ported from prototype C's variation D
// (branch ghostex/3fbfaf5b) with #625's day-by-day wording: a service's logo, the GoodWatch score, the Wishlist
// mark, a country's flag, a ranked row, a row of posters, and the line that says when a title arrived.
import { BookmarkIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { arrivalWords, waitedWords } from "~/domain/new-on-services"
import type {
	NewPageData,
	NewTitle,
	PageService,
} from "~/server/new-on-services-page.server"
import { TmdbImage } from "~/ui/TmdbImage"
import { DISPLAY } from "~/ui/my-pages/bits"
import { countryFlagUrl } from "~/utils/country-flag"
import placeholder from "~/img/poster-placeholder.png"
import { assetUrl } from "~/utils/asset-url"
import { goodwatchVibeIndex } from "~/utils/ratings"

export const Logo = ({
	service,
	size = 28,
	className = "",
}: { service: PageService | undefined; size?: number; className?: string }) =>
	service?.logo_path ? (
		<TmdbImage
			kind="logo"
			path={service.logo_path}
			width={size}
			ratio={1}
			alt={service.name}
			title={service.name}
			className={`shrink-0 rounded-lg ring-1 ring-white/20 ${className}`}
			style={{ width: size, height: size }}
		/>
	) : (
		<span
			className={`block shrink-0 rounded-lg bg-white/10 ring-1 ring-white/20 ${className}`}
			style={{ width: size, height: size }}
			aria-hidden
		/>
	)

/**
 * A title's poster, or the placeholder the site's card grids show for a title the catalog has no poster for
 * (ui/Poster.tsx). Both reserve the 2:3 space, so nothing moves.
 */
export const PosterImage = ({
	path,
	width,
	eager = false,
	className,
}: { path: string | null; width: number; eager?: boolean; className: string }) =>
	path ? (
		<TmdbImage
			kind="poster"
			path={path}
			width={width}
			priority={eager ? "eager" : "lazy"}
			className={className}
		/>
	) : (
		<img
			src={assetUrl(placeholder)}
			alt=""
			width={width}
			height={Math.round(width * 1.5)}
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			className={className}
		/>
	)

/** The GoodWatch score in its color, as on a poster's tab. */
export const Score = ({
	score,
	className = "",
}: { score: number | null; className?: string }) =>
	score === null ? null : (
		<span
			className={`inline-flex shrink-0 items-center justify-center rounded-md px-1.5 font-black tabular-nums text-white bg-vibe-${goodwatchVibeIndex(score)} ${className}`}
		>
			<span className="sr-only">GoodWatch score </span>
			{score}
		</span>
	)

/** The Wishlist's bookmark, as on a poster. */
export const WantMark = ({ className = "" }: { className?: string }) => (
	<span
		className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-950/85 ring-1 ring-amber-400/60 ${className}`}
	>
		<BookmarkIcon className="h-4 w-4 text-amber-400" aria-hidden />
		<span className="sr-only">You wait for it</span>
	</span>
)

export const Flag = ({
	country,
	className = "h-4 w-6",
}: { country: string; className?: string }) => (
	<img
		src={countryFlagUrl(country)}
		alt=""
		width={24}
		height={16}
		className={`shrink-0 rounded-[3px] object-cover ring-1 ring-white/20 ${className}`}
	/>
)

export const H2 = ({ children }: { children: ReactNode }) => (
	<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{children}</h2>
)

export const Sub = ({ children }: { children: ReactNode }) => (
	<p className="mt-1 text-sm text-gray-400">{children}</p>
)

const runtimeWords = (title: NewTitle) =>
	title.runtime
		? title.media_type === "movie"
			? `${Math.floor(title.runtime / 60)}h ${title.runtime % 60}m`
			: `${title.runtime} min episodes`
		: null

/** "New on Netflix today", or "New on Netflix" for a title whose day is not known; a waited title says more. */
function WhenLine({
	title,
	data,
	wait,
}: {
	title: NewTitle
	data: NewPageData
	wait: "want" | "watching" | undefined
}) {
	const name = data.services[title.service]?.name ?? "your services"
	if (wait)
		return (
			<span className="truncate text-sky-200">
				{waitedWords(title, wait, name, data.now).landed}
			</span>
		)
	const words = arrivalWords(title, name, data.now)
	if (!title.exact) return <span className="truncate">{words}</span>
	const service = `New on ${name} `
	return (
		<span className="truncate">
			{service}
			<b className="font-bold text-gray-100">{words.slice(service.length)}</b>
		</span>
	)
}

/** One row of the ranked list: rank, poster, title, facts, when it arrived, the score. */
export function RankedRow({
	title,
	rank,
	data,
	eager,
}: { title: NewTitle; rank: number; data: NewPageData; eager: boolean }) {
	const wait = waitOf(data, title)
	const facts = [
		title.media_type === "movie" ? "Movie" : "Show",
		title.release_year ? String(title.release_year) : null,
		runtimeWords(title),
	].filter(Boolean)
	return (
		<li>
			<Link
				to={title.path}
				prefetch="intent"
				className="group flex items-center gap-3 border-b border-white/[0.07] py-2.5 hover:bg-white/[0.04]"
			>
				<span
					className={`${DISPLAY} w-9 shrink-0 text-center text-3xl tabular-nums text-gray-600`}
				>
					{rank}
				</span>
				<span className="relative shrink-0">
					<PosterImage
						path={title.poster_path}
						width={64}
						eager={eager}
						className="h-24 w-16 rounded-md bg-white/5 object-cover"
					/>
					{wait && <WantMark className="absolute -left-1.5 -top-1.5 h-6 w-6" />}
				</span>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-base text-white group-hover:text-amber-200">
						{title.title}
					</b>
					<span className="block truncate text-sm text-gray-400">
						{facts.join(" · ")}
					</span>
					<span className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
						<Logo service={data.services[title.service]} size={20} />
						<WhenLine title={title} data={data} wait={wait} />
					</span>
				</span>
				<Score score={title.score} className="h-9 min-w-11 text-base" />
			</Link>
		</li>
	)
}

/** Small posters in a row that wraps, as below prototype C's ranked list. */
export function PosterRow({
	titles,
	data,
}: { titles: NewTitle[]; data: NewPageData }) {
	return (
		<ul className="mt-2 flex flex-wrap gap-2">
			{titles.map((title) => (
				<li key={title.key} className="w-[calc(25%-6px)] sm:w-24 lg:w-[110px]">
					<Link to={title.path} prefetch="intent" className="group block">
						<span className="relative block">
							<PosterImage
								path={title.poster_path}
								width={110}
								className="block aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-white/10 group-hover:ring-amber-400/70"
							/>
							<Score
								score={title.score}
								className="absolute right-1 top-1 h-6 min-w-7 text-xs"
							/>
							{waitOf(data, title) && (
								<WantMark className="absolute -left-1 -top-1 h-6 w-6" />
							)}
						</span>
						<span className="mt-1 block truncate text-xs text-gray-300">
							{title.title}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

export const waitOf = (data: NewPageData, title: NewTitle) =>
	data.waited.find(({ key }) => key === title.key)?.wait
