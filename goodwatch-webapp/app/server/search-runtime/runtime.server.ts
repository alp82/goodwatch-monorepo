import { attributedSearch, type SearchContext } from "../../domain/search-attribution.ts";
import { recordSearchHistoryWrite } from "./telemetry.server";
import { runsSearch } from "../role.server";
import { Agent, fetch } from "undici";
import { onShutdown } from "../lifecycle.server";
import {
	APIError,
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
// The most a reading can cost: both requests at the input bound (5,505,024 nano). Readings reserve less (jevReserveNano).
export const JEV_RESERVE_NANO = 2 * JEV_INPUT_BOUND * JEV_NANO_PER_TOKEN;
// What the model adds around a request (instructions, separators), in tokens, beyond one token per byte of the
// request. The fingerprint request's fixed part is about 330 tokens including its state
// (docs/prototypes/search-arena/results/baseline-cost-latency.md).
export const JEV_TEMPLATE_TOKENS = 1024;
/**
 * The estimate a reading reserves: per request, its serialized UTF-8 bytes plus JEV_TEMPLATE_TOKENS, at most the input
 * bound. A tokenizer makes at most one token per byte of text it reads; measured readings use 3.6 (attribute) to 4.4
 * (fingerprint) bytes per token, so whatever the model adds per question has a margin of more than three times. A
 * reading that still costs more halts paid readings in finish, as before. A typical search's requests are about
 * 12,400 + 19,600 bytes: 34,000 tokens, 1.43M nano, against 8,000 real tokens (339k nano) and the old fixed 5.5M.
 */
export function jevReserveNano(requests: readonly SystemOneRequest[]): number {
	return (
		requests.reduce(
			(tokens, request) =>
				tokens +
				Math.min(
					JEV_INPUT_BOUND,
					Buffer.byteLength(JSON.stringify(request), "utf8") + JEV_TEMPLATE_TOKENS,
				),
			0,
		) * JEV_NANO_PER_TOKEN
	);
}
// A reading whose estimate was never settled (the provider failed or timed out, the settlement write failed, or the
// process died) counts at most this much once STALE_ESTIMATE_MS have passed: 2 × 5,120 tokens, a full reading of the
// longest search (12 content words, about 9,000 tokens; a typical one is 8,000).
export const JEV_EXPIRED_NANO = 2 * 5_120 * JEV_NANO_PER_TOKEN;
export const BASIC_SEARCH_MESSAGE = "Showing basic search results.";
// HTTP 529: TypeSafe is overloaded and asks callers to retry after a short delay. A request that gets a 529 is sent
// again after each of these delays, inside the same deadline, claim and spending estimate.
export const JEV_OVERLOAD_RETRY_DELAYS_MS = [100, 250];
// A retry starts only while this much of the deadline is left, enough for a normal reading. Later, it falls back.
export const JEV_RETRY_MIN_REMAINING_MS = 700;

// The connections to TypeSafe stay open between searches. undici's default pool closes a connection after 4 s idle,
// so most searches paid a new TCP and TLS handshake. api.typesafe.ai (behind Cloudflare) keeps idle connections for
// minutes, and a free GET /health a minute keeps both connections of a search's two parallel requests open.
const TYPESAFE_ORIGIN = "https://api.typesafe.ai";
const KEEP_WARM_EVERY_MS = 60_000;
const typesafeAgent = new Agent({
	keepAliveTimeout: 5 * 60_000,
	keepAliveMaxTimeout: 10 * 60_000,
});
const typesafeFetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
	fetch(input, { ...init, dispatcher: typesafeAgent })) as typeof fetch;
let keepWarm: NodeJS.Timeout | undefined;

/** Starts the pings that keep the TypeSafe connections open. No model calls, nothing billed. Once per process. */
export function keepJevConnectionsWarm(): void {
	if (!runsSearch()) return;
	if (keepWarm || !process.env.TYPESAFE_API_KEY) return;
	const ping = () =>
		typesafeFetch(`${TYPESAFE_ORIGIN}/health`, {
			signal: AbortSignal.timeout(5000),
		}).then(
			(response) => response.body?.cancel(),
			() => {},
		);
	const both = () => Promise.all([ping(), ping()]).catch(() => {});
	both();
	keepWarm = setInterval(both, KEEP_WARM_EVERY_MS);
	keepWarm.unref();
	onShutdown("search connection pings", () => clearInterval(keepWarm));
}

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

