/*
 * Page-world response observer. Injected only after Start, next to extract.js.
 *
 * Scope: a response is considered only when its request URL is on this page's
 * origin and its path looks like a list (checked before anything is read). It
 * must also be JSON, and is read through a copy with a hard byte cap. Requests
 * and responses stay intact: the wrappers pass every call through unchanged
 * and read only a clone.
 *
 * Lifetime: observation ends on the collector's deactivate message (sent on
 * Stop, Cancel and every automatic end), on page hide, and after 16 minutes.
 * Ending restores the page's own fetch and XMLHttpRequest methods when they
 * are still ours; a wrapper the page kept a reference to passes through.
 */
((nonce) => {
	const X = globalThis.__goodwatchPrimeExtract;
	if (!X || typeof nonce !== "string") return;
	const running = globalThis.__goodwatchPrimeObserver;
	if (running?.active) {
		running.nonce = nonce;
		return;
	}
	const MAX_BODY = 8 * 1024 * 1024;
	const MAX_MESSAGES = 600;
	const LIFETIME = 16 * 60 * 1000;
	const LIST_PATH = /watchlist|mystuff|my-stuff|paginat|getlandingpage|getpage|\/api\//i;
	const state = { nonce, active: true, sent: 0 };
	globalThis.__goodwatchPrimeObserver = state;

	const listUrl = (raw) => {
		try {
			const u = new URL(raw, location.href);
			return u.origin === location.origin && LIST_PATH.test(u.pathname) ? u : null;
		} catch {
			return null;
		}
	};
	const isJson = (type) => /^application\/(?:[\w.+-]*\+)?json\b|^text\/json\b/i.test(type || "");

	function post(message) {
		if (!state.active || state.sent >= MAX_MESSAGES) return;
		state.sent++;
		window.postMessage({ goodwatchPrime: state.nonce, message }, location.origin);
	}

	function reduce(url, status, text, tooLarge) {
		const message = {
			kind: "response",
			path: X.redactPath(url.pathname),
			status: Number.isSafeInteger(status) ? status : null,
			requestKeys: X.requestKeys(url.href, location.href),
			parsed: false,
			tooLarge: Boolean(tooLarge),
			collections: [],
		};
		if (!tooLarge && typeof text === "string") {
			try {
				const json = JSON.parse(text);
				const found = X.findCollections(json, location.href);
				message.parsed = true;
				message.truncated = found.truncated;
				message.collections = found.collections.slice(0, 50);
				message.shape = X.shape(json);
				message.profiles = X.profileMarkers(json);
				message.filters = X.filterEvidence(json);
			} catch {}
		}
		post(message);
	}

	/** Reads a clone of the body, stopping at MAX_BODY bytes. */
	async function readBounded(response) {
		const declared = Number(response.headers.get("content-length"));
		if (Number.isFinite(declared) && declared > MAX_BODY) return { tooLarge: true };
		const body = response.clone().body;
		if (!body || typeof body.getReader !== "function") return { tooLarge: false, text: null };
		const reader = body.getReader();
		const chunks = [];
		let total = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_BODY || !state.active) {
				await reader.cancel().catch(() => {});
				return { tooLarge: total > MAX_BODY };
			}
			chunks.push(value);
		}
		const bytes = new Uint8Array(total);
		let at = 0;
		for (const c of chunks) {
			bytes.set(c, at);
			at += c.byteLength;
		}
		return { tooLarge: false, text: new TextDecoder("utf-8").decode(bytes) };
	}

	const originalFetch = window.fetch;
	const wrappedFetch = function (input, init) {
		const result = originalFetch.apply(this, arguments);
		if (!state.active) return result;
		let raw;
		try {
			raw = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input?.href ?? input);
		} catch {
			return result;
		}
		const url = listUrl(raw);
		if (!url) return result;
		Promise.resolve(result)
			.then(async (response) => {
				if (!state.active || !response || (response.url && !listUrl(response.url))) return;
				if (!isJson(response.headers.get("content-type"))) return;
				const read = await readBounded(response);
				if (state.active) reduce(url, response.status, read.text, read.tooLarge);
			})
			.catch(() => {});
		return result;
	};
	if (typeof originalFetch === "function") window.fetch = wrappedFetch;

	const proto = window.XMLHttpRequest?.prototype;
	const originalOpen = proto?.open;
	const originalSend = proto?.send;
	const wrappedOpen = function (method, url, ...rest) {
		this.__goodwatchPrimeUrl = state.active ? listUrl(url) : null;
		return originalOpen.call(this, method, url, ...rest);
	};
	const wrappedSend = function (...args) {
		const url = this.__goodwatchPrimeUrl;
		if (state.active && url) {
			this.addEventListener(
				"load",
				() => {
					try {
						if (!state.active || (this.responseURL && !listUrl(this.responseURL))) return;
						if (!isJson(this.getResponseHeader("content-type"))) return;
						if (this.responseType !== "" && this.responseType !== "text") return;
						// The browser already holds this text for the page; only its length
						// is checked before parsing.
						const text = this.responseText;
						reduce(url, this.status, text.length > MAX_BODY ? null : text, text.length > MAX_BODY);
					} catch {}
				},
				{ once: true },
			);
		}
		return originalSend.apply(this, args);
	};
	if (proto && originalOpen && originalSend) {
		proto.open = wrappedOpen;
		proto.send = wrappedSend;
	}

	function deactivate() {
		if (!state.active) return;
		state.active = false;
		if (window.fetch === wrappedFetch) window.fetch = originalFetch;
		if (proto?.open === wrappedOpen) proto.open = originalOpen;
		if (proto?.send === wrappedSend) proto.send = originalSend;
		window.removeEventListener("message", onControl);
		window.removeEventListener("pagehide", deactivate);
		clearTimeout(timer);
	}
	function onControl(event) {
		if (event.origin !== location.origin || !event.data || event.data.goodwatchPrimeControl !== state.nonce) return;
		if (event.data.action === "deactivate") deactivate();
	}
	window.addEventListener("message", onControl);
	window.addEventListener("pagehide", deactivate);
	const timer = setTimeout(deactivate, LIFETIME);
	state.deactivate = deactivate;
})(...(globalThis.__goodwatchPrimeObserverArgs || []));
