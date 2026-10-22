// Taste on the TV, in its three states (tv-taste.ts): the way into the quiz before the person has five scores, the
// sides of their taste as tiles once there are some, and the quiz's picks as a list ("Made for you") when there
// are five scores and no sides yet. A side's screen lists the titles of it the person rated. The Expand key opens
// the Taste page, on the side on screen (`/taste?side=`); its place at the bottom right is the Frame's, and every
// state keeps the corner free.
// A chunk the TV asks for on first use (screen-code.tsx).
import { type ReactNode, useRef } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { useTasteQuiz } from "~/ui/taste-quiz/use-taste-quiz"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { TASTE_GROUPS_NAME } from "../../../taste/taste-groups-name"
import { TitleList } from "../TitleList"
import {
	Expand,
	Frame,
	Img,
	Item,
	PageArrow,
	backdropSize,
	keySize,
	phoneFit,
	useListAnchor,
	usePage,
	useReport,
	useTvView,
} from "../kit"
import type { TvScreen } from "../tv-machine"
import { type TvSide, type TvTasteOnScreen, startWords } from "../tv-taste"
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
	const art = backdrop
		? tmdbImageUrl(backdrop, backdropSize(canvas))
		: undefined
	if (P) {
		// The phone: the headline and its line on one line each, then the keys; a guest's sign-up on a row of its
		// own, so no key is squeezed or cut.
		const h = keySize(canvas, 54)
		const start = items.includes("start-quiz") && (
			<Item
				id="start-quiz"
				className="tvc-btn flex shrink-0 items-center whitespace-nowrap px-6 text-[19px]"
				style={{ height: h }}
			>
				{label}
			</Item>
		)
		return (
			<Frame name="Your taste" items={items} art={art} dim={0.8} inlineExpand>
				<div className="flex h-full flex-col justify-center gap-1.5">
					<div className="text-[28px] font-bold leading-[32px] tracking-tight">
						{headline}
					</div>
					{line && (
						<div className="text-[17px] leading-[20px] text-white/80">
							{line}
						</div>
					)}
					{/* In the machine's order: the way into the quiz, a guest's sign-up, then the Expand key, on a row of its
					    own where the sign-up leaves it no room. */}
					<div className="mt-1.5 flex items-center gap-2">
						{start}
						{items.includes("sign-up") ? (
							<SignUp />
						) : (
							items.includes("expand") && <Expand />
						)}
					</div>
					{items.includes("sign-up") && items.includes("expand") && (
						<div className="flex">
							<Expand />
						</div>
					)}
				</div>
			</Frame>
		)
	}
	return (
		<Frame name="Your taste" items={items} art={art} dim={0.8} inlineExpand>
			<div className="flex min-h-full flex-col justify-center">
				<div
					className="font-bold leading-[1.02] tracking-tight"
					style={{ fontSize: 72 }}
				>
					{headline}
				</div>
				{line && <div className="mt-3 text-[30px] text-white/80">{line}</div>}
				{(items.includes("start-quiz") || items.includes("sign-up")) && (
					<div className="mt-9 flex flex-wrap items-center gap-5">
						{items.includes("start-quiz") && (
							<Item
								id="start-quiz"
								className="tvc-btn flex h-[76px] items-center px-10 text-[30px]"
							>
								{label}
							</Item>
						)}
						{items.includes("sign-up") && <SignUp />}
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
			className={`tvc-btn flex shrink-0 items-center whitespace-nowrap ${P ? "px-5 text-[19px]" : "h-[70px] px-9 text-[27px]"}`}
			style={P ? { height: keySize(canvas, 54) } : undefined}
		>
			Rate more
		</Item>
	)
}

/**
 * A guest's way to keep what they rated: the site's sign-up, through the TV, back to Your taste (tv-machine.ts,
 * `sign-up`). Their progress in this browser moves to the account they make.
 */
function SignUp() {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	return (
		<Item
			id="sign-up"
			label="Sign up to save your scores and taste"
			className={`tvc-btn tvc-cta flex shrink-0 items-center gap-3 whitespace-nowrap ${P ? "px-5 text-[19px]" : "h-[70px] px-8 text-[26px]"}`}
			style={P ? { height: keySize(canvas, 54) } : undefined}
		>
			<GoodWatchG height={P ? 22 : 30} color="currentColor" />
			{P ? "Sign up to save" : "Sign up to save your scores and taste"}
		</Item>
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
	const anchor = useListAnchor("taste-sides", sides.map((side) => `side:${side.id}`))
	const last = useRef(anchor?.slice("side:".length) ?? sides[0]?.id)
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
				className={`absolute ${P ? "inset-x-2.5 bottom-2" : five ? "inset-x-3.5 bottom-4" : "inset-x-5 bottom-5"}`}
			>
				<span
					className={`font-bold leading-[1.05] ${P ? "hyphens-auto text-[17px] [overflow-wrap:break-word]" : `line-clamp-3 ${five ? "hyphens-auto text-[21px] [overflow-wrap:break-word]" : many ? "text-[30px]" : "text-[36px]"}`}`}
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
		name: "Your taste",
		crumb: TASTE_GROUPS_NAME.title,
		items,
		art: shown?.backdrop
			? tmdbImageUrl(shown.backdrop, backdropSize(canvas))
			: undefined,
		dim: 0.86,
	}
	// The phone: three sides a page, with arrows where there are more, and Rate more and the Expand key under them.
	// A guest's sign-up joins Rate more, the Expand key takes a row of its own, and the sides give up their height
	// for it (no line over them).
	if (P) {
		const guest = items.includes("sign-up")
		const h = keySize(canvas, 54)
		return (
			<Frame {...frame} crumb={guest ? undefined : frame.crumb} inlineExpand>
				<div className="flex h-full flex-col gap-1.5">
					<SidesPage
						items={items}
						sides={sides}
						tile={tile}
						height={guest ? h : undefined}
					/>
					<div
						className="flex shrink-0 items-center gap-2"
						style={{ height: h }}
					>
						{/* In the machine's order: Rate more, a guest's sign-up, then the Expand key, on a row of its own
						    where the sign-up leaves it no room. */}
						{more && <RateMore />}
						{guest ? <SignUp /> : items.includes("expand") && <Expand />}
					</div>
					{guest && items.includes("expand") && (
						<div className="flex shrink-0">
							<Expand />
						</div>
					)}
				</div>
			</Frame>
		)
	}
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
			{(more || items.includes("sign-up")) && (
				<div className="mt-8 flex gap-5">
					{more && <RateMore />}
					{items.includes("sign-up") && <SignUp />}
				</div>
			)}
		</Frame>
	)
}

