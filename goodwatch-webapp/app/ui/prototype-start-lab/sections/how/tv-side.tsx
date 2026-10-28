// PROTOTYPE (start page lab): how b · TV on the side: a short section with a crop of the room around the TV (the whole crop is one button that plays the intro from the TV) beside the three essentials and one "Read how it works" link.
import { Link } from "@remix-run/react"
import { useEffect, useRef } from "react"
import { useLab } from "../../lab/types"
import { ESSENTIALS } from "./visuals"

export function TvSide() {
	const { Room, tvScene, playIntro } = useLab()
	const roomBox = useRef<HTMLDivElement>(null)
	// Close enough that the TV is about a third of the crop's width, whatever the scene.
	// Round 2's stage scenes have no TV: the room shows its TV corner (Lab.tvScene).
	const tvWidth = tvScene.landscape.tv?.box[2] || 0.2
	const zoom = Math.min(4, Math.max(1, 0.36 / tvWidth))
	// The room's overlay presses the TV's own control (tv a's pill, or another variant's hint or label), so
	// the intro grows out of the TV on screen; with no control there it opens plain.
	const watch = () => {
		const box = roomBox.current
		const own = box?.querySelector("[data-labtv-play]")
		if (own instanceof HTMLElement) return own.click()
		// The stage draws the slots, then the TV, then the tv variant's Near, then the children (the marker): walk back from the marker.
		let el = box?.querySelector("[data-how-b-end]")?.previousElementSibling ?? null
		for (let i = 0; el && i < 2; i++, el = el.previousElementSibling) {
			const hint = el.matches("button, [role=button]") ? el : el.querySelector("button, [role=button]")
			if (hint instanceof HTMLElement) return hint.click()
		}
		playIntro(null)
	}
	// The whole crop is one button laid over the room: the room's own controls step out of the tab order and the
	// accessibility tree (inert), and the overlay forwards to them.
	useEffect(() => {
		if (roomBox.current) roomBox.current.inert = true
	}, [])
	return (
		<section aria-labelledby="how-b-h" className="mx-auto max-w-6xl px-4 py-10 sm:px-8 md:py-14">
			<div className="grid items-center gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
				<div data-labtv-press className="group relative overflow-hidden rounded-2xl">
					<div ref={roomBox}>
						<Room className="h-[220px] w-full sm:h-[280px] md:h-[340px]" zoom={zoom} noOverlay>
							<span data-how-b-end hidden />
						</Room>
					</div>
					{/* Hover: the room brightens a touch (a white veil's opacity) while the pill lifts (push.css). */}
					<span
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06] group-active:opacity-[0.02]"
					/>
					<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
					<button
						type="button"
						onClick={watch}
						aria-label="Watch the intro"
						className="absolute inset-0 z-[3] cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
					/>
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
					{/* Round 6: the room's "Watch the intro" pill is the one way into the film; the text's one link is the page. */}
					<Link
						to="/how-it-works"
						className="group/read mt-5 inline-flex items-center gap-2 text-base font-bold text-amber-300 hover:underline md:mt-7 md:text-lg"
					>
						Read how it works
						<span aria-hidden className="inline-block transition-transform duration-200 group-hover/read:translate-x-1">
							→
						</span>
					</Link>
				</div>
			</div>
		</section>
	)
}
