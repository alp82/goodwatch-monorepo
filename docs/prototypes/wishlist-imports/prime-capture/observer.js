/*
 * Page-world response observer. Injected only after Start, next to extract.js.
 * It reads copies of same-origin JSON responses that the page itself requested,
 * reduces them to entity fields and pagination evidence, and posts that to the
 * isolated collector. It never sends a request, changes a response or keeps a
 * raw body. Requests made before Start are missed; the collector reports that.
 */
((nonce) => {
	const X = globalThis.__goodwatchPrimeExtract;
	if (!X || typeof nonce !== "string") return;
	const state = (globalThis.__goodwatchPrimeObserver ??= { nonce: null, installed: false });
	state.nonce = nonce;
	if (state.installed) return;
	state.installed = true;
	const MAX_BODY = 8 * 1024 * 1024;
	const LIST_PATH = /watchlist|mystuff|my-stuff|paginat|getlandingpage|getpage|\/api\//i;

	const redactPath = (pathname) =>
		pathname
			.split("/")
			.map((p) => (/^[A-Za-z0-9]{8,40}$/.test(p) && /\d/.test(p) ? "<id>" : p))
			.join("/");

	function report(url, status, text) {
		let parsed;
		try {
			parsed = new URL(url, location.href);
		} catch {
			return;
		}
		if (parsed.origin !== location.origin || !LIST_PATH.test(parsed.pathname)) return;
		const message = { kind: "response", path: redactPath(parsed.pathname), status, collections: [], parsed: false };
		if (typeof text === "string" && text.length <= MAX_BODY) {
			try {
				const json = JSON.parse(text);
				const found = X.findCollections(json, location.href);
				message.parsed = true;
				message.truncated = found.truncated;
				message.shape = X.shape(json);
				message.collections = found.collections;
			} catch {
				message.parsed = false;
			}
		} else {
			message.tooLarge = typeof text === "string";
		}
		window.postMessage({ goodwatchPrime: state.nonce, message }, location.origin);
	}

	const originalFetch = window.fetch;
	if (typeof originalFetch === "function") {
		window.fetch = function (...args) {
			const result = originalFetch.apply(this, args);
			result
				.then((response) => {
					const type = response.headers.get("content-type") || "";
					if (!/json|text\/plain/i.test(type)) return;
					return response
						.clone()
						.text()
						.then((text) => report(response.url, response.status, text));
				})
				.catch(() => {});
			return result;
		};
	}

	const proto = window.XMLHttpRequest?.prototype;
	if (proto) {
		const open = proto.open;
		const send = proto.send;
		proto.open = function (method, url, ...rest) {
			this.__goodwatchPrimeUrl = url;
			return open.call(this, method, url, ...rest);
		};
		proto.send = function (...args) {
			this.addEventListener("load", () => {
				try {
					const type = this.getResponseHeader("content-type") || "";
					if (!/json|text\/plain/i.test(type)) return;
					const text = this.responseType === "" || this.responseType === "text" ? this.responseText : null;
					report(this.responseURL || this.__goodwatchPrimeUrl, this.status, text);
				} catch {}
			});
			return send.apply(this, args);
		};
	}
})(...(globalThis.__goodwatchPrimeObserverArgs || []));
