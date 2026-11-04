// The Tropes sub-page's layout: a narrow index of every trope on the left (find, the All / Signature / Rare tabs,
// letters in the margin), and the main column with the signature cards until a trope opens, then one calm article
// (the write-up at a reading measure, what it is, Also in posters, the next trope). A phone opens the article as a
// full-screen reading sheet. J and K step through the list, Escape closes.
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import {
	type ReactNode,
	type Ref,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
} from "react"
import { SegmentedTabs } from "~/ui/details/SegmentedTabs"
import { CAPTION, Kbd, Reveal, SearchField, fmt } from "~/ui/details/page-ui"
import type { TitleInfo } from "~/ui/details/sub-page/paths"
import { SIGNATURE_CARD, SignatureCardFace } from "./TropeCard"
import type { Skip } from "./TropeCard"
import {
	LETTERS,
	type Row,
	type TropesPageState,
	letterId,
	letterOf,
	rowId,
} from "./model"
import { Count, Marked } from "./parts"
import {
	AlsoIn,
	InTitle,
	MetaLine,
	NextLinks,
	WhatItIs,
	reducedMotion,
	useDesktop,
} from "./reading"

interface Props {
	s: TropesPageState
	info: TitleInfo
}

function useGroups(rows: Row[]) {
	return useMemo(() => {
		const out = new Map<string, Row[]>()
		for (const t of rows) {
			const l = letterOf(t.name)
			out.set(l, [...(out.get(l) ?? []), t])
		}
		return out
	}, [rows])
}

/** Moves the list to a letter: the index itself where it scrolls on its own (a desktop), else the page. */
export function jumpToLetter(l: string) {
	const el = document.getElementById(letterId(l))
	if (!el) return
	const box = el.parentElement
	const behavior = reducedMotion() ? "auto" : "smooth"
	if (
		box &&
		box.scrollHeight > box.clientHeight + 1 &&
		getComputedStyle(box).overflowY !== "visible"
	) {
		box.scrollTo({ top: el.offsetTop - box.offsetTop, behavior })
		return
	}
	el.scrollIntoView({ block: "start", behavior })
}

function Letters({
	groups,
	className = "",
	vertical = false,
	navRef,
}: {
	groups: Map<string, Row[]>
	className?: string
	vertical?: boolean
	navRef?: Ref<HTMLElement>
}) {
	if (vertical)
		return (
			<nav
				ref={navRef}
				aria-label="Jump to a letter"
				className={`flex flex-col ${className}`}
			>
				{LETTERS.map((l) => (
					<button
						key={l}
						type="button"
						disabled={!groups.has(l)}
						onClick={() => jumpToLetter(l)}
						className="flex min-h-0 max-h-6 flex-1 w-7 cursor-pointer items-center justify-center rounded text-[13px] font-semibold text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-amber-300 disabled:cursor-default disabled:text-gray-700 disabled:hover:bg-transparent"
					>
						{l}
					</button>
				))}
			</nav>
		)
	return (
		<nav
			aria-label="Jump to a letter"
			className={`flex flex-wrap gap-0.5 ${className}`}
		>
			{LETTERS.map((l) => (
				<button
					key={l}
					type="button"
					disabled={!groups.has(l)}
					onClick={() => jumpToLetter(l)}
					className="h-8 w-[1.6rem] cursor-pointer rounded-md text-xs font-semibold text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-default disabled:text-gray-700 disabled:hover:bg-transparent"
				>
					{l}
				</button>
			))}
		</nav>
	)
}

function Find({ s }: { s: TropesPageState }) {
	return (
		<div className="flex flex-col gap-3">
			<SearchField
				value={s.q}
				onChange={s.setQ}
				label="Find a trope"
				placeholder={`Find in ${fmt(s.total)} tropes`}
				className="w-full"
			/>
			<SegmentedTabs
				label="Show"
				tabs={s.chips}
				value={s.filter}
				onChange={s.setFilter}
			/>
		</div>
	)
}

const isSignature = (s: TropesPageState, t: Row) =>
	s.signature.some((x) => x.id === t.id)
const findRow = (s: TropesPageState, id: string | null) =>
	id
		? (s.rows.find((r) => r.id === id) ??
			s.signature.find((r) => r.id === id) ??
			null)
		: null

