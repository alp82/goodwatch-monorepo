// PROTOTYPE - throwaway (prototype/explore-r5). Small pieces the genres variants share: a poster tile, colored words,
// and the page's compact head.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { FOCUS, WRAP, poster } from "../../../../kit/ui"
import type { Lite, Word } from "./shared"

/** A title as its poster, untinted, with the real score pill and its name under it. One link to the title page. */
export function Tile({
	t,
	caption = true,
	eager = false,
	className = "",
}: {
	t: Lite
	caption?: boolean
	eager?: boolean
	className?: string
}) {
	return (
		<Link
			to={t.to}
			prefetch="intent"
			title={caption ? undefined : `${t.title}${t.year ? ` (${t.year})` : ""}`}
			className={`group/tile block min-w-0 rounded-lg ${FOCUS} ${className}`}
		>
			<span className="relative block overflow-hidden rounded-lg bg-gray-800 shadow-md ring-1 shadow-black/40 ring-white/10 transition-transform duration-200 ease-out group-hover/tile:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover/tile:translate-y-0">
				{t.poster ? (
					<img
						src={poster(t.poster, "w342")}
						alt=""
						loading={eager ? "eager" : "lazy"}
						decoding="async"
						className="block aspect-[2/3] w-full object-cover"
					/>
				) : (
					<span className="block aspect-[2/3] w-full" />
				)}
				{caption && (
					<ScorePill
						goodwatch={t.score}
						score={null}
						mark={null}
						size="S"
						className="absolute top-1.5 right-1.5"
					/>
				)}
			</span>
			{caption ? (
				<span className="mt-1.5 block">
					<span className="block truncate text-[13px] leading-tight font-semibold text-gray-100 group-hover/tile:text-white">
						{t.title}
					</span>
					{t.year && <span className="block text-xs text-gray-500">{t.year}</span>}
				</span>
			) : (
				<span className="sr-only">{t.title}</span>
			)}
		</Link>
	)
}

/** Trait words in their colors, said as a short list. */
export function Words({ words, className = "" }: { words: Word[]; className?: string }) {
	if (!words.length) return null
	return (
		<span className={className}>
			{words.map((w, i) => (
				<span key={w.word}>
					{i > 0 && <span className="text-gray-600"> · </span>}
					<span style={{ color: w.color }}>{w.word}</span>
				</span>
			))}
		</span>
	)
}

/** A genre's name, with the quiet word that tells doubles apart under movies and shows together. */
export function GenreName({ label, only }: { label: string; only: string | null }) {
	return (
		<>
			{label}
			{only && <span className="ml-1.5 text-[0.62em] font-medium text-gray-500">{only}</span>}
		</>
	)
}

/** The genres page's head: short, so the page's own instrument starts in the first screen. */
export function GenresHead({
	kicker,
	title,
	lede,
	children,
}: {
	kicker: string
	title: ReactNode
	lede?: ReactNode
	children?: ReactNode
}) {
	return (
		<header className={`${WRAP} pt-6 pb-5 sm:pt-8 sm:pb-6`}>
			<Kicker>{kicker}</Kicker>
			<PageTitle className="mt-2 text-3xl leading-[1.08] tracking-tight text-balance text-white sm:text-[2.6rem]">
				{title}
			</PageTitle>
			{lede && (
				<p className="mt-3 max-w-2xl text-base leading-relaxed text-pretty text-gray-300 sm:text-lg">
					{lede}
				</p>
			)}
			{children}
		</header>
	)
}
