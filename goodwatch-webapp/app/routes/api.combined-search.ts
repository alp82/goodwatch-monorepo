import { searchBody } from "~/server/combined-search/search-body.server";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { isIP } from "node:net";
import { getAuthFromRequest } from "~/utils/auth";
import { runsSearch, searchRoleUrl } from "~/server/role.server";
import { searchStream } from "~/server/combined-search/search-stream.server";
import { forwardSearch } from "~/server/combined-search/search-role-client.server";
import { parseSearchFilters } from "~/server/combined-search/search-filters";
import { getFeatureMode } from "~/server/features.server";
import {
	searchAdmission,
	searchBusyResponse,
} from "~/server/search-runtime/admission.server";
import { searchTaste } from "~/server/combined-search/taste-rows.server";

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
	const roleUrl = searchRoleUrl();
	if (!runsSearch() && !roleUrl) return searchBusyResponse();
	const release = roleUrl ? () => {} : searchAdmission.enter();
	if (!release) return searchBusyResponse();
	let handedOver = false;
	try {
		const { body, q } = await searchBody(request, headers);
		const filters = roleUrl ? undefined : parseSearchFilters(body.filters);
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
		if (!roleUrl) request.signal.addEventListener("abort", stop, { once: true });
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
		let stream: ReadableStream<Uint8Array>;
		if (roleUrl) {
			headers = (await auth).headers;
			const forwarded = await forwardSearch(roleUrl, {
				q, filters: body.filters, lesserKnown: body.lesserKnown === true,
				allTitles: body.allTitles === true, fullList,
				accountId: await accountId, networkIdentity,
			}, request.signal, taste, forYou);
			if (!forwarded) {
				const response = searchBusyResponse();
				const busyHeaders = new Headers(headers);
				response.headers.forEach((value, name) => busyHeaders.set(name, value));
				return new Response(response.body, { status: response.status, headers: busyHeaders });
			}
			stream = forwarded;
		} else {
			stream = searchStream({
				q, body, filters: filters!, accountId, networkIdentity, searchAbort,
				taste, forYou, fullList, release,
			});
		}
		handedOver = true;
		// The response carries the session check's cookies, so it waits for the check (not for the search).
		headers = (await auth).headers;
		headers.set("Referrer-Policy", "no-referrer");
		headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
		headers.set("Cache-Control", "private, no-store, no-transform");
		return new Response(stream, { headers });
	} catch (error) {
		if (error instanceof Response) return error;
		return json(
			{ error: "Search is unavailable. Your previous results are kept." },
			{ status: 503, headers },
		);
	} finally {
		if (!handedOver) release();
	}
}
