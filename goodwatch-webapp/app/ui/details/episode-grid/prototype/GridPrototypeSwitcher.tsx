// PROTOTYPE (#153): the floating bar that flips between episode grid layouts. It is not
// part of any design and never renders in a production build.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { useEffect } from "react"

interface Props {
	variants: { key: string; name: string }[]
	current: string
	onChange: (key: string) => void
}

export default function GridPrototypeSwitcher({ variants, current, onChange }: Props) {
	const index = Math.max(0, variants.findIndex((v) => v.key === current))
	const step = (delta: number) => onChange(variants[(index + delta + variants.length) % variants.length].key)

	useEffect(() => {
		if (import.meta.env.PROD) return
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest("input, textarea, select, [contenteditable]")) return
			if (event.metaKey || event.ctrlKey || event.altKey) return
			if (event.key === "ArrowLeft") step(-1)
			if (event.key === "ArrowRight") step(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	if (import.meta.env.PROD) return null
	const variant = variants[index]
	return (
		<div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none" data-prototype-switcher>
			<div className="pointer-events-auto flex items-center gap-1 rounded-full bg-fuchsia-600 p-1 text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] ring-2 ring-white/80">
				<button type="button" onClick={() => step(-1)} aria-label="Previous grid layout" className="rounded-full p-1.5 hover:bg-white/20">
					<ChevronLeftIcon className="h-4 w-4" />
				</button>
				<span className="px-1 text-sm font-semibold whitespace-nowrap">
					<span className="mr-1.5 rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">Prototype</span>
					{variant.key.toUpperCase()}: {variant.name}
				</span>
				<button type="button" onClick={() => step(1)} aria-label="Next grid layout" className="rounded-full p-1.5 hover:bg-white/20">
					<ChevronRightIcon className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}
