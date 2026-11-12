import type {
	Questions,
	SystemOneRequest,
	SystemOneResult,
} from "@typesafe-ai/sdk";
import { Agent, fetch as undiciFetch } from "undici";

export const LIQUID_MODEL = "liquid/d1.1";
export const LIQUID_RESPONSE_MODEL = "liquid/d1.1-20261027";
export const LIQUID_PRICE_VERSION = "openrouter-liquid-2026-11-12-20nano-v1";
// Conservative admission estimate, not an API-enforced request cost ceiling. The dedicated key is the backstop.
export const LIQUID_RESERVE_NANO = 10_000_000;
const agent = new Agent({
	keepAliveTimeout: 5 * 60_000,
	keepAliveMaxTimeout: 10 * 60_000,
});
const transport = ((
	url: Parameters<typeof undiciFetch>[0],
	init?: Parameters<typeof undiciFetch>[1],
) =>
	undiciFetch(url, {
		...init,
		dispatcher: agent,
	})) as unknown as typeof globalThis.fetch;
type Reading = SystemOneResult<Questions>;
type NativeReading = Reading & {
	provider?: string;
	warnings?: unknown[];
	usage: Reading["usage"] & {
		cost?: number;
		truncated?: boolean;
		state_tokens_dropped?: number;
		truncated_questions?: unknown[];
		options?: Record<string, { distinct: number; total: number }>;
	};
};

export class LiquidContractError extends Error {
	chargedNano: number | null;
	constructor(chargedNano: number | null) {
		super("Invalid native decision response");
		this.chargedNano = chargedNano;
	}
}

/** Native probabilities only. Every original question is sent once, in chunks of at most 128. No retries. */
export async function readLiquid(
	requests: [SystemOneRequest, SystemOneRequest],
	apiKey: string,
	signal: AbortSignal,
	fetcher: typeof globalThis.fetch = transport,
): Promise<{ readings: [Reading, Reading]; chargedNano: number }> {
	const jobs = requests.flatMap((request, group) => {
		const entries = Object.entries(request.questions);
		if (!entries.length) throw new LiquidContractError(0);
		return Array.from(
			{ length: Math.ceil(entries.length / 128) },
			(_, chunk) => ({
				group,
				state: request.state,
				questions: Object.fromEntries(
					entries.slice(chunk * 128, (chunk + 1) * 128),
				),
			}),
		);
	});
	const responses: NativeReading[] = new Array(jobs.length);
	let cursor = 0;
	let failed = false;
	await Promise.all(
		Array.from({ length: Math.min(2, jobs.length) }, async () => {
			while (!failed && cursor < jobs.length) {
				signal.throwIfAborted();
				const index = cursor++;
				const job = jobs[index];
				try {
					const response = await fetcher(
						"https://openrouter.ai/api/alpha/decisions",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${apiKey}`,
							},
							redirect: "error",
							signal,
							body: JSON.stringify({
								state: job.state,
								questions: job.questions,
								model: LIQUID_MODEL,
								provider: {
									only: ["liquid"],
									allow_fallbacks: false,
									max_price: { prompt: "0.02", completion: "0", request: "0" },
								},
							}),
						},
					);
					if (!response.ok) {
						await response.body?.cancel();
						throw new Error("Decision provider unavailable");
					}
					responses[index] = (await response.json()) as NativeReading;
				} catch (error) {
					failed = true;
					throw error;
				}
			}
		}),
	);
	signal.throwIfAborted();
	const costKnown = responses.every(
		(r) =>
			typeof r?.usage?.cost === "number" &&
			Number.isFinite(r.usage.cost) &&
			r.usage.cost >= 0,
	);
	const chargedNano = costKnown
		? Math.ceil(responses.reduce((sum, r) => sum + r.usage.cost!, 0) * 1e9)
		: null;
	const invalid = () => {
		throw new LiquidContractError(
			Number.isSafeInteger(chargedNano) ? chargedNano : null,
		);
	};
	if (chargedNano === null || !Number.isSafeInteger(chargedNano)) invalid();
	const probability = (n: unknown): n is number =>
		typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
	for (let i = 0; i < jobs.length; i++) {
		const r = responses[i],
			q = jobs[i].questions;
		if (
			!r ||
			r.model !== LIQUID_RESPONSE_MODEL ||
			r.provider !== "Liquid" ||
			!Number.isSafeInteger(r.usage?.input_tokens) ||
			r.usage.input_tokens < 0 ||
			r.usage?.truncated ||
			r.usage?.state_tokens_dropped ||
			r.usage?.truncated_questions?.length ||
			Object.values(r.usage?.options ?? {}).some((o) => o.distinct < o.total) ||
			(r.warnings ?? []).some((w) => /truncat/i.test(JSON.stringify(w))) ||
			Object.keys(r.answers ?? {})
				.sort()
				.join("\n") !== Object.keys(q).sort().join("\n")
		)
			invalid();
		for (const [key, question] of Object.entries(q)) {
			const answer = r.answers[key];
			if (
				answer?.type !== question.type ||
				(answer as { truncated?: boolean }).truncated
			)
				invalid();
			if (question.type === "noul") {
				if (answer.type !== "noul" || !probability(answer.noul)) invalid();
			} else if (question.type === "choice") {
				const choices = Object.keys(question.criteria);
				if (
					answer.type !== "choice" ||
					!probability(answer.confidence) ||
					!choices.includes(answer.choice) ||
					!answer.probabilities ||
					Object.keys(answer.probabilities).sort().join("\n") !==
						choices.sort().join("\n") ||
					choices.some((c) => !probability(answer.probabilities[c])) ||
					Math.abs(
						choices.reduce((s, c) => s + answer.probabilities[c], 0) - 1,
					) > 0.02
				)
					invalid();
			} else invalid();
		}
	}
	const readings = requests.map((_, group) => {
		const parts = responses.filter((_, i) => jobs[i].group === group);
		return {
			...parts[0],
			answers: Object.assign({}, ...parts.map((r) => r.answers)),
			usage: {
				input_tokens: parts.reduce((s, r) => s + r.usage.input_tokens, 0),
				output_tokens: parts.reduce(
					(s, r) => s + (r.usage.output_tokens ?? 0),
					0,
				),
			},
		};
	}) as [Reading, Reading];
	return { readings, chargedNano: chargedNano! };
}

/** A separate key and a positive explicit cap are both required. Shared OPENROUTER_API_KEY is never considered. */
export function overflowConfiguration():
	| { apiKey: string; monthlyNano: number }
	| undefined {
	const apiKey = process.env.SEARCH_OVERFLOW_OPENROUTER_API_KEY?.trim();
	const amount = process.env.SEARCH_OVERFLOW_MONTHLY_BUDGET_USD ?? "";
	if (!apiKey || !/^\d+(\.\d{1,9})?$/.test(amount)) return;
	const [dollars, fraction = ""] = amount.split(".");
	const nano =
		BigInt(dollars) * BigInt(1_000_000_000) + BigInt(fraction.padEnd(9, "0"));
	if (nano <= BigInt(0) || nano > BigInt(Number.MAX_SAFE_INTEGER)) return;
	return { apiKey, monthlyNano: Number(nano) };
}
