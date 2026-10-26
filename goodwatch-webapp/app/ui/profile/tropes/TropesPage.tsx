// The profile's Tropes tab: full-width bands in ranked order, stepping down in size. Ranks 1-3 are hero bands that
// already show how the trope shows up in their top title ("In <Title>": the poster and the excerpt's first lines,
// covered when the viewer hasn't seen it); 4-10 medium bands, the rest compact rows. Opening a band carries on:
//   What it is      the TV Tropes description (when there is one) and the numbers on one line
//   below, side by side at the same height: the 12 defining titles as a poster grid, and the reader (the selected
//   title's backdrop, "In <Title>", prev / next, the excerpt); on phones a poster row above the reader
//   the TV Tropes link and the license credit; a page-level credit also closes the list, for the bands' excerpts
// The filter bar (FilterStrip) sits above. Motion: the tapped band holds still and the others slide (FLIP, transform
// only), the detail fades in, switching titles crossfades; nothing moves with reduced motion.
// Spec: docs/implementation/taste-redesign.md, decision 3.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { TropesPreview } from "~/server/profile/tropes-preview"
import type { ProfileTropes } from "~/server/profile/tropes.server"
import { PosterImg, backdropUrl, posterUrl } from "~/ui/profile/parts"
import { describeTrope } from "~/utils/profile-trope-descriptions"
import { FilterStrip } from "./FilterStrip"
import {
	type RankedTrope,
	type Tier,
	WHOLE_WORDS,
	nameSize,
	teaser,
	tierOf,
} from "./model"
import { EASE, reducedMotion, reveal, useBandMotion, useWide } from "./motion"
import {
	Credits,
	type DetailState,
	ExcerptStage,
	InTitle,
	LicenseCredit,
	NoMatches,
	Numbers,
	PosterButton,
	Steps,
	WhatItIs,
	definingTitles,
	useDetail,
} from "./parts"
import { useDescriptions } from "./useDescriptions"
import { useExcerpts } from "./useExcerpts"
import { type TropeFacets, useTropeFacets } from "./useTropeFacets"

const PAGE = 30

