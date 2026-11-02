// PROTOTYPE (discover-easy): the floating variant switcher. ← and → also cycle (not while typing). Dev only.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const current = params.get("variant") ?? variants[0].key
	const index = Math.max(0, variants.findIndex((v) => v.key === current))
	const go = (step: number) => {
		const out = new URLSearchParams(params)
		out.set("variant", variants[(index + step + variants.length) % variants.length].key)
		navigate({ search: `?${out}` }, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest("input, textarea, select, [contenteditable]")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	const v = variants[index]
	const member = params.get("as") === "member"
	const toggleMember = () => {
		const out = new URLSearchParams(params)
		member ? out.delete("as") : out.set("as", "member")
		window.location.search = `?${out}`
	}
	return (
		<div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-fuchsia-600 p-1 text-xs lg:text-sm font-bold text-white shadow-2xl shadow-black/60">
			<button type="button" onClick={() => go(-1)} className="cursor-pointer rounded-full px-3 py-1.5 hover:bg-white/20" aria-label="Previous variant">←</button>
			<span className="text-center whitespace-nowrap lg:min-w-44">{v.key} · {v.name}</span>
			<button type="button" onClick={() => go(1)} className="cursor-pointer rounded-full px-3 py-1.5 hover:bg-white/20" aria-label="Next variant">→</button>
			<button type="button" onClick={toggleMember} className="ml-1 cursor-pointer rounded-full bg-white/20 px-3 py-1.5 hover:bg-white/30" title="Reloads the page">
				{member ? "Member" : "Guest"}
			</button>
		</div>
	)
}
