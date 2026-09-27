import type { ReactNode } from "react"
import type { BridgeKind } from "~/domain/explorer"

export interface Side {
	id: string
	name: string
	color: string
}

/** "130 titles in both", or "130 titles between them". */
export const sharedLine = (count: number, kind: BridgeKind) =>
	kind === "both"
		? `${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"} in both`
		: `${count.toLocaleString("en")} ${count === 1 ? "title" : "titles"} between them`

/** "130 in both", or "238 in between": what an island shares with the lit one, under its name. */
export const sharedNote = (count: number, kind: BridgeKind) =>
	`${count.toLocaleString("en")} in ${kind === "both" ? "both" : "between"}`

export type BarState =
	| { k: "lit"; lit: Side; next: string }
	| { k: "forming"; list: Side[] }
	| { k: "bridge"; list: Side[]; count: number; kind: BridgeKind }

const dot = (s: Side) => (
	<span
		key={s.id}
		className="ex-bar-dot"
		style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
	/>
)
const names = (list: Side[]) => (
	<b className="ex-bar-nm">{list.map((s) => s.name).join(" + ")}</b>
)

/**
 * What's being combined, in one line over the map, with the way back always on it: a lit island (what to do next and
 * Let go), a bridge being found, or a bridge (the islands, what they share, and Separate). Changes are announced.
 */
export function CombineBar({
	state,
	onUndo,
	onGo,
}: {
	state: BarState
	onUndo: () => void
	/** Frames the bridge (its name is a button). */
	onGo: () => void
}) {
	let body: ReactNode
	let undo: string | null = null
	if (state.k === "lit") {
		body = (
			<>
				{dot(state.lit)}
				<b className="ex-bar-nm">{state.lit.name}</b>
				<span className="ex-bar-mute">{state.next}</span>
			</>
		)
		undo = "Let go"
	} else if (state.k === "forming") {
		body = (
			<>
				<span className="ex-bar-pair">{state.list.map(dot)}</span>
				{names(state.list)}
				<span className="ex-bar-mute">finding what they share…</span>
			</>
		)
	} else {
		body = (
			<>
				<span className="ex-bar-pair">{state.list.map(dot)}</span>
				<button type="button" className="ex-bar-go" onClick={onGo}>
					{names(state.list)}
				</button>
				<span className="ex-bar-count">
					<span className="ex-bar-lg">
						{sharedLine(state.count, state.kind)}
					</span>
					<span className="ex-bar-sm">
						{sharedNote(state.count, state.kind)}
					</span>
				</span>
			</>
		)
		undo = "Separate"
	}
	return (
		<div className="ex-bar">
			<div className="ex-bar-body">{body}</div>
			{undo && (
				<button type="button" className="ex-bar-x" onClick={onUndo}>
					<svg viewBox="0 0 12 12" aria-hidden="true">
						<path
							d="M2.5 2.5l7 7M9.5 2.5l-7 7"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>
					{undo}
				</button>
			)}
		</div>
	)
}
