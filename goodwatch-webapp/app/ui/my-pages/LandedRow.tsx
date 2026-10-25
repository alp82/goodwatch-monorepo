import { canonicalMediaTitle } from "~/utils/media-presentation"
// The titles that landed on the member's services in the last 14 days (#489), on My movies and My shows: one row
// that names the latest with its service and its day, and opens to all of them with the day each landed. It stays
// for the 14 days, whether the member has been here since or not. And the mark the same titles carry in a list:
// the service's logo ringed in the sky blue of the signal with a "New" tab on a poster, or the logo beside the
// words where the poster is too small for it. An opened row ends in the title's score pill, which the page hands
// over (`parts`), like the row's logo: this file stays free of the poster parts (see below).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import {
	type LandedTitle,
	type NewOn,
	landedDayWords,
	landedRowWords,
	newOn,
} from "~/domain/newly-available-words"
import { titleToDashed } from "~/utils/helpers"

// Not from ./bits: this file loads with the words of "newly available" (rule 5 in vite.config.js), which the hub
// and home's doors load too, and must not bring the pages' pieces along.
const tmdbImage = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

const Logo = ({
	service,
	className,
}: { service: NewOn; className: string }) => (
	<img
		src={tmdbImage(service.logo_path, "w92")}
		alt=""
		loading="lazy"
		decoding="async"
		className={`shrink-0 object-cover ${className}`}
	/>
)

/**
 * The mark on a poster or a backdrop: the logo of the service the title is new on, ringed, with a "New" tab. For a
 * picture at least 64 pixels wide; a smaller one leaves it to `NewOnWords`.
 */
export const NewOnSticker = ({
	service,
	small = false,
	className = "",
}: { service: NewOn; small?: boolean; className?: string }) => (
	<span
		data-new-on={service.name}
		className={`pointer-events-none flex flex-col items-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] ${className}`}
	>
		<Logo
			service={service}
			className={`ring-2 ring-sky-400 ${small ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg"}`}
		/>
		<span className="-mt-1.5 rounded-full bg-sky-400 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-black">
			New
		</span>
		<span className="sr-only">{newOn(service.name)}</span>
	</span>
)

/** The mark in a line of words, where the poster is too small to carry it: the logo, and "New on Netflix". */
export const NewOnWords = ({ service }: { service: NewOn }) => (
	<span
		data-new-on={service.name}
		className="inline-flex items-center gap-1 align-bottom font-semibold text-sky-200"
	>
		<Logo service={service} className="h-4 w-4 rounded" />
		{newOn(service.name)}
	</span>
)

/** What an opened row shows that the page draws: the service's logo in the row's words, and the row's end. */
export interface LandedRowParts {
	logo: (title: LandedTitle, service: NewOn) => ReactNode
	end: (title: LandedTitle) => ReactNode
}

export function LandedRow({
	landed,
	note,
	parts,
	className = "",
}: {
	/** The titles of the page's kind that landed in the last 14 days, the latest first. */
	landed: readonly LandedTitle[]
	/** What else is new about a title, said after its service: a show's new episode. */
	note?: (title: LandedTitle) => string | null
	parts?: LandedRowParts
	className?: string
}) {
	const words = landedRowWords(landed)
	if (!words) return null
	const [latest] = landed
	return (
		<details
			className={`group/landed overflow-hidden rounded-2xl bg-sky-400/[0.07] ring-1 ring-sky-300/20 open:bg-white/[0.03] open:ring-white/10 ${className}`}
			data-landed
		>
			<summary
				className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 md:gap-4 md:px-5 [&::-webkit-details-marker]:hidden"
				data-landed-summary
			>
				{latest.service ? (
					<Logo service={latest.service} className="h-6 w-6 rounded-md" />
				) : (
					<span
						className="mx-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400"
						aria-hidden
					/>
				)}
				<span className="min-w-0 flex-1 text-sm md:flex md:items-baseline md:gap-2">
					<span className="block truncate text-sky-100" data-landed-says>
						<b className="font-bold text-white">{words.title} </b>
						{words.says}
					</span>
					<span
						className="block truncate text-xs text-gray-400 md:text-sm"
						data-landed-more
					>
						<span className="hidden md:inline" aria-hidden>
							·{" "}
						</span>
						{words.when}
						{words.more && ` · ${words.more}`}
					</span>
				</span>
				<span className="hidden shrink-0 text-xs font-black uppercase tracking-[0.18em] text-sky-300/80 lg:inline">
					New on your services
				</span>
				<span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
					{landed.length}
				</span>
				<ChevronRightIcon
					className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open/landed:rotate-90"
					aria-hidden
				/>
			</summary>
			<ul className="border-t border-white/10">
				{landed.map((title) => {
					const { when, detail } = landedDayWords(title.at, title.days)
					const also = note?.(title)
					return (
						<li
							key={title.tmdbId}
							data-landed-row={title.tmdbId}
							className="border-t border-white/5 first:border-t-0"
						>
							<Link
								to={`/${title.mediaType}/${title.tmdbId}-${titleToDashed(canonicalMediaTitle(title))}`}
								prefetch="intent"
								className="group flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05] md:px-5"
							>
								{title.poster_path ? (
									<img
										src={tmdbImage(title.poster_path, "w92")}
										alt=""
										loading="lazy"
										decoding="async"
										className="h-[54px] w-9 shrink-0 rounded bg-white/5 object-cover"
									/>
								) : (
									<span className="block h-[54px] w-9 shrink-0 rounded bg-white/10" />
								)}
								<span className="min-w-0 flex-1">
									<b className="block truncate text-sm text-white">
										{title.title}
									</b>
									<span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
										{title.service &&
											(parts ? (
												parts.logo(title, title.service)
											) : (
												<Logo
													service={title.service}
													className="h-4 w-4 rounded"
												/>
											))}
										<span className="truncate">
											<span className="font-semibold text-sky-200">
												{newOn(title.service?.name ?? null)}
											</span>
											{also && ` · ${also}`}
											<span className="sm:hidden"> · {when}</span>
										</span>
									</span>
								</span>
								<span
									className="hidden w-24 shrink-0 text-right sm:block md:w-36"
									data-landed-day
								>
									<b className="block text-sm text-white">{when}</b>
									<span className="block text-xs text-gray-500">{detail}</span>
								</span>
								{parts?.end(title)}
								<ChevronRightIcon
									className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300 max-sm:hidden"
									aria-hidden
								/>
							</Link>
						</li>
					)
				})}
			</ul>
		</details>
	)
}
