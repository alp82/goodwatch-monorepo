// PROTOTYPE (discover-field): the variants of the search field and the floating switcher. ← and → also cycle (not while
// typing). Dev only. The look survives URL rewrites by filters and searches through a module variable.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export const LOOKS = [
	{ key: "A", name: "Links under the field" },
	{ key: "B", name: "Links in the field" },
	{ key: "C", name: "Pills under the field" },
	{ key: "D", name: "One example under the field" },
	{ key: "E", name: "Two decks" },
] as const
export type Look = (typeof LOOKS)[number]["key"]

let last: Look = "A"

export function useLook(): Look {
	const [params] = useSearchParams()
	const asked = LOOKS.find((look) => look.key === params.get("variant"))?.key
	if (asked) last = asked
	return last
}

export function FieldSwitcher() {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const current = useLook()
	const index = LOOKS.findIndex((look) => look.key === current)
	const go = (step: number) => {
		const out = new URLSearchParams(params)
		out.set("variant", LOOKS[(index + step + LOOKS.length) % LOOKS.length].key)
		navigate({ search: `?${out}` }, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (event.key === "ArrowLeft") go(-1)
			if (event.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	return (
		<div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 p-1 text-xs font-bold whitespace-nowrap text-white shadow-2xl shadow-black/60 lg:text-sm">
			<button type="button" onClick={() => go(-1)} className="cursor-pointer rounded-full px-3 py-1.5 hover:bg-white/20" aria-label="Previous variant">
				←
			</button>
			<span className="text-center lg:min-w-64">
				{current} · {LOOKS[index].name}
			</span>
			<button type="button" onClick={() => go(1)} className="cursor-pointer rounded-full px-3 py-1.5 hover:bg-white/20" aria-label="Next variant">
				→
			</button>
		</div>
	)
}
