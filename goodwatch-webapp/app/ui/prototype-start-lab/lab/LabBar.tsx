// PROTOTYPE (start page lab): the floating bar that picks one variant per section. Guest/Member switch, the section
// the arrows cycle, the variant's name. Keys: ← → cycle the variant, ↑ ↓ the section, H hides the bar. Arrow keys
// are left alone while a field has focus. Never rendered in a production build.
import { useNavigate } from "@remix-run/react"
import { useEffect, useState } from "react"
import { type Choice, SECTIONS, type SectionId, paramsFromChoice } from "./choice"

export type BarSection = { id: SectionId; name: string; variants: { key: string; name: string }[] }

export function LabBar({ choice, sections }: { choice: Choice; sections: BarSection[] }) {
	const navigate = useNavigate()
	const [hidden, setHidden] = useState(false)
	const [open, setOpen] = useState(false)
	const visible = sections.filter((s) => SECTIONS.find((x) => x.id === s.id)?.for.includes(choice.as))
	const active = visible.find((s) => s.id === choice.sec) ?? visible[0]
	const currentKey = (id: SectionId) => {
		const s = visible.find((x) => x.id === id)
		return choice[id] && s?.variants.some((v) => v.key === choice[id]) ? choice[id] : s?.variants[0]?.key
	}

	const go = (next: Choice) =>
		navigate(`?${paramsFromChoice(next).toString()}`, { replace: true, preventScrollReset: true })

	const cycle = (dir: 1 | -1) => {
		if (!active?.variants.length) return
		const i = active.variants.findIndex((v) => v.key === currentKey(active.id))
		const next = active.variants[(i + dir + active.variants.length) % active.variants.length]
		go({ ...choice, [active.id]: next.key })
	}
	const cycleSection = (dir: 1 | -1) => {
		const i = visible.findIndex((s) => s.id === active?.id)
		const next = visible[(i + dir + visible.length) % visible.length]
		if (next) go({ ...choice, sec: next.id })
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
			else return
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	if (process.env.NODE_ENV === "production") return null
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

	const variant = active?.variants.find((v) => v.key === currentKey(active.id))
	return (
		<div className="fixed inset-x-0 bottom-3 z-[2147483000] flex justify-center px-2" data-lab-bar>
			<div className="flex max-w-full flex-col items-stretch gap-1 rounded-2xl border border-fuchsia-400/60 bg-black/90 p-1.5 text-xs text-white shadow-2xl shadow-black">
				{open ? (
					<div className="grid max-h-[50vh] grid-cols-1 gap-x-3 gap-y-1 overflow-y-auto p-1 sm:grid-cols-2">
						{visible.map((s) => (
							<label key={s.id} className="flex items-center justify-between gap-2">
								<span className="text-white/60">{s.name}</span>
								<select
									className="max-w-[12rem] rounded bg-white/10 px-1 py-0.5 text-white"
									value={currentKey(s.id)}
									onChange={(e) => go({ ...choice, [s.id]: e.target.value, sec: s.id })}
								>
									{s.variants.map((v) => (
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
								onClick={() => go({ ...choice, as, sec: as === "member" ? "member" : "hero" })}
								className={`px-2.5 py-1.5 font-semibold capitalize ${choice.as === as ? "bg-fuchsia-600" : "text-white/70"}`}
							>
								{as}
							</button>
						))}
					</div>
					<select
						aria-label="Section"
						className="rounded-full bg-white/10 px-2 py-1.5 text-white"
						value={active?.id}
						onChange={(e) => go({ ...choice, sec: e.target.value as SectionId })}
					>
						{visible.map((s) => (
							<option key={s.id} value={s.id} className="bg-black">
								{s.name}
							</option>
						))}
					</select>
					<button type="button" aria-label="Previous variant" onClick={() => cycle(-1)} className="rounded-full px-2 py-1.5 hover:bg-white/10">
						◀
					</button>
					<span className="min-w-0 max-w-[11rem] truncate font-semibold sm:max-w-[16rem]" title={variant?.name}>
						{variant ? `${variant.key} · ${variant.name}` : "none yet"}
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
