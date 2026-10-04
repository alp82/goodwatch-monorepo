// Checks exposition and caps so scrape output stays accurate and bounded.
import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
	counter,
	gauge,
	histogram,
	renderMetrics,
	resetMetricsForTest,
} from "./registry.server.ts"

beforeEach(resetMetricsForTest)
test("counter accumulates and escapes label values and help", () => {
	const c = counter("test_counter", "A\\help\nline", ["name"])
	c.inc(['a\\b"c\nd'])
	c.inc(['a\\b"c\nd'], 2)
	assert.ok(renderMetrics().includes('test_counter{name="a\\\\b\\"c\\nd"} 3\n'))
	assert.ok(
		renderMetrics().includes(
			"# HELP test_counter A\\\\help\\nline\n# TYPE test_counter counter",
		),
	)
})
test("histogram has cumulative finite and infinite buckets, sum and count", () => {
	const h = histogram("test_duration", "Duration.", [], [0.1, 0.3, 1])
	for (const n of [0.05, 0.3, 2]) h.observe([], n)
	const output = renderMetrics()
	for (const line of [
		'test_duration_bucket{le="0.1"} 1',
		'test_duration_bucket{le="0.3"} 2',
		'test_duration_bucket{le="1"} 2',
		'test_duration_bucket{le="+Inf"} 3',
		"test_duration_sum 2.35",
		"test_duration_count 3",
	])
		assert.ok(output.includes(`${line}\n`), line)
})
test("caps drop new sets, count drops, and keep existing sets writable", () => {
	const c = counter("test_capped", "Capped.", ["a", "b"], 2)
	c.inc(["a:b", "c"])
	c.inc(["a", "b:c"])
	c.inc(["new", "set"])
	c.inc(["new", "set"])
	c.inc(["a:b", "c"])
	const output = renderMetrics()
	assert.ok(output.includes('test_capped{a="a:b",b="c"} 2'))
	assert.ok(output.includes('test_capped{a="a",b="b:c"} 1'))
	assert.ok(!output.includes('a="new"'))
	assert.ok(
		output.includes(
			'goodwatch_metrics_dropped_label_sets_total{metric="test_capped"} 2',
		),
	)
})
test("gauges collect on each render and reset preserves counter handles", () => {
	let value = 7
	gauge("test_gauge", "Gauge.", [], () => [{ labels: [], value }])
	assert.ok(renderMetrics().includes("test_gauge 7\n"))
	value = 9
	assert.ok(renderMetrics().includes("test_gauge 9\n"))
	const c = counter("test_reset", "Reset.", [])
	c.inc([], 8)
	resetMetricsForTest()
	c.inc([])
	assert.ok(renderMetrics().includes("test_reset 1\n"))
})
