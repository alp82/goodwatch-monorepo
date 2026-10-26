// The open band's pieces.
// - Two plain labels keep the general and the per-title text apart: "What it is" (sky, the TV Tropes description) and
//   "In <Title>" (amber, the excerpt for that title).
// - The numbers on one line.
// - The excerpt stage at a fixed height, so switching titles never moves anything; the old excerpt fades out while the
//   new one fades in. A spoiler cover for titles the viewer hasn't seen.
// - Prev / next with "3 of 12", the TV Tropes link and the license credit, every target at least 44 px.
import {
	ArrowTopRightOnSquareIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import type { ProfileTitle } from "~/domain/profile"
import { PosterImg, ScoreChip } from "~/ui/profile/parts"
import { signed } from "~/ui/profile/taste/model"
import { DEFINING, type RankedTrope } from "./model"
import { EASE } from "./motion"
import { useExcerpts } from "./useExcerpts"

/** One trope's defining titles, the selected one, its excerpt, and the spoiler reveals. */
export function useDetail(
	handle: string,
	tag: RankedTrope,
	titles: Record<string, ProfileTitle>,
	seen: (key: string) => boolean,
	focus: string | null,
	onFocus: (key: string) => void,
) {
	const top = definingTitles(tag, titles)
	const { loading, textOf, labelOf } = useExcerpts(
		handle,
		tag.id ?? tag.name,
		top.map((t) => t.key),
	)
	const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
	const i = Math.max(
		0,
		top.findIndex((t) => t.key === focus),
	)
	const t = top[i] ?? null
	return {
		top,
		i,
		t,
		loading,
		textOf,
		labelOf,
		covered: (key: string) => !seen(key) && !revealed.has(key),
		reveal: (key: string) => setRevealed((s) => new Set(s).add(key)),
		step: (d: number) =>
			top.length && onFocus(top[(i + d + top.length) % top.length].key),
	}
}
export type DetailState = ReturnType<typeof useDetail>

export const definingTitles = (
	tag: RankedTrope,
	titles: Record<string, ProfileTitle>,
) =>
	tag.top
		.map((k) => titles[k])
		.filter(Boolean)
		.slice(0, DEFINING)

export function WhatItIs({ className = "" }: { className?: string }) {
	return (
		<p
			className={`text-xs font-bold tracking-[0.16em] text-sky-300 uppercase ${className}`}
		>
			What it is
		</p>
	)
}

export function TitleLink({
	t,
	className = "",
}: { t: ProfileTitle; className?: string }) {
	return (
		<Link
			to={t.href}
			prefetch="intent"
			className={`font-bold text-white hover:text-amber-200 hover:underline ${className}`}
		>
			{t.title}
		</Link>
	)
}

/** "In Training Day": the label that says the text below is about that title. The title links to its page. */
export function InTitle({
	t,
	className = "",
}: { t: ProfileTitle; className?: string }) {
	return (
		<p className={`flex min-w-0 items-center gap-2 ${className}`}>
			<span className="shrink-0 text-xs font-bold tracking-[0.16em] text-amber-300 uppercase">
				In
			</span>
			<TitleLink
				t={t}
				className="inline-flex min-h-11 min-w-0 items-center truncate text-base leading-tight sm:text-lg"
			/>
			{t.year && (
				<span className="shrink-0 text-sm text-gray-500 tabular-nums">
					{t.year}
				</span>
			)}
			{t.score != null && (
				<span className="shrink-0">
					<ScoreChip score={t.score} size="sm" />
				</span>
			)}
		</p>
	)
}

export function Numbers({
	tag,
	usual,
	owner,
	className = "",
}: {
	tag: RankedTrope
	usual: number
	owner: boolean
	className?: string
}) {
	const lift = Math.round((tag.average - usual) * 10) / 10
	return (
		<p
			className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-400 ${className}`}
		>
			<span>
				<b className="text-base font-black text-white tabular-nums">
					{tag.count}
				</b>{" "}
				of {owner ? "your" : "their"} titles
			</span>
			<span>
				<b className="text-base font-black text-white tabular-nums">
					{tag.loved}
				</b>{" "}
				scored 8 or more
			</span>
			<span>
				<b
					className={`text-base font-black tabular-nums ${lift > 0 ? "text-green-400" : lift < 0 ? "text-rose-400" : "text-white"}`}
				>
					{tag.average.toFixed(1)}
				</b>{" "}
				average, {signed(lift)} on {owner ? "your" : "their"} usual
			</span>
		</p>
	)
}

export function Steps({
	d,
	className = "",
}: { d: DetailState; className?: string }) {
	return (
		<div className={`flex shrink-0 items-center gap-1 ${className}`}>
			<span className="mr-1 text-xs text-gray-500 tabular-nums">
				{d.i + 1} of {d.top.length}
			</span>
			{([-1, 1] as const).map((dir) => {
				const Icon = dir < 0 ? ChevronLeftIcon : ChevronRightIcon
				return (
					<button
						key={dir}
						type="button"
						onClick={() => d.step(dir)}
						aria-label={dir < 0 ? "Previous title" : "Next title"}
						className="flex size-11 cursor-pointer items-center justify-center rounded-full text-gray-200 ring-1 ring-white/15 hover:bg-white/10"
					>
						<Icon className="size-5" aria-hidden />
					</button>
				)
			})}
		</div>
	)
}

/** The excerpt, blurred behind a cover the viewer taps when they haven't seen the title. Same size either way. */
export function Excerpt({
	text,
	covered,
	onReveal,
	className = "",
}: {
	text: string | null
	covered: boolean
	onReveal: () => void
	className?: string
}) {
	if (text === null)
		return (
			<span className={`block text-gray-500 ${className}`}>
				No write-up for this title.
			</span>
		)
	return (
		<span className={`relative block ${className}`}>
			<span
				className={`block ${covered ? "blur-[5px] select-none" : ""}`}
				aria-hidden={covered || undefined}
			>
				{text}
			</span>
			{covered && (
				<button
					type="button"
					onClick={onReveal}
					className="absolute inset-0 flex cursor-pointer items-center justify-center"
				>
					<span className="rounded-full bg-gray-950/85 px-3 py-1 text-xs font-bold text-gray-100 ring-1 ring-white/15">
						Spoiler · tap to reveal
					</span>
				</button>
			)}
		</span>
	)
}

/** The excerpt at a fixed height (`className` sets it); switching titles crossfades. */
export function ExcerptStage({
	d,
	className = "h-40",
	textClass = "text-[15px] leading-relaxed text-gray-200",
}: { d: DetailState; className?: string; textClass?: string }) {
	const t = d.t
	return (
		<div className={`relative ${className}`} aria-live="polite">
			<AnimatePresence initial={false}>
				{t && !d.loading && (
					<motion.div
						key={t.key}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.22, ease: EASE }}
						className={`absolute inset-0 overflow-y-auto pr-1 [scrollbar-width:thin] ${textClass}`}
					>
						<Excerpt
							text={d.textOf(t.key)}
							covered={d.covered(t.key)}
							className={d.covered(t.key) ? "h-full overflow-hidden" : ""}
							onReveal={() => d.reveal(t.key)}
						/>
						{d.labelOf(t.key) && (
							<p className="mt-2 text-xs text-gray-400">
								Listed as “{d.labelOf(t.key)}”
							</p>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** A defining title's poster that selects it, with the owner's score in the corner. */
export function PosterButton({
	t,
	on,
	onClick,
}: {
	t: ProfileTitle
	on: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			aria-label={`How it shows up in ${t.title}`}
			title={t.title}
			className={`group relative block w-full cursor-pointer rounded-md ${on ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-950" : ""}`}
		>
			<PosterImg
				title={t}
				className="rounded-md shadow-lg ring-1 ring-white/10 transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transition-none"
			/>
			{t.score != null && (
				<span className="absolute -right-1 -bottom-1">
					<ScoreChip score={t.score} size="sm" />
				</span>
			)}
		</button>
	)
}

/** The TV Tropes link and the license credit, side by side where there's room. */
export function Credits({
	tag,
	className = "",
}: { tag: RankedTrope; className?: string }) {
	if (!tag.url) return null
	return (
		<div className={`flex flex-wrap items-center gap-x-6 ${className}`}>
			<a
				href={tag.url}
				target="_blank"
				rel="noreferrer noopener"
				className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-sky-300 hover:text-sky-200"
			>
				Read about it on TV Tropes (opens in a new tab)
				<ArrowTopRightOnSquareIcon className="size-4" aria-hidden />
			</a>
			<LicenseCredit />
		</div>
	)
}

/** "Excerpts from TV Tropes, CC BY-NC-SA 3.0", linking to the license: quiet, 44 px tall to tap. */
export function LicenseCredit({ className = "" }: { className?: string }) {
	return (
		<a
			href="https://creativecommons.org/licenses/by-nc-sa/3.0/"
			target="_blank"
			rel="noreferrer noopener license"
			className={`inline-flex min-h-11 items-center text-xs text-gray-500 hover:text-gray-300 hover:underline ${className}`}
		>
			Excerpts from TV Tropes, CC BY-NC-SA 3.0
		</a>
	)
}

/** No tropes for the filters: the same place the list takes, plain words, one way out. */
export function NoMatches({ onClear }: { onClear: () => void }) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-start gap-3 pt-16 text-center">
			<p className="text-base font-bold text-white">
				No tropes in these titles.
			</p>
			<button
				type="button"
				onClick={onClear}
				className="min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold text-gray-200 ring-1 ring-white/15 hover:bg-white/10"
			>
				Clear filters
			</button>
		</div>
	)
}
