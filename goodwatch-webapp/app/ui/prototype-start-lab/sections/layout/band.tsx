// PROTOTYPE (start page lab): layout c: the hero on the plain page first, then a short cinematic band of the room (shelves with posters, TV as the intro hint), then recs, how, browse.
import { type ComponentType, useRef } from "react"
import { useLab } from "../../lab/types"
import { useHasRoom } from "./fit"

type Blocks = {
	Hero: ComponentType
	Recs: ComponentType
	How: ComponentType
	Browse: ComponentType
}

export function HeroThenBand({ Hero, Recs, How, Browse }: Blocks) {
	const { Room } = useLab()
	const hero = useRef<HTMLDivElement>(null)
	const heroHasRoom = useHasRoom(hero)
	return (
		<div className="pb-24">
			<div ref={hero}>
				<Hero />
			</div>
			{heroHasRoom ? null : (
				// Wide crop around the TV. The box stays wider than tall on phones too, so it keeps the landscape scene,
				// which shows nearly the whole room at this height.
				<div className="relative my-6 sm:my-10">
					<Room
						className="h-[40svh] min-h-[220px] max-h-[460px] w-full"
						portraitBelow={0.5}
					>
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(to bottom, rgb(3 7 18) 0%, rgb(3 7 18 / 0) 18%, rgb(3 7 18 / 0) 82%, rgb(3 7 18) 100%)",
							}}
						/>
					</Room>
				</div>
			)}
			<Recs />
			<How />
			<Browse />
		</div>
	)
}
