// A signature trope as a card: its name, how rare it is, posters of other titles with it, and how it shows up here in
// a spoiler-free line. The Tropes sub-page's signature cards and the title page's Tropes section show the same card.
import {
	type CSSProperties,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import { fmt } from "~/ui/details/page-ui"
import { type Row, commonness, useAlsoIn } from "./model"
import type { CardTrope } from "./tropes-data"

/** A signature trope card's box (the tropes page's look); the title page's Tropes section shows the same cards. */
export const SIGNATURE_CARD =
	"flex flex-col gap-3 rounded-xl bg-white/[0.025] p-4 ring-1 ring-white/10 transition-colors duration-150 sm:p-5"

/** A signature trope card's content: name, rarity, posters of other titles with it, the spoiler-free teaser. */
export function SignatureCardFace({
	t,
	skip,
	size,
	read = true,
}: { t: CardTrope; skip: Skip; size: number; read?: boolean }) {
	return (
		<>
			<span className="flex items-start justify-between gap-3">
				<span className="min-w-0">
					<span className="block text-[17px] leading-snug font-semibold text-white">
						{t.name}
					</span>
					<span className="mt-1.5 block">
						<RarityMeter t={t} />
					</span>
				</span>
				<PosterStack t={t} skip={skip} size={size} />
			</span>
			<span className="line-clamp-3 text-[15px] leading-relaxed text-gray-300">
				{t.teaser}
			</span>
			{read && (
				<span className="mt-auto text-sm font-semibold text-amber-300/80 transition-colors group-hover:text-amber-300">
					Read →
				</span>
			)}
		</>
	)
}

export type Skip = { type: "movie" | "show"; id: number }

/** True once the element has come within `margin` of the viewport (and stays true). */
export function useSeen<T extends Element>(
	margin = "300px",
): [RefObject<T>, boolean] {
	const ref = useRef<T>(null)
	const [seen, setSeen] = useState(false)
	useEffect(() => {
		if (seen || !ref.current) return
		const io = new IntersectionObserver(
			(es) => es.some((e) => e.isIntersecting) && setSeen(true),
			{
				rootMargin: margin,
			},
		)
		io.observe(ref.current)
		return () => io.disconnect()
	}, [seen, margin])
	return [ref, seen]
}

/** How many catalog titles carry it, as a short log-scale track: a near-empty track is rare, a full one everywhere. */
export function RarityMeter({
	t,
	compact = false,
}: { t: Pick<Row, "titles" | "rare">; compact?: boolean }) {
	if (t.titles == null) return null
	const fill = commonness(t.titles)
	return (
		<span
			className="inline-flex items-center gap-2 text-xs whitespace-nowrap text-gray-400"
			title={`${fmt(t.titles)} titles in the catalog have it`}
		>
			<span
				aria-hidden
				className={`relative h-1 overflow-hidden rounded-full bg-white/[0.08] ${compact ? "w-8" : "w-12"}`}
			>
				<span
					className={`absolute inset-y-0 left-0 w-full origin-left rounded-full ${t.rare ? "bg-amber-300/80" : "bg-gray-400/60"}`}
					style={{ transform: `scaleX(${fill})` }}
				/>
			</span>
			{!compact && (
				<span className="tabular-nums">
					{t.rare && (
						<span className="font-semibold text-amber-200/90">Rare · </span>
					)}
					in {fmt(t.titles)} titles
				</span>
			)}
			{compact && <span className="sr-only">in {fmt(t.titles)} titles</span>}
		</span>
	)
}

export function YoursMark() {
	return (
		<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200/90">
			<span aria-hidden className="size-1.5 rounded-full bg-amber-300" />
			Your trope
		</span>
	)
}

/** Three posters of titles with the trope, overlapped; loads once it scrolls near. */
export function PosterStack({
	t,
	skip,
	size = 26,
	enabled = true,
	className = "",
}: {
	t: Pick<Row, "url">
	skip: Skip
	size?: number
	enabled?: boolean
	className?: string
}) {
	const [ref, seen] = useSeen<HTMLSpanElement>("200px")
	const q = useAlsoIn(t.url, enabled && seen, skip)
	const titles = (q.data?.titles ?? []).filter((x) => x.poster_path).slice(0, 3)
	const h = Math.round(size * 1.5)
	return (
		<span
			ref={ref}
			aria-hidden
			className={`relative flex shrink-0 items-center ${className}`}
			style={{ height: h }}
		>
			{!t.url
				? null
				: !q.data
					? [0, 1, 2].map((i) => (
							<span
								key={i}
								className="rounded-[3px] bg-white/[0.05] ring-1 ring-gray-900"
								style={{
									width: size,
									height: h,
									marginLeft: i ? -size * 0.45 : 0,
								}}
							/>
						))
					: titles.map((x, i) => (
							<span
								key={`${x.type}-${x.tmdb_id}`}
								className="block overflow-hidden rounded-[3px] shadow-md shadow-black/40 ring-1 ring-gray-900 transition-transform duration-200 group-hover:translate-x-[var(--spread)]"
								style={
									{
										width: size,
										height: h,
										marginLeft: i ? -size * 0.45 : 0,
										zIndex: 3 - i,
										"--spread": `${i * 3}px`,
									} as CSSProperties
								}
							>
								<TmdbImage
									kind="poster"
									path={x.poster_path}
									width={size}
									alt=""
									className="h-full w-full object-cover"
								/>
							</span>
						))}
		</span>
	)
}