export function TropesPage({
	shell,
	data,
	preview,
	descriptionSeed,
	loading = false,
	retry,
}: {
	shell: ProfileShell
	data: ProfileTropes
	preview?: TropesPreview
	descriptionSeed?: TropesPreview
	loading?: boolean
	retry?: () => void
}) {
	const m = useTropeFacets(data, shell.viewer === "owner", preview)
	const handle = shell.handle
	const [open, setOpen] = useState<string | null>(null)
	const [focus, setFocus] = useState<string | null>(null)
	const [shown, setShown] = useState(PAGE)
	const visible = m.tropes.slice(0, shown)
	const descriptions = useDescriptions(shell, visible, descriptionSeed)
	const list = useRef<HTMLOListElement>(null)
	const openRef = useRef<HTMLLIElement | null>(null)
	const snap = useBandMotion(list, open)
	const wide = useWide(768)
	const strip = useWide(1024)

	const pick = (tag: RankedTrope, title?: string) => {
		snap(
			list.current?.querySelector<HTMLElement>(
				`[data-trope="${CSS.escape(tag.id ?? tag.name)}"]`,
			) ?? null,
		)
		if ((tag.id ?? tag.name) === open && !title) return setOpen(null)
		setOpen(tag.id ?? tag.name)
		setFocus(title ?? tag.top[0] ?? null)
	}
	useEffect(() => {
		if (!open) return
		// Clear of the site header and the profile tabs.
		const id = requestAnimationFrame(() => reveal(openRef.current, 150))
		return () => cancelAnimationFrame(id)
	}, [open])

	const rows = visible.map((tag) => describeTrope(tag, descriptions))
	return (
		<MotionConfig reducedMotion="user">
			<div className="flex flex-col gap-4">
				<fieldset
					disabled={!!preview}
					aria-busy={!!preview}
					className="min-w-0"
				>
					<legend className="sr-only">Filter tropes</legend>
					<FilterStrip m={m} wide={strip} />
				</fieldset>
				{preview && (
					<p role="status" className="text-sm text-gray-400">
						{loading ? (
							"Preparing filters…"
						) : (
							<>
								Filters could not load.{" "}
								<button type="button" className="underline" onClick={retry}>
									Try again
								</button>
							</>
						)}
					</p>
				)}
				{rows.length === 0 ? (
					<NoMatches onClear={m.reset} />
				) : (
					<ol ref={list} className="flex min-h-[50vh] flex-col gap-2">
						{rows.map((tag, i) => {
							const on = (tag.id ?? tag.name) === open
							const tier = tierOf(i)
							return (
								<li
									key={tag.id ?? tag.name}
									data-flip=""
									data-trope={tag.id ?? tag.name}
									ref={on ? openRef : undefined}
									className={`relative overflow-hidden bg-gray-900 ring-1 transition-[box-shadow] ${tier === "compact" && !on ? "rounded-xl" : "rounded-2xl"} ${on ? "ring-amber-400/50" : "ring-white/10 hover:ring-white/25"}`}
								>
									<Band
										tag={tag}
										rank={i + 1}
										tier={tier}
										on={on}
										m={m}
										handle={handle}
										wide={wide}
										onPick={pick}
									/>
									{on && (
										<motion.div
											initial={{ opacity: 0, y: -10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.32, ease: EASE }}
										>
											<Detail
												tag={tag}
												m={m}
												handle={handle}
												focus={focus}
												onFocus={setFocus}
												wide={wide}
											/>
										</motion.div>
									)}
								</li>
							)
						})}
						{m.total > shown && (
							<li data-flip="" className="flex justify-center pt-2">
								<button
									type="button"
									disabled={!!preview}
									onClick={() => setShown((n) => n + PAGE)}
									className="min-h-11 cursor-pointer rounded-full px-5 text-sm font-bold text-gray-200 ring-1 ring-white/15 hover:bg-white/10"
								>
									Show {Math.min(PAGE, m.total - shown)} more tropes
								</button>
							</li>
						)}
					</ol>
				)}
				{rows.length > 0 && (
					// Hero bands and band lines show TV Tropes text before any band opens.
					<p className="flex justify-center">
						<LicenseCredit />
					</p>
				)}
			</div>
		</MotionConfig>
	)
}

