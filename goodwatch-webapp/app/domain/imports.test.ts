import assert from "node:assert/strict"
import { test } from "node:test"
import {
	IMPORT_KINDS,
	IMPORT_SOURCES,
	type ImportItem,
	type ImportOptions,
	type ImportOutcome,
	REWATCH_QUESTION_EVIDENCE,
	effectiveImportOptions,
	followsConflictChoice,
	importGate,
} from "./imports.ts"

const row: ImportItem = {
	index: 0,
	key: "row",
	kind: "want",
	mediaType: "movie",
	title: "Title",
	year: null,
	tmdbId: 1,
	imdbId: null,
	outcome: "conflict",
	reason: null,
}

test("gate preserves legacy coupling and honors explicit rewatch consent across every source and option combination", () => {
	const outcomes: ImportOutcome[] = [
		"new",
		"conflict",
		"unchanged",
		"unmatched",
		"unsupported",
		"invalid",
	]
	for (const source of [
		...IMPORT_SOURCES,
		...REWATCH_QUESTION_EVIDENCE,
		undefined,
	])
		for (const kind of [...IMPORT_KINDS, "unsupported"] as const)
			for (const outcome of outcomes)
				for (const wishlistShowChoice of [undefined, false, true])
					for (const wishlistRewatchChoice of [undefined, false, true])
						for (const conflictChoice of ["keep", "source"] as const)
							for (const wishlistRewatch of [undefined, false, true])
								for (const wishlistShows of [undefined, false, true])
									for (const selected of [false, true]) {
										const item: ImportItem = {
											...row,
											kind,
											outcome,
											wishlistShowChoice,
											wishlistRewatchChoice,
											wishlistEvidence: source
												? {
														source,
														completeness: "complete",
														mediaType: "movie",
													}
												: undefined,
										}
										const input: ImportOptions = {
											kinds: selected ? [...IMPORT_KINDS] : [],
											watchDates: "preserve",
											conflictChoice,
											wishlistRewatch,
											wishlistShows,
										}
										// The legacy predicates remain the oracle when independent consent is absent.
										const independent = [
											"watcharr",
											"imdb-watchlist",
											"mdblist",
										].includes(source ?? "")
										const allowRewatch =
											wishlistRewatch !== undefined
												? wishlistRewatch === true
												: independent
													? wishlistRewatch === true
													: !!source && conflictChoice === "source"
										const kept =
											kind === "unsupported" ||
											!input.kinds.includes(kind) ||
											[
												"unmatched",
												"unsupported",
												"invalid",
												"unchanged",
											].includes(outcome) ||
											(outcome === "conflict" &&
												((wishlistShowChoice && wishlistShows !== true) ||
													(wishlistRewatchChoice
														? !allowRewatch
														: wishlistRewatchChoice !== false &&
															conflictChoice === "keep")))
										const before = structuredClone(input)
										const gate = importGate(item, input)
										assert.equal("kept" in gate, Boolean(kept))
										assert.equal(
											followsConflictChoice(item),
											outcome === "conflict" &&
												(wishlistRewatchChoice === undefined ||
													(wishlistRewatchChoice === true && !independent)),
										)
										assert.equal(
											effectiveImportOptions(item, input).wishlistRewatch,
											allowRewatch,
										)
										if ("effective" in gate)
											assert.deepEqual(gate.effective, {
												...input,
												wishlistRewatch: allowRewatch,
											})
										assert.deepEqual(input, before)
									}
})

test("stage 1 explicit leave identifies the kept question without changing implicit defaults", () => {
	const options: ImportOptions = {
		kinds: ["want"],
		conflictChoice: "source",
		watchDates: "preserve",
	}
	for (const question of ["wholeShow", "rewatch"] as const) {
		const item = {
			...row,
			...(question === "wholeShow"
				? { wishlistShowChoice: true }
				: { wishlistRewatchChoice: true }),
		}
		assert.deepEqual(importGate(item, options), { kept: true })
		assert.deepEqual(
			importGate(item, {
				...options,
				...(question === "wholeShow"
					? { wishlistShows: false }
					: { wishlistRewatch: false }),
			}),
			{ kept: true, question },
		)
	}
})
