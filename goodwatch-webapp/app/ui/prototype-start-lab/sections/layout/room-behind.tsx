// PROTOTYPE (start page lab): layout b: the room fills the first screen as a backdrop, the hero sits on its calm top area over a scrim, the rest follows on the plain page.
import { type ComponentType, useRef } from "react"
import { useLab } from "../../lab/types"
import { tvAt, useHasRoom, useSize } from "./fit"

type Blocks = {
	Hero: ComponentType
	Recs: ComponentType
	How: ComponentType
	Browse: ComponentType
}

export function RoomBehind({ Hero, Recs, How, Browse }: Blocks) {
	const { Room, scene } = useLab()
	const first = useRef<HTMLDivElement>(null)
	const hero = useRef<HTMLDivElement>(null)
	const box = useSize(first)
	const heroSize = useSize(hero)
	const heroHasRoom = useHasRoom(hero)
	// The TV goes in the open space under the hero: halfway between the hero's bottom and the first screen's bottom.
	const heroBottom = heroSize?.h ?? 0
	const target = box
		? Math.min(
				box.h * 0.8,
				Math.max(box.h * 0.45, heroBottom + (box.h - heroBottom) * 0.45),
			)
		: 0
	// Phones zoom less: the portrait scenes are already close.
	const { focal, zoom } = tvAt(scene, box, target, box && box.w < 640 ? 1.35 : 1.8)
	const p = box ? Math.min(85, (heroBottom / box.h) * 100) : 45
	const scrim = `linear-gradient(to bottom, rgb(3 7 18 / 0.9) 0%, rgb(3 7 18 / 0.75) ${p * 0.75}%, rgb(3 7 18 / 0.2) ${p}%, rgb(3 7 18 / 0) ${Math.min(90, p + 12)}%, rgb(3 7 18 / 0.85) 96%, rgb(3 7 18) 100%)`
	return (
		<div className="pb-24">
			<div
				ref={first}
				className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col"
			>
				{heroHasRoom ? null : (
					<>
						<div className="absolute inset-0 -z-10">
							<Room className="h-full w-full" focal={focal} zoom={zoom} />
						</div>
						{/* Scrim: dark behind the hero, clear over the TV, back to the page color at the bottom. */}
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 -z-10"
							style={{ background: scrim }}
						/>
					</>
				)}
				<div ref={hero} className="relative pt-4 sm:pt-10">
					<Hero />
				</div>
			</div>
			<Recs />
			<How />
			<Browse />
		</div>
	)
}