function Band({
	tag,
	rank,
	tier,
	on,
	m,
	handle,
	wide,
	onPick,
}: {
	tag: RankedTrope
	rank: number
	tier: Tier
	on: boolean
	m: TropeFacets
	handle: string
	wide: boolean
	onPick: (tag: RankedTrope, title?: string) => void
}) {
	const hero = tier === "hero"
	const compact = tier === "compact"
	const share = tag.loved / Math.max(1, tag.count)
	const line = teaser(tag.description)
	const posters = tag.top
		.map((k) => m.titles[k])
		.filter(Boolean)
		.slice(0, wide ? 5 : 2)
	const numbers = `${tag.loved} of ${tag.count} loved · ${tag.average.toFixed(1)} avg`
	return (
		<div
			className={`relative flex gap-3 sm:gap-5 ${hero ? "flex-col p-4 md:flex-row md:items-stretch md:p-6 md:pr-14" : compact ? "min-h-14 items-center px-3 py-2 sm:px-5" : "items-center p-3 sm:px-5 sm:py-4"}`}
		>
			<button
				type="button"
				onClick={() => onPick(tag)}
				aria-expanded={on}
				aria-label={tag.name}
				className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset"
			/>
			<span className="pointer-events-none flex min-w-0 flex-1 gap-3 sm:gap-4">
				<span
					className={`shrink-0 text-right font-black text-gray-500 tabular-nums ${hero ? "w-8 pt-1 text-2xl sm:w-12 sm:text-4xl" : compact ? "w-7 self-center text-sm sm:w-12 sm:text-base" : "w-7 pt-0.5 text-base sm:w-12 sm:text-xl"}`}
				>
					{rank}
				</span>
				<span className="min-w-0 flex-1">
					<span
						lang="en"
						className={`block font-black leading-[1.05] text-white ${WHOLE_WORDS} ${hero ? `pr-6 md:pr-0 ${nameSize(tag.name, "hero")}` : compact ? "text-base font-bold sm:text-lg" : nameSize(tag.name, "big")}`}
					>
						{tag.name}
					</span>
					{!on && !compact && line && (
						<span
							className={`mt-1.5 block ${hero ? "line-clamp-2 text-base text-gray-300" : "line-clamp-1 text-sm text-gray-400"}`}
						>
							{line}
						</span>
					)}
					{!compact && (
						<span className="mt-2 flex items-center gap-2 text-xs text-gray-400">
							<span className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
								<span
									className="absolute inset-y-0 left-0 rounded-full bg-sky-400"
									style={{ width: `${Math.max(8, share * 100)}%` }}
								/>
							</span>
							{numbers}
						</span>
					)}
				</span>
			</span>
			{hero && !on && <Preview tag={tag} m={m} handle={handle} />}
			{compact && (
				<span className="pointer-events-none hidden shrink-0 text-xs text-gray-400 tabular-nums sm:block">
					{numbers}
				</span>
			)}
			{tier === "medium" && !on && (
				<span className="relative flex shrink-0 gap-1.5">
					{posters.map((t) => (
						<button
							key={t.key}
							type="button"
							onClick={() => onPick(tag, t.key)}
							aria-label={`${tag.name} in ${t.title}`}
							title={t.title}
							className="w-11 cursor-pointer overflow-hidden rounded-[5px] ring-1 ring-white/15 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none sm:w-12"
						>
							{t.poster ? (
								<img
									src={posterUrl(t.poster, "w185") ?? ""}
									alt=""
									className="aspect-[2/3] w-full object-cover"
									loading="lazy"
								/>
							) : (
								<span className="block aspect-[2/3] w-full bg-white/10" />
							)}
						</button>
					))}
				</span>
			)}
			<ChevronDownIcon
				className={`pointer-events-none size-5 shrink-0 text-gray-500 transition-transform duration-300 ${on ? "rotate-180 text-amber-300" : ""} ${hero ? "absolute top-4 right-3 sm:right-4" : ""}`}
				aria-hidden
			/>
		</div>
	)
}

/** A hero band's first look: how the trope shows up in its top title, the excerpt's first lines. */
function Preview({
	tag,
	m,
	handle,
}: { tag: RankedTrope; m: TropeFacets; handle: string }) {
	const top = definingTitles(tag, m.titles)
	const { loading, textOf } = useExcerpts(
		handle,
		tag.id ?? tag.name,
		top.map((t) => t.key),
	)
	const t = top[0]
	if (!t) return null
	const text = textOf(t.key)
	const covered = !m.seen(t.key)
	return (
		<span className="pointer-events-none flex shrink-0 gap-3 rounded-xl bg-gray-800 p-3 md:w-[26rem] md:self-center lg:w-[30rem]">
			<span className="w-14 shrink-0 md:w-16">
				<PosterImg title={t} className="rounded-md ring-1 ring-white/10" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline gap-2">
					<span className="text-xs font-bold tracking-[0.16em] text-amber-300 uppercase">
						In
					</span>
					<span className="truncate text-sm font-bold text-white">
						{t.title}
					</span>
				</span>
				<span
					className={`mt-1 line-clamp-4 text-[13px] leading-relaxed text-gray-300 transition-opacity ${loading ? "opacity-0" : "opacity-100"} ${covered ? "blur-[4px] select-none" : ""}`}
					aria-hidden={covered || undefined}
				>
					{text ?? "No write-up for this title."}
				</span>
			</span>
		</span>
	)
}

