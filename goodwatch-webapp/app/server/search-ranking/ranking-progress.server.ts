// Request-local numeric diagnostics. These wall spans may overlap; they are not additive stage budgets.
export type RankingSpan =
	| "index"
	| "preparedWait"
	| "encodeEarly"
	| "encodeLate"
	| "prefetch"
	| "round1"
	| "rescore"
	| "round2"

export class RankingProgress {
	private readonly spans = new Map<
		RankingSpan,
		{ started: number; ended?: number }
	>()

	async measure<T>(name: RankingSpan, run: () => Promise<T>): Promise<T> {
		// The early work can be awaited again after the reading. Keep its original start and completion.
		if (this.spans.has(name)) return run()
		const span = {
			started: performance.now(),
			ended: undefined as number | undefined,
		}
		this.spans.set(name, span)
		try {
			return await run()
		} finally {
			span.ended = performance.now()
		}
	}

	snapshot(): Readonly<Record<string, number>> {
		const now = performance.now()
		const out: Record<string, number> = {}
		for (const [name, span] of this.spans) {
			out[`${name}Elapsed`] =
				Math.round(((span.ended ?? now) - span.started) * 10) / 10
			if (span.ended === undefined) out[`${name}Pending`] = 1
		}
		return Object.freeze(out)
	}
}
