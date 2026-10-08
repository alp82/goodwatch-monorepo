import { Agent, fetch } from "undici";
import { searchRoleKey, searchRoleUrl } from "../role.server.ts";
import { onShutdown } from "../lifecycle.server";
import { withTaste, type searchTaste } from "./taste-rows.server";
import type { PaletteTitle } from "../../utils/command-palette";

const agent = new Agent({ connections: 64, keepAliveTimeout: 60_000 });
onShutdown("search role connections", () => agent.close());
const encoder = new TextEncoder();
const errorLine = encoder.encode(`${JSON.stringify({
	kind: "error",
	error: "Search is unavailable. Your previous results are kept.",
})}\n`);

function timeout(name: string, fallback: number): number {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function forwardSearch(
	url: string,
	body: {
		q: string; filters: unknown; lesserKnown: boolean; allTitles: boolean;
		fullList: boolean; accountId: string | null; networkIdentity: string;
	},
	signal: AbortSignal,
	taste: ReturnType<typeof searchTaste>,
	forYou: boolean,
): Promise<ReadableStream<Uint8Array> | null> {
	const abort = new AbortController();
	const stop = () => abort.abort();
	signal.addEventListener("abort", stop, { once: true });
	if (signal.aborted) stop();
	let timer = setTimeout(stop, timeout("SEARCH_ROLE_TIMEOUT_MS", 2000));
	const cleanup = () => {
		clearTimeout(timer);
		signal.removeEventListener("abort", stop);
	};
	try {
		const response = await fetch(`${url}/internal/search`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Search-Role-Key": searchRoleKey() ?? "",
			},
			body: JSON.stringify(body),
			dispatcher: agent,
			redirect: "manual",
			signal: abort.signal,
		});
		clearTimeout(timer);
		if (response.status !== 200 || !response.body) {
			stop();
			cleanup();
			return null;
		}
		timer = setTimeout(stop, timeout("SEARCH_ROLE_BODY_TIMEOUT_MS", 15000));
		const reader = response.body.getReader();
		let cancelled = false;
		let endsWithNewline = true;
		let rejectAborted: () => void = () => {};
		const aborted = new Promise<never>((_, reject) => {
			rejectAborted = () => reject(new Error("Search role request aborted"));
			abort.signal.addEventListener("abort", rejectAborted, { once: true });
			if (abort.signal.aborted) rejectAborted();
		});
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					const memberTaste = await Promise.race([taste, aborted]);
					const decoder = new TextDecoder();
					let buffered = "";
					const line = (text: string) => {
						const message = JSON.parse(text);
						if (message.kind === "batch" && memberTaste) {
							message.batch.rows = withTaste(message.batch.rows, memberTaste, forYou);
							return `${JSON.stringify(message)}\n`;
						}
						return text;
					};
					while (!cancelled) {
						const { done, value } = await reader.read();
						if (done) break;
						if (!memberTaste) {
							controller.enqueue(value);
							if (value.length) endsWithNewline = value[value.length - 1] === 10;
							continue;
						}
						buffered += decoder.decode(value, { stream: true });
						let end: number;
						while ((end = buffered.indexOf("\n")) >= 0) {
							controller.enqueue(encoder.encode(line(buffered.slice(0, end + 1))));
							buffered = buffered.slice(end + 1);
						}
					}
					if (memberTaste && !cancelled) {
						buffered += decoder.decode();
						if (buffered) controller.enqueue(encoder.encode(line(buffered)));
					}
				} catch {
					if (!cancelled) {
						if (!endsWithNewline) controller.enqueue(encoder.encode("\n"));
						controller.enqueue(errorLine);
					}
				} finally {
					cleanup();
					abort.signal.removeEventListener("abort", rejectAborted);
					stop();
					if (!cancelled) controller.close();
				}
			},
			cancel() {
				cancelled = true;
				stop();
				cleanup();
				return reader.cancel();
			},
		});
	} catch {
		stop();
		cleanup();
		return null;
	}
}

export async function searchRolePalette(prefix: string): Promise<PaletteTitle[] | null> {
	const url = searchRoleUrl();
	if (!url) return null;
	try {
		const response = await fetch(`${url}/internal/command-palette?q=${encodeURIComponent(prefix)}`, {
			headers: { "X-Search-Role-Key": searchRoleKey() ?? "" },
			dispatcher: agent,
			redirect: "manual",
			signal: AbortSignal.timeout(timeout("SEARCH_ROLE_PALETTE_TIMEOUT_MS", 500)),
		});
		if (response.status !== 200) {
			await response.body?.cancel();
			return null;
		}
		const body = await response.json() as { titles?: PaletteTitle[] };
		return Array.isArray(body.titles) ? body.titles : null;
	} catch {
		return null;
	}
}
