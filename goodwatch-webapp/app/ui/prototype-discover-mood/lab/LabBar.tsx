// PROTOTYPE (Discover lab): the floating bar that picks one variant per section, like the start page lab. Keys: ← →
// cycle the variant of the current section, ↑ ↓ the section, H hides the bar. Arrow keys are left alone while a field
// has focus. ☰ lists every section with its pick. "Round 5" goes back to the old switcher (?variant=16).
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { type Choice, SECTIONS, choiceFromParams, paramsFromChoice } from "./choice"
import { REGISTRY, pick } from "./registry"
import type { SectionId } from "./types"

export function useLabChoice(): Choice {
	const [params] = useSearchParams()
	return choiceFromParams(params)
}

export function LabBar() {
	const choice = useLabChoice()
	const navigate = useNavigate()
	const [hidden, setHidden] = useState(false)
	const [open, setOpen] = useState(false)
	const sec = choice.sec
	const go = (next: Choice) => navigate(`?${paramsFromChoice(next).toString()}`, { replace: true, preventScrollReset: true })

	const cycle = (dir: 1 | -1) => {
		const list = REGISTRY[sec]
		const i = list.findIndex((v) => v.key === pick(choice, sec).key)
		go({ ...choice, [sec]: list[(i + dir + list.length) % list.length].key })
	}
	const cycleSection = (dir: 1 | -1) => {
		const i = SECTIONS.findIndex((s) => s.id === sec)
		go({ ...choice, sec: SECTIONS[(i + dir + SECTIONS.length) % SECTIONS.length].id })
	}

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null
			if (t?.closest("input, textarea, select, [contenteditable='true']")) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if (e.key === "ArrowRight") cycle(1)
			else if (e.key === "ArrowLeft") cycle(-1)
			else if (e.key === "ArrowUp" && !hidden) {
				e.preventDefault()
				cycleSection(-1)
			} else if (e.key === "ArrowDown" && !hidden) {
				e.preventDefault()
				cycleSection(1)
			} else if (e.key === "h" || e.key === "H") setHidden((h) => !h)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	if (hidden)
		return (
			<button
				type="button"
				onClick={() => setHidden(false)}
				className="fixed bottom-3 right-3 z-[2147483000] rounded-full bg-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
			>
				Lab
			</button>
		)

	const variant = pick(choice, sec)
	const count = REGISTRY[sec].length
	return (
		<div className="fixed inset-x-0 bottom-3 z-[2147483000] flex justify-center px-2" data-lab-bar>
			<div className="flex max-w-full flex-col items-stretch gap-1 rounded-2xl border border-fuchsia-400/60 bg-black/90 p-1.5 text-xs text-white shadow-2xl shadow-black">
				{open ? (
					<div className="grid max-h-[50vh] grid-cols-1 gap-x-3 gap-y-1 overflow-y-auto p-1 sm:grid-cols-2">
						{SECTIONS.map((s) => (
							<label key={s.id} className="flex items-center justify-between gap-2">
								<span className="text-white/60">{s.name}</span>
								<select
									className="max-w-[12rem] rounded bg-white/10 px-1 py-0.5 text-white"
									value={pick(choice, s.id).key}
									onChange={(e) => go({ ...choice, [s.id]: e.target.value, sec: s.id })}
								>
									{REGISTRY[s.id].map((v) => (
										<option key={v.key} value={v.key} className="bg-black">
											{v.key} · {v.name}
										</option>
									))}
								</select>
							</label>
						))}
					</div>
				) : null}
				<div className="flex items-center gap-1">
					<div className="flex overflow-hidden rounded-full bg-white/10">
						{(["guest", "member"] as const).map((as) => (
							<button
								key={as}
								type="button"
								onClick={() => go({ ...choice, as })}
								className={`px-2.5 py-1.5 font-semibold capitalize ${choice.as === as ? "bg-fuchsia-600" : "text-white/70"}`}
							>
								{as}
							</button>
						))}
					</div>
					<a href="?variant=16" className="rounded-full bg-white/10 px-2.5 py-1.5 font-semibold text-white/70" title="Round 5 switcher">
						R5
					</a>
					<select
						aria-label="Section"
						className="max-w-[10rem] rounded-full bg-white/10 px-2 py-1.5 text-white sm:max-w-none"
						value={sec}
						onChange={(e) => go({ ...choice, sec: e.target.value as SectionId })}
					>
						{SECTIONS.map((s) => (
							<option key={s.id} value={s.id} className="bg-black">
								{s.name} ({REGISTRY[s.id].length})
							</option>
						))}
					</select>
					<button type="button" aria-label="Previous variant" onClick={() => cycle(-1)} className="rounded-full px-2 py-1.5 hover:bg-white/10">
						◀
					</button>
					<span className="min-w-0 max-w-[11rem] truncate font-semibold sm:max-w-[16rem]" title={variant.name}>
						{variant.key} · {variant.name}
						{count > 1 ? <span className="font-normal text-white/50"> /{count}</span> : null}
					</span>
					<button type="button" aria-label="Next variant" onClick={() => cycle(1)} className="rounded-full px-2 py-1.5 hover:bg-white/10">
						▶
					</button>
					<button
						type="button"
						aria-label="All sections"
						onClick={() => setOpen((o) => !o)}
						className={`rounded-full px-2 py-1.5 ${open ? "bg-fuchsia-600" : "hover:bg-white/10"}`}
					>
						☰
					</button>
					<button type="button" aria-label="Hide the lab bar (H)" onClick={() => setHidden(true)} className="rounded-full px-2 py-1.5 text-white/60 hover:bg-white/10">
						✕
					</button>
				</div>
			</div>
		</div>
	)
}
