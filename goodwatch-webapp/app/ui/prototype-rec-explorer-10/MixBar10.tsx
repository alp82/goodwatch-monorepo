// PROTOTYPE - throwaway. Round 10 of the Explorer: what's picked, in one line over the map. Each picked island is a
// chip that lets it go; empty rings show how many more can join; the line says what the combination holds, and the
// button brings the middle (where it rises) into view.
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

/** "130 titles in both", "130 titles between them", or "42 titles on all 3". */
export const sharedLine10 = (count: number, kind: MixKind, of: number) =>
	kind === "all"
		? `${titles(count)} on all ${of}`
		: kind === "both"
			? `${titles(count)} in both`
			: `${titles(count)} between them`

/** What an island would add to the picked ones, under its name. */
export const sharedNote10 = (count: number, kind: MixKind, of: number) =>
	`${count.toLocaleString("en")} in ${kind === "all" ? `all ${of}` : kind === "both" ? "both" : "between"}`

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
}: {
	state: MixBarState
	onDrop: (id: string) => void
	onClear: () => void
	/** Goes to the middle, where the combination is. */
	onGo: () => void
	/** Goes back out to the whole world. */
	onAll: () => void
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
						className={state.at === "hub" ? "ex10-view-on" : ""}
						onClick={onGo}
					>
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
			<button type="button" className="ex-bar-x" onClick={onClear}>
				<Cross />
				{state.list.length > 1 ? "Separate" : "Let go"}
			</button>
		</div>
	)
}