let lastFinishWarning = -Infinity;
// Settlements still running after their readings were returned. A shutdown waits for them, as it waits for requests.
const settling = new Set<Promise<void>>();
onShutdown("search settlement", () => Promise.allSettled([...settling]));
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
	// accountId may still be resolving (the route verifies the session while the search starts). It is awaited only
	// where it is needed, before admission; a rejection means the search must not make a paid call.
	visitor: {
		attribution?: SearchContext;
		accountId: string | null | Promise<string | null>;
		networkIdentity: string;
		/** Trusted integrations may meter fresh readings. Cache hits never call this. */
		beforeUncachedReading?: () => Promise<void>;
		/** Discord permits only the website's Jev reading, with no translation model call. */
		allowTranslation?: boolean;
	};
	signal?: AbortSignal;
	admissionAttemptId?: string;
	// Called once after a fresh reading is claimed and the abort check passes, just before the paid call starts.
	// Cached readings and basic outcomes before the claim do not call it.
	onClaimed?: () => void;
	// Filled with milliseconds per step, for the history row: lookup (the cache), claim (spending checks and the
	// attempt), dispatch, call (both Jev requests), finish (scheduling settlement on success; awaited otherwise).
	timings?: Record<string, number>;
}

export async function runJevStage(input: JevStageInput): Promise<JevOutcome> {
	let store: SearchStore;
	try {
		store = getSearchStore();
	} catch {
		return basic("configuration");
	}
	expireStaleEstimatesSoon(store);
	return executeJevStage(store, input);
}

