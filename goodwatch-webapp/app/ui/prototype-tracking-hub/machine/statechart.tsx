// PROTOTYPE - throwaway (issue #368, map #365). The statechart of /prototype/tracking-machine, laid out by hand.
// Which arrows exist comes from the transition table; where they run and what they say is written here.
import { type Row, STATES, STATE_LABEL, type Settings, type State, TABLE, rowIsActive } from "~/domain/prototype-tracking-machine/machine"

type Point = [number, number]

const NODE: Record<State, Point> = {
	not_started: [230, 50],
	watching: [230, 250],
	on_hold: [80, 480],
	dropped: [380, 480],
	seen: [230, 710],
}
const NODE_W = 132
const NODE_H = 48

interface Edge {
	from: State
	to: State
	/** A straight or bent line between two points, moved sideways by `off` so the two directions of a pair part. */
	a?: Point
	b?: Point
	off?: number
	bend?: number
	/** Or a path written out. */
	d?: string
	label: string[]
	at: Point
	anchor?: "start" | "middle" | "end"
}

const EDGES: Edge[] = [
	{ from: "not_started", to: "watching", a: [230, 74], b: [230, 226], off: 9, label: ["tick ↓"], at: [212, 154], anchor: "end" },
	{ from: "watching", to: "not_started", a: [230, 226], b: [230, 74], off: 9, label: ["↑ untick the last"], at: [248, 154], anchor: "start" },
	{ from: "watching", to: "seen", a: [230, 274], b: [230, 686], off: 9, label: ["↓ tick the last aired", "or Seen"], at: [230, 346] },
	{ from: "seen", to: "watching", a: [230, 686], b: [230, 274], off: 9, label: ["↑ untick · Seen again", "tick one of several new", "(watch again)"], at: [230, 596] },
	{ from: "watching", to: "on_hold", a: [184, 274], b: [98, 456], off: 7, label: ["hold"], at: [128, 348], anchor: "end" },
	{ from: "on_hold", to: "watching", a: [98, 456], b: [184, 274], off: 7, label: ["↑ tick · resume"], at: [128, 436], anchor: "start" },
	{ from: "watching", to: "dropped", a: [276, 274], b: [362, 456], off: -7, label: ["drop"], at: [332, 348], anchor: "start" },
	{ from: "dropped", to: "watching", a: [362, 456], b: [276, 274], off: -7, label: ["tick · resume ↑"], at: [332, 436], anchor: "end" },
	{ from: "on_hold", to: "dropped", a: [146, 480], b: [314, 480], off: 0, label: ["drop →"], at: [180, 472] },
	{ from: "on_hold", to: "not_started", a: [66, 456], b: [164, 60], off: 0, bend: -46, label: ["↑ resume with", "nothing watched"], at: [76, 262] },
	{ from: "not_started", to: "dropped", a: [296, 52], b: [412, 456], off: -6, bend: 74, label: ["↓ drop"], at: [424, 232] },
	{ from: "dropped", to: "not_started", a: [412, 456], b: [296, 52], off: -6, bend: -74, label: ["↑ Want to See ·", "resume, 0 watched"], at: [424, 250] },
	{ from: "on_hold", to: "seen", a: [62, 504], b: [164, 702], off: 7, label: ["↓ Seen ·", "tick the last aired"], at: [102, 606], anchor: "end" },
	{ from: "seen", to: "on_hold", a: [164, 702], b: [62, 504], off: 7, label: ["↑ Seen again"], at: [102, 640], anchor: "end" },
	{ from: "dropped", to: "seen", a: [398, 504], b: [296, 702], off: -7, label: ["↓ Seen ·", "tick the last aired"], at: [358, 606], anchor: "start" },
	{ from: "seen", to: "dropped", a: [296, 702], b: [398, 504], off: -7, label: ["↑ Seen again"], at: [358, 640], anchor: "start" },
	{ from: "not_started", to: "seen", d: "M164,38 C40,38 -26,70 -26,180 L-26,650 C-26,744 60,756 196,736", label: ["↓ Seen"], at: [-14, 318], anchor: "start" },
	{ from: "seen", to: "not_started", d: "M186,736 C66,744 -12,734 -12,650 L-12,180 C-12,90 50,50 164,50", label: ["↑ Seen again ·", "untick the last"], at: [-2, 150], anchor: "start" },
]

function path(edge: Edge): string {
	if (edge.d) return edge.d
	const [ax, ay] = edge.a ?? [0, 0]
	const [bx, by] = edge.b ?? [0, 0]
	const length = Math.hypot(bx - ax, by - ay) || 1
	const nx = -(by - ay) / length
	const ny = (bx - ax) / length
	const off = edge.off ?? 0
	const bend = edge.bend ?? 0
	const start = [ax + nx * off, ay + ny * off]
	const end = [bx + nx * off, by + ny * off]
	if (!bend) return `M${start[0]},${start[1]} L${end[0]},${end[1]}`
	const control = [(ax + bx) / 2 + nx * (off + bend), (ay + by) / 2 + ny * (off + bend)]
	return `M${start[0]},${start[1]} Q${control[0]},${control[1]} ${end[0]},${end[1]}`
}

