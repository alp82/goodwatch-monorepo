// PROTOTYPE (start page lab): layout d: on desktop, hero and results on the left and the room on the right, sticky while the left column scrolls; on phones, a short room strip above the hero.
import { type ComponentType, useRef } from "react"
import { useLab } from "../../lab/types"
import { useHasRoom } from "./fit"

type Blocks = {
	Hero: ComponentType
	Recs: ComponentType
	How: ComponentType
	Browse: ComponentType
}

export function Split({ Hero, Recs, How, Browse }: Blocks) {
	const { Room } = useLab()
	const left = useRef<HTMLDivElement>(null)
	const heroHasRoom = useHasRoom(left)
	return (
		<div className="pb-24">
			{heroHasRoom ? null : (
				// Phones: a short wide strip, a bit closer around the TV so the hint is easy to hit.
				<Room
					className="h-[22svh] min-h-[150px] max-h-[220px] w-full lg:hidden"
					zoom={1.25}
				>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-gray-950"
					/>
				</Room>
			)}
			<div
				className={
					heroHasRoom
						? ""
						: "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,42%)] lg:gap-6 lg:pr-6"
				}
			>
				<div ref={left} className="min-w-0">
					<Hero />
					<Recs />
				</div>
				{heroHasRoom ? null : (
					<div className="hidden lg:block">
						{/* Tall box: the scene's phone version swaps in where there is one; otherwise a crop around the TV. */}
						<div className="sticky top-20 pt-6">
							<Room className="h-[calc(100svh-7rem)] max-h-[860px] w-full overflow-hidden rounded-2xl ring-1 ring-white/10" />
						</div>
					</div>
				)}
			</div>
			<How />
			<Browse />
		</div>
	)
}
