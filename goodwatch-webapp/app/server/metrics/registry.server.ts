// Keeps bounded metrics in memory so requests never send telemetry over the network.
type Labels = readonly string[]
type Sample = { labels: Labels; value: number }
type Row = { labels: Labels; value: number; count: number; buckets: number[] }
type Metric = {
	name: string
	help: string
	type: "counter" | "histogram" | "gauge"
	labelNames: Labels
	buckets: readonly number[]
	cap: number
	rows: Map<string, Row>
	dropped: number
	collect?: () => Sample[]
}
const key = Symbol.for("goodwatch.metrics.registry")
const shared = globalThis as typeof globalThis & { [key]?: Map<string, Metric> }
shared[key] ??= new Map()
const metrics = shared[key]

export const durationBuckets = [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5, 10]

function register(
	name: string,
	help: string,
	type: Metric["type"],
	labelNames: Labels,
	buckets: readonly number[],
	cap: number,
): Metric {
	const existing = metrics.get(name)
	if (existing) return existing
	const metric: Metric = {
		name,
		help,
		type,
		labelNames,
		buckets,
		cap,
		rows: new Map(),
		dropped: 0,
	}
	metrics.set(name, metric)
	return metric
}

function rowFor(metric: Metric, labels: Labels): Row | undefined {
	// Length prefixes keep arbitrary label values from colliding, without temporary arrays.
	let key = ""
	for (let i = 0; i < labels.length; i++)
		key += `${labels[i].length}:${labels[i]}`
	let row = metric.rows.get(key)
	if (row) return row
	if (metric.rows.size >= metric.cap) {
		metric.dropped++
		return
	}
	row = {
		labels: labels.slice(),
		value: 0,
		count: 0,
		buckets: metric.buckets.map(() => 0),
	}
	metric.rows.set(key, row)
	return row
}

export function counter(
	name: string,
	help: string,
	labelNames: Labels,
	cap = 2000,
) {
	const metric = register(name, help, "counter", labelNames, [], cap)
	return {
		inc(labels: Labels, value = 1) {
			if (!Number.isFinite(value) || value < 0) return
			const row = rowFor(metric, labels)
			if (row) row.value += value
		},
	}
}

export function histogram(
	name: string,
	help: string,
	labelNames: Labels,
	buckets: readonly number[],
	cap = 2000,
) {
	const metric = register(name, help, "histogram", labelNames, buckets, cap)
	return {
		observe(labels: Labels, seconds: number) {
			if (!Number.isFinite(seconds) || seconds < 0) return
			const row = rowFor(metric, labels)
			if (!row) return
			row.value += seconds
			row.count++
			for (let i = 0; i < metric.buckets.length; i++) {
				if (seconds <= metric.buckets[i]) row.buckets[i]++
			}
		},
	}
}

export function gauge(
	name: string,
	help: string,
	labelNames: Labels,
	collect: () => Sample[],
	cap = 2000,
) {
	register(name, help, "gauge", labelNames, [], cap).collect = collect
}

function escapeLabel(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"')
}

function labelsText(names: Labels, values: Labels, le?: string): string {
	const pairs = names.map((name, i) => `${name}="${escapeLabel(values[i])}"`)
	if (le !== undefined) pairs.push(`le="${le}"`)
	return pairs.length ? `{${pairs.join(",")}}` : ""
}

export function renderMetrics(): string {
	const lines: string[] = []
	for (const metric of metrics.values()) {
		if (metric.collect) {
			for (const sample of metric.collect()) {
				const row = rowFor(metric, sample.labels)
				if (row) row.value = sample.value
			}
		}
		lines.push(
			`# HELP ${metric.name} ${metric.help.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")}`,
			`# TYPE ${metric.name} ${metric.type}`,
		)
		for (const row of metric.rows.values()) {
			const labels = labelsText(metric.labelNames, row.labels)
			if (metric.type === "histogram") {
				metric.buckets.forEach((bucket, i) =>
					lines.push(
						`${metric.name}_bucket${labelsText(metric.labelNames, row.labels, String(bucket))} ${row.buckets[i]}`,
					),
				)
				lines.push(
					`${metric.name}_bucket${labelsText(metric.labelNames, row.labels, "+Inf")} ${row.count}`,
					`${metric.name}_sum${labels} ${row.value}`,
					`${metric.name}_count${labels} ${row.count}`,
				)
			} else lines.push(`${metric.name}${labels} ${row.value}`)
		}
	}
	lines.push(
		"# HELP goodwatch_metrics_dropped_label_sets_total Observations dropped because a metric reached its label set cap.",
		"# TYPE goodwatch_metrics_dropped_label_sets_total counter",
	)
	for (const metric of metrics.values()) {
		if (metric.dropped)
			lines.push(
				`goodwatch_metrics_dropped_label_sets_total{metric="${escapeLabel(metric.name)}"} ${metric.dropped}`,
			)
	}
	return `${lines.join("\n")}\n`
}

// Preserve metric handles held by imported modules while clearing their observations.
export function resetMetricsForTest(): void {
	for (const metric of metrics.values()) {
		metric.rows.clear()
		metric.dropped = 0
	}
}
