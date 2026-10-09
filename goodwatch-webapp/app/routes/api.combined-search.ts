import { json, type ActionFunctionArgs } from "@remix-run/node";
import { isIP } from "node:net";
import { getAuthFromRequest } from "~/utils/auth";
import { combinedSearch } from "~/server/combined-search/search.server";
import { parseSearchFilters } from "~/server/combined-search/search-filters";
import { getFeatureMode } from "~/server/features.server";
import { runsSearch } from "~/server/role.server";
import {
	searchAdmission,
	searchBusyResponse,
} from "~/server/search-runtime/admission.server";
import { RESULT_LENGTH } from "~/server/search-ranking/ranking.server";
import {
	searchTaste,
	withTaste,
} from "~/server/combined-search/taste-rows.server";

export async function action({ request }: ActionFunctionArgs) {
	let headers = new Headers({
		"Cache-Control": "private, no-store",
		"Referrer-Policy": "no-referrer",
	});
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers });
	// Coolify terminates TLS; remix-serve sees HTTP. Match the configured public
	// origin, as in poster impressions, without trusting caller-supplied proxies.
	const expectedOrigin = process.env.APP_ORIGIN || (
		process.env.NODE_ENV === "production" ? "https://goodwatch.app" : "http://localhost:3003"
	);
	if (
		request.headers.get("Origin") &&
		request.headers.get("Origin") !== expectedOrigin
	)
		return json({ error: "Invalid origin" }, { status: 403, headers });
	// A page instance does no search work (see role.server.ts): the proxy sends searches to the search roles.
	if (!runsSearch()) return searchBusyResponse();
	const release = searchAdmission.enter();
	if (!release) return searchBusyResponse();
	let handedOver = false;
	try {
		// Bound the body before JSON parsing; Content-Length is not a trustworthy bound.
		const reader = request.body?.getReader();
		let bytes = 0,
			raw = "";
		const decoder = new TextDecoder();
		if (!reader)
			return json({ error: "Invalid search" }, { status: 400, headers });
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.byteLength;
			if (bytes > 8192) {
				await reader.cancel();
				return json({ error: "Search is too long" }, { status: 413, headers });
			}
			raw += decoder.decode(value, { stream: true });
		}
		raw += decoder.decode();
		const body = JSON.parse(raw),
			q = typeof body.q === "string" ? body.q.trim().normalize("NFC") : "";
		if (q.length < 2 || Buffer.byteLength(q) > 4096)
			return json(
				{ error: "Enter between 2 and 4096 bytes of search text" },
				{ status: 400, headers },
			);
		const filters = parseSearchFilters(body.filters);
		// Deployment must explicitly configure a header overwritten by its trusted ingress.
		// Without that contract, all guests share a conservative scope; cookies cannot evade it.
		const address = process.env.SEARCH_TRUSTED_IP_HEADER
			? request.headers.get(process.env.SEARCH_TRUSTED_IP_HEADER)?.trim()
			: null;
		const networkIdentity =
			address && isIP(address) ? address : "shared-unverified-ingress";
		// The session check (Supabase getUser, a network call for signed-in people) runs while the search starts. The
		// search waits for the account only before a paid Jev call and for the history row. If the check fails, the
		// search stops and the response is the error below, as before.
		const searchAbort = new AbortController();
		const stop = () => searchAbort.abort();
		request.signal.addEventListener("abort", stop, { once: true });
		const auth = getAuthFromRequest({ request });
		const accountId = auth.then(
			({ user }) => user?.id || null,
			(error) => {
				stop();
				throw error;
			},
		);
		accountId.catch(() => {});
		// With the new filter bar, a member's rows carry their taste match and For you movement (see taste-rows).
		// The taste loads while the search runs. `forYou` is the switch; the rows keep the ranking's order.
		const taste = searchTaste(accountId);
		const forYou = body.forYou === true;
		const fullList =
			body.discover === true && getFeatureMode("filterBar") !== "off";
		// Newline-delimited JSON: a "reading" line as soon as the interpretation is known,
		// then the "batch" line with the results. "no-transform" keeps the compression
		// middleware from holding the first line back until the response ends.
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
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
		handedOver = true;
		// The response carries the session check's cookies, so it waits for the check (not for the search).
		headers = (await auth).headers;
		headers.set("Referrer-Policy", "no-referrer");
		headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
		headers.set("Cache-Control", "private, no-store, no-transform");
		return new Response(stream, { headers });
	} catch {
		return json(
			{ error: "Search is unavailable. Your previous results are kept." },
			{ status: 503, headers },
		);
	} finally {
		if (!handedOver) release();
	}
}
