import { fetch } from "undici";
import {
	TypeSafeClient,
	type SystemOneRequest,
	type SystemOneResult,
	type Questions,
} from "@typesafe-ai/sdk";
import {
	productionStore,
	type BasicReason,
	type SearchStore,
} from "./store.server";

export const JEV_MODEL = "jev-1.13.0";
export const JEV_DEADLINE_MS = 1500;
// Published context maximum is 64k total input tokens, including all questions.
// Use 65,536 (larger than decimal 64k), never the observed average usage.
export const JEV_INPUT_BOUND = 65_536;
export const JEV_NANO_PER_TOKEN = 42; // $0.042 per million input tokens; output free.
export const JEV_PRICE_VERSION = "typesafe-public-2026-09-21-42nano-v1";
export const JEV_RESERVE_NANO = 2 * JEV_INPUT_BOUND * JEV_NANO_PER_TOKEN;
export const BASIC_SEARCH_MESSAGE = "Showing basic search results.";

type Reading = SystemOneResult<Questions>;
export type LanguagePolicy =
	| { mode: "english"; version: string }
	| { mode: "native-vector-only"; version: string }
	| {
			mode: "translated";
			version: string;
			model: string;
			translatedText: string;
	  };

export const translationEnabled = () =>
	process.env.SEARCH_TRANSLATION_ENABLED === "true";
export function nativeLanguagePolicy(isEnglish: boolean): LanguagePolicy {
	return {
		mode: isEnglish ? "english" : "native-vector-only",
		version: "language-routing-v1",
	};
}

export type JevOutcome =
	| {
			kind: "ready" | "cached";
			readings: [Reading, Reading];
			chargedNano: number;
	  }
	| {
			kind: "basic";
			reason: BasicReason;
			message: typeof BASIC_SEARCH_MESSAGE;
			chargedNano: number;
	  };