/** J and K (and the arrow-free Escape) for the opened trope. */
function useStepKeys(s: TropesPageState, on: boolean) {
	useEffect(() => {
		if (!on) return
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea")) return
			if (e.key === "Escape") return s.setOpen(null)
			if (e.key !== "j" && e.key !== "k") return
			const at = s.rows.findIndex((t) => t.id === s.open)
			const next = s.rows[at + (e.key === "j" ? 1 : -1)]
			if (!next) return
			e.preventDefault()
			s.setOpen(next.id)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
}

/**
 * The letter rail sits beside the list, as tall as it. When the page scrolls the list up under the
 * sticky sub-page header ([data-sub-bar]), the rail keeps its top just
 * below the header and fits its letters into what's left of the list (down to 13 px a letter, then it leaves with
 * the list's end), so it doesn't scroll away while the list is in view and never leaves the list's
 * bounds. Measured on scroll, at most once a frame.
 */
const RAIL_MIN = LETTERS.length * 13 + 16

function useRailInView(rail: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const el = rail.current
		const box = el?.parentElement
		if (!el || !box) return
		let frame = 0
		const place = () => {
			frame = 0
			const headerBottom = Math.max(
				64,
				...[...document.querySelectorAll<HTMLElement>("[data-sub-bar]")]
					.map((h) => h.getBoundingClientRect())
					.filter((r) => r.height > 0)
					.map((r) => r.bottom),
			)
			const b = box.getBoundingClientRect()
			const top0 = Math.max(b.top, headerBottom + 4)
			if (top0 <= b.top) {
				el.style.top = el.style.height = el.style.bottom = ""
				return
			}
			// The letters squeeze to RAIL_MIN at most (13 px a letter), then the rail goes out with the list's end.
			const height = Math.min(b.height, Math.max(b.bottom - top0, RAIL_MIN))
			el.style.top = `${Math.min(top0 - b.top, b.height - height)}px`
			el.style.height = `${height}px`
			el.style.bottom = "auto"
		}
		const ask = () => {
			if (!frame) frame = requestAnimationFrame(place)
		}
		place()
		window.addEventListener("scroll", ask, { passive: true })
		window.addEventListener("resize", ask)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", ask)
			window.removeEventListener("resize", ask)
		}
	}, [rail])
}

