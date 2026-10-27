// PROTOTYPE (start page lab): layout e (bolder): the page sits inside the room: a slim room strip as the header area, a dim fixed room behind everything, dark cards on top, and a small TV that stays in reach.
import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import { useLab } from "../../lab/types"
import { tvFill, useHasRoom } from "./fit"

type Blocks = {
	Hero: ComponentType
	Recs: ComponentType
	How: ComponentType
	Browse: ComponentType
}

const Card = ({ children }: { children: ReactNode }) => (
	<section className="overflow-hidden rounded-2xl bg-gray-950/90 shadow-2xl shadow-black/60 ring-1 ring-white/10">
		{children}
	</section>
)

export function RoomFrame({ Hero, Recs, How, Browse }: Blocks) {
	const { Room, scene } = useLab()
	const strip = useRef<HTMLDivElement>(null)
	const hero = useRef<HTMLDivElement>(null)
	const heroHasRoom = useHasRoom(hero)
	// The mini TV shows once the strip's TV has scrolled away.
	const [stripGone, setStripGone] = useState(false)
	useEffect(() => {
		const el = strip.current
		if (!el) return
		const io = new IntersectionObserver(
			([e]) => setStripGone(!e.isIntersecting),
			{ threshold: 0.35 },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [])
	return (
		<div className="relative isolate pb-28">
			{/* The dim room behind the whole page: static, not interactive, no TV. */}
			<div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
				<Room className="h-full w-full opacity-40" noTv noOverlay />
				<div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/60 to-gray-950/80" />
			</div>
			{/* The room peeks in as the page's header area. */}
			<div ref={strip}>
				{heroHasRoom ? null : (
					<Room
						className="h-[24svh] min-h-[160px] max-h-[260px] w-full"
						zoom={1.15}
					>
						<div
							aria-hidden
							className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-gray-950/70"
						/>
					</Room>
				)}
			</div>
			<div
				className={`relative mx-auto ${heroHasRoom ? "pt-6" : "-mt-8 sm:-mt-12"} flex max-w-6xl flex-col gap-4 px-3 sm:gap-6 sm:px-6`}
			>
				<Card>
					<div ref={hero}>
						<Hero />
					</div>
				</Card>
				<Card>
					<Recs />
				</Card>
				<Card>
					<How />
				</Card>
				<Card>
					<Browse />
				</Card>
			</div>
			{/* Always in reach: the TV, cropped close, in the corner above the lab bar. */}
			{heroHasRoom ? null : (
				<div
					className={`fixed bottom-24 right-3 z-30 overflow-hidden rounded-xl shadow-2xl shadow-black ring-1 ring-amber-400/40 transition duration-300 ease-out sm:right-5 ${
						stripGone
							? "translate-y-0 opacity-100"
							: "pointer-events-none translate-y-4 opacity-0"
					}`}
				>
					{/* Same aspect at both sizes, so one zoom fits. */}
					<Room
						className="h-[84px] w-[132px] sm:h-[104px] sm:w-[164px]"
						zoom={tvFill(scene, 164, 104)}
						portraitBelow={0}
						noOverlay
					/>
				</div>
			)}
		</div>
	)
}
