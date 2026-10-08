import { json } from "@remix-run/node";

export async function searchBody(request: Request, headers: Headers) {
	// Bound the body before JSON parsing; Content-Length is not a trustworthy bound.
	const reader = request.body?.getReader();
	let bytes = 0,
		raw = "";
	const decoder = new TextDecoder();
	if (!reader)
		throw json({ error: "Invalid search" }, { status: 400, headers });
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value.byteLength;
		if (bytes > 8192) {
			await reader.cancel();
			throw json({ error: "Search is too long" }, { status: 413, headers });
		}
		raw += decoder.decode(value, { stream: true });
	}
	raw += decoder.decode();
	const body = JSON.parse(raw),
		q = typeof body.q === "string" ? body.q.trim().normalize("NFC") : "";
	if (q.length < 2 || Buffer.byteLength(q) > 4096)
		throw json(
			{ error: "Enter between 2 and 4096 bytes of search text" },
			{ status: 400, headers },
		);
	return { body, q };
}
