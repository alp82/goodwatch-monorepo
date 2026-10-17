// PROTOTYPE - throwaway. Short summary card; the full fingerprint opens in a side sheet (bottom sheet on phones).
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import { AttributeGrid, Audience, HEX, Meter, MoreLinks, PILLARS, Verdict } from "../../DetailsFingerprint"
import type { VariantProps } from "../types"
import { Chip, FpHeading } from "./sheet-head"
import { AREA_WORD, goodFor, skipIfShort, tagline } from "./sheet-words"

export default function Sheet(props: VariantProps) {
	const { t } = props
	const [open, setOpen] = useState(false)
	const [shown, setShown] = useState(false)
	const dialog = useRef<HTMLDialogElement>(null)
	const opener = useRef<HTMLButtonElement>(null)
	const closeBtn = useRef<HTMLButtonElement>(null)
	const body = useRef<HTMLDivElement>(null)
	const tiers = t.fingerprint.pillars
	const good = goodFor(t, 4)
	const skip = skipIfShort(t).slice(0, 1)

	const show = (area?: string) => {
		setOpen(true)
		dialog.current?.showModal()
		closeBtn.current?.focus({ preventScroll: true })
		requestAnimationFrame(() => {
			setShown(true)
			if (area) body.current?.querySelector(`[data-area="${area}"]`)?.scrollIntoView({ block: "start" })
			else body.current?.scrollTo({ top: 0 })
		})
	}
	const hide = () => {
		setShown(false)
		window.setTimeout(() => {
			dialog.current?.close()
			setOpen(false)
			opener.current?.focus({ preventScroll: true })
		}, 200)
	}
	useEffect(() => {
		const d = dialog.current
		if (!d) return
		const onCancel = (e: Event) => {
			e.preventDefault()
			hide()
		}
		d.addEventListener("cancel", onCancel)
		return () => d.removeEventListener("cancel", onCancel)
	})

	return (
		<div>
			<FpHeading t={t} />
			<div className="mt-4 rounded-2xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
				<div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10">
					<div>
						<p className="text-2xl font-semibold tracking-tight text-amber-200">{tagline(t) || F.pillarLine(t)}.</p>
						<p className="mt-1.5 text-gray-300 leading-relaxed">{F.summary(t)}</p>
					</div>
					<button
						ref={opener}
						type="button"
						aria-haspopup="dialog"
						aria-expanded={open}
						onClick={() => show()}
						className="h-11 shrink-0 cursor-pointer justify-self-start rounded-full bg-amber-300 px-5 text-sm font-semibold text-black hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
					>
						See full fingerprint
					</button>
				</div>
				<ul className="mt-5 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-white/8 pt-4 sm:flex sm:flex-wrap sm:gap-x-7" aria-label="Areas">
					{PILLARS.map((p) => (
						<li key={p}>
							<button
								type="button"
								onClick={() => show(p)}
								className="flex cursor-pointer items-center gap-2 rounded-md py-0.5 pr-1 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-300"
							>
								<span aria-hidden="true" className="text-lg">{PILLAR_CONFIG[p].emoji}</span>
								<span className="flex flex-col gap-1">
									<span className="[&>span>span]:w-3.5 sm:[&>span>span]:w-4">
										<Meter tier={tiers[p]} p={p} />
									</span>
									<span className="text-xs leading-none text-gray-400">
										<span className="sr-only">{p}: </span>
										{AREA_WORD[p][tiers[p]]}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
				<div className="mt-4 flex flex-wrap items-center gap-1.5">
					<span className="mr-1 text-sm text-gray-400">Good for</span>
					{good.shown.map((g) => (
						<Chip key={g}>{g}</Chip>
					))}
					{skip.map((s) => (
						<Chip key={s} tone="skip">
							Skip if {s}
						</Chip>
					))}
				</div>
			</div>

			<dialog
				ref={dialog}
				aria-labelledby="fp-sheet-title"
				onClick={(e) => e.target === dialog.current && hide()}
				className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-white backdrop:bg-transparent"
			>
				<div className={`fixed inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`} aria-hidden="true" onClick={hide} />
				<div
					className={`fixed inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border border-white/10 bg-stone-950 shadow-2xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(46rem,92vw)] md:rounded-none md:rounded-l-2xl ${
						shown ? "translate-y-0 opacity-100 md:translate-x-0" : "translate-y-8 opacity-0 md:translate-x-8 md:translate-y-0"
					}`}
				>
					<div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-5 sm:px-7">
						<div className="min-w-0">
							<h2 id="fp-sheet-title" className="text-xl font-semibold text-white">
								Full fingerprint
							</h2>
							<p className="mt-0.5 truncate text-sm text-gray-400">{t.title}: every trait, by area</p>
						</div>
						<button
							ref={closeBtn}
							type="button"
							onClick={hide}
							aria-label="Close"
							className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
						>
							<XMarkIcon className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
					<nav aria-label="Jump to area" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-5 py-3 [scrollbar-width:none] sm:px-7">
						{PILLARS.map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => body.current?.querySelector(`[data-area="${p}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
								className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full bg-white/5 px-3 text-sm text-gray-300 hover:bg-white/10"
							>
								{PILLAR_CONFIG[p].emoji} {p}
							</button>
						))}
					</nav>
					<div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 sm:px-7">
						{open &&
							PILLARS.map((p) => (
								<section key={p} data-area={p} className="scroll-mt-0 border-b border-white/8 py-7">
									<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
										<h3 className="flex items-center gap-2 text-lg font-semibold">
											<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
											{p}
										</h3>
										<Meter tier={tiers[p]} p={p} />
										<span className="text-sm" style={{ color: HEX[p] }}>
											{AREA_WORD[p][tiers[p]]}
										</span>
									</div>
									<div className="mt-3">
										<Verdict t={t} p={p} size="lg" />
									</div>
									<div className="mt-5">
										<AttributeGrid t={t} p={p} meaning={false} />
									</div>
									<div className="mt-5">
										<MoreLinks t={t} p={p} />
									</div>
								</section>
							))}
						{open && (
							<section className="pt-7">
								<Audience t={t} layout="stack" />
							</section>
						)}
					</div>
				</div>
			</dialog>
		</div>
	)
}
