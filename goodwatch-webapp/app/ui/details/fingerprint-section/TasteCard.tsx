// Where the title sits in the member's taste, as a card in the fingerprint section: the taste group's loved titles
// fanned out, a wash in the badge's color (amber when the title fits a group, sky when it's close to one or between
// two) over a still, blurred copy of the first poster, the group's name in the display face, and Watch next in the
// same color. Production's words (title-sides-copy) and rules: the server decides the group, and rating, watching or
// dismissing the title takes the card away, as it is no longer a recommendation.
import { Link } from "@remix-run/react"
import {
	useIsNotInterested,
	useIsSkipped,
	useUserScore,
	useWatchState,
} from "~/hooks/useUserDataAccessors"
import type { TitleSides } from "~/server/title-sides.server"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	TITLE_SIDES_COPY as COPY,
	titleSidesText,
} from "~/ui/details/hero/title-sides-copy"
import { titleToDashed } from "~/utils/helpers"

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'
const TMDB = "https://image.tmdb.org/t/p"

const LOOKS = {
	fits: {
		rgb: "245 158 11",
		text: "#fcd34d",
		icon: "M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z",
	},
	close: { rgb: "56 189 248", text: "#7dd3fc", icon: "M3 10h14M10 3l7 7-7 7" },
} as const

export function TasteCard({
	sides,
	mediaType,
	tmdbId,
	className = "",
}: {
	sides: TitleSides
	mediaType: "movie" | "show"
	tmdbId: number
	className?: string
}) {
	const score = useUserScore(mediaType, tmdbId)
	const watchState = useWatchState(mediaType, tmdbId)
	const notInterested = useIsNotInterested(mediaType, tmdbId)
	const skipped = useIsSkipped(mediaType, tmdbId)
	if (score || watchState || notInterested || skipped) return null

	const { side, other } = sides
	const { text: sentence, phone } = titleSidesText(sides)
	const stack = [...side.near, ...(other?.near ?? [])].slice(0, 4)
	const look = sides.at === "edge" ? LOOKS.close : LOOKS.fits
	const tint = (a: number) => `rgb(${look.rgb} / ${a})`
	const n = stack.length
	return (
		<section
			aria-label={COPY.label}
			data-feedback-area="taste-fit"
			className={`group/taste relative isolate overflow-hidden rounded-2xl ${className}`}
			style={{
				border: `1px solid ${tint(0.28)}`,
				background: `linear-gradient(100deg, ${tint(0.2)} 0%, ${tint(0.07)} 45%, rgb(255 255 255 / 0.015) 100%)`,
			}}
		>
			{/* A still, blurred copy of the first poster under the wash: color from the group's own titles. */}
			{stack[0]?.poster && (
				<img
					src={`${TMDB}/w92${stack[0].poster}`}
					alt=""
					aria-hidden="true"
					className="pointer-events-none absolute top-1/2 left-0 -z-10 h-[220%] w-[45%] -translate-y-1/2 object-cover opacity-30 blur-2xl saturate-150"
				/>
			)}
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
				{/* The loved titles, fanned; they spread a little on hover (transform only). */}
				<div
					className="relative h-[3.75rem] shrink-0"
					style={{ width: `calc(2.5rem + ${Math.max(0, n - 1)} * 1.15rem)` }}
				>
					{stack.map((t, i) => {
						const mid = (n - 1) / 2
						return (
							<Link
								key={`${t.mediaType}-${t.tmdbId}`}
								to={`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`}
								prefetch="intent"
								title={t.title}
								className="fp-taste-fan absolute top-0 block w-10 overflow-hidden rounded-md bg-gray-900 shadow-lg shadow-black/50 ring-2 ring-stone-950 focus-visible:outline-2 focus-visible:outline-amber-300"
								style={{
									left: `calc(${i} * 1.15rem)`,
									zIndex: n - i,
									["--r" as string]: `${(i - mid) * 5}deg`,
									["--x" as string]: `${(i - mid) * 3}px`,
								}}
							>
								<TmdbImage
									kind="poster"
									path={t.poster}
									width={80}
									alt={COPY.poster(t.title)}
									className="block aspect-[2/3] w-full object-cover"
									draggable={false}
								/>
							</Link>
						)
					})}
				</div>
				<div className="min-w-0 flex-1">
					<p
						className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] uppercase"
						style={{ color: look.text }}
					>
						<svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
							<path
								d={look.icon}
								fill={look === LOOKS.fits ? "currentColor" : "none"}
								stroke="currentColor"
								strokeWidth={look === LOOKS.fits ? 0 : 2.2}
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						{look === LOOKS.fits ? COPY.fits : COPY.close}
					</p>
					{sentence && (
						<p
							className="mt-0.5 text-[18px] leading-snug font-bold text-white sm:text-[20px]"
							style={{ fontFamily: DISPLAY }}
						>
							{phone ? (
								<>
									<span className="max-sm:hidden">{sentence}</span>
									<span className="sm:hidden">{phone}</span>
								</>
							) : (
								sentence
							)}
						</p>
					)}
				</div>
				<Link
					to={
						side.moods.length
							? `/watch-next?moods=${side.moods.join(",")}`
							: "/watch-next"
					}
					className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors max-sm:w-full"
					style={{
						color: look.text,
						background: tint(0.14),
						boxShadow: `inset 0 0 0 1px ${tint(0.35)}`,
					}}
				>
					{COPY.watchNext}
					<span aria-hidden="true">→</span>
				</Link>
			</div>
		</section>
	)
}
