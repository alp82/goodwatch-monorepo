// PROTOTYPE (start page lab): recs e · "Share your shelf (bolder)": tap three you love, the picks fill a compact
// room's shelves, and a share sheet mock shows the room-with-your-picks card you could post.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useLab, type LabCard } from "../../lab/types"
import { CardRow, SectionHead, Slots, TapPoster, joinNames, usePicks } from "./shared"

const NEED = 3
const PAGE = 12
const EASE = [0.22, 1, 0.36, 1] as const
// Placeholder: a real build needs a saved list or a guest share id to link to.
const PLACEHOLDER_URL = "https://goodwatch.app/shelf/guest-preview"

export function ShareShelf() {
	const { data, Room } = useLab()
	const pool = data.guest.quizPool
	const [page, setPage] = useState(0)
	const [picked, setPicked] = useState<LabCard[]>([])
	const [done, setDone] = useState<LabCard[] | null>(null)
	const [sharing, setSharing] = useState(false)
	const picks = usePicks(done)
	const pages = Math.max(1, Math.ceil(pool.length / PAGE))
	const shown = pool.slice(page * PAGE, page * PAGE + PAGE)

	const tap = (c: LabCard) => {
		if (done) return
		const on = picked.some((p) => p.key === c.key)
		const next = on ? picked.filter((p) => p.key !== c.key) : [...picked, c]
		setPicked(next)
		if (next.length >= NEED) setTimeout(() => setDone(next), 450)
	}
	const again = () => {
		setDone(null)
		setPicked([])
		setPage((p) => (p + 1) % pages)
	}

	return (
		<section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
				{/* The room: popular titles on its shelves until the picks replace them. */}
				<div className="relative lg:order-2">
					<Room
						className="h-[40vh] max-h-[420px] min-h-[220px] w-full overflow-hidden rounded-2xl ring-1 ring-white/10 lg:h-[48vh] lg:max-h-[520px]"
						focal={[0.5, 0.45]}
						zoom={1.15}
					/>
					{done ? (
						<div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-linear-to-t from-gray-950/90 to-transparent px-4 pb-3 pt-10">
							<p className="text-sm font-semibold text-amber-300">Your shelf</p>
							<p className="truncate text-xs text-gray-300">Because you love {joinNames(done)}</p>
						</div>
					) : null}
				</div>

				<div className="min-w-0 lg:order-1">
					{done ? (
						<div className="animate-[shelf-in_.4s_ease-out_both]">
							<style>{`@keyframes shelf-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
							<SectionHead kicker="Your shelf" title="Picked for you">
								<p className="mt-1 text-sm text-gray-300">
									Because you love <b className="text-white">{joinNames(done)}</b>
								</p>
							</SectionHead>
							<CardRow cards={picks} size="sm" />
							<div className="mt-4 flex flex-wrap items-center gap-3">
								<button
									type="button"
									onClick={() => setSharing(true)}
									className="inline-flex h-11 items-center rounded-lg bg-amber-400 px-5 text-sm font-bold text-gray-950 hover:bg-amber-300"
								>
									Share your shelf
								</button>
								<Link
									to="/sign-up"
									className="inline-flex h-11 items-center rounded-lg bg-white/[0.06] px-4 text-sm font-semibold text-gray-200 hover:bg-white/10"
								>
									Keep my shelf
								</Link>
								<button type="button" onClick={again} className="text-sm font-semibold text-gray-400 hover:text-white">
									Try three others
								</button>
							</div>
						</div>
					) : (
						<>
							<div className="mb-4 flex items-end justify-between gap-4">
								<SectionHead kicker="Fill your shelf" title="Tap three you love">
									<p className="mt-1 text-sm text-gray-300" aria-live="polite">
										{picked.length === 0
											? "Picks for your taste go on the shelves."
											: `${joinNames(picked)}${picked.length < NEED ? ` · ${NEED - picked.length} more` : ""}`}
									</p>
								</SectionHead>
								<div className="mb-4 shrink-0">
									<Slots picked={picked} need={NEED} />
								</div>
							</div>
							<ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
								{shown.map((c) => {
									const n = picked.findIndex((p) => p.key === c.key) + 1
									return (
										<li key={c.key}>
											<TapPoster card={c} n={n} onTap={() => tap(c)} disabled={picked.length >= NEED} />
										</li>
									)
								})}
							</ul>
							{pages > 1 && (
								<button
									type="button"
									onClick={() => setPage((p) => (p + 1) % pages)}
									className="mt-3 text-sm font-semibold text-gray-400 hover:text-white"
								>
									Show other titles
								</button>
							)}
						</>
					)}
				</div>
			</div>

			<AnimatePresence>
				{sharing && done ? <ShareSheet loved={done} picks={picks} onClose={() => setSharing(false)} /> : null}
			</AnimatePresence>
		</section>
	)
}

function ShareSheet({ loved, picks, onClose }: { loved: LabCard[]; picks: LabCard[]; onClose: () => void }) {
	const { Room } = useLab()
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(PLACEHOLDER_URL)
		} catch {
			// Clipboard needs a secure context; the mock just says it copied.
		}
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}

	return (
		<motion.div
			className="fixed inset-0 z-[2147483100] flex items-end justify-center bg-black/80 sm:items-center sm:p-6"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
			onClick={onClose}
		>
			<motion.div
				role="dialog"
				aria-modal="true"
				aria-label="Share your shelf"
				className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-gray-900 p-4 ring-1 ring-white/10 sm:rounded-2xl sm:p-5"
				initial={{ y: 40, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				exit={{ y: 40, opacity: 0 }}
				transition={{ duration: 0.3, ease: EASE }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="text-lg font-bold text-white">Share your shelf</h3>
					<button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-gray-400 hover:bg-white/10 hover:text-white">
						Close
					</button>
				</div>

				{/* The card as it would be posted: 1200 × 630, the room with the picks on its shelves. */}
				<div className="relative aspect-[1200/630] w-full overflow-hidden rounded-xl bg-gray-950 ring-1 ring-white/10">
					<Room className="absolute inset-0" posters={picks} noTv portraitBelow={0} focal={[0.5, 0.45]} zoom={1.05} />
					<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-gray-950/95 via-gray-950/30 to-transparent" />
					<div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-4">
						<div className="min-w-0">
							<p className="text-base font-extrabold text-white sm:text-xl">My GoodWatch shelf</p>
							<p className="truncate text-[11px] text-gray-300 sm:text-sm">Because I love {joinNames(loved)}</p>
						</div>
						<span className="shrink-0 text-[10px] font-bold tracking-wide text-amber-400 sm:text-xs">goodwatch.app</span>
					</div>
				</div>

				<div className="mt-4 grid gap-2 sm:grid-cols-3">
					<button
						type="button"
						onClick={copy}
						className="inline-flex h-11 items-center justify-center rounded-lg bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/15"
					>
						{copied ? "Copied" : "Copy link"}
					</button>
					<span title="Not in the prototype: the image would be rendered on the server" className="inline-flex">
						<button
							type="button"
							disabled
							className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/[0.04] px-4 text-sm font-semibold text-gray-500"
						>
							Download image
						</button>
					</span>
					<Link
						to="/sign-up"
						className="inline-flex h-11 items-center justify-center rounded-lg bg-amber-400 px-4 text-sm font-bold text-gray-950 hover:bg-amber-300"
					>
						Keep my shelf
					</Link>
				</div>
				<p className="mt-3 text-[11px] leading-snug text-gray-500">
					Mock. The real card would be rendered on the server like the site's share cards and OG images, and needs a
					saved list or a guest share id. Copy link copies a placeholder.
				</p>
			</motion.div>
		</motion.div>
	)
}
