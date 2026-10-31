// Why a pick: a sheet from the bottom on phones, a dialog in the middle from sm up. The pick's poster, name and match,
// then one box per trope of the member's it carries (at most eight, in their rank order): the trope's name, a "More
// like this →" link to that trope's picks, and how the trope shows up in the title (TV Tropes text, under a spoiler
// cover since the member hasn't seen it). ← and → beside Close (and the arrow keys) step to the previous and next
// pick. No chips. Loaded on first use (TropeRecsPage).
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { type RecKind, tropeRecsPath } from "~/domain/trope-recs"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import { useOverlayRoot } from "~/ui/overlay"
import { EASE } from "~/ui/profile/tropes/motion"
import { Excerpt, LicenseCredit } from "~/ui/profile/tropes/parts"
import { type RecTitle, useExcerpt } from "./api"
import { cardTitle } from "./card"

export interface PickSheetProps {
	pick: RecTitle
	/** The pick's place in the list, from 1. */
	place: number
	/** How many top tropes the member has. */
	tropeCount: number
	kind: RecKind
	onClose: () => void
	/** Opens the previous pick; null on the first. */
	onPrev?: (() => void) | null
	/** Opens the next pick; null on the last. */
	onNext?: (() => void) | null
}

const SHEET_BUTTON =
	"min-h-9 shrink-0 cursor-pointer rounded-full px-3 text-xs font-bold text-gray-300 ring-1 ring-white/15 hover:bg-white/10 disabled:cursor-default disabled:opacity-30"

const sourceOf = (id: string) => (id.startsWith("https://") ? id : null)

export default function PickSheet({
	pick,
	place,
	tropeCount,
	kind,
	onClose,
	onPrev = null,
	onNext = null,
}: PickSheetProps) {
	const root = useOverlayRoot()
	const box = useRef<HTMLDivElement>(null)
	useModalDialog({ open: true, onClose, container: box })
	useEffect(() => {
		if (!onPrev && !onNext) return
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
			const el = document.activeElement
			if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
			if (e.key === "ArrowLeft" && onPrev) onPrev()
			if (e.key === "ArrowRight" && onNext) onNext()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onPrev, onNext])
	useEffect(() => {
		const before = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = before
		}
	}, [])
	if (!root) return null
	const kindName = pick.kind === "show" ? "Show" : "Movie"
	return createPortal(
		<div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-6">
			<motion.div
				aria-hidden
				className="absolute inset-0 bg-black/70"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				onClick={onClose}
			/>
			<motion.div
				ref={box}
				// biome-ignore lint/a11y/useSemanticElements: a modal on a motion element, with useModalDialog
				role="dialog"
				aria-modal="true"
				aria-labelledby="trope-pick-name"
				initial={{ opacity: 0, y: 32 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.26, ease: EASE }}
				className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-gray-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ring-1 ring-white/10 sm:rounded-2xl sm:p-5"
			>
				<div className="flex gap-4">
					<div className="w-20 shrink-0 sm:w-24">
						<MovieTvCard
							details={cardTitle(pick)}
							mediaType={pick.kind}
							actions={false}
						/>
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-start justify-between gap-2">
							<h2
								id="trope-pick-name"
								className="text-xl font-black text-white"
							>
								<Link
									to={pick.href}
									prefetch="intent"
									className="hover:underline"
								>
									{pick.name}
								</Link>
							</h2>
							<div className="flex shrink-0 gap-1.5">
								{(onPrev || onNext) && (
									<>
										<button
											type="button"
											onClick={onPrev ?? undefined}
											disabled={!onPrev}
											aria-label="Previous pick"
											className={SHEET_BUTTON}
										>
											←
										</button>
										<button
											type="button"
											onClick={onNext ?? undefined}
											disabled={!onNext}
											aria-label="Next pick"
											className={SHEET_BUTTON}
										>
											→
										</button>
									</>
								)}
								<button
									type="button"
									onClick={onClose}
									className={SHEET_BUTTON}
								>
									Close
								</button>
							</div>
						</div>
						<p className="text-sm text-gray-400">
							{[pick.year, kindName].filter(Boolean).join(" · ")}
						</p>
						<p className="mt-2 text-sm text-gray-300">
							#{place} · match{" "}
							<b className="text-white tabular-nums">{pick.match}</b> · carries{" "}
							{pick.matchedCount} of your {tropeCount} tropes
						</p>
					</div>
				</div>
				<ul className="mt-4 grid gap-2 sm:grid-cols-2">
					{pick.matchedTropes.map((trope) => (
						<TropeBox
							// Per pick: a step to the next pick covers its write-ups again.
							key={`${pick.id}|${trope.id}`}
							trope={trope}
							pick={pick}
							kind={kind}
							onClose={onClose}
						/>
					))}
				</ul>
				{pick.matchedCount > pick.matchedTropes.length && (
					<p className="mt-2 text-xs text-gray-500">
						And {pick.matchedCount - pick.matchedTropes.length} more of your
						tropes.
					</p>
				)}
				<LicenseCredit />
			</motion.div>
		</div>,
		root,
	)
}

function TropeBox({
	trope,
	pick,
	kind,
	onClose,
}: {
	trope: RecTitle["matchedTropes"][number]
	pick: RecTitle
	kind: RecKind
	onClose: () => void
}) {
	const [open, setOpen] = useState(false)
	const excerpt = useExcerpt(trope.id, pick.id)
	const loading = excerpt.isPending || !!excerpt.data?.pending
	const source = sourceOf(trope.id)
	return (
		<li className="rounded-xl bg-gray-950/60 p-3 ring-1 ring-white/10">
			<Link
				to={tropeRecsPath({ trope: trope.id, kind })}
				onClick={onClose}
				className="group flex min-h-8 w-full items-baseline justify-between gap-2 text-left text-xs font-bold text-sky-300"
			>
				<span className="group-hover:underline">{trope.name}</span>
				<span className="shrink-0 font-normal text-gray-500 group-hover:text-gray-300">
					More like this →
				</span>
			</Link>
			{loading ? (
				<span className="mt-1.5 block space-y-1.5" aria-label="Loading">
					<span className="block h-3 w-full animate-pulse rounded bg-white/10" />
					<span className="block h-3 w-4/5 animate-pulse rounded bg-white/10" />
				</span>
			) : excerpt.isError ? (
				<span className="mt-1.5 block text-[13px] text-gray-500">
					The write-up could not load.
				</span>
			) : (
				<Excerpt
					text={excerpt.data?.text ?? null}
					covered={!open}
					onReveal={() => setOpen(true)}
					className="mt-1.5 text-[13px] leading-relaxed text-gray-200"
				/>
			)}
			{source && (
				<a
					href={source}
					target="_blank"
					rel="noreferrer noopener"
					className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
				>
					On TV Tropes
					<ArrowTopRightOnSquareIcon className="size-3" aria-hidden />
				</a>
			)}
		</li>
	)
}
