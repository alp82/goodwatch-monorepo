// PROTOTYPE - throwaway (#541). The floating variant switcher, as ui/prototype/PrototypeSwitcher.tsx, but it keeps
// the address's `#browse`: the start page reads the fragment (use-below-room.ts), and dropping it would send the page
// back up to the room on every switch.
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect } from "react"

export function Switcher({ variants }: { variants: Record<string, string> }) {
	const location = useLocation()
	const navigate = useNavigate()
	const keys = Object.keys(variants)
	const current = new URLSearchParams(location.search).get("variant") ?? keys[0]
	const go = (step: number) => {
		const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length]
		const params = new URLSearchParams(location.search)
		params.set("variant", next)
		navigate({ search: `?${params}`, hash: location.hash }, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest("input, textarea, [contenteditable]")) return
			// The room's keys are the TV's while it is on the screen; the switcher takes them below it only.
			if (!location.hash) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	return (
		<div className="sr-switcher fixed bottom-24 left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-1.5 py-1 text-sm font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 sm:bottom-6">
			<button type="button" onClick={() => go(-1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Previous variant">
				←
			</button>
			<span className="min-w-36 whitespace-nowrap text-center">
				{current} · {variants[current]}
			</span>
			<button type="button" onClick={() => go(1)} className="rounded-full px-3 py-1 hover:bg-neutral-200" aria-label="Next variant">
				→
			</button>
		</div>
	)
}
