// The hero's roll control: a pixel die in a column card beside the hero on wide screens, a pill under the sentence
// below 1024 px. The die is the one the die-tumble effect throws, lying flat (die-faces.ts); the hero hides it while
// the thrown one is in the air. Motion is transform and opacity only.
import { DIE_FACES } from "./die-faces"

export const ROLL_LABEL = "Roll another total"

const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
/** A dark tile with a hairline ring that warms on hover. */
const TILE =
	"bg-linear-to-b from-gray-800 to-gray-950 ring-1 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.45)] transition-[box-shadow,--tw-ring-color] hover:ring-amber-400/60"

/** CSS px per die pixel: the die is 16 cells, so 48 px, as on the effect canvas. */
export const DIE_PX = 3

function PixelDie({ face, hidden }: { face: number; hidden: boolean }) {
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: decorative, the button carries the label
		<svg
			viewBox="0 0 16 16"
			width={16 * DIE_PX}
			height={16 * DIE_PX}
			shapeRendering="crispEdges"
			aria-hidden
			data-fx="die"
			className={`block transition-[transform,opacity] duration-150 group-hover:-translate-y-0.5 ${hidden ? "opacity-0" : "opacity-100"}`}
		>
			{(DIE_FACES[face - 1] ?? DIE_FACES[0]).map(([x, y, fill]) => (
				<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
			))}
		</svg>
	)
}

export function RollControl({
	face,
	hidden,
	compact = false,
	onRoll,
	onIntent,
}: {
	face: number
	/** The die is in the air on the effect canvas. */
	hidden: boolean
	/** The pill under the sentence, below 1024 px. */
	compact?: boolean
	onRoll: () => void
	/** A pointer on the button: time to fetch the effect. */
	onIntent?: () => void
}) {
	const die = (
		<span className="rounded-xl bg-[radial-gradient(circle_at_50%_40%,#2a1d0c,#0d0904)] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] ring-1 ring-amber-500/25">
			<PixelDie face={face} hidden={hidden} />
		</span>
	)
	return (
		<button
			type="button"
			onClick={onRoll}
			onPointerEnter={onIntent}
			onFocus={onIntent}
			aria-label={ROLL_LABEL}
			title={ROLL_LABEL}
			className={`group relative shrink-0 cursor-pointer select-none ${FOCUS} ${TILE} ${
				compact
					? "flex h-16 items-center gap-3 rounded-full pr-6 pl-1.5"
					: "flex w-28 flex-col items-center gap-4 rounded-3xl px-4 pt-6 pb-4"
			}`}
		>
			{compact ? (
				<>
					{die}
					<span className="text-lg font-black tracking-tight text-white">
						Roll the dice
					</span>
				</>
			) : (
				<>
					<span className="flex h-24 items-center">{die}</span>
					<span className="text-sm font-black tracking-[0.18em] text-amber-300 uppercase">
						Roll
					</span>
				</>
			)}
		</button>
	)
}

/** A cheap repeatable digit for reel cell k of character i on roll r: nothing random is rendered. */
const reelDigit = (r: number, i: number, k: number) =>
	((r * 7 + i * 13 + k * 5 + (((r + k) * i) % 7)) % 10).toString()

/** Digits a reel spins through before it stops on its own. */
const REEL = 8

/**
 * The hero's number. `roll` 0 is the first paint: plain text. After a roll each digit arrives on a slot reel, one after
 * another; other characters rise in. `still` splits it into characters without moving, for the invisible copies that
 * hold the hero's size.
 */
export function RollNumber({
	text,
	roll,
	still = false,
}: {
	text: string
	roll: number
	still?: boolean
}) {
	if (still)
		return (
			<span className="roll-chars block whitespace-pre">
				{[...text].map((ch, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed text
					<span key={i}>{ch}</span>
				))}
			</span>
		)
	if (!roll) return <span className="block">{text}</span>
	return (
		<span className="roll-chars roll-reels block whitespace-pre">
			{[...text].map((ch, i) => {
				const key = `${i}-${ch}`
				if (!/\d/.test(ch))
					return (
						<span key={key} className="roll-char">
							{ch}
						</span>
					)
				return (
					<span key={key} className="roll-cell">
						<span
							className="roll-strip"
							style={{
								animationDelay: `${i * 40}ms`,
								animationDuration: `${560 + i * 40}ms`,
							}}
						>
							{Array.from({ length: REEL }, (_, k) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a fixed strip
								<span key={k}>{reelDigit(roll, i, k)}</span>
							))}
							<span>{ch}</span>
						</span>
					</span>
				)
			})}
		</span>
	)
}

/** The roll number's motion. Each reel cell is 1.4em tall with its digit in the top 0.9em, so neighbors stay out. */
export function RollStyles() {
	return (
		<style
			// biome-ignore lint/security/noDangerouslySetInnerHtml: our own CSS; plain children would escape `>` on the server and not hydrate
			dangerouslySetInnerHTML={{
				__html: `
.roll-chars > span { display: inline-block; vertical-align: top; }
.roll-cell { height: 0.9em; overflow: hidden; }
.roll-strip { display: flex; flex-direction: column; transform: translateY(-${REEL * 1.4}em); }
.roll-strip > span { display: block; height: 1.4em; line-height: 0.9em; }
@media (prefers-reduced-motion: reduce) {
	.roll-reels { animation: roll-fade .3s ease-out; }
	@keyframes roll-fade { from { opacity: 0; } to { opacity: 1; } }
}
@media (prefers-reduced-motion: no-preference) {
	@keyframes roll-strip { from { transform: translateY(0); } to { transform: translateY(-${REEL * 1.4}em); } }
	.roll-strip { animation: roll-strip .7s cubic-bezier(.2,.75,.25,1.06) both; }
	@keyframes roll-rise { from { opacity: 0; transform: translateY(.3em); } to { opacity: 1; transform: none; } }
	.roll-reels .roll-char { animation: roll-rise .3s cubic-bezier(.16,1,.3,1) both; }
}
`,
			}}
		/>
	)
}