// At most once per interval per process, detached: estimates without a settlement stop counting at full size.
const EXPIRY_EVERY_MS = 5 * 60_000;
let lastExpiry = -Infinity;
function expireStaleEstimatesSoon(store: SearchStore) {
	const now = performance.now();
	if (now - lastExpiry < EXPIRY_EVERY_MS) return;
	lastExpiry = now;
	store.expireStaleEstimates(expiredCost).catch(() => {});
}
/** What an estimate that never got a settlement counts once stale: a Jev reading at most JEV_EXPIRED_NANO. */
export function expiredCost(row: { price_version: string | null; amount_nano: number }): number {
	return row.price_version === JEV_PRICE_VERSION
		? Math.min(row.amount_nano, JEV_EXPIRED_NANO)
		: row.amount_nano;
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
	let mark = performance.now();
	const step = (name: string) => {
		const now = performance.now();
		if (input.timings) input.timings[name] = Math.round((now - mark) * 10) / 10;
		mark = now;
	};
	// Copy only known fields: callers cannot sneak an alternate model or transport options in.
	let requests: [SystemOneRequest, SystemOneRequest];
	let cacheKey: string;
	let reserve: number;
	let checks: ReturnType<SearchStore["claimChecks"]> | undefined;
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
		reserve = jevReserveNano(requests);
		cacheKey = store.digest(
			canonical({
				contract,
				language: input.language,
				requests,
				text: input.requestText.trim().normalize("NFC"),
			}),
		);
		// After a Redis miss, the claim's reads overlap the Crate lookup. A hit never reaches admission or either insert.
		const hit = await store.lookup(cacheKey, () => {
			checks = store.claimChecks(input.timings);
			checks.catch(() => {}); // A cache hit discards even failed checks.
		});
		step("lookup");
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
	const accountStarted = performance.now();
	// This overlaps the spending reads. claimScopes records only the residual await after those reads.
	const scopes = Promise.resolve(input.visitor.accountId)
		.then((accountId) => [
			"global",
			store.digest(`network:${input.visitor.networkIdentity}`),
			...(accountId ? [store.digest(`account:${accountId}`)] : []),
		])
		.finally(() => {
			if (input.timings)
				input.timings.claimAccount = Math.round((performance.now() - accountStarted) * 10) / 10;
		});
	// A rejected session may resolve before claim reaches its residual scopes await.
	scopes.catch(() => {});
	try {
		claim = await store.claim({
			checks,
			attribution: () => Promise.resolve(input.visitor.accountId).then(accountId => attributedSearch(input.visitor.attribution, accountId)),
			cacheKey,
			contract,
			// The account scope waits for the session check; the spending checks don't.
			scopes,
			timings: input.timings,
			reserveNano: reserve,
			priceVersion: JEV_PRICE_VERSION,
			admissionAttemptId: input.admissionAttemptId,
		});
	} catch {
		return basic("storage");
	} finally {
		step("claim");
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
		await input.visitor.beforeUncachedReading?.();
	} catch (error) {
		await store.finish(id, 0).catch(() => {});
		throw error;
	}
	if (input.signal?.aborted) {
		await store.finish(id, 0).catch(() => {});
		return basic("cancelled");
	}
	try {
		input.onClaimed?.();
	} catch {
		// Preparing for the reading must not break the stage.
	}
	try {
		await store.dispatch(id, cacheKey);
	} catch {
		return basic("storage", reserve);
	}
	step("dispatch");
	const controller = new AbortController();
	const deadlineAt = Date.now() + JEV_DEADLINE_MS;
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
		fetch: typesafeFetch as unknown as typeof globalThis.fetch,
		apiKey,
		baseURL: TYPESAFE_ORIGIN,
		defaultModel: JEV_MODEL,
		timeout: JEV_DEADLINE_MS,
		retry: { maxRetries: 0 },
		logLevel: "off",
	});
	let readings: [Reading, Reading] | undefined;
	// Rejected attempts per request. Retries run under the claim and estimate above: no new claim, no second estimate.
	const overloaded = [0, 0];
	const read = async (request: SystemOneRequest, index: number) => {
		for (let attempt = 0; ; attempt++) {
			try {
				return await client.systemOne(request, {
					signal: controller.signal,
					timeout: JEV_DEADLINE_MS,
					retry: { maxRetries: 0 },
				});
			} catch (error) {
				const delay = JEV_OVERLOAD_RETRY_DELAYS_MS[attempt];
				if (
					!(error instanceof APIError && error.status === 529) ||
					delay === undefined ||
					deadlineAt - Date.now() - delay < JEV_RETRY_MIN_REMAINING_MS ||
					controller.signal.aborted
				)
					throw error;
				overloaded[index]++;
				await new Promise((resolve) => setTimeout(resolve, delay));
				if (controller.signal.aborted) throw error;
			}
		}
	};
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
			Promise.all(requests.map(read)),
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
			reserve,
		);
	} finally {
		clearTimeout(timer);
		input.signal?.removeEventListener("abort", cancelled);
	}
	step("call");
	const validUsage = readings.every(
		(result) =>
			Number.isSafeInteger(result?.usage?.input_tokens) &&
			result.usage.input_tokens >= 0,
	);
	if (!validUsage) {
		await store.finish(id, null).catch(() => {});
		return basic("contract", reserve);
	}
	if (readings.some((result) => result.usage.input_tokens > JEV_INPUT_BOUND)) {
		await store.haltPaidAdmissions().catch(() => {});
	}
	// Never infer zero usage from an error: each rejected 529 attempt counts as if it was billed like the identical
	// request that succeeded. Capped at the estimate, which covers both requests' bytes: above it, the estimate stays
	// the recorded spend, as when a response is lost.
	const actualNano = Math.min(
		readings.reduce(
			(sum, result, index) =>
				sum +
				result.usage.input_tokens * JEV_NANO_PER_TOKEN * (1 + overloaded[index]),
			0,
		),
		overloaded.some(Boolean) ? reserve : Number.POSITIVE_INFINITY,
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
	if (valid) {
		// Keep the estimate until durable settlement succeeds. Valid paid readings remain useful even if storage
		// fails; a detached failure must neither reject the search nor expose request/identity data in logs.
		// The cache and the settlement get their own copy: the search goes on to read the returned objects.
		const stored = structuredClone(readings);
		try {
			await store.prime(cacheKey, stored);
		} catch {
			// finish caches the reading too.
		}
		const settlement: Promise<void> = Promise.resolve()
			.then(() => store.finish(id, actualNano, stored))
			.catch(() => {
				try {
					const now = performance.now();
					if (now - lastFinishWarning >= 60_000) {
						lastFinishWarning = now;
						// The attempt id is random: it finds the attempt to reconcile without naming the visitor.
						console.warn("Search settlement unavailable", { reason: "storage", attempt: id });
					}
				} catch { /* Logging cannot reject detached work. */ }
			})
			.finally(() => settling.delete(settlement));
		settling.add(settlement);
		step("finish");
		return { kind: "ready", readings, chargedNano: actualNano };
	}
	try {
		await store.finish(id, actualNano);
	} catch {
		return basic("storage", reserve);
	}
	step("finish");
	return basic("contract", actualNano);
}

// Call once for the whole search from composition, including basic/cached/title paths.
// accountId must be the verified identity AT search time; never adopt guest rows at signup.
export async function recordSearchHistory(
	input: Parameters<SearchStore["history"]>[0],
): Promise<{ recorded: boolean; id: string | null }> {
	let result: { recorded: boolean; id: string | null };
	try {
		const id = await getSearchStore().history(input);
		result = { recorded: true, id };
	} catch {
		result = { recorded: false, id: null };
	}
	try {
		recordSearchHistoryWrite(result.recorded);
	} catch {
		// Logging cannot change whether history was stored or reject the detached caller.
	}
	return result;
}
