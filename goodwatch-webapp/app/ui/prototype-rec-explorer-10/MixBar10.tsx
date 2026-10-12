// PROTOTYPE - throwaway. Round 10 of the Explorer: what's picked, in one line over the map. Each picked island is a
// chip that lets it go; empty rings show how many more can join; the line says what the combination holds, and the
// button brings the middle (where it rises) into view.
import { Press } from "~/ui/explorer/Tutorial"
import type { MixKind } from "./engine10"

export interface MixSide {
	id: string
	name: string
	color: string
}

export interface MixBarState {
	list: MixSide[]
	/** What the combination holds, or what to do next. */
	status: string
	/** The combination is up (or rising). */
	up: boolean
	/** Every place is taken: nothing more can join. */
	full: boolean
	/** How many islands combine at most. */
	max: number
	/** Where the view is: on the middle ("hub"), out at the whole world ("all"), or elsewhere (""). */
	at: "hub" | "all" | ""
}

const titles = (count: number) =>
	`${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"}`

/** Two islands of one group, today's bridge: "130 titles in both" or "130 titles between them". */
export const sharedLine10 = (count: number, kind: MixKind) =>
	kind === "both"
		? `${titles(count)} in both`
		: `${titles(count)} between them`

/** Groupings where a title sits on one island only: two of their islands in a combination mean either. */
const ONE_ISLAND = new Set(["decade", "country", "taste"])
const ORDER = ["mood", "style", "taste", "theme", "occasion", "decade", "country"]
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)
const OCCASIONS: Record<string, string> = {
	Party: "for a party",
	Family: "for the family",
	Binge: "for a binge",
	Background: "for the background",
	"Easy watch": "an easy watch",
	"Drop-in": "for dropping in",
}
/** An island as it reads after "titles that are": Funny, about crime, for a party, from the 1990s. */
const phrase = (grouping: string, name: string) =>
	grouping === "theme"
		? `about ${lower(name)}`
		: grouping === "occasion"
			? (OCCASIONS[name] ?? `for ${lower(name)}`)
			: grouping === "decade" || (grouping === "country" && /^United /.test(name))
				? `the ${name}`
				: name

/**
 * A combination of islands from different groups, as a sentence: "15 titles that are Funny, Talky, about crime, from
 * the 1990s, from the United States". Two decades or two countries read "from the 1980s or the 1990s", as the
 * combination holds either.
 */
export function mixSentence10(count: number, sides: readonly MixSide[]) {
	const groups = new Map<string, string[]>()
	for (const s of sides) {
		const grouping = s.id.slice(0, s.id.indexOf(":"))
		const list = groups.get(grouping) ?? []
		list.push(phrase(grouping, s.name))
		groups.set(grouping, list)
	}
	const parts = [...groups]
		.sort((x, y) => ORDER.indexOf(x[0]) - ORDER.indexOf(y[0]))
		.map(([grouping, list]) => {
			const joined = list.join(ONE_ISLAND.has(grouping) ? " or " : " and ")
			return grouping === "decade" || grouping === "country"
				? `from ${joined}`
				: joined
		})
	return `${titles(count)} that are ${parts.join(", ")}`
}

/**
 * What an island would leave of the combination, under its name: every island added narrows it. A second island of
 * the first one's group makes today's bridge instead, and keeps its words.
 */
export const sharedNote10 = (count: number, kind: MixKind, bridge: boolean) =>
	bridge
		? `${count.toLocaleString("en")} ${kind === "both" ? "in both" : "between"}`
		: `${count.toLocaleString("en")} left`

const Cross = () => (
	<svg viewBox="0 0 12 12" aria-hidden="true">
		<path
			d="M2.5 2.5l7 7M9.5 2.5l-7 7"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		/>
	</svg>
)

export function MixBar({
	state,
	onDrop,
	onClear,
	onGo,
	onAll,
	nudge,
}: {
	state: MixBarState
	onDrop: (id: string) => void
	onClear: () => void
	/** Goes to the middle, where the combination is. */
	onGo: () => void
	/** Goes back out to the whole world. */
	onAll: () => void
	/** The tutorial points at a button: on a touch screen with a finger, else with a cursor. */
	nudge?: { at: "combined" | "separate"; touch: boolean } | null
}) {
	const free = Math.max(0, state.max - state.list.length)
	return (
		<div className="ex-bar">
			<div className="ex-bar-body">
				<span className="ex10-chips">
					{state.list.map((s) => (
						<span key={s.id} className="ex10-chip">
							<span
								className="ex-bar-dot"
								style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
							/>
							{s.name}
							<button
								type="button"
								aria-label={`Let ${s.name} go`}
								onClick={() => onDrop(s.id)}
							>
								<Cross />
							</button>
						</span>
					))}
					{Array.from({ length: free }, (_, k) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: empty places, all alike.
						<span key={k} className="ex10-slot" aria-hidden="true" />
					))}
				</span>
				<span className={state.up ? "ex-bar-count" : "ex-bar-mute"}>
					{state.status}
				</span>
				{/* One switch between the two views: the combination in the middle, and the whole world. */}
				<span className="ex10-view" role="group" aria-label="View">
					<button
						type="button"
						aria-pressed={state.at === "hub"}
						className={`${state.at === "hub" ? "ex10-view-on" : ""} ${nudge?.at === "combined" ? "ex-tut-glow" : ""}`}
						onClick={onGo}
					>
						{nudge?.at === "combined" && <Press touch={nudge.touch} />}
						<svg viewBox="0 0 14 14" aria-hidden="true">
							<path
								d="M8.5 2H12v3.5M12 2L8 6M5.5 12H2V8.5M2 12l4-4"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.7"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						Combined
					</button>
					<button
						type="button"
						aria-pressed={state.at === "all"}
						className={state.at === "all" ? "ex10-view-on" : ""}
						onClick={onAll}
					>
						Show all
					</button>
				</span>
			</div>
			<button
				type="button"
				className={nudge?.at === "separate" ? "ex-bar-x ex-tut-glow" : "ex-bar-x"}
				onClick={onClear}
			>
				<Cross />
				{state.list.length > 1 ? "Separate" : "Let go"}
				{nudge?.at === "separate" && <Press touch={nudge.touch} />}
			</button>
		</div>
	)
}
