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
			domMarker: null,
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

	const redact = (pathname) => X.redactPath(pathname);

	function filterKey() {
		const after = location.pathname.replace(/^.*?\/watchlist/i, "").replace(/\/$/, "");
		const params = [...new URLSearchParams(location.search)]
			.filter(([k]) => /filter|type|sort|view|offer|category/i.test(k))
			// Values are kept only when they look like a filter word (movie, tv, all).
			.map(([k, v]) => `${X.safeKey(k)}=${/^[a-z_-]{1,20}$/i.test(v) ? v : "<value>"}`)
			.sort();
		return redact(after) + (params.length ? `?${params.join("&")}` : "");
	}

	function domMarker() {
		const nodes = [...document.querySelectorAll(PROFILE)].filter((n) => n.closest(OUTSIDE));
		if (!nodes.length) return null;
		const n = nodes[0];
		// Labels only: an avatar URL can change while lazy loading or cache-busting.
		const label = `${n.getAttribute("aria-label") || ""}|${n.querySelector("img")?.getAttribute("alt") || ""}`;
		return label === "|" ? null : X.hash(`d:${label}`);
	}

	// State markers come from hydration read at Start, so they can't change
	// later. The header marker is compared on every scan whenever one existed.
	function profileChanged() {
		if (s.markerSource === "dom") return domMarker() !== s.marker;
		return s.domMarker !== null && domMarker() !== s.domMarker;
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
			// A retried request returns the same page again; that isn't a loop.
			if (s.pageSignatures.has(sig)) {
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
				chain: c.chain || c.path,
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
		// A row label can name a title ("Because you watched …"), so it is hashed.
		const label = group.getAttribute("aria-label");
		return [group.tagName.toLowerCase(), group.getAttribute("role") || "", group.getAttribute("data-testid") || "", label ? `label#${X.hash(label)}` : "", classes].join("|");
	}

	function readCards() {
		const seen = new Map(); // signature -> cards in this pass
		// A card can hold several detail links (poster, title, play). Read each
		// card once; links to two different titles make the card unusable.
		const roots = new Map();
		for (const a of document.querySelectorAll(CARD_LINK)) {
			if (a.closest(OUTSIDE)) continue;
			const root = a.closest(CARD_ROOT) || a;
			if (!roots.has(root)) roots.set(root, []);
			roots.get(root).push(a);
		}
		for (const [root, links] of roots) {
			const parsed = links.map((a) => X.detailLink(a.getAttribute("href"), location.href));
			if (parsed.some((l) => !l)) {
				bump(s.domRejected, "card_invalid_link");
				if (parsed.every((l) => !l)) continue;
			}
			const tokens = new Set(parsed.filter(Boolean).map((l) => l.token));
			if (tokens.size !== 1) {
				bump(s.domRejected, "card_conflicting_links");
				continue;
			}
			const link = parsed.find(Boolean);
			const sig = signature(root.parentElement?.closest(GROUP) || null);
			for (const attr of root.getAttributeNames()) if (attr.startsWith("data-")) s.cardAttributes.add(attr);
			if (!seen.has(sig)) seen.set(sig, []);
			seen.get(sig).push({ links, root, link });
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
			if (sig !== s.primary) {
				const other = cards.filter((c) => s.structuredKeys.has(c.link.token)).length;
				const mine = [...(s.groups.get(s.primary)?.tokens || [])].filter((t) => s.structuredKeys.has(t)).length;
				if (other > mine) s.primaryContested = true;
			}
			const g = s.groups.get(sig);
			for (const c of cards) g.tokens.add(c.link.token);
			if (sig !== s.primary) continue;
			for (const { links, root, link } of cards) {
				s.domSightings++;
				const labels = [...new Set(links.map((a) => a.getAttribute("aria-label")?.trim()).filter(Boolean))];
				// Card-level names first; a link label can be an action ("Play …").
				const title = (
					root.getAttribute("data-card-title") ||
					root.querySelector("img[alt]:not([alt=''])")?.getAttribute("alt") ||
					root.querySelector("h2, h3, h4, [data-testid*='title' i]")?.textContent ||
					(labels.length === 1 ? labels[0] : "") ||
					(links.length === 1 ? links[0].textContent : "") ||
					""
				).trim().replace(/\s+/g, " ");
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
		try {
			acceptCollections(clean, "response", String(m.path).slice(0, 200));
		} catch {
			terminate("collector_error", false);
			return;
		}
		safeScan();
	}

	function disconnect() {
		s.observer?.disconnect();
		s.observer = null;
		if (s.interval !== null) clearInterval(s.interval);
		if (s.pending) clearTimeout(s.pending);
		s.pending = null;
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
		if (s.markerSource !== "none" && profileChanged()) return terminate("terminated_profile", true);
		if (filterKey() !== s.filter) s.filterChanged = true;
		if (Date.now() - s.started >= MAX_TIME) return terminate("limit_time", false);
		readScripts();
		if (s.state === "capturing") readCards();
	}

	// A collector error must end the capture visibly, never leave it "capturing".
	function safeScan() {
		try {
			scan();
		} catch {
			if (s.state === "capturing") terminate("collector_error", false);
		}
	}

	/** The in-extension gate. Reasons are codes; no titles or IDs. */
	function evaluate() {
		const partial = [];
		const unknown = [];
		if (s.state === "terminated") partial.push(s.code);
		if (!s.pages.length) unknown.push("no_structured_watchlist");
		// Each Watchlist collection path is its own chain. Every chain must end
		// on an explicit last page; one chain's end says nothing about another.
		const chains = new Map();
		for (const p of s.pages) chains.set(p.chain, [...(chains.get(p.chain) || []), p]);
		for (const pages of chains.values()) {
			const last = pages[pages.length - 1];
			if (last.terminal === true) continue;
			if (last.terminal === false) partial.push(pages.some((p) => p.terminal === true) ? "continuation_after_end" : "continuation_pending");
			else unknown.push("no_terminal_evidence");
		}
		if (chains.size > 1) unknown.push("several_watchlist_chains");
		if (s.cursorRepeats) partial.push("cursor_repeated");
		const totals = [...new Set(s.pages.map((p) => p.totalItems).filter((t) => t !== null))];
		if (totals.length > 1) partial.push("total_changed");
		// Live entries count toward a reported total but stay out of the file.
		if (totals.length === 1 && totals[0] !== s.structuredKeys.size + s.liveExcluded) partial.push("total_mismatch");
		const domOnly = [...s.domKeys].filter((k) => !s.structuredKeys.has(k)).length;
		const structuredOnly = [...s.structuredKeys].filter((k) => !s.domKeys.has(k)).length;
		if (s.pages.length && domOnly) partial.push("visible_not_in_structured");
		if (structuredOnly) partial.push("structured_not_seen_visible");
		if (!s.domKeys.size) unknown.push("no_visible_cards");
		if (s.primaryBy === "first_of_several_guess") unknown.push("visible_group_guessed");
		if (s.primaryContested) partial.push("visible_group_contested");
		const primaryTokens = [...(s.groups.get(s.primary)?.tokens || [])];
		if (s.pages.length && primaryTokens.length && !primaryTokens.some((t) => s.structuredKeys.has(t))) unknown.push("visible_group_unconfirmed");
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
				// Per scan pass, so one bad card counts once per pass it was seen in.
				rejectedCardSightings: Object.fromEntries(s.domRejected),
			},
			pagination: {
				pages: s.pages.map(({ origin, path, chain, count, terminal, totalItems, nextIndex, paginationKeys, at }) => ({ origin, path, chain, count, terminal, totalItems, nextIndex, paginationKeys, atSeconds: Math.round(at / 1000) })),
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
			chains: [...new Set(s.pages.map((p) => p.chain))].length,
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
			s.domMarker = domMarker();
			if (!s.marker) {
				s.marker = s.domMarker;
				s.markerSource = s.marker ? "dom" : "none";
			}
			s.state = "capturing";
			s.code = "capturing";
			if (s.nonce) {
				s.listener = onMessage;
				window.addEventListener("message", s.listener);
			}
			// Mutations come in bursts while the grid renders; scan at most every 100 ms.
			s.observer = new MutationObserver(() => {
				if (s.pending) return;
				s.pending = setTimeout(() => {
					s.pending = null;
					safeScan();
				}, 100);
			});
			s.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "aria-label", "data-card-title", "alt"] });
			s.interval = setInterval(safeScan, 500);
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
