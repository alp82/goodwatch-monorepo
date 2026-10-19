/*
 * Experimental Prime Video Watchlist collector (isolated world).
 *
 * Two independent membership channels:
 *  - structured: Watchlist collections in the page's inert hydration scripts,
 *    plus copies of the page's own list responses posted by observer.js;
 *  - visible: continuous accumulation of title cards in the Watchlist grid.
 * The file is "complete" only when both channels agree exactly and the
 * structured chain shows an explicit end. Everything else is partial/unknown.
 */
(() => {
	if (globalThis.__goodwatchPrimeCommand) return;
	const X = globalThis.__goodwatchPrimeExtract;
	const VERSION = "0.1.0";
	const MAX_ITEMS = 5000;
	const MAX_TIME = 15 * 60 * 1000;
	const CARD_LINK = 'a[href*="/detail/"]';
	const CARD_ROOT = '[data-card-title], [data-testid="card"], article, li';
	const GROUP = 'ul, ol, [role="list"], [role="grid"], [role="rowgroup"], section';
	const OUTSIDE = 'header, nav, footer, [role="dialog"], [aria-modal="true"], [role="banner"], [role="navigation"]';
	const PROFILE = '[data-testid*="profile" i], [aria-label*="profile" i], [aria-label*="profil" i]';

	let s = fresh();

	function fresh() {
		return {
			state: "idle",
			code: "idle",
			nonce: null,
			origin: "",
			lang: "",
			filter: "",
			pathPattern: "",
			started: 0,
			stoppedAt: 0,
			observer: null,
			interval: null,
			listener: null,
			marker: null,
			markerSource: "none",
			entries: new Map(), // key -> entry
			aliases: new Map(), // gti -> key
			quarantined: new Set(),
			structuredKeys: new Set(),
			domKeys: new Set(),
			domSightings: 0,
			structuredSightings: 0,
			domRejected: new Map(),
			titleDisagreements: 0,
			typeDisagreements: 0,
			sameTitleDistinctIds: 0,
			liveExcluded: 0,
			primary: null,
			groups: new Map(), // signature -> { cards: Set(token), primary }
			seenScripts: new WeakSet(),
			scripts: [],
			pages: [], // structured Watchlist pages
			otherCollections: [],
			cursors: new Set(),
			pageSignatures: new Set(),
			duplicatePages: 0,
			cursorRepeats: 0,
			responses: [],
			unparsedListResponses: 0,
			filterChanged: false,
			truncated: false,
			cardAttributes: new Set(),
		};
	}

	const isWatchlist = () =>
		/(^|\.)(primevideo\.com|amazon\.[a-z.]{2,12})$/.test(location.hostname) && /\/watchlist(\/|$)/i.test(location.pathname);

	function redact(pathname) {
		return pathname
			.split("/")
			.map((p) => (/^[A-Za-z0-9]{8,40}$/.test(p) && /\d/.test(p) ? "<id>" : p))
			.join("/");
	}

	function filterKey() {
		const after = location.pathname.replace(/^.*?\/watchlist/i, "").replace(/\/$/, "");
		const params = [...new URLSearchParams(location.search)]
			.filter(([k]) => /filter|type|sort|view|offer|category/i.test(k))
			.map(([k, v]) => `${k}=${v.slice(0, 40)}`)
			.sort();
		return redact(after) + (params.length ? `?${params.join("&")}` : "");
	}

	function domMarker() {
		const nodes = [...document.querySelectorAll(PROFILE)].filter((n) => n.closest(OUTSIDE));
		if (!nodes.length) return null;
		const n = nodes[0];
		const img = n.querySelector("img");
		return X.hash(`d:${n.getAttribute("aria-label") || ""}|${img?.getAttribute("alt") || ""}|${img?.getAttribute("src") || ""}`);
	}

	function currentMarker() {
		return s.markerSource === "dom" ? domMarker() : s.marker;
	}

	function bump(map, code) {
		map.set(code, (map.get(code) || 0) + 1);
	}

	function keyFor(e) {
		if (e.token) return e.token;
		if (e.gti && s.aliases.has(e.gti)) return s.aliases.get(e.gti);
		return e.gti ? `gti:${e.gti}` : null;
	}

	function quarantine(key) {
		s.quarantined.add(key);
		s.entries.delete(key);
		s.structuredKeys.delete(key);
		s.domKeys.delete(key);
	}

	function upsert(e, channel) {
		if (e.hasLive) {
			s.liveExcluded++;
			return;
		}
		let key = keyFor(e);
		if (!key || s.quarantined.has(key)) return;
		// A structured entity can name the GTI of an earlier link-less one.
		if (e.gti && e.token && s.entries.has(`gti:${e.gti}`) && !s.entries.has(e.token)) {
			const moved = s.entries.get(`gti:${e.gti}`);
			s.entries.delete(`gti:${e.gti}`);
			s.entries.set(e.token, moved);
			for (const set of [s.structuredKeys, s.domKeys]) if (set.delete(`gti:${e.gti}`)) set.add(e.token);
		}
		if (e.gti) s.aliases.set(e.gti, key);
		let entry = s.entries.get(key);
		if (!entry) {
			if (s.entries.size >= MAX_ITEMS) return terminate("limit_items", false);
			entry = { key, gti: null, url: null, title: null, domTitle: null, mediaType: "unknown", season: false, year: undefined };
			s.entries.set(key, entry);
		}
		if (e.gti && entry.gti && entry.gti !== e.gti) return quarantine(key);
		entry.gti ||= e.gti;
		entry.url ||= e.url;
		if (channel === "dom") {
			if (entry.domTitle && entry.domTitle !== e.title) return quarantine(key);
			entry.domTitle = e.title;
			s.domKeys.add(key);
		} else {
			if (entry.title && entry.title !== e.title) return quarantine(key);
			entry.title = e.title;
			if (e.mediaType !== "unknown") {
				if (entry.mediaType !== "unknown" && entry.mediaType !== e.mediaType) s.typeDisagreements++;
				entry.mediaType = e.mediaType;
			}
			entry.season ||= e.season;
			entry.parentKnown ||= e.parentKnown;
			s.structuredSightings++;
			if (e.year) entry.year = e.year;
			s.structuredKeys.add(key);
		}
		if (entry.title && entry.domTitle && entry.title !== entry.domTitle && !entry.countedDisagreement) {
			entry.countedDisagreement = true;
			s.titleDisagreements++;
		}
	}

	function acceptCollections(collections, origin, path) {
		for (const c of collections) {
			if (c.classification !== "watchlist") {
				s.otherCollections.push({
					origin,
					path: c.path,
					classification: c.classification,
					count: c.items.length,
					objects: c.objects,
					paginationKeys: c.pagination.keys,
					tokens: new Set(c.items.map((i) => i.token).filter(Boolean)),
				});
				continue;
			}
			const p = c.pagination;
			// The same page can be embedded in more than one hydration script.
			const sig = X.hash(JSON.stringify([p.cursor, c.items.map((i) => i.token || i.gti)]));
			if (origin === "state" && s.pageSignatures.has(sig)) {
				s.duplicatePages++;
				continue;
			}
			s.pageSignatures.add(sig);
			if (p.cursor) {
				if (s.cursors.has(p.cursor)) s.cursorRepeats++;
				s.cursors.add(p.cursor);
			}
			s.pages.push({
				origin,
				source: path,
				path: c.path,
				count: c.items.length,
				terminal: p.terminal,
				totalItems: p.totalItems,
				nextIndex: p.nextIndex,
				paginationKeys: p.keys,
				at: Date.now() - s.started,
			});
			for (const e of c.items) upsert(e, "structured");
		}
	}

	function readScripts() {
		for (const el of document.querySelectorAll('script[type="text/template"], script[type="application/json"]')) {
			if (s.seenScripts.has(el)) continue;
			s.seenScripts.add(el);
			const holder = document.createElement("div");
			holder.appendChild(el.cloneNode(true));
			const [doc] = X.parseScripts(holder);
			if (!doc) continue;
			s.scripts.push({ type: doc.type, id: doc.id, size: doc.size, parsed: doc.json !== null, shape: doc.json ? X.shape(doc.json) : null });
			if (!doc.json) continue;
			if (s.state === "idle" && !s.marker) {
				const m = X.profileMarker(doc.json);
				if (m) {
					s.marker = m;
					s.markerSource = "state";
				}
			}
			const found = X.findCollections(doc.json, location.href);
			s.truncated ||= found.truncated;
			acceptCollections(found.collections, "state", `script:${doc.type}`);
		}
	}

	function signature(group) {
		if (!group) return "document";
		const classes = [...group.classList].slice(0, 3).join(".");
		return [group.tagName.toLowerCase(), group.getAttribute("role") || "", group.getAttribute("data-testid") || "", group.getAttribute("aria-label") || "", classes].join("|");
	}

	function readCards() {
		const seen = new Map(); // signature -> tokens in this pass
		for (const a of document.querySelectorAll(CARD_LINK)) {
			if (a.closest(OUTSIDE)) continue;
			const root = a.closest(CARD_ROOT) || a;
			const group = root.parentElement?.closest(GROUP) || null;
			const sig = signature(group);
			const link = X.detailLink(a.getAttribute("href"), location.href);
			if (!link) {
				bump(s.domRejected, "card_invalid_link");
				continue;
			}
			for (const attr of root.getAttributeNames()) if (attr.startsWith("data-")) s.cardAttributes.add(attr);
			if (!seen.has(sig)) seen.set(sig, []);
			seen.get(sig).push({ a, root, link });
		}
		if (!s.primary && seen.size) {
			// Prefer the group that shares the most cards with structured Watchlist
			// pages; a recommendation row can hold more cards than the grid.
			// Without overlap, take the first group in document order (the grid
			// under the page heading) and report the choice as a guess.
			const overlap = (sig) => seen.get(sig).filter((c) => s.structuredKeys.has(c.link.token)).length;
			const order = [...seen.keys()];
			s.primary = order.reduce((best, sig) => (overlap(sig) > overlap(best) ? sig : best), order[0]);
			s.primaryBy = overlap(s.primary) ? "structured_overlap" : order.length > 1 ? "first_of_several_guess" : "only_group";
		}
		for (const [sig, cards] of seen) {
			if (!s.groups.has(sig)) s.groups.set(sig, { tokens: new Set() });
			const g = s.groups.get(sig);
			for (const c of cards) g.tokens.add(c.link.token);
			if (sig !== s.primary) continue;
			for (const { a, root, link } of cards) {
				s.domSightings++;
				const title = (root.getAttribute("data-card-title") || a.getAttribute("aria-label") || root.querySelector("img[alt]")?.getAttribute("alt") || a.textContent || "").trim().replace(/\s+/g, " ");
				if (!X.isText(title)) {
					bump(s.domRejected, "card_missing_title");
					continue;
				}
				const type = X.mediaType(root.getAttribute("data-card-entity-type") || undefined);
				upsert({ gti: null, token: link.token, url: link.url, title, mediaType: type.mediaType, season: type.season, hasLive: false }, "dom");
				if (s.state !== "capturing") return;
			}
		}
	}

	function onMessage(event) {
		// Only this origin, only with the per-capture nonce. A frame or the page
		// itself can still forge messages; see README, "What it trusts".
		if (event.origin !== location.origin || !event.data || event.data.goodwatchPrime !== s.nonce || s.state !== "capturing") return;
		const m = event.data.message;
		if (!m || m.kind !== "response" || !Array.isArray(m.collections)) return;
		const watch = m.collections.filter((c) => c && c.classification === "watchlist");
		s.responses.push({ path: String(m.path).slice(0, 200), status: m.status, parsed: Boolean(m.parsed), collections: m.collections.length, watchlist: watch.length, tooLarge: Boolean(m.tooLarge), shape: m.shape ?? null });
		if (!m.parsed && /watchlist/i.test(String(m.path))) s.unparsedListResponses++;
		if (m.parsed && /watchlist/i.test(String(m.path)) && !m.collections.length) s.unparsedListResponses++;
		const clean = m.collections.filter((c) => c && Array.isArray(c.items) && c.pagination).map((c) => ({
			...c,
			items: c.items.filter((i) => i && X.isText(i.title) && (typeof i.gti === "string" ? X.GTI.test(i.gti) : true)),
		}));
		acceptCollections(clean, "response", String(m.path).slice(0, 200));
		scan();
	}

	function disconnect() {
		s.observer?.disconnect();
		s.observer = null;
		if (s.interval !== null) clearInterval(s.interval);
		s.interval = null;
		if (s.listener) window.removeEventListener("message", s.listener);
		s.listener = null;
	}

	function terminate(code, discard) {
		disconnect();
		s.state = "terminated";
		s.code = code;
		s.stoppedAt = Date.now();
		if (discard) {
			s.entries.clear();
			s.structuredKeys.clear();
			s.domKeys.clear();
			s.discarded = true;
		}
	}

	function scan() {
		if (s.state !== "capturing") return;
		if (location.origin !== s.origin || !isWatchlist()) return terminate("terminated_navigation", false);
		if (s.markerSource !== "none" && currentMarker() !== s.marker) return terminate("terminated_profile", true);
		if (filterKey() !== s.filter) s.filterChanged = true;
		if (Date.now() - s.started >= MAX_TIME) return terminate("limit_time", false);
		readScripts();
		if (s.state === "capturing") readCards();
	}

	/** The in-extension gate. Reasons are codes; no titles or IDs. */
	function evaluate() {
		const partial = [];
		const unknown = [];
		if (s.state === "terminated") partial.push(s.code);
		if (!s.pages.length) unknown.push("no_structured_watchlist");
		const last = s.pages[s.pages.length - 1];
		if (s.pages.length) {
			if (s.pages.some((p) => p.terminal === true)) {
				if (last.terminal === false) partial.push("continuation_after_end");
			} else if (last.terminal === false) partial.push("continuation_pending");
			else unknown.push("no_terminal_evidence");
		}
		if (s.cursorRepeats) partial.push("cursor_repeated");
		const totals = [...new Set(s.pages.map((p) => p.totalItems).filter((t) => t !== null))];
		if (totals.length > 1) partial.push("total_changed");
		if (totals.length === 1 && totals[0] !== s.structuredKeys.size) partial.push("total_mismatch");
		const domOnly = [...s.domKeys].filter((k) => !s.structuredKeys.has(k)).length;
		const structuredOnly = [...s.structuredKeys].filter((k) => !s.domKeys.has(k)).length;
		if (s.pages.length && domOnly) partial.push("visible_not_in_structured");
		if (structuredOnly) partial.push("structured_not_seen_visible");
		if (!s.domKeys.size) unknown.push("no_visible_cards");
		if (s.primaryBy === "first_of_several_guess") unknown.push("visible_group_guessed");
		if (s.quarantined.size) partial.push("conflicting_identity");
		if (s.unparsedListResponses) unknown.push("unknown_response_schema");
		if (s.filterChanged) partial.push("filter_changed");
		if (s.filter !== "") unknown.push("filtered_view");
		if (s.truncated) partial.push("state_truncated");
		if (s.markerSource === "none") unknown.push("profile_unconfirmed");
		const completeness = partial.length ? "partial" : unknown.length ? "unknown" : "complete";
		return { completeness, partial, unknown, domOnly, structuredOnly, totals };
	}

	function items() {
		const out = [];
		for (const e of s.entries.values()) {
			if (s.quarantined.has(e.key)) continue;
			const title = e.title || e.domTitle;
			if (!X.isText(title)) continue;
			out.push({
				title,
				mediaType: e.mediaType,
				...(e.year ? { year: e.year } : {}),
				sourceId: e.gti || e.key,
				...(e.url ? { sourceUrl: e.url } : {}),
			});
		}
		return out;
	}

	function report(gate) {
		const list = [...s.entries.values()];
		const titles = new Map();
		for (const e of list) {
			const t = (e.title || e.domTitle || "").toLowerCase();
			titles.set(t, (titles.get(t) || 0) + 1);
		}
		const domTokens = new Set([...s.domKeys]);
		return {
			format: "goodwatch-prime-capture-report",
			collectorVersion: VERSION,
			note: "Counts and field names only. No titles, IDs, cursors or profile values.",
			browser: (navigator.userAgent.match(/(Chrome|Edg|Firefox)\/(\d+)/) || []).slice(1).join(" "),
			host: s.origin.replace(/^https:\/\//, ""),
			lang: s.lang,
			pathPattern: s.pathPattern,
			filter: s.filter,
			filterChanged: s.filterChanged,
			elapsedSeconds: Math.round(((s.stoppedAt || Date.now()) - s.started) / 1000),
			stop: s.code,
			profileGuard: s.markerSource,
			completeness: gate.completeness,
			partialReasons: gate.partial,
			unknownReasons: gate.unknown,
			counts: {
				fileItems: items().length,
				structuredUnique: s.structuredKeys.size,
				visibleUnique: s.domKeys.size,
				inBoth: [...s.domKeys].filter((k) => s.structuredKeys.has(k)).length,
				visibleOnly: gate.domOnly,
				structuredOnly: gate.structuredOnly,
				visibleSightings: s.domSightings,
				quarantined: s.quarantined.size,
				titleDisagreements: s.titleDisagreements,
				typeDisagreements: s.typeDisagreements,
				sameTitleDistinctIds: [...titles.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
				liveExcluded: s.liveExcluded,
				withGti: list.filter((e) => e.gti).length,
				withDetailToken: list.filter((e) => !e.key.startsWith("gti:")).length,
				tokenAsinLike: list.filter((e) => /^B0[A-Z0-9]{8}$/.test(e.key)).length,
				movies: list.filter((e) => e.mediaType === "movie").length,
				shows: list.filter((e) => e.mediaType === "show" && !e.season).length,
				seasons: list.filter((e) => e.season).length,
				seasonsWithParent: list.filter((e) => e.season && e.parentKnown).length,
				structuredSightings: s.structuredSightings,
				withoutDetailLink: list.filter((e) => !e.url).length,
				unknownType: list.filter((e) => e.mediaType === "unknown").length,
				withYear: list.filter((e) => e.year).length,
				rejectedCards: Object.fromEntries(s.domRejected),
			},
			pagination: {
				pages: s.pages.map(({ origin, path, count, terminal, totalItems, nextIndex, paginationKeys, at }) => ({ origin, path, count, terminal, totalItems, nextIndex, paginationKeys, atSeconds: Math.round(at / 1000) })),
				reportedTotals: gate.totals,
				distinctCursors: s.cursors.size,
				duplicateStatePages: s.duplicatePages,
				cursorRepeats: s.cursorRepeats,
			},
			responses: s.responses.slice(0, 200),
			otherCollections: s.otherCollections.slice(0, 200).map(({ tokens, ...c }) => ({
				...c,
				overlapWithVisible: [...tokens].filter((t) => domTokens.has(t)).length,
			})),
			primaryGroupChosenBy: s.primaryBy || null,
			cardGroups: [...s.groups].map(([sig, g]) => ({ signature: sig, primary: sig === s.primary, cards: g.tokens.size })),
			cardAttributes: [...s.cardAttributes].sort(),
			scripts: s.scripts.slice(0, 50),
		};
	}

	const KEEP = new Set(["capturing", "stopped", "terminated"]);

	function result(withReport) {
		const gate = evaluate();
		const keep = KEEP.has(s.state) && !s.discarded;
		return {
			state: s.state,
			code: s.code,
			version: VERSION,
			profileGuard: s.markerSource,
			counts: {
				items: keep ? items().length : 0,
				structured: s.structuredKeys.size,
				visible: s.domKeys.size,
				inBoth: [...s.domKeys].filter((k) => s.structuredKeys.has(k)).length,
				pages: s.pages.length,
			},
			completeness: gate.completeness,
			reasons: [...gate.partial, ...gate.unknown],
			...(keep
				? {
						envelope: {
							format: "goodwatch-wishlist",
							version: 1,
							source: "prime-video",
							exportedAt: new Date().toISOString(),
							completeness: gate.completeness,
							items: items(),
						},
					}
				: {}),
			...(withReport && s.state !== "idle" ? { report: report(gate) } : {}),
		};
	}

	globalThis.__goodwatchPrimeCommand = (command) => {
		const action = command?.action;
		if (!["start", "status", "stop", "cancel"].includes(action)) return { ...result(false), code: "invalid_command" };
		if (action === "start") {
			if (s.state === "capturing") {
				// Start re-injects observer.js, which adopts the new nonce.
				if (typeof command.nonce === "string") s.nonce = command.nonce;
				scan();
				return result(false);
			}
			disconnect();
			s = fresh();
			if (!isWatchlist()) return { ...result(false), code: "wrong_page" };
			s.nonce = typeof command.nonce === "string" ? command.nonce : null;
			s.origin = location.origin;
			s.lang = (document.documentElement.getAttribute("lang") || "").slice(0, 20);
			s.filter = filterKey();
			s.pathPattern = redact(location.pathname);
			s.started = Date.now();
			readScripts();
			if (!s.marker) {
				s.marker = domMarker();
				s.markerSource = s.marker ? "dom" : "none";
			}
			s.state = "capturing";
			s.code = "capturing";
			if (s.nonce) {
				s.listener = onMessage;
				window.addEventListener("message", s.listener);
			}
			s.observer = new MutationObserver(scan);
			s.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "aria-label", "data-card-title", "src", "alt"] });
			s.interval = setInterval(scan, 500);
			scan();
			return result(false);
		}
		if (action === "cancel") {
			disconnect();
			s = fresh();
			s.state = "cancelled";
			s.code = "cancelled";
			return result(false);
		}
		scan();
		if (action === "stop" && s.state === "capturing") {
			disconnect();
			s.state = "stopped";
			s.code = "stopped";
			s.stoppedAt = Date.now();
		}
		return result(action === "stop" || command.report === true);
	};
})();
