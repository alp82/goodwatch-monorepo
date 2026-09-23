// Re-exports undici with a fetch that records every call: wall time through body parse, the
// Crate statement and args, and the parsed JSON response. Loaded by arena-capture.ts through
// arena-vite.config.mjs when ARENA_CAPTURE_FETCH=1.
import * as undici from "../node_modules/undici/index.js";
export * from "../node_modules/undici/index.js";
export interface CapturedCall {
	url: string;
	stmt?: string;
	args?: unknown[];
	ms: number;
	json?: any;
}
export const captured: CapturedCall[] = [];
(globalThis as any).__arenaCaptured = captured;
export const fetch = async (input: any, init?: any) => {
	const url = String(input);
	let stmt: string | undefined, args: unknown[] | undefined;
	if (typeof init?.body === "string" && url.includes("/_sql")) {
		try {
			({ stmt, args } = JSON.parse(init.body));
		} catch {}
	}
	const t = performance.now();
	const res: any = await (undici.fetch as any)(input, init);
	const json = res.json.bind(res);
	res.json = async () => {
		const v = await json();
		captured.push({ url: url.replace(/api_key=[^&]+/, "api_key=…"), stmt, args, ms: performance.now() - t, json: v });
		return v;
	};
	return res;
};
