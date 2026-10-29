import { expect, it } from "vitest"
import { pageHeaders } from "./headers.ts"

it("preserves parent, child and thrown-response timing in document headers", () => {
	const headers = new Headers(
		pageHeaders({
			parentHeaders: new Headers({ "Server-Timing": "session;dur=12.0" }),
			loaderHeaders: new Headers({ "Server-Timing": "data;dur=350.0" }),
			actionHeaders: new Headers(),
			errorHeaders: new Headers({
				"Server-Timing": "total;dur=400.0",
				"Cache-Control": "private, no-store",
				"Retry-After": "2",
			}),
		}),
	)
	expect(headers.get("Server-Timing")).toBe(
		"session;dur=12.0, data;dur=350.0, total;dur=400.0",
	)
	expect(headers.get("Cache-Control")).toBe("private, no-store")
	expect(headers.get("Retry-After")).toBe("2")
})

it("adds timings to a thrown loader Response without changing its status or retry policy", async () => {
	const { withRequestTiming, timeRequestWork } = await import(
		"./request-work.ts"
	)
	const response = new Response("temporarily unavailable", {
		status: 503,
		headers: { "Cache-Control": "private, no-store", "Retry-After": "2" },
	})
	const request = new Request("http://localhost/hot-on-socials")
	const load = withRequestTiming(async ({ request }: { request: Request }) => {
		await timeRequestWork(request, "data", async () => {
			throw response
		})
	})
	await expect(load({ request })).rejects.toBe(response)
	expect(response.headers.get("Server-Timing")).toMatch(
		/data;dur=\d+\.\d, total;dur=\d+\.\d/,
	)
	expect(response.status).toBe(503)
	expect(response.headers.get("Retry-After")).toBe("2")
})