export function TropesReader({ s, info }: Props) {
	const desktop = useDesktop()
	const groups = useGroups(s.rows)
	const skip: Skip = { type: info.type, id: info.id }
	const sel = findRow(s, s.open)
	const at = sel ? s.rows.findIndex((r) => r.id === sel.id) : -1
	const prev = at > 0 ? s.rows[at - 1] : null
	const next = at >= 0 ? (s.rows[at + 1] ?? null) : null
	const article = useRef<HTMLDivElement>(null)
	const list = useRef<HTMLDivElement>(null)
	const rail = useRef<HTMLElement>(null)
	useStepKeys(s, !!sel)
	useRailInView(rail)

	// Desktop: a newly opened trope starts at its top, and its index row stays in view.
	useEffect(() => {
		if (!desktop || !s.open) return
		const top = article.current?.getBoundingClientRect().top ?? 0
		if (top < 64)
			window.scrollTo({
				top: Math.max(0, window.scrollY + top - 96),
				behavior: reducedMotion() ? "auto" : "smooth",
			})
		// Only the index scrolls to the row (scrollIntoView would move the page too).
		const box = list.current
		const row = document.getElementById(rowId(s.open))
		if (!box || !row) return
		const r = row.getBoundingClientRect()
		const b = box.getBoundingClientRect()
		if (r.top < b.top + 40) box.scrollTop += r.top - b.top - 48
		else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 16
	}, [s.open, desktop])

	const open = (t: Row) => {
		if (!s.rows.some((r) => r.id === t.id)) s.clear()
		s.setOpen(t.id)
	}

	return (
		<div className="flex flex-col gap-10">
			{/* A phone starts with the signature cards; a desktop shows them in the main column. */}
			<div className="lg:hidden">
				<SignatureCards s={s} skip={skip} title={info.title} onPick={open} />
			</div>
			<div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[21rem_minmax(0,1fr)] xl:gap-16">
				<aside
					aria-label="Every trope"
					data-tropes-index=""
					className="lg:sticky lg:top-[8.5rem] lg:flex lg:h-[calc(100dvh-10rem)] lg:flex-col lg:self-start"
				>
					<Find s={s} />
					<Letters groups={groups} className="mt-3 lg:hidden" />
					<div className="mt-4 mb-1">
						<Count s={s} />
					</div>
					<div className="lg:relative lg:flex lg:min-h-0 lg:flex-1">
						{/* The letter rail sits in the margin left of the list, as tall as the list, so the letters can be big; it
					    keeps under the sub-page header while the list goes up under it (useRailInView). */}
						<Letters
							groups={groups}
							vertical
							navRef={rail}
							className="absolute inset-y-0 -left-12 hidden py-2 lg:flex"
						/>
						<div
							ref={list}
							className="-ml-3 lg:-mr-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]"
						>
							{[...groups.entries()].map(([l, rows]) => (
								<section
									key={l}
									id={letterId(l)}
									aria-labelledby={`${letterId(l)}-h`}
									className="scroll-mt-20"
								>
									<h2
										id={`${letterId(l)}-h`}
										data-trope-letter=""
										className="sticky top-[116px] z-10 flex items-baseline gap-2 bg-gray-900 px-3 pt-4 pb-1.5 lg:top-0"
									>
										<span className="text-sm font-semibold text-white">
											{l === "#" ? "0–9" : l}
										</span>
										<span className="text-[11px] text-gray-600 tabular-nums">
											{fmt(rows.length)}
										</span>
									</h2>
									<ul>
										{rows.map((t) => {
											const on = sel?.id === t.id
											return (
												<li
													key={t.id}
													id={rowId(t.id)}
													className="scroll-mt-28"
												>
													<button
														type="button"
														onClick={() =>
															on && !desktop ? s.setOpen(null) : open(t)
														}
														aria-current={on || undefined}
														className={`group relative flex w-full cursor-pointer flex-col rounded-lg px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-300 ${on ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
													>
														{on && (
															<span
																aria-hidden
																className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-amber-300"
															/>
														)}
														<span className="flex items-center gap-2">
															<span
																className={`min-w-0 flex-1 truncate text-[15px] ${on ? "font-semibold text-white" : "font-medium text-gray-200"}`}
															>
																<Marked text={t.name} q={s.q} />
															</span>
															{t.picks && (
																<span
																	aria-label="Your trope"
																	className="size-1.5 shrink-0 rounded-full bg-amber-300"
																/>
															)}
															{t.rare && !t.picks && (
																<span className="shrink-0 text-[10px] font-semibold tracking-wide text-amber-200/60 uppercase">
																	Rare
																</span>
															)}
														</span>
														{t.line && (
															<span
																className={`mt-0.5 truncate text-[13px] ${t.lineFromWriteUp ? "text-gray-400 italic" : "text-gray-500"}`}
															>
																<Marked text={t.line} q={s.q} />
															</span>
														)}
													</button>
												</li>
											)
										})}
									</ul>
								</section>
							))}
						</div>
					</div>
				</aside>
				<div ref={article} className="hidden min-w-0 lg:block">
					{sel ? (
						<Reveal key={sel.id}>
							<TropeArticle
								t={sel}
								s={s}
								info={info}
								skip={skip}
								prev={prev}
								next={next}
								top={
									<div className="flex items-center justify-between gap-4">
										<button
											type="button"
											onClick={() => s.setOpen(null)}
											className="inline-flex min-h-9 cursor-pointer items-center gap-1 text-sm text-gray-400 hover:text-white"
										>
											<ChevronLeftIcon aria-hidden className="size-4" />
											Signature tropes
										</button>
										<StepButtons s={s} prev={prev} next={next} />
									</div>
								}
							/>
						</Reveal>
					) : (
						<SignatureCards
							s={s}
							skip={skip}
							title={info.title}
							onPick={open}
							roomy
						/>
					)}
				</div>
			</div>
			{!desktop && sel && (
				<ReadingSheet
					t={sel}
					s={s}
					info={info}
					skip={skip}
					prev={prev}
					next={next}
				/>
			)}
		</div>
	)
}

function StepButtons({
	s,
	prev,
	next,
}: { s: TropesPageState; prev: Row | null; next: Row | null }) {
	const btn =
		"inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-default disabled:text-gray-700 disabled:hover:bg-transparent"
	return (
		<div className="flex items-center gap-1.5">
			<span className="mr-1 hidden items-center gap-1 text-[11px] text-gray-600 xl:flex">
				<Kbd>K</Kbd>
				<Kbd>J</Kbd>
			</span>
			<button
				type="button"
				className={btn}
				disabled={!prev}
				onClick={() => prev && s.setOpen(prev.id)}
				aria-label={prev ? `Previous: ${prev.name}` : "Previous"}
			>
				<ChevronLeftIcon aria-hidden className="size-4" />
			</button>
			<button
				type="button"
				className={btn}
				disabled={!next}
				onClick={() => next && s.setOpen(next.id)}
				aria-label={next ? `Next: ${next.name}` : "Next"}
			>
				<ChevronRightIcon aria-hidden className="size-4" />
			</button>
		</div>
	)
}

function TropeArticle({
	t,
	s,
	info,
	skip,
	next,
	top,
}: {
	t: Row
	s: TropesPageState
	info: TitleInfo
	skip: Skip
	prev: Row | null
	next: Row | null
	top?: ReactNode
}) {
	return (
		<article aria-labelledby="trope-article-name">
			{top}
			<h2
				id="trope-article-name"
				className="mt-5 text-balance text-[1.75rem] leading-tight font-semibold tracking-tight text-white sm:text-[2.1rem]"
			>
				{t.name}
			</h2>
			<MetaLine t={t} signature={isSignature(s, t)} className="mt-3" />
			<div className="mt-7">
				<InTitle t={t} title={info.title} />
			</div>
			<WhatItIs t={t} className="mt-8" />
			<NextLinks t={t} className="mt-4" />
			<AlsoIn
				t={t}
				skip={skip}
				grid="grid-cols-3 sm:grid-cols-4 xl:grid-cols-6"
				className="mt-8 border-t border-white/[0.07] pt-7"
			/>
			{next && (
				<button
					type="button"
					onClick={() => s.setOpen(next.id)}
					className="group mt-10 flex w-full cursor-pointer items-center gap-4 rounded-xl bg-white/[0.025] px-5 py-4 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.05]"
				>
					<span className="min-w-0 flex-1">
						<span className={`${CAPTION} block`}>Next</span>
						<span className="mt-0.5 block truncate text-base font-semibold text-white">
							{next.name}
						</span>
						{next.meaning && (
							<span className="mt-0.5 block truncate text-sm text-gray-500">
								{next.meaning}
							</span>
						)}
					</span>
					<ChevronRightIcon
						aria-hidden
						className="size-5 shrink-0 text-gray-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
					/>
				</button>
			)}
		</article>
	)
}

/** The phone's reading state: the article full screen over the list, with back and step buttons. */
function ReadingSheet(props: {
	t: Row
	s: TropesPageState
	info: TitleInfo
	skip: Skip
	prev: Row | null
	next: Row | null
}) {
	const { t, s, prev, next } = props
	const sheet = useRef<HTMLDivElement>(null)
	const body = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const html = document.documentElement
		const before = html.style.overflow
		html.style.overflow = "hidden"
		if (!reducedMotion())
			sheet.current?.animate(
				[
					{ opacity: 0, transform: "translateY(32px)" },
					{ opacity: 1, transform: "none" },
				],
				{ duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" },
			)
		return () => {
			html.style.overflow = before
		}
	}, [])
	// A new trope starts at its top.
	useEffect(() => {
		body.current?.scrollTo({ top: 0 })
	}, [t.id])
	return (
		<div
			ref={sheet}
			// biome-ignore lint/a11y/useSemanticElements: a full-screen layer over the page, not a modal <dialog>
			role="dialog"
			aria-modal="true"
			aria-label={t.name}
			className="fixed inset-0 z-[70] flex flex-col bg-gray-900"
		>
			<div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-2">
				<button
					type="button"
					onClick={() => s.setOpen(null)}
					className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-200 hover:text-white"
				>
					<ChevronLeftIcon aria-hidden className="size-5" />
					Tropes
				</button>
				<div className="flex items-center gap-1 pr-1">
					<StepButtons s={s} prev={prev} next={next} />
					<button
						type="button"
						onClick={() => s.setOpen(null)}
						aria-label="Close"
						className="ml-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:text-white"
					>
						<XMarkIcon aria-hidden className="size-5" />
					</button>
				</div>
			</div>
			<div
				ref={body}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-16"
			>
				<Reveal key={t.id}>
					<TropeArticle {...props} />
				</Reveal>
			</div>
		</div>
	)
}

/** The signature tropes as cards: posters of titles that share it, the name, how it shows up here. */
function SignatureCards({
	s,
	skip,
	title,
	onPick,
	roomy = false,
}: {
	s: TropesPageState
	skip: Skip
	title: string
	onPick: (t: Row) => void
	roomy?: boolean
}) {
	if (!s.signature.length) return null
	return (
		<section aria-labelledby={`sig-h-${roomy ? "wide" : "phone"}`}>
			<h2
				id={`sig-h-${roomy ? "wide" : "phone"}`}
				className={
					roomy
						? "text-xl font-semibold tracking-tight text-white"
						: `${CAPTION} mb-3`
				}
			>
				Signature tropes
			</h2>
			{roomy && (
				<p className="mt-1 mb-6 text-[15px] text-gray-400">
					The ones that say the most about {title}. Pick one to read it.
				</p>
			)}
			<ul
				className={`grid gap-3 ${roomy ? "xl:grid-cols-2" : "sm:grid-cols-2"}`}
			>
				{s.signature.map((t) => (
					<li key={t.id} className="min-w-0">
						<button
							type="button"
							onClick={() => onPick(t)}
							className={`group h-full w-full cursor-pointer text-left hover:bg-white/[0.05] hover:ring-white/20 focus-visible:outline-2 focus-visible:outline-amber-300 ${SIGNATURE_CARD}`}
						>
							<SignatureCardFace t={t} skip={skip} size={roomy ? 30 : 26} />
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}
