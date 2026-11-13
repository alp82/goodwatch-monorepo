// The reading pieces of the Tropes sub-page: "Also in" posters (the site's poster card) and the trope article: this
// title's write-up at a reading measure with spoilers covered, what the trope is, and where to go next. The rarity
// meter and the tiny poster stack are the cards' (TropeCard.tsx).
import { ArrowUpRightIcon } from "@heroicons/react/20/solid"
import { tropeDiscoverPath } from "~/domain/trope-filter"
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { TmdbImage } from "~/ui/TmdbImage"
import { CAPTION, Reveal, fmt } from "~/ui/details/page-ui"
import { DescriptionOpening } from "~/ui/profile/tropes/Opening"
import { titlePath } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import type { SizeRule } from "~/utils/tmdb-image"
import {
	PosterStack,
	RarityMeter,
	type Skip,
	YoursMark,
	useSeen,
} from "./TropeCard"
import type { Paragraph } from "./excerpt"
import { type Row, useAlsoIn, useTropeOpening } from "./model"

const ALSO_IN_SIZES: Record<"wide" | "narrow" | "rail", SizeRule[]> = {
	wide: [
		["(min-width: 1024px)", "130px"],
		[null, "23vw"],
	],
	narrow: [
		["(min-width: 1024px)", "110px"],
		[null, "30vw"],
	],
	rail: [
		["(min-width: 1024px)", "100px"],
		[null, "30vw"],
	],
}

/**
 * "Also in": the site's poster cards of other titles with the trope, loaded when asked (`enabled`). Each poster goes to
 * that title's tropes page, so a reader stays on tropes from title to title.
 */
export function AlsoIn({
	t,
	skip,
	enabled = true,
	count = 6,
	grid = "grid-cols-3 sm:grid-cols-6",
	sizes = "wide",
	heading = true,
	className = "",
}: {
	t: Row
	skip: Skip
	enabled?: boolean
	count?: number
	grid?: string
	sizes?: keyof typeof ALSO_IN_SIZES
	heading?: boolean
	className?: string
}) {
	const q = useAlsoIn(t.url, enabled, skip)
	if (!t.url) return null
	const titles = q.data?.titles.slice(0, count)
	if (q.data && !titles?.length) return null
	return (
		<section
			aria-label={`Also in, titles with ${t.name}`}
			className={className}
		>
			{heading && (
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<h3 className={CAPTION}>
						Also in
						<span className="normal-case tracking-normal text-gray-600">
							{" "}
							· well-loved titles with it
						</span>
					</h3>
					<Link
						to={tropeDiscoverPath(t.url)}
						prefetch="intent"
						className="shrink-0 text-xs font-semibold text-gray-400 hover:text-white"
					>
						More →
					</Link>
				</div>
			)}
			<ul className={`grid gap-2 ${grid}`}>
				{titles
					? titles.map((x) => (
							<li key={`${x.type}-${x.tmdb_id}`} className="min-w-0">
								<Reveal>
									<MovieTvCard
										details={x}
										mediaType={x.type}
										posterSizes={ALSO_IN_SIZES[sizes]}
										href={`${titlePath(x.type, x.tmdb_id, canonicalMediaTitle(x))}/tropes`}
									/>
								</Reveal>
							</li>
						))
					: Array.from({ length: count }, (_, i) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className="aspect-[2/3] animate-pulse rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]"
							/>
						))}
			</ul>
		</section>
	)
}

/** The write-up at a reading measure; spoilers covered until tapped. Several paragraphs read as a quiet list. */
export function ReadingText({
	paragraphs,
	size = "lg",
}: { paragraphs: Paragraph[]; size?: "lg" | "md" }) {
	const many = paragraphs.length > 1
	return (
		<div
			className={`max-w-[65ch] text-pretty text-gray-200 ${size === "lg" ? "space-y-3.5 text-[16px] leading-[1.75] sm:text-[17px]" : "space-y-3 text-[15px] leading-[1.7] sm:text-[16px]"}`}
		>
			{paragraphs.map((p, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: paragraphs never reorder
				<p key={i} className={many ? "relative pl-5" : ""}>
					{many && (
						<span
							aria-hidden
							className="absolute top-[0.78em] left-1 h-px w-2 bg-gray-500"
						/>
					)}
					{p.map((r, k) =>
						r.spoiler ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: runs never reorder
							<Spoiler key={k} text={r.text} />
						) : (
							// biome-ignore lint/suspicious/noArrayIndexKey: runs never reorder
							<span key={k}>{r.text}</span>
						),
					)}
				</p>
			))}
		</div>
	)
}

/**
 * A spoiler: a small "Spoiler" tag, then the words blurred on a faint wash; a tap shows them (and they stay shown).
 * Opacity and filter fade only.
 */
