// The geometry of a ranked bar chart, apart from its drawing so plain Node can test it. The chart is 358 units wide:
// a 390 px phone with 16 px gutters shows it at full size, so its 12 px labels are 12 px on screen.

export const CHART_WIDTH = 358
/** Room for the country names, right-aligned against the bars. */
export const LABEL_WIDTH = 108
/** Room after the longest bar for its value. */
const VALUE_ROOM = 46
const BAR_HEIGHT = 11
const AXIS_ROOM = 22

export type BarRow = {
	code: string
	label: string
	value: number
	/** A second, smaller line under the label, such as the service's name. */
	sub?: string | null
	/** Drawn in the accent; the others in gray. Without any highlighted row, every bar is in the accent. */
	highlight?: boolean
}

export type Bar = BarRow & {
	y: number
	width: number
	path: string
	valueX: number
	accent: boolean
}

export type Tick = {
	x: number
	value: number
	anchor: "start" | "middle" | "end"
}

export type BarsLayout = {
	width: number
	height: number
	plotX: number
	plotWidth: number
	rowHeight: number
	barHeight: number
	ticks: Tick[]
	bars: Bar[]
	gridBottom: number
}

/** A bar's outline: square at the baseline, a 4 px rounded data end. */
export function barPath(x: number, y: number, width: number, height: number) {
	const w = Math.max(width, 2)
	const r = Math.min(4, w / 2, height / 2)
	const f = (n: number) => Number(n.toFixed(1))
	return `M${f(x)},${f(y)}h${f(w - r)}a${r},${r} 0 0 1 ${r},${r}v${f(height - 2 * r)}a${r},${r} 0 0 1 -${r},${r}h-${f(w - r)}z`
}

export function layoutBars(
	rows: readonly BarRow[],
	{ scale, steps }: { scale: number; steps: number },
): BarsLayout {
	const hasSub = rows.some((row) => row.sub)
	const rowHeight = hasSub ? 30 : 20
	const plotX = LABEL_WIDTH
	const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_ROOM
	const anyHighlight = rows.some((row) => row.highlight)
	const top = AXIS_ROOM
	const bars = rows.map((row, index) => {
		const y = top + index * rowHeight + 4
		const width = Math.max((plotWidth * Math.min(row.value, scale)) / scale, 2)
		return {
			...row,
			y,
			width,
			path: barPath(plotX, y, width, BAR_HEIGHT),
			valueX: plotX + width + 5,
			accent: anyHighlight ? Boolean(row.highlight) : true,
		}
	})
	const ticks: Tick[] = Array.from({ length: steps + 1 }, (_, k) => ({
		x: plotX + (plotWidth * k) / steps,
		value: Math.round((scale * k) / steps),
		anchor: k === 0 ? "start" : k === steps ? "end" : "middle",
	}))
	const gridBottom = top + rowHeight * rows.length
	return {
		width: CHART_WIDTH,
		height: gridBottom + 6,
		plotX,
		plotWidth,
		rowHeight,
		barHeight: BAR_HEIGHT,
		ticks,
		bars,
		gridBottom,
	}
}
