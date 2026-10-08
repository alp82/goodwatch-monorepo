import { combinedSearch } from "./search.server";
import { RESULT_LENGTH } from "../search-ranking/ranking.server";
import { withTaste, type searchTaste } from "./taste-rows.server";
import type { parseSearchFilters } from "./search-filters";

type StreamInput = {
	q: string;
	body: { lesserKnown?: unknown; allTitles?: unknown };
	filters: ReturnType<typeof parseSearchFilters>;
	accountId: string | null | Promise<string | null>;
	networkIdentity: string;
	searchAbort: AbortController;
	taste?: ReturnType<typeof searchTaste>;
	forYou?: boolean;
	fullList: boolean;
	release: () => void;
};

export function searchStream({
	q, body, filters, accountId, networkIdentity, searchAbort,
	taste, forYou = false, fullList, release,
}: StreamInput): ReadableStream<Uint8Array> {
	// Newline-delimited JSON: a "reading" line as soon as the interpretation is known,
	// then the "batch" line with the results. "no-transform" keeps the compression
	// middleware from holding the first line back until the response ends.
	const encoder = new TextEncoder();
	return new ReadableStream({
		async start(controller) {
			const send = (message: object) =>
				controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
			try {
				const batch = await combinedSearch(
					q,
					{
						includeAdult: false,
						lesserKnown: body.lesserKnown === true,
						filters,
					},
					{ accountId, networkIdentity },
					searchAbort.signal,
					(reading) => send({ kind: "reading", reading }),
					{
						allTitles: body.allTitles === true,
						// Discover's search mode filters and counts over the whole ranked list.
						rows: fullList ? RESULT_LENGTH : undefined,
					},
				);
				const memberTaste = await taste;
				send({
					kind: "batch",
					batch: memberTaste
						? { ...batch, rows: withTaste(batch.rows, memberTaste, forYou) }
						: batch,
				});
			} catch {
				send({
					kind: "error",
					error: "Search is unavailable. Your previous results are kept.",
				});
			} finally {
				release();
				controller.close();
			}
		},
	});
}
