// PROTOTYPE - throwaway. The floating switcher: variant (arrows or the keyboard's left and right arrows, not while
// typing), the surface, and who is looking. It folds down to a small pill so the page underneath can be seen. Hidden
// in production. It sits under the sheets, at the top on phones (the bottom is for the dock, sheets and tabs).
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { SCREENS, type Screen, VARIANTS, type Variant, VIEWERS, type Viewer } from "~/ui/prototype-feedback/model"

const seg = (on: boolean) =>
	`cursor-pointer rounded-full px-2 py-1 whitespace-nowrap ${on ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-200"}`

export function Switcher() {
	const [params, setParams] = useSearchParams()
	// Phones start folded to a small pill, so the switcher doesn't eat the screen.
	const [folded, setFolded] = useState(false)
	useEffect(() => {
		if (window.matchMedia("(max-width: 767px)").matches) setFolded(true)
	}, [])
	const phone = (params.get("m") === "2" ? "2" : "1") as "1" | "2"
	const variant = (params.get("variant") ?? "C") as Variant
	const screen = (params.get("screen") ?? "title") as Screen
	const viewer = (params.get("as") ?? "member") as Viewer
	const put = (key: string, value: string) => {
		const p = new URLSearchParams(params)
		p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const keys = Object.keys(VARIANTS) as Variant[]
	const go = (step: number) => put("variant", keys[(keys.indexOf(variant) + step + keys.length) % keys.length])
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
	if (folded)
		return (
			<button
				type="button"
				data-feedback-private
				data-prototype-switcher
				onClick={() => setFolded(false)}
				aria-label="Show prototype options"
				className="fixed top-[4.5rem] left-2 z-[1000] inline-flex cursor-pointer items-center gap-1 rounded-full bg-white py-1 pr-1.5 pl-2.5 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:top-auto lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2"
			>
				{variant} · m{phone}
				<ChevronDownIcon className="size-4" />
			</button>
		)
	return (
		<div
			data-feedback-private
			data-prototype-switcher
			className="fixed top-[4.25rem] left-1/2 z-[1000] w-max lg:top-auto max-w-[calc(100vw-1rem)] -translate-x-1/2 rounded-2xl bg-white px-1.5 py-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:bottom-4"
		>
			<div className="flex items-center gap-1">
				<button type="button" onClick={() => go(-1)} className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200" aria-label="Previous variant">
					←
				</button>
				<span className="min-w-0 flex-1 truncate text-center sm:min-w-64">
					{variant} — {VARIANTS[variant]}
				</span>
				<button type="button" onClick={() => go(1)} className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200" aria-label="Next variant">
					→
				</button>
				<button type="button" onClick={() => setFolded((f) => !f)} className="cursor-pointer rounded-full p-1 hover:bg-neutral-200" aria-label={folded ? "Show options" : "Fold"}>
					<ChevronUpIcon className="size-4" />
				</button>
			</div>
			{!folded && (
				<div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-neutral-200 pt-1 pb-0.5">
					<div className="flex flex-wrap justify-center" role="group" aria-label="Surface">
						{(Object.keys(SCREENS) as Screen[]).map((s) => (
							<button key={s} type="button" onClick={() => put("screen", s)} className={seg(screen === s)}>
								{SCREENS[s]}
							</button>
						))}
					</div>
					<div className="flex rounded-full bg-neutral-100" role="group" aria-label="Phone fix mode">
						{(["1", "2"] as const).map((m) => (
							<button key={m} type="button" onClick={() => put("m", m)} className={seg(phone === m)}>
								{m === "1" ? "Phone: Split view" : "Phone: Quoted"}
							</button>
						))}
					</div>
					<div className="flex rounded-full bg-neutral-100" role="group" aria-label="Viewing as">
						{(Object.keys(VIEWERS) as Viewer[]).map((v) => (
							<button key={v} type="button" onClick={() => put("as", v)} className={seg(viewer === v)}>
								{VIEWERS[v]}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
