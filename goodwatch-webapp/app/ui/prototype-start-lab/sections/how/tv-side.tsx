// PROTOTYPE (start page lab): how b · TV on the side: a short section with a crop of the room around the TV (its hint plays the intro) beside a few lines and the link.
import { Link } from "@remix-run/react"
import { useRef } from "react"
import { useLab } from "../../lab/types"
import { ESSENTIALS } from "./visuals"

export function TvSide() {
	const { Room, scene, playIntro } = useLab()
	const roomBox = useRef<HTMLDivElement>(null)
	// Close enough that the TV is about a third of the crop's width, whatever the scene.
	const tvWidth = scene.landscape.tv.box[2] || 0.2
	const zoom = Math.min(4, Math.max(1, 0.36 / tvWidth))
	// The text's button presses the TV's own hint when it is a button, so the intro grows out of the TV; otherwise it opens plain.
	const watch = () => {
		// The stage draws the slots, then the TV, then the tv variant's Near, then the children (the marker): walk back from the marker.
		let el = roomBox.current?.querySelector("[data-how-b-end]")?.previousElementSibling ?? null
		for (let i = 0; el && i < 2; i++, el = el.previousElementSibling) {
			const hint = el.matches("button, [role=button]") ? el : el.querySelector("button, [role=button]")
			if (hint instanceof HTMLElement) return hint.click()
		}
		playIntro(null)
	}
	return (
		<section aria-labelledby="how-b-h" className="mx-auto max-w-6xl px-4 py-10 sm:px-8 md:py-14">
			<div className="grid items-center gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
				<div ref={roomBox} className="overflow-hidden rounded-2xl ring-1 ring-inset ring-white/10">
					<Room className="h-[200px] w-full sm:h-[280px] md:h-[340px]" zoom={zoom} noOverlay>
						<span data-how-b-end hidden />
					</Room>
				</div>
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/85">How it works</p>
					<h2 id="how-b-h" className="mt-1 text-2xl font-extrabold text-white md:text-4xl">
						How GoodWatch works
					</h2>
					<ul className="mt-3 space-y-1.5 text-[15px] leading-snug text-gray-300 md:mt-4 md:space-y-2 md:text-base">
						{ESSENTIALS.map((e) => (
							<li key={e.id} className="flex gap-2">
								<span aria-hidden className="text-amber-400">
									•
								</span>
								<span>
									<b className="font-bold text-white">{e.title}.</b> {e.line}
								</span>
							</li>
						))}
					</ul>
					<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 md:mt-6">
						<button
							type="button"
							onClick={watch}
							className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-300"
						>
							{"\u25B6\uFE0E"} Watch the intro
						</button>
						<Link to="/how-it-works" className="text-sm font-bold text-amber-300 hover:underline">
							Read how it works →
						</Link>
					</div>
				</div>
			</div>
		</section>
	)
}
