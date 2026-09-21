import { json, type ActionFunctionArgs } from "@remix-run/node";
import { isIP } from "node:net";
import { getAuthFromRequest } from "~/utils/auth";
import { combinedSearch } from "~/server/combined-search/search.server";
import { parseSearchFilters } from "~/server/combined-search/search-filters";

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
		const { user, headers: authHeaders } = await getAuthFromRequest({
			request,
		});
		headers = authHeaders;
		headers.set("Cache-Control", "private, no-store");
		headers.set("Referrer-Policy", "no-referrer");
		// Deployment must explicitly configure a header overwritten by its trusted ingress.
		// Without that contract, all guests share a conservative scope; cookies cannot evade it.
		const address = process.env.SEARCH_TRUSTED_IP_HEADER
			? request.headers.get(process.env.SEARCH_TRUSTED_IP_HEADER)?.trim()
			: null;
		const networkIdentity =
			address && isIP(address) ? address : "shared-unverified-ingress";
		return json(
			await combinedSearch(
				q,
				{
					includeAdult: false,
					lesserKnown: body.lesserKnown === true,
					filters,
				},
				{ accountId: user?.id || null, networkIdentity },
				request.signal,
			),
			{ headers },
		);
	} catch {
		return json(
			{ error: "Search is unavailable. Your previous results are kept." },
			{ status: 503, headers },
		);
	}
}
