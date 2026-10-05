// PROTOTYPE - throwaway. Floating variant switcher for UI prototypes. Hidden in production.
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export function PrototypeSwitcher({ variants, position = "bottom-6 left-1/2 -translate-x-1/2" }: { variants: Record<string, string>; position?: string }) {
	const [params, setParams] = useSearchParams()
	const keys = Object.keys(variants)
	const current = params.get("variant") ?? keys[0]
	const go = (step: number) => {
		const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length]
		const p = new URLSearchParams(params)
		p.set("variant", next)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest("input, textarea, [contenteditable]")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	return (
		<div className={`fixed ${position} z-50 flex items-center gap-2 rounded-full bg-white px-2 py-1.5 text-sm font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500`}>
			<button type="button" onClick={() => go(-1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Previous variant">
				←
			</button>
			<span className="min-w-44 text-center">
				{current} — {variants[current]}
			</span>
			<button type="button" onClick={() => go(1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Next variant">
				→
			</button>
		</div>
	)
}