function Spoiler({ text }: { text: string }) {
	const [open, setOpen] = useState(false)
	if (open)
		return (
			<span className="rounded-sm bg-amber-200/[0.06]">
				<span className="sr-only">Spoiler: </span>
				{text}
			</span>
		)
	return (
		<button
			type="button"
			onClick={() => setOpen(true)}
			aria-label="Spoiler, tap to show"
			title="Tap to show"
			className="group/sp inline cursor-pointer rounded-sm text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
		>
			<span className="mr-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-white/[0.08] px-2 align-middle text-[10px] leading-[1.6] font-semibold tracking-[.12em] text-gray-300 uppercase ring-1 ring-white/10 transition-colors group-hover/sp:bg-amber-300/15 group-hover/sp:text-amber-100">
				Spoiler
			</span>
			<span
				aria-hidden
				className="rounded-sm bg-white/[0.04] text-gray-300/80 blur-[5px] transition-[filter] duration-200 group-hover/sp:blur-[4px]"
			>
				{text}
			</span>
		</button>
	)
}

/** What the trope is: its first sentence, the TV Tropes opening on demand. */
export function WhatItIs({
	t,
	className = "",
}: { t: Row; className?: string }) {
	const [more, setMore] = useState(false)
	const opening = useTropeOpening(t.url, more)
	if (!t.meaning) return null
	return (
		<section
			aria-label="What it is"
			className={`max-w-[65ch] border-l-2 border-white/10 pl-4 ${className}`}
		>
			<p className={`${CAPTION} mb-1`}>What it is</p>
			{more && opening.data?.opening ? (
				<Reveal className="text-[15px] leading-relaxed text-gray-300">
					<DescriptionOpening opening={opening.data.opening} url={t.url} />
				</Reveal>
			) : (
				<p className="text-[15px] leading-relaxed text-gray-400">
					{t.meaning}{" "}
					{t.url && (
						<button
							type="button"
							onClick={() => setMore(true)}
							disabled={more}
							className="cursor-pointer whitespace-nowrap font-semibold text-amber-300/90 hover:text-amber-300 disabled:cursor-wait disabled:opacity-60"
						>
							{more ? "Loading…" : "More"}
						</button>
					)}
				</p>
			)}
		</section>
	)
}

/** Where next: the member's picks with it, or Discover; and TV Tropes. */
export function NextLinks({
	t,
	className = "",
}: { t: Row; className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${className}`}>
			{t.picks ? (
				<Link
					to={t.picks}
					prefetch="intent"
					className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-amber-200 hover:text-amber-100"
				>
					<span aria-hidden className="size-1.5 rounded-full bg-amber-300" />
					Your picks with it →
				</Link>
			) : (
				<Link
					to={tropeDiscoverPath(t.url)}
					prefetch="intent"
					className="inline-flex min-h-10 items-center text-sm font-semibold text-gray-200 hover:text-white"
				>
					Find more with it on Discover →
				</Link>
			)}
			{t.url && (
				<a
					href={t.url}
					target="_blank"
					rel="noreferrer noopener"
					className="inline-flex min-h-10 items-center gap-1 text-sm text-gray-400 hover:text-white"
				>
					TV Tropes
					<ArrowUpRightIcon aria-hidden className="size-3.5" />
					<span className="sr-only"> (opens in a new tab)</span>
				</a>
			)}
		</div>
	)
}

/** This title's write-up under a small "In <title>" label, or the plain note when TV Tropes lists the name only. */
export function InTitle({
	t,
	title,
	size = "lg",
}: { t: Row; title: string; size?: "lg" | "md" }) {
	// The write-up is on its way (the index carries only the signature tropes' own).
	if (t.paragraphs === undefined)
		return (
			<output aria-busy className="flex max-w-[65ch] flex-col gap-2.5">
				<span className="sr-only">Loading the write-up…</span>
				<span className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
				<span className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
				<span className="h-4 w-11/12 animate-pulse rounded bg-white/[0.04]" />
				<span className="h-4 w-2/3 animate-pulse rounded bg-white/[0.04]" />
			</output>
		)
	return t.paragraphs ? (
		<section aria-label={`In ${title}`}>
			<p className="mb-2 text-[11px] font-semibold tracking-[.14em] text-amber-300/80 uppercase">
				In {title}
			</p>
			<ReadingText paragraphs={t.paragraphs} size={size} />
			{t.length > 950 && t.url && (
				<p className="mt-2 text-xs text-gray-500">
					The start of a longer write-up.{" "}
					<a
						href={t.url}
						target="_blank"
						rel="noreferrer noopener"
						className="text-gray-400 underline-offset-2 hover:text-white hover:underline"
					>
						Read it all on TV Tropes
					</a>
				</p>
			)}
		</section>
	) : (
		<p className="text-[15px] text-gray-500">
			TV Tropes lists it for {title} without a write-up.
		</p>
	)
}

/** The meta line under a trope's name: rarity, Yours, Signature. */
export function MetaLine({
	t,
	signature = false,
	className = "",
}: { t: Row; signature?: boolean; className?: string }) {
	return (
		<div
			className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}
		>
			<RarityMeter t={t} />
			{t.picks && <YoursMark />}
			{signature && (
				<span className="text-xs text-gray-500">Signature trope</span>
			)}
		</div>
	)
}

/** Prefers reduced motion (read once on the client). */
export const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Matches the large breakpoint (1024px), live. False on the server. */
export function useDesktop() {
	const [on, setOn] = useState(false)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 1024px)")
		const update = () => setOn(m.matches)
		update()
		m.addEventListener("change", update)
		return () => m.removeEventListener("change", update)
	}, [])
	return on
}