const COLOR = { taken: "#fbbf24", possible: "#e5e7eb", quiet: "#566072" }

export interface ChartMove {
	from: State
	to: State
	row: Row
}

/** The arrows the table has: one per pair of different states, with the rows behind it. */
export function tableArrows(settings: Settings) {
	const arrows = new Map<string, { active: boolean; rows: Row[] }>()
	for (const row of TABLE) {
		if (row.to === "same") continue
		for (const from of row.from) {
			if (from === row.to) continue
			const key = `${from}>${row.to}`
			const found = arrows.get(key) ?? { active: false, rows: [] }
			found.rows.push(row)
			if (rowIsActive(row, settings)) found.active = true
			arrows.set(key, found)
		}
	}
	return arrows
}

export function Statechart({ state, possible, last, settings, tick }: { state: State; possible: ChartMove[]; last: ChartMove | null; settings: Settings; tick: number }) {
	const arrows = tableArrows(settings)
	const drawn = EDGES.filter((edge) => arrows.has(`${edge.from}>${edge.to}`))
	const kindOf = (edge: Edge) => {
		if (last && last.from === edge.from && last.to === edge.to) return "taken"
		if (possible.some((move) => move.from === edge.from && move.to === edge.to)) return "possible"
		return "quiet"
	}
	// Quiet arrows first, so the bright ones lie on top.
	const ordered = [...drawn].sort((a, b) => ["quiet", "possible", "taken"].indexOf(kindOf(a)) - ["quiet", "possible", "taken"].indexOf(kindOf(b)))
	const stayed = last && last.from === last.to ? last.from : null
	return (
		<svg viewBox="-40 0 540 772" className="mx-auto block h-auto w-full max-w-[30rem]" role="img" aria-label={`Statechart. Current state: ${STATE_LABEL[state]}.`} data-testid="statechart" data-state={state}>
			<defs>
				{(Object.keys(COLOR) as (keyof typeof COLOR)[]).map((kind) => (
					<marker key={kind} id={`machine-arrow-${kind}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
						<path d="M0,0 L10,5 L0,10 z" fill={COLOR[kind]} />
					</marker>
				))}
			</defs>

			{ordered.map((edge) => {
				const kind = kindOf(edge)
				const key = `${edge.from}>${edge.to}`
				const arrow = arrows.get(key)
				const dashed = !arrow?.active
				return (
					<path
						key={kind === "taken" ? `${key}-${tick}` : key}
						d={path(edge)}
						fill="none"
						stroke={COLOR[kind]}
						strokeWidth={kind === "taken" ? 3 : kind === "possible" ? 2 : 1.25}
						strokeDasharray={kind === "taken" ? "9 6" : dashed ? "3 5" : undefined}
						markerEnd={`url(#machine-arrow-${kind})`}
						data-edge={key}
						data-kind={kind}
					>
						{kind === "taken" && <animate attributeName="stroke-dashoffset" from="60" to="0" dur="1.2s" repeatCount="indefinite" />}
					</path>
				)
			})}

			{ordered.map((edge) => {
				const kind = kindOf(edge)
				return (
					<text
						key={`${edge.from}>${edge.to}`}
						x={edge.at[0]}
						y={edge.at[1]}
						textAnchor={edge.anchor ?? "middle"}
						fontSize="14"
						fontWeight={kind === "quiet" ? 400 : 700}
						fill={kind === "quiet" ? "#8b95a5" : COLOR[kind]}
						stroke="#141923"
						strokeWidth="5"
						paintOrder="stroke"
						strokeLinejoin="round"
					>
						{edge.label.map((line, index) => (
							<tspan key={line} x={edge.at[0]} dy={index === 0 ? 0 : 16}>
								{line}
							</tspan>
						))}
					</text>
				)
			})}

			{STATES.map((name) => {
				const [x, y] = NODE[name]
				const current = name === state
				return (
					<g key={name} data-node={name} data-current={current}>
						{stayed === name && (
							<rect key={tick} x={x - NODE_W / 2 - 6} y={y - NODE_H / 2 - 6} width={NODE_W + 12} height={NODE_H + 12} rx="18" fill="none" stroke={COLOR.taken} strokeWidth="2.5" strokeDasharray="9 6">
								<animate attributeName="stroke-dashoffset" from="60" to="0" dur="1.2s" repeatCount="indefinite" />
							</rect>
						)}
						<rect x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H} rx="13" fill={current ? "#22c55e" : "#1d2431"} stroke={current ? "#86efac" : "#566072"} strokeWidth={current ? 2.5 : 1.25} />
						<text x={x} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill={current ? "#04130a" : "#e5e7eb"}>
							{STATE_LABEL[name]}
						</text>
					</g>
				)
			})}
		</svg>
	)
}
