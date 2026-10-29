// PROTOTYPE: the floating variant bar for `?gap=` (prototype branch only).
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { GAP_VARIANTS, type GapKey } from "./variants"

export function GapSwitcher({
	current,
	shelfSource,
}: { current: GapKey; shelfSource: string }) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const index = GAP_VARIANTS.findIndex((v) => v.key === current)
	const go = (step: number) => {
		const next =
			GAP_VARIANTS[(index + step + GAP_VARIANTS.length) % GAP_VARIANTS.length]
		const p = new URLSearchParams(params)
		p.set("gap", next.key)
		navigate(`?${p}`, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null
			if (
				el?.closest("input, textarea, [contenteditable]") ||
				(e.key !== "ArrowLeft" && e.key !== "ArrowRight")
			)
				return
			go(e.key === "ArrowLeft" ? -1 : 1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	const button =
		"flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-lg hover:bg-black/10"
	return (
		<div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-200 px-2 py-1 text-sm font-semibold text-black shadow-2xl ring-2 ring-black">
			<button type="button" className={button} onClick={() => go(-1)}>
				←
			</button>
			<span className="whitespace-nowrap px-1">
				{current.toUpperCase()} - {GAP_VARIANTS[index].name}
				<span className="ml-2 font-normal opacity-70">
					shelf: {shelfSource}
				</span>
			</span>
			<button type="button" className={button} onClick={() => go(1)}>
				→
			</button>
		</div>
	)
}
