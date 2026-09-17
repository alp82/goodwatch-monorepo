import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export const variants = ["A", "B", "C"] as const
export type Variant = (typeof variants)[number]
export const variantNames = {
	A: "Discovery feed",
	B: "Title workbench",
	C: "Guided journey",
}

export default function PrototypeSwitcher() {
	const [params, setParams] = useSearchParams()
	const current = variants.includes(params.get("variant") as Variant)
		? (params.get("variant") as Variant)
		: "A"
	function cycle(direction: number) {
		const next = new URLSearchParams(params)
		next.set(
			"variant",
			variants[(variants.indexOf(current) + direction + 3) % 3],
		)
		setParams(next, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				(event.target as HTMLElement)?.closest(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				event.preventDefault()
				cycle(event.key === "ArrowLeft" ? -1 : 1)
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [params])
	if (process.env.NODE_ENV === "production") return null
	return (
		<nav
			aria-label="Prototype variations"
			className="fixed bottom-20 left-1/2 z-50 flex w-max max-w-[95vw] -translate-x-1/2 items-center gap-3 rounded-full bg-white px-4 py-3 text-sm text-black shadow-xl"
		>
			<button
				type="button"
				onClick={() => cycle(-1)}
				aria-label="Previous variant"
			>
				←
			</button>
			<strong>
				{current} · {variantNames[current]}
			</strong>
			<button type="button" onClick={() => cycle(1)} aria-label="Next variant">
				→
			</button>
		</nav>
	)
}
