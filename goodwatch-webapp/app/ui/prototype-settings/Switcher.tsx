// PROTOTYPE - throwaway. The floating variant switcher of ui/prototype/PrototypeSwitcher.tsx, but each variant is its
// own path (/prototype/settings/a, /b, ...), so a screenshot or a link names the variant. Hidden in production.
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect } from "react"

export function PathSwitcher({ base, variants, current }: { base: string; variants: Record<string, string>; current: string }) {
	const navigate = useNavigate()
	const { search } = useLocation()
	const keys = Object.keys(variants)
	const go = (step: number) => {
		const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length]
		navigate(`${base}/${next}${search}`, { replace: true, preventScrollReset: true })
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
	if (search.includes("shot")) return null
	return (
		<div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-2 py-1.5 text-sm font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 md:bottom-6">
			<button type="button" onClick={() => go(-1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Previous variant">
				←
			</button>
			<span className="min-w-44 text-center">
				{current.toUpperCase()} — {variants[current]}
			</span>
			<button type="button" onClick={() => go(1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Next variant">
				→
			</button>
		</div>
	)
}
