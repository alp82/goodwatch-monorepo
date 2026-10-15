// Taste on the TV, in its three states (tv-taste.ts): the way into the quiz before the person has five scores, the
// sides of their taste as tiles once there are some, and the quiz's picks as a list ("Made for you") when there
// are five scores and no sides yet. A side's screen lists the titles of it the person rated. The Expand key opens
// the Taste page, on the side on screen (`/taste?side=`); its place at the bottom right is the Frame's, and every
// state keeps the corner free.
// A chunk the TV asks for on first use (screen-code.tsx).
import { type ReactNode, useRef } from "react"
import { useTasteQuiz } from "~/ui/taste-quiz/use-taste-quiz"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { TitleList } from "../TitleList"
import {
	Frame,
	Img,
	Item,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import type { TvScreen } from "../tv-machine"
import {
	type TvSide,
	type TvTasteOnScreen,
	sidesCrumb,
	startWords,
} from "../tv-taste"
import {
	type TvTasteRead,
	type TvTasteReport,
	quizOptions,
	useTasteRead,
	useTasteReport,
} from "../use-tv-taste"

// ---------------------------------------------------------------------------------------------------------
// The data (use-tv-taste.ts). Draws nothing. The scene mounts `TasteData` once while the address names Taste, a
// side or the quiz, and gets what it holds through `report`. It is in this chunk, so the person's taste costs no
// request of its own and nothing in the page's first view.

type DataProps = {
	screen: TvScreen
	member: boolean
	report: (taste: TvTasteReport | null) => void
}

function Report({
	screen,
	report,
	read,
	quiz,
}: DataProps & {
	read: TvTasteRead
	quiz: Parameters<typeof useTasteReport>[2]
}) {
	useReport(report, useTasteReport(screen, read, quiz))
	return null
}

/** The quiz, while it has something to do: its titles, the person's picks, and where its scores go. */
function WithQuiz(props: DataProps & { read: TvTasteRead }) {
	const quiz = useTasteQuiz(quizOptions(props.screen, props.read, props.member))
	return <Report {...props} quiz={quiz} />
}

export function TasteData(props: DataProps) {
	const read = useTasteRead(props)
	return read.quizzes ? (
		<WithQuiz {...props} read={read} />
	) : (
		<Report {...props} read={read} quiz={null} />
	)
}

// ---------------------------------------------------------------------------------------------------------
// The screens.

/** The words and one key: before the person has five scores, and while the portrait is on its way. */
function Ask({
	items,
	headline,
	line,
	label,
	backdrop,
}: {
	items: readonly string[]
	headline: string
	line?: string
	label: string
	/** The picture behind the words, a TMDB path. */
	backdrop?: string | null
}) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	return (
		<Frame
			name="Taste"
			items={items}
			art={backdrop ? tmdbImageUrl(backdrop, backdropSize(canvas)) : undefined}
			dim={0.8}
		>
			<div className="flex min-h-full flex-col justify-center">
				<div
					className="font-bold leading-[1.02] tracking-tight"
					style={{ fontSize: P ? 36 : 72 }}
				>
					{headline}
				</div>
				{line && (
					<div
						className={`text-white/80 ${P ? "mt-2 text-[21px]" : "mt-3 text-[30px]"}`}
					>
						{line}
					</div>
				)}
				{items.includes("start-quiz") && (
					<div className={`flex ${P ? "mt-6" : "mt-9"}`}>
						<Item
							id="start-quiz"
							className={`tvc-btn flex items-center ${P ? "px-7 text-[22px]" : "h-[76px] px-10 text-[30px]"}`}
							style={P ? { height: keySize(canvas, 54) } : undefined}
						>
							{label}
						</Item>
					</div>
				)}
			</div>
		</Frame>
	)
}

/** "Rate more": the way back into the quiz once the person has a taste. */
function RateMore() {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	return (
		<Item
			id="start-quiz"
			className={`tvc-btn flex shrink-0 items-center whitespace-nowrap ${P ? "px-6 text-[21px]" : "h-[70px] px-9 text-[27px]"}`}
			style={P ? { height: keySize(canvas, 54) } : undefined}
		>
			Rate more
		</Item>
	)
}

/**
 * The phone's last row: what a screen puts beside the Expand key, which has the right end of it. As tall as a key
 * with or without one, so nothing above it reaches into the Expand key's corner.
 */
function Foot({ children }: { children?: ReactNode }) {
	const { canvas } = useTvView()
	return (
		<div
			className="mt-2.5 flex shrink-0 items-center gap-2 pr-[158px]"
			style={{ height: keySize(canvas, 54) }}
		>
			{children}
		</div>
	)
}

/** A side's colour: a tint over its picture, so the tiles read as different sides. */
const SIDE_HUES = [215, 28, 265, 160, 340]

