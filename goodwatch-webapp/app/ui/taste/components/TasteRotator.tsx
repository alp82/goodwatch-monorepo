import RotatingText from "~/ui/text/RotatingText"
import { shuffleArray } from "~/utils/array"

const TASTE_PART_1 = shuffleArray([
	"Christopher Nolan films",
	"90s thrillers",
	"Korean cinema",
	"Tarantino's dialogue",
	"Wes Anderson aesthetics",
	"sci-fi epics",
	"indie dramas",
	"psychological thrillers",
	"historical epics",
	"crime sagas",
	"coming-of-age stories",
	"fantasy worlds",
	"noir mysteries",
	"war dramas",
	"romantic comedies",
	"surrealist cinema",
	"biographical films",
	"Studio Ghibli magics",
	"Leonardo DiCaprio movies",
	"80s nostalgia",
	"French New Wave",
	"sports underdog stories",
	"existential dramas",
	"showbiz satires",
])

const TASTE_PART_2 = shuffleArray([
	"with stunning visuals",
	"full of tension",
	"that keep you guessing",
	"with dark humor",
	"and quirky charm",
	"that blow your mind",
	"with deep characters",
	"and pure adrenaline",
	"that make you cry",
	"with slow-burn intensity",
	"and fast-paced action",
	"full of wonder",
	"with biting satire",
	"and emotional release",
	"that haunt you for days",
	"with witty conversation",
	"and melancholic beauty",
	"full of romance",
	"with mind-bending plots",
	"and wholesome warmth",
	"that challenge your thinking",
	"with stunning cinematography",
	"and unforgettable scores",
	"full of absurdity",
])

const rotateProps = {
	mainClassName: "inline-flex",
	splitLevelClassName: "overflow-hidden",
	staggerFrom: "last" as const,
	staggerDuration: 0.005,
	initial: { y: "100%", opacity: 0 },
	animate: { y: 0, opacity: 1 },
	exit: { y: "-120%", opacity: 0 },
	transition: { type: "spring", damping: 40, stiffness: 600 },
	rotationInterval: 6000,
	rotateOnMount: true,
}

interface TasteRotatorProps {
}

export default function TasteRotator({}: TasteRotatorProps) {
	return (
		<div className="max-w-3xl mx-auto rounded-sm border-l-8 border-gray-600 bg-gray-700/50 p-4">
			<div className="flex flex-wrap justify-center gap-x-2 text-xl md:text-2xl font-medium text-white">
				<span className="text-gray-300">You like</span>
				<span className="text-amber-400 font-semibold">
					<RotatingText
						{...rotateProps}
						texts={TASTE_PART_1}
						initialDelay={4500}
					/>
				</span>
				<span className="text-blue-400 font-semibold">
					<RotatingText
						{...rotateProps}
						texts={TASTE_PART_2}
						initialDelay={1500}
					/>
				</span>
			</div>
		</div>
	)
}