const basic = (reason: BasicReason, chargedNano = 0): JevOutcome => ({
	kind: "basic",
	reason,
	message: BASIC_SEARCH_MESSAGE,
	chargedNano,
});

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
			.join(",")}}`;
	return JSON.stringify(value);
}

let sharedStore: SearchStore | undefined;
export function getSearchStore() {
	return (sharedStore ??= productionStore());
}

export interface JevStageInput {
	requestText: string;
	questionVersion: string;
	language: LanguagePolicy;
	// Exactly the locked attribute + fingerprint requests, already constructed by D4+.
	// This module does not rewrite questions, rank results, or invoke translation.
	requests: [SystemOneRequest, SystemOneRequest];
	// Obtained from authenticated server context and a TRUSTED ingress address resolver.
	// Never accept arbitrary forwarded headers, browser-provided user IDs, or new cookies.
	visitor: { accountId: string | null; networkIdentity: string };
	signal?: AbortSignal;
	admissionAttemptId?: string;
}

export async function runJevStage(input: JevStageInput): Promise<JevOutcome> {
	let store: SearchStore;
	try {
		store = getSearchStore();
	} catch {
		return basic("configuration");
	}
	return executeJevStage(store, input);
}

// Explicit store parameter supports isolated maintenance/ad hoc verification.
// Only the production SDK transport is used; there is no prototype credential fallback.
export async function executeJevStage(
	store: SearchStore,
	input: JevStageInput,
): Promise<JevOutcome> {
	if (input.signal?.aborted) return basic("cancelled");
	if (
		!input.requestText.trim() ||
		Buffer.byteLength(input.requestText, "utf8") > 4096 ||
		!input.visitor.networkIdentity ||
		!input.questionVersion ||
		input.requests.length !== 2
	)
		return basic("input");
	if (input.language.mode === "translated" && !translationEnabled())
		return basic("configuration");
	// Copy only known fields: callers cannot sneak an alternate model or transport options in.
	let requests: [SystemOneRequest, SystemOneRequest];
	let cacheKey: string;
	const contract = `d4+/${JEV_MODEL}/${input.questionVersion}/${input.language.mode}/${input.language.version}`;
	try {
		requests = input.requests.map((request) => ({
			state: request.state,
			questions: request.questions,
			model: JEV_MODEL,
		})) as [SystemOneRequest, SystemOneRequest];
		// Bound the actual serialized input too. Oversized requests fall back without a paid attempt.
		if (
			requests.some(
				(request) => Buffer.byteLength(JSON.stringify(request), "utf8") > 65536,
			)
		)
			return basic("input");
		cacheKey = store.digest(
			canonical({
				contract,
				language: input.language,
				requests,
				text: input.requestText.trim().normalize("NFC"),
			}),
		);
		const hit = await store.lookup(cacheKey);
		if (hit?.kind === "cached")
			return {
				kind: "cached",
				readings: store.unseal(hit.ciphertext),
				chargedNano: 0,
			};
	} catch {
		return basic("storage");
	}
	// Cache reuse doesn't depend on provider credentials or available paid allowance.
	const apiKey = process.env.TYPESAFE_API_KEY;
	if (!apiKey) return basic("configuration");
	let claim;
	try {
		claim = await store.claim({
			cacheKey,
			contract,
			scopes: [
				"global",
				store.digest(`network:${input.visitor.networkIdentity}`),
				...(input.visitor.accountId
					? [store.digest(`account:${input.visitor.accountId}`)]
					: []),
			],
			reserveNano: JEV_RESERVE_NANO,
			priceVersion: JEV_PRICE_VERSION,
			admissionAttemptId: input.admissionAttemptId,
		});
	} catch {
		return basic("storage");
	}
	if (claim.kind === "basic") return basic(claim.reason);
	if (claim.kind === "cached") {
		try {
			return {
				kind: "cached",
				readings: store.unseal(claim.ciphertext),
				chargedNano: 0,
			};
		} catch {
			return basic("storage");
		}
	}
	const id = claim.id;
	if (input.signal?.aborted) {
		await store.finish(id, 0).catch(() => {});
		return basic("cancelled");
	}
	try {
		await store.dispatch(id);
	} catch {
		return basic("storage", JEV_RESERVE_NANO);
	}
	const controller = new AbortController();
	let deadlineExpired = false;
	const cancelled = () => controller.abort();
	input.signal?.addEventListener("abort", cancelled, { once: true });
	if (input.signal?.aborted) controller.abort();
	const timer = setTimeout(() => {
		deadlineExpired = true;
		controller.abort();
	}, JEV_DEADLINE_MS);
	const client = new TypeSafeClient({
		// Undici implements Fetch; Remix augments the global DOM types with its shim.
		fetch: fetch as unknown as typeof globalThis.fetch,
		apiKey,
		baseURL: "https://api.typesafe.ai",
		defaultModel: JEV_MODEL,
		timeout: JEV_DEADLINE_MS,
		retry: { maxRetries: 0 },
		logLevel: "off",
	});
	let readings: [Reading, Reading] | undefined;
	try {
		// Race covers body parsing as well as headers (SDK attempt timer ends at headers).
		const aborted = new Promise<never>((_, reject) => {
			if (controller.signal.aborted) reject(new Error("cancelled"));
			else
				controller.signal.addEventListener(
					"abort",
					() => reject(new Error("cancelled")),
					{ once: true },
				);
		});
		readings = (await Promise.race([
			Promise.all(
				requests.map((request) =>
					client.systemOne(request, {
						signal: controller.signal,
						timeout: JEV_DEADLINE_MS,
						retry: { maxRetries: 0 },
					}),
				),
			),
			aborted,
		])) as [Reading, Reading];
	} catch {
		controller.abort();
		// Even HTTP rejection/cancellation can be billable. Never infer zero usage from an error.
		await store.finish(id, null).catch(() => {});
		return basic(
			deadlineExpired
				? "deadline"
				: input.signal?.aborted
					? "cancelled"
					: "provider",
			JEV_RESERVE_NANO,
		);
	} finally {
		clearTimeout(timer);
		input.signal?.removeEventListener("abort", cancelled);
	}
	const validUsage = readings.every(
		(result) =>
			Number.isSafeInteger(result?.usage?.input_tokens) &&
			result.usage.input_tokens >= 0,
	);
	if (!validUsage) {
		await store.finish(id, null).catch(() => {});
		return basic("contract", JEV_RESERVE_NANO);
	}
	if (readings.some((result) => result.usage.input_tokens > JEV_INPUT_BOUND)) {
		await store.haltPaidAdmissions().catch(() => {});
	}
	const actualNano = readings.reduce(
		(sum, result) => sum + result.usage.input_tokens * JEV_NANO_PER_TOKEN,
		0,
	);
	const valid = readings.every(
		(result, index) =>
			result.model === JEV_MODEL &&
			result.usage.input_tokens <= JEV_INPUT_BOUND &&
			Object.keys(requests[index].questions).every(
				(key) =>
					result.answers?.[key]?.type === requests[index].questions[key].type,
			),
	);
	try {
		await store.finish(id, actualNano, valid ? readings : undefined);
	} catch {
		return basic("storage", JEV_RESERVE_NANO);
	}
	return valid
		? { kind: "ready", readings, chargedNano: actualNano }
		: basic("contract", actualNano);
}

// Call once for the whole search from composition, including basic/cached/title paths.
// accountId must be the verified identity AT search time; never adopt guest rows at signup.
export async function recordSearchHistory(
	input: Parameters<SearchStore["history"]>[0],
): Promise<{ recorded: boolean }> {
	try {
		await getSearchStore().history(input);
		return { recorded: true };
	} catch {
		return { recorded: false };
	}
}