function Detail({
	tag,
	m,
	handle,
	focus,
	onFocus,
	wide,
}: {
	tag: RankedTrope
	m: TropeFacets
	handle: string
	focus: string | null
	onFocus: (key: string) => void
	wide: boolean
}) {
	const d = useDetail(handle, tag, m.titles, m.seen, focus, onFocus)
	const label = (
		<p className="mb-2.5 text-xs font-bold tracking-[0.16em] text-gray-400 uppercase">
			The titles that define it {m.owner ? "for you" : "for them"}
		</p>
	)
	return (
		<div className="px-4 pb-4 sm:px-5 sm:pb-6 md:pl-[5.25rem]">
			<section aria-label={tag.description ? "What it is" : undefined}>
				{tag.description && (
					<>
						<WhatItIs />
						<p className="mt-1.5 max-w-3xl text-[16px] leading-relaxed text-gray-200 sm:text-[17px]">
							{tag.description}
						</p>
					</>
				)}
				<Numbers
					tag={tag}
					usual={m.usual}
					owner={m.owner}
					className={tag.description ? "mt-3" : ""}
				/>
			</section>
			{wide ? (
				<section aria-label="The titles that define it" className="mt-6">
					{label}
					<div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
						<ul className="grid grid-cols-6 content-start gap-2.5 pt-1">
							{d.top.map((p) => (
								<li key={p.key}>
									<PosterButton
										t={p}
										on={p.key === d.t?.key}
										onClick={() => onFocus(p.key)}
									/>
								</li>
							))}
						</ul>
						<Reader d={d} />
					</div>
				</section>
			) : (
				<section aria-label="The titles that define it" className="mt-6">
					{label}
					<PhoneRow d={d} onFocus={onFocus} />
					<Reader d={d} phone />
				</section>
			)}
			<Credits tag={tag} className="mt-3" />
		</div>
	)
}

function PhoneRow({
	d,
	onFocus,
}: { d: DetailState; onFocus: (key: string) => void }) {
	const row = useRef<HTMLUListElement>(null)
	const key = d.t?.key
	useEffect(() => {
		const list = row.current
		const el = list?.querySelector<HTMLElement>(
			`[data-key="${CSS.escape(key ?? "")}"]`,
		)
		if (!list || !el) return
		// Scroll the row only, never the page.
		list.scrollTo({
			left: el.offsetLeft - list.clientWidth / 2 + el.clientWidth / 2,
			behavior: reducedMotion() ? "instant" : "smooth",
		})
	}, [key])
	return (
		<ul
			ref={row}
			data-no-swipe=""
			className="-mx-4 mb-3 flex gap-2.5 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none]"
		>
			{d.top.map((p) => (
				<li key={p.key} data-key={p.key} className="w-[4.5rem] shrink-0">
					<PosterButton
						t={p}
						on={p.key === key}
						onClick={() => onFocus(p.key)}
					/>
				</li>
			))}
		</ul>
	)
}

/** The reader: "In <Title>" with prev / next and its excerpt, over the title's backdrop. Switching crossfades. */
function Reader({ d, phone = false }: { d: DetailState; phone?: boolean }) {
	const t = d.t
	if (!t) return null
	return (
		<div
			className={`relative isolate flex flex-col overflow-hidden rounded-2xl bg-gray-800 ${phone ? "" : "h-full min-h-[15rem]"}`}
		>
			<div className="absolute inset-0 -z-10" aria-hidden>
				<AnimatePresence initial={false}>
					<motion.span
						key={t.key}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3, ease: EASE }}
						className="absolute inset-0"
					>
						{t.backdrop && (
							<img
								src={backdropUrl(t.backdrop, "w780") ?? ""}
								alt=""
								className="h-full w-full object-cover opacity-30"
							/>
						)}
					</motion.span>
				</AnimatePresence>
				<span
					className={`absolute inset-0 ${phone ? "bg-linear-to-b from-gray-800/40 via-gray-800/90 to-gray-800" : "bg-linear-to-r from-gray-800 via-gray-800/90 to-gray-800/50"}`}
				/>
			</div>
			<div className="flex items-center justify-between gap-2 px-4 pt-1">
				<InTitle t={t} />
				<Steps d={d} />
			</div>
			<ExcerptStage
				d={d}
				className={`mx-4 mb-4 ${phone ? "h-56" : "min-h-0 flex-1"}`}
			/>
		</div>
	)
}
