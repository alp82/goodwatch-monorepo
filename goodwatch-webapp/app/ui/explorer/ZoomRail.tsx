import { MinusIcon, PlusIcon } from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import type { MapEngine } from "./engine"

const labelOf = (k: number, island: string) =>
	k === 0
		? "All islands"
		: k === 1
			? island || "Island"
			: k === 2
				? "First titles"
				: k === 3
					? "Closer titles"
					: "Closest"

/**
 * Zoom in and out, and on wide screens the zoom stops near the island in the middle: all islands, the island, then
 * its titles generation by generation. The marker follows the camera between stops.
 */
export function ZoomRail({
	engine,
	onStop,
}: {
	engine: MapEngine | null
	onStop: (scale: number) => void
}) {
	const [state, setState] = useState<{
		stops: number[]
		at: number
		name: string
	}>({
		stops: [],
		at: 0,
		name: "",
	})
	useEffect(() => {
		if (!engine) return
		let raf = 0
		const update = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = engine.view()
				const l = Math.log(v.cam.s)
				let at = 0
				v.stops.forEach((s, k) => {
					if (Math.abs(Math.log(s) - l) < Math.abs(Math.log(v.stops[at]) - l))
						at = k
				})
				// Where between two stops the camera is, for the marker.
				let f = at
				const s0 = v.stops[at]
				const next = l > Math.log(s0) ? at + 1 : at - 1
				if (v.stops[next])
					f =
						at +
						((l - Math.log(s0)) / (Math.log(v.stops[next]) - Math.log(s0))) *
							(next - at)
				const name = v.focus?.name ?? ""
				setState((p) =>
					p.stops.length === v.stops.length &&
					Math.abs(p.at - f) < 0.02 &&
					p.name === name
						? p
						: { stops: v.stops, at: Math.max(0, f), name },
				)
			})
		}
		update()
		const off = engine.subscribe(update)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [engine])
	const n = Math.max(1, state.stops.length - 1)
	return (
		<fieldset className="ex-rail" aria-label="Zoom">
			<button
				type="button"
				aria-label="Zoom in"
				className="ex-zb"
				onClick={() => engine?.stepZoom(1)}
			>
				<PlusIcon className="ex-i" />
			</button>
			<div className="ex-rail-track">
				<span className="ex-rail-line" />
				<span
					className="ex-rail-mark"
					style={{ "--k": Math.min(1, state.at / n) } as React.CSSProperties}
				/>
				{state.stops.map((s, k) => (
					<button
						// The stops are positions on the rail; their number changes with the island in the middle.
						// biome-ignore lint/suspicious/noArrayIndexKey: a stop is its position.
						key={k}
						type="button"
						className={`ex-rail-stop ${Math.round(state.at) === k ? "ex-rail-on" : ""}`}
						style={{ "--k": k / n } as React.CSSProperties}
						onClick={() => onStop(s)}
						aria-label={`Zoom to ${labelOf(k, state.name)}`}
					>
						<span className="ex-rail-dot" />
						<span className="ex-rail-t">{labelOf(k, state.name)}</span>
					</button>
				))}
			</div>
			<button
				type="button"
				aria-label="Zoom out"
				className="ex-zb"
				onClick={() => engine?.stepZoom(-1)}
			>
				<MinusIcon className="ex-i" />
			</button>
		</fieldset>
	)
}
