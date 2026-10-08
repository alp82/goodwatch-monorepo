import { json, type ActionFunctionArgs } from "@remix-run/node";
import { searchRoleAuthorized } from "~/server/search-role-auth.server";
import { searchAdmission, searchBusyResponse } from "~/server/search-runtime/admission.server";
import { searchBody } from "~/server/combined-search/search-body.server";
import { parseSearchFilters } from "~/server/combined-search/search-filters";
import { searchStream } from "~/server/combined-search/search-stream.server";

export const loader = () => new Response(null, { status: 404 });

export async function action({ request }: ActionFunctionArgs) {
	if (!searchRoleAuthorized(request)) return new Response(null, { status: 404 });
	if (request.method !== "POST") return new Response(null, { status: 405 });
	const headers = new Headers({
		"Cache-Control": "private, no-store",
		"Referrer-Policy": "no-referrer",
	});
	const release = searchAdmission.enter();
	if (!release) return searchBusyResponse();
	let handedOver = false;
	try {
		const { body, q } = await searchBody(request, headers);
		const searchAbort = new AbortController();
		const stop = () => searchAbort.abort();
		request.signal.addEventListener("abort", stop, { once: true });
		if (request.signal.aborted) stop();
		const stream = searchStream({
			q, body, filters: parseSearchFilters(body.filters),
			accountId: body.accountId ?? null, networkIdentity: body.networkIdentity,
			searchAbort, fullList: body.fullList === true,
			release: () => {
				release();
				request.signal.removeEventListener("abort", stop);
			},
		});
		handedOver = true;
		headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
		headers.set("Cache-Control", "private, no-store, no-transform");
		return new Response(stream, { headers });
	} catch (error) {
		if (error instanceof Response) return error;
		return json({ error: "Search is unavailable. Your previous results are kept." }, { status: 503, headers });
	} finally {
		if (!handedOver) release();
	}
}