/** The phone's sides: three a page, an arrow to either side where there are more. */
function SidesPage({
	items,
	sides,
	tile,
	height,
}: {
	items: readonly string[]
	sides: readonly TvSide[]
	tile: (side: TvSide, n: number) => ReactNode
	/** The row's height; the room that is left by default. */
	height?: number
}) {
	const ids = sides
		.map((side) => `side:${side.id}`)
		.filter((id) => items.includes(id))
	const { canvas } = useTvView()
	// Three a page upright, up to five on a phone's wide canvas; the page holds the side shown last.
	const per = phoneFit(canvas, 3, 120, 5)
	const page = usePage(ids, per, useListAnchor("taste-sides", ids))
	return (
		<div
			className={`flex items-stretch gap-2 ${height ? "shrink-0" : "min-h-0 flex-1"}`}
			style={height ? { height } : undefined}
		>
			{page.pages > 1 && (
				<PageArrow
					to={page.prev}
					dir="prev"
					label="Sides before"
					className="self-center"
				/>
			)}
			<div
				className="grid min-w-0 flex-1 gap-2"
				style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))` }}
			>
				{page.shown.map((id) => {
					const n = sides.findIndex((side) => `side:${side.id}` === id)
					return tile(sides[n], n)
				})}
			</div>
			{page.pages > 1 && (
				<PageArrow
					to={page.next}
					dir="next"
					label="More sides"
					className="self-center"
				/>
			)}
		</div>
	)
}

/** "Rate more" as a list's key. */
const RATE_MORE = [{ id: "start-quiz", label: "Rate more" }]
/** A guest's sign-up, as a list's key. */
const SIGN_UP = {
	id: "sign-up",
	label: "Sign up to save your scores and taste",
}

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
				name="Your taste"
				items={items}
				crumb={shown?.name ?? "Fits your taste"}
				// The phone's header names the side, where the desktop has the crumb.
				phoneName={shown?.name ?? "Fits your taste"}
				titles={shown?.titles ?? []}
				empty={
					taste.state === "reading"
						? "Reading your taste."
						: "This isn't in your taste any more."
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
					name="Your taste"
					items={items}
					crumb="Made for you"
					phoneName="Made for you"
					titles={taste.picks}
					actions={
						items.includes("sign-up") ? [...RATE_MORE, SIGN_UP] : RATE_MORE
					}
					empty={
						taste.waiting
							? "Your picks are on their way."
							: "No picks right now. Rate a few more titles."
					}
				/>
			)
	}
}