function Sides({
	items,
	sides,
}: { items: readonly string[]; sides: readonly TvSide[] }) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const more = items.includes("start-quiz")
	// The picture and the line follow the focused side, and stay on the last one while the focus is elsewhere.
	const last = useRef(sides[0]?.id)
	const at = sides.find((side) => `side:${side.id}` === focused)
	if (at) last.current = at.id
	const shown = sides.find((side) => side.id === last.current) ?? sides[0]
	const many = sides.length > 3
	// Five tiles are narrow: smaller words with more room, broken at syllables where the browser can, else at the edge.
	const five = sides.length > 4
	const tile = (side: TvSide, n: number) => (
		<Item
			key={side.id}
			id={`side:${side.id}`}
			className="tvc-tile"
			style={P ? undefined : { height: 270 }}
		>
			{side.backdrop && (
				<Img
					src={tmdbImageUrl(side.backdrop, "w780")}
					className="absolute inset-0 h-full w-full"
				/>
			)}
			<span
				className="absolute inset-0"
				style={{
					background: `linear-gradient(0deg, hsl(${SIDE_HUES[n % SIDE_HUES.length]} 60% 10% / .95) 0%, hsl(${SIDE_HUES[n % SIDE_HUES.length]} 70% 30% / .25) 100%)`,
				}}
			/>
			<span
				className={`absolute ${P ? "inset-x-3 bottom-3" : five ? "inset-x-3.5 bottom-4" : "inset-x-5 bottom-5"}`}
			>
				<span
					className={`line-clamp-3 font-bold leading-[1.05] ${five ? "hyphens-auto [overflow-wrap:break-word]" : ""} ${P ? (five ? "text-[17px]" : many ? "text-[20px]" : "text-[22px]") : five ? "text-[21px]" : many ? "text-[30px]" : "text-[36px]"}`}
				>
					{side.name}
				</span>
				{!P && (
					<span
						className={`mt-2 line-clamp-2 leading-tight text-white/85 ${five ? "text-[18px]" : "text-[22px]"}`}
					>
						{side.line}
					</span>
				)}
			</span>
		</Item>
	)
	const frame = {
		name: "Taste",
		crumb: sidesCrumb(sides.length),
		items,
		art: shown?.backdrop
			? tmdbImageUrl(shown.backdrop, backdropSize(canvas))
			: undefined,
		dim: 0.86,
	}
	// The phone: the sides side by side (four stand two by two, five three over two), the focused one's line over
	// them, and Rate more
	// beside the Expand key's corner.
	if (P)
		return (
			<Frame {...frame}>
				<div className="flex h-full flex-col">
					<div
						key={shown?.id}
						className="tvc-fade shrink-0 truncate text-[20px] leading-tight text-white/85"
					>
						{shown?.line}
					</div>
					<div
						className="mt-2.5 grid min-h-0 flex-1 gap-3"
						style={{
							gridTemplateColumns: `repeat(${five ? 3 : many ? 2 : sides.length}, minmax(0, 1fr))`,
						}}
					>
						{sides.map(tile)}
					</div>
					<Foot>{more && <RateMore />}</Foot>
				</div>
			</Frame>
		)
	return (
		<Frame {...frame}>
			<div
				className="grid gap-6 pt-2"
				style={{
					gridTemplateColumns: `repeat(${Math.max(sides.length, 3)}, minmax(0, 1fr))`,
				}}
			>
				{sides.map(tile)}
			</div>
			{more && (
				<div className="mt-8 flex">
					<RateMore />
				</div>
			)}
		</Frame>
	)
}

/** "Rate more" as a list's key. */
const RATE_MORE = [{ id: "start-quiz", label: "Rate more" }]

export default function Taste({
	items,
	taste,
	side,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	taste: TvTasteOnScreen
	/** The side the screen is on, as the URL names it; null for Taste itself. */
	side: string | null
}) {
	if (side) {
		const sides = taste.state === "sides" ? taste.sides : []
		const shown = sides.find((one) => one.id === side)
		return (
			<TitleList
				name="Taste"
				items={items}
				crumb={shown?.name ?? "A side of you"}
				titles={shown?.titles ?? []}
				empty={
					taste.state === "reading"
						? "Reading your taste."
						: "This side of you isn't there any more."
				}
			/>
		)
	}
	switch (taste.state) {
		case "reading":
			return (
				<Ask items={items} headline="Reading your taste." label="Rate more" />
			)
		case "start": {
			const words = startWords(taste.rated)
			return (
				<Ask
					items={items}
					headline={words.headline}
					line={words.line}
					label={words.key}
					// The first title the quiz will ask about is the picture, as it is on the quiz itself.
					backdrop={taste.backdrop}
				/>
			)
		}
		case "sides":
			return <Sides items={items} sides={taste.sides} />
		case "picks":
			return (
				<TitleList
					name="Taste"
					items={items}
					crumb="Made for you"
					titles={taste.picks}
					actions={RATE_MORE}
					empty={
						taste.waiting
							? "Your picks are on their way."
							: "No picks right now. Rate a few more titles."
					}
				/>
			)
	}
}
