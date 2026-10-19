/* Experimental My List collector, version 0.0.7 (ticket #706).
 * - Page-state reference: Netflix's own reported total for the selected row,
 *   read from the inline page-state script text, accepted only when it belongs
 *   to the current profile and to a document first loaded on My List less
 *   than REFERENCE_MAX_AGE_MS ago, and only while the script is unchanged.
 * - Card ownership: only cards proven to sit in the My List row's own scroller
 *   (or the My List grid) enter the file, whatever the verdict.
 * - Stable reads: a card is accepted only after its link and label stay the
 *   same for STABLE_MS.
 * - Position checks: every known position is checked against the cards'
 *   order as it comes into view; a lap needs a card seen directly before the
 *   first title (adjacent slots or continuous settled windows), which an
 *   unmount and remount can't produce.
 * - An empty list is complete only after the row stays absent for
 *   EMPTY_SETTLE_MS, and stops being complete if a row appears.
 * - Optional bounded assisted traversal that clicks only the row scroller's
 *   own next arrow, at most ceil(total / cards in view) + 3 + 3 times; when
 *   unsure, it falls back to manual capture.
 * Selectors come from one saved de-DE page; they remain hypotheses. */
(() => {
	if (globalThis.__goodwatchWishlistCaptureCommand) return;
	const VERSION = '0.0.7';
	const BOUNDARIES = '.mainView .gallery, [data-uia="my-list-gallery"]';
	const EXCLUDED =
		'[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog, .bob-card, .previewModal, .recommendations, .billboard-row';
	const ROWS = '.lolomoRow, .rowContainer, section.carousel-row';
	const NESTED_ROWS = '.lolomoRow, section.carousel-row';
	const MODERN_ROW = 'section.carousel-row';
	const MODERN_CARD = 'a[data-uia="standard-card"]';
	const SCROLLER = '[data-uia="carousel-scroller"]';
	const NEXT_BUTTON = 'button[data-uia="carousel-hawkins-right-button"]';
	const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
	// Containers that mean "some other group", never part of the list itself.
	const FOREIGN = `section, aside, nav, article, header, footer, [role="region"], [role="group"], [role="navigation"], [role="complementary"], ${EXCLUDED}, ${NESTED_ROWS}`;
	const MY_LIST_LABELS = new Set(['My List', 'Meine Liste']);
	const MY_LIST_PATH = /^\/browse\/my-list\/?$/;
	const STATE_MARKER = "netflix.reactContext.models.graphql = JSON.parse('";
	const MAX_STATE_CHARS = 8 * 1024 * 1024;
	const MAX_ROWS = 5000;
	const MAX_TIME = 10 * 60 * 1000;
	const STABLE_MS = 400;
	const ASSIST_SETTLE_MS = 600;
	const ASSIST_MAX_WAIT_MS = 8000;
	const MAX_REBINDS = 20;
	const ASSIST_STALL_LIMIT = 3;
	const ASSIST_EXTRA_ADVANCES = 3;
	const ASSIST_MAX_TIME = 3 * 60 * 1000;
	// The inline state describes the list when the document loaded.
	const REFERENCE_MAX_AGE_MS = 10 * 60 * 1000;
	const EMPTY_SETTLE_MS = 2000;

	let state = 'idle';
	let code = 'idle';
	let boundary = null;
	let rowLabel = null;
	let marker = null;
	let initialUrl = '';
	let started = 0;
	let ended = 0;
	let observer = null;
	let interval = null;
	let items = new Map();
	let quarantined = new Set();
	let seenIds = new Set();
	let rejected = new Set();
	let pending = new WeakMap();
	let stableIds = new WeakMap();
	let reference = null;
	let referenceReason = 'not_read';
	let assist = null;
	let lastMutation = 0;
	// Positions: Netflix's loaded entries, checked against the cards' order.
	let idAt = [];
	let posOf = new Map();
	let confirmed = new Set();
	let mismatchSeen = false;
	let prevWindow = [];
	let maxWindow = 0;
	let sinceIds = new Set();
	// Lap: a card seen directly before the first title (the row wrapped).
	let lapSeen = false;
	let stateFingerprint = null;
	let emptyCheck = false;
	let rebinds = 0;
	const issues = new Map();

	const validText = (value) =>
		typeof value === 'string' &&
		value.trim().length > 0 &&
		value.length <= 1000 &&
		![...value].some((c) => c.charCodeAt(0) < 32);
	const nativeId = (value) =>
		typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
			? value
			: typeof value === 'number' && Number.isSafeInteger(value) && value > 0
				? String(value)
				: null;

	function isMyList() {
		return location.origin === 'https://www.netflix.com' && MY_LIST_PATH.test(location.pathname);
	}
	// The single active-profile avatar. Both alt text and image are required.
	function avatar() {
		const triggers = document.querySelectorAll('button[data-uia="navigation+profile-menu+trigger"]');
		if (triggers.length !== 1) return null;
		const avatars = triggers[0].querySelectorAll('img[data-uia="navigation+profile-menu+Avatar"]');
		if (avatars.length !== 1) return null;
		const alt = (avatars[0].getAttribute('alt') || '').trim();
		const src = (avatars[0].getAttribute('src') || '').trim();
		return alt && src ? { alt, src } : null;
	}
	function profileMarker() {
		// No marker values leave this closure.
		const a = avatar();
		return a ? JSON.stringify([a.alt, a.src]) : null;
	}
	function headingLabel(heading) {
		if (!heading) return null;
		const titles = heading.querySelectorAll('.row-header-title');
		if (titles.length > 1) return null;
		return (titles.length === 1 ? titles[0].textContent : heading.getAttribute('aria-label') || heading.textContent)?.trim().replace(/\s+/g, ' ');
	}
	function ownHeadings(row) {
		return [...row.querySelectorAll(HEADINGS)].filter(heading =>
			heading.closest(ROWS) === row && !heading.closest(`${EXCLUDED}, .ptrack-content, ${MODERN_CARD}`));
	}
	function boundaries() {
		const grids = [...document.querySelectorAll(BOUNDARIES)]
			.filter(node => !node.closest(EXCLUDED) && !node.closest(ROWS))
			.filter((node, _, nodes) => !nodes.some(other => other !== node && other.contains(node)));
		const rows = [...document.querySelectorAll(HEADINGS)]
			.filter(heading => !heading.closest(`${EXCLUDED}, .ptrack-content, ${MODERN_CARD}`) && MY_LIST_LABELS.has(headingLabel(heading)))
			.map(heading => heading.closest(ROWS)).filter(row => row &&
				ownHeadings(row).length === 1 &&
				![...row.querySelectorAll(ROWS)].some(nested => !nested.closest(EXCLUDED) && ownHeadings(nested).length));
		return [...grids, ...rows];
	}

	// ---- Page-state reference -------------------------------------------
	function decodeLiteral(text, from) {
		let out = '';
		for (let i = from; i < text.length; i++) {
			const c = text[i];
			if (c === "'") return out;
			if (c !== '\\') { out += c; continue; }
			const n = text[++i];
			if (n === undefined) return null;
			if (n === 'x') {
				const hex = text.slice(i + 1, i + 3);
				if (!/^[0-9a-fA-F]{2}$/.test(hex)) return null;
				out += String.fromCharCode(parseInt(hex, 16)); i += 2;
			} else if (n === 'u') {
				if (text[i + 1] === '{') {
					const close = text.indexOf('}', i);
					const hex = text.slice(i + 2, close);
					if (close < 0 || !/^[0-9a-fA-F]{1,6}$/.test(hex)) return null;
					out += String.fromCodePoint(parseInt(hex, 16)); i = close;
				} else {
					const hex = text.slice(i + 1, i + 5);
					if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
					out += String.fromCharCode(parseInt(hex, 16)); i += 4;
				}
			} else if (n === '\n') {
				// Line continuation.
			} else {
				out += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' }[n] ?? n;
			}
		}
		return null;
	}
	function cursorPosition(cursor) {
		if (typeof cursor !== 'string' || cursor.length > 64) return null;
		try {
			const text = atob(cursor);
			return /^(0|[1-9]\d{0,5})$/.test(text) ? Number(text) : null;
		} catch {
			return null;
		}
	}
	// The inline state is written when the document loads. It describes My
	// List only if this document was first loaded on My List.
	function loadedOnMyList() {
		try {
			const entries = performance.getEntriesByType('navigation');
			if (entries.length !== 1) return false;
			const url = new URL(entries[0].name);
			return url.origin === 'https://www.netflix.com' && MY_LIST_PATH.test(url.pathname);
		} catch {
			return false;
		}
	}
	const refuse = reason => ({ reference: null, reason });
	// Cheap FNV-1a hash of the page-state script, to notice it changing.
	function fingerprint(text) {
		let h = 0x811c9dc5;
		for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
		return `${text.length}:${h >>> 0}`;
	}
	function stateUnchanged() {
		const scripts = [...document.querySelectorAll('script:not([src])')].filter(script => (script.textContent || '').includes(STATE_MARKER));
		return scripts.length === 1 && fingerprint(scripts[0].textContent) === reference?.fingerprint;
	}
	// Reads only the section whose label equals the selected row's heading,
	// after checking that the state belongs to the open profile and page.
	function readReference(label) {
		if (!label) return refuse('reference_no_label');
		if (!loadedOnMyList()) return refuse('reference_other_page');
		const scripts = [...document.querySelectorAll('script:not([src])')]
			.filter(script => (script.textContent || '').includes(STATE_MARKER));
		if (scripts.length !== 1) return refuse(scripts.length ? 'reference_ambiguous' : 'reference_missing');
		const text = scripts[0].textContent;
		if (text.length > MAX_STATE_CHARS) return refuse('reference_too_large');
		let age;
		try {
			age = performance.now();
		} catch {
			age = NaN;
		}
		if (!(age >= 0 && age <= REFERENCE_MAX_AGE_MS)) return refuse('reference_stale');
		const literal = decodeLiteral(text, text.indexOf(STATE_MARKER) + STATE_MARKER.length);
		let data;
		try {
			data = JSON.parse(literal)?.data;
		} catch {
			return refuse('reference_unreadable');
		}
		if (!data || typeof data !== 'object') return refuse('reference_unreadable');
		// Profile provenance: the state's current profile is the one on screen,
		// and its name can't be confused with another profile's.
		const root = data.ROOT_QUERY;
		const current = data[root?.currentProfile?.__ref];
		const profiles = Array.isArray(root?.account?.profiles) ? root.account.profiles.map(ref => data[ref?.__ref]) : null;
		if (!current || typeof current.name !== 'string' || !profiles || profiles.some(p => !p || typeof p.name !== 'string')) return refuse('reference_no_profile');
		const shown = avatar();
		if (!shown || shown.alt !== current.name) return refuse('reference_other_profile');
		if (profiles.filter(p => p.name === current.name).length !== 1) return refuse('reference_profile_ambiguous');
		const sections = Object.entries(data).filter(([, entity]) =>
			entity && entity.__typename === 'PinotCarouselSection' && entity.displayString === label);
		if (sections.length !== 1) return refuse(sections.length ? 'reference_ambiguous' : 'reference_missing');
		const [sectionKey, section] = sections[0];
		// Page provenance: the section belongs to the page the state describes.
		const pages = Object.entries(root).filter(([key]) => /^pinotBrowsePage(\(|$)/.test(key));
		const page = pages.length === 1 ? data[pages[0][1]?.__ref] : null;
		const pageSections = page && Object.entries(page).filter(([key, value]) => /^sections(\(|$)/.test(key) && Array.isArray(value?.edges));
		if (!pageSections || pageSections.length !== 1 || !pageSections[0][1].edges.some(edge => edge?.node?.__ref === sectionKey)) return refuse('reference_not_on_page');
		const connections = Object.entries(section)
			.filter(([key, value]) => /^entities(\(|$)/.test(key) && value && typeof value === 'object');
		if (connections.length !== 1) return refuse('reference_ambiguous');
		const connection = connections[0][1];
		const total = connection.totalCount;
		if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ROWS) return refuse('reference_no_total');
		const edges = Array.isArray(connection.edges) ? connection.edges : [];
		const loaded = [];
		const positions = new Set();
		for (const edge of edges) {
			const treatment = data[edge?.node?.__ref];
			const entity = data[treatment?.unifiedEntity?.__ref];
			const id = nativeId(entity?.videoId);
			const position = cursorPosition(edge?.cursor);
			if (!id || position === null || positions.has(position) || position >= total || loaded.some(e => e.id === id)) {
				return refuse('reference_bad_edge');
			}
			positions.add(position);
			loaded.push({ id, position });
		}
		loaded.sort((a, b) => a.position - b.position);
		// Known positions must run 0, 1, 2, ... without gaps.
		if (loaded.some((edge, k) => edge.position !== k)) return refuse('reference_bad_edge');
		return { reference: { total, loaded, fingerprint: fingerprint(text) }, reason: 'reference_found' };
	}

	// ---- Card ownership ---------------------------------------------------
	function ownScroller() {
		if (!boundary?.matches(MODERN_ROW)) return null;
		const scrollers = [...boundary.querySelectorAll(SCROLLER)].filter(s => s.closest(MODERN_ROW) === boundary);
		if (scrollers.length !== 1) return null;
		for (let p = scrollers[0].parentElement; p && p !== boundary; p = p.parentElement) {
			if (p.matches(FOREIGN)) return null;
		}
		return scrollers[0];
	}
	// A card counts only when nothing between it and the list container marks
	// another group: no section-like or dialog element and no heading.
	function cardOwned(card) {
		if (!boundary || card.closest(EXCLUDED)) return false;
		const container = boundary.matches(MODERN_ROW) ? ownScroller() : boundary;
		if (!container || !container.contains(card)) return false;
		for (let p = card.parentElement; p && p !== container; p = p.parentElement) {
			if (p.matches(FOREIGN)) return false;
			if ([...p.querySelectorAll(HEADINGS)].some(h => !card.contains(h))) return false;
		}
		return true;
	}

	function disconnect() {
		observer?.disconnect();
		observer = null;
		if (interval !== null) clearInterval(interval);
		interval = null;
		if (assist?.timer != null) clearTimeout(assist.timer);
		if (assist) assist.timer = null;
	}
	function clearAll() {
		items.clear();
		quarantined.clear();
		seenIds.clear();
		rejected.clear();
		issues.clear();
		pending = new WeakMap();
		stableIds = new WeakMap();
	}
	function terminate(reason, discard) {
		disconnect();
		state = 'terminated';
		code = reason;
		ended = Date.now();
		if (discard) clearAll();
	}
	function reject(card, reason) {
		const signature = JSON.stringify([
			reason,
			card.getAttribute('data-ui-tracking-context')?.slice(0, 128),
			card.textContent?.slice(0, 128),
			[...card.querySelectorAll('a[href]')].slice(0, 2).map((a) => a.getAttribute('href')?.slice(0, 128)),
		]);
		if (!rejected.has(signature) && rejected.size < MAX_ROWS) {
			rejected.add(signature);
			issues.set(reason, (issues.get(reason) || 0) + 1);
		}
	}
	function cardEvidence(card) {
		const ids = new Set();
		const tracking = card.getAttribute('data-ui-tracking-context');
		if (tracking !== null && tracking.length > 4096) return 'card_invalid_tracking';
		if (tracking !== null) {
			let parsed;
			try {
				parsed = JSON.parse(tracking);
			} catch {
				try {
					parsed = JSON.parse(decodeURIComponent(tracking));
				} catch {
					return 'card_invalid_tracking';
				}
			}
			if (parsed && Object.hasOwn(parsed, 'video_id')) {
				const id = nativeId(parsed.video_id);
				if (!id) return 'card_invalid_tracking';
				ids.add(id);
			}
		}
		let sourceUrl;
		const modern = card.matches(MODERN_CARD);
		if (modern && !card.hasAttribute('href')) return 'card_invalid_link';
		const anchors = [...(card.matches('a[href]') ? [card] : []), ...card.querySelectorAll('a[href]')];
		if (anchors.length > 20) return 'card_invalid_link';
		for (const anchor of anchors) {
			let url;
			const href = anchor.getAttribute('href');
			if (href.length > 2048 || href.includes('\\') || [...href].some((c) => c.charCodeAt(0) < 32)) return 'card_invalid_link';
			try {
				url = new URL(href, location.href);
			} catch {
				return 'card_invalid_link';
			}
			if (modern) {
				const entries = [...url.searchParams];
				const id = entries.length === 1 && entries[0][0] === 'jbv' && nativeId(entries[0][1]);
				if (url.origin !== 'https://www.netflix.com' || url.username || url.password || url.pathname !== '/browse' || !id) return 'card_invalid_link';
				ids.add(id);
				continue;
			}
			if (!/^\/title(?:\/|$)/.test(url.pathname)) continue;
			const match = /^\/title\/([1-9]\d{0,19})\/?$/.exec(url.pathname);
			if (url.origin !== 'https://www.netflix.com' || url.username || url.password || !match) return 'card_invalid_link';
			ids.add(match[1]);
			sourceUrl = `${url.origin}/title/${match[1]}`;
		}
		const title = modern ? card.getAttribute('aria-label')?.trim() :
			card.querySelector('.fallback-text')?.textContent?.trim() ||
			card.querySelector('a[aria-label]')?.getAttribute('aria-label')?.trim();
		return { ids, sourceUrl, title, modern };
	}
	// Returns true when the card is owned (whether or not it was accepted).
	function readCard(card) {
		stableIds.delete(card);
		if (!cardOwned(card)) return false;
		const evidence = cardEvidence(card);
		const signature = typeof evidence === 'string' ? evidence :
			JSON.stringify([[...evidence.ids], evidence.title ?? null, evidence.sourceUrl ?? null]);
		const seen = pending.get(card);
		if (!seen || seen.signature !== signature) {
			pending.set(card, { signature, since: Date.now() });
			return true;
		}
		if (Date.now() - seen.since < STABLE_MS) return true;
		if (typeof evidence === 'string') {
			reject(card, evidence);
			return true;
		}
		const { ids, sourceUrl, title } = evidence;
		for (const id of ids) {
			if (!seenIds.has(id) && seenIds.size >= MAX_ROWS) {
				terminate('limit_rows', false);
				return true;
			}
			seenIds.add(id);
		}
		if (ids.size !== 1) {
			if (ids.size > 1)
				for (const id of ids) {
					quarantined.add(id);
					items.delete(id);
				}
			reject(card, ids.size ? 'card_conflicting_ids' : 'card_missing_id');
			return true;
		}
		const sourceId = [...ids][0];
		if (quarantined.has(sourceId)) return true;
		if (!validText(title)) {
			reject(card, 'card_missing_title');
			return true;
		}
		if (items.has(sourceId) && items.get(sourceId).title !== title) {
			quarantined.add(sourceId);
			items.delete(sourceId);
			reject(card, 'card_conflicting_title');
			return true;
		}
		if (!items.has(sourceId) && items.size >= MAX_ROWS) {
			terminate('limit_rows', false);
			return true;
		}
		const previous = items.get(sourceId);
		items.set(sourceId, {
			title,
			mediaType: 'unknown',
			sourceId,
			...(sourceUrl || previous?.sourceUrl ? { sourceUrl: sourceUrl || previous.sourceUrl } : {}),
		});
		stableIds.set(card, sourceId);
		return true;
	}
	function rawId(card) {
		try {
			const url = new URL(card.getAttribute('href') || '', location.href);
			return nativeId(url.searchParams.get('jbv') || '');
		} catch {
			return null;
		}
	}
	function ownedCards() {
		if (!boundary) return [];
		return [...boundary.querySelectorAll(boundary.matches(MODERN_ROW) ? MODERN_CARD : '.ptrack-content')].filter(cardOwned);
	}
	function mountedIds() {
		if (!boundary?.matches(MODERN_ROW)) return [];
		return ownedCards().map(rawId).filter(Boolean);
	}
	function adjacentSlots(a, b) {
		let ca = a;
		while (ca.parentElement && !ca.parentElement.contains(b)) ca = ca.parentElement;
		const common = ca.parentElement;
		if (!common) return false;
		let cb = b;
		while (cb.parentElement !== common) cb = cb.parentElement;
		return ca.nextElementSibling === cb;
	}
	// Checks adjacent confirmed cards against Netflix's known positions, and
	// records positive wrap evidence.
	function trackPositions(cards) {
		const ids = cards.map(card => stableIds.get(card) ?? null);
		const pairs = [];
		// Neighbors only when their slots are adjacent: an empty or loading slot
		// between two cards means they aren't consecutive.
		for (let i = 0; i + 1 < ids.length; i++) if (adjacentSlots(cards[i], cards[i + 1])) pairs.push([ids[i], ids[i + 1]]);
		// Across windows: when a fully settled window (every card confirmed and
		// as many cards as the row has shown at once) replaces the previous one
		// with no overlap, the old last card and the new first card are
		// neighbors. Paging backward can only cause a mismatch, never complete.
		// Continuity: every card shown in between must belong to one of the two
		// windows, or a page went by unconfirmed and the pair is skipped.
		for (const id of cards.map(rawId)) if (id) sinceIds.add(id);
		const settled = ids.length > 0 && ids.every(Boolean);
		if (settled) maxWindow = Math.max(maxWindow, ids.length);
		if (settled && ids.length >= maxWindow && ids.join(',') !== prevWindow.join(',')) {
			const continuous = [...sinceIds].every(id => prevWindow.includes(id) || ids.includes(id));
			if (prevWindow.length && continuous && !ids.some(id => prevWindow.includes(id))) pairs.push([prevWindow.at(-1), ids[0]]);
			prevWindow = ids;
			sinceIds = new Set(ids);
		}
		for (const [a, b] of pairs) {
			if (!a || !b || a === b) continue;
			const pa = posOf.get(a);
			const pb = posOf.get(b);
			if (pa !== undefined && pa + 1 < idAt.length) {
				if (b === idAt[pa + 1]) confirmed.add(pa);
				else mismatchSeen = true;
			}
			if (pb !== undefined && pb > 0 && a !== idAt[pb - 1]) mismatchSeen = true;
			if (pb === 0 && reference) {
				// Something directly before the first title: the row wrapped. With
				// every member known, it must be the last one.
				const everyKnown = idAt.length === reference.total;
				if (pa === undefined ? !everyKnown : pa === reference.total - 1) lapSeen = true;
				else mismatchSeen = true;
			}
		}
	}
	function guard() {
		if (!isMyList() || location.pathname !== initialUrl) {
			terminate('terminated_navigation', true);
			return false;
		}
		if (profileMarker() !== marker) {
			terminate('terminated_profile', true);
			return false;
		}
		return true;
	}
	function scan() {
		if (state !== 'capturing') return;
		if (!guard()) return;
		if (emptyCheck) {
			// Netflix reported zero: the row must stay absent for EMPTY_SETTLE_MS.
			if (boundaries().length || !stateUnchanged()) {
				terminate('terminated_row_appeared', true);
			} else if (Date.now() - started >= EMPTY_SETTLE_MS) {
				disconnect();
				emptyCheck = false;
				state = 'stopped';
				code = 'list_empty';
				ended = Date.now();
			}
			return;
		}
		const found = boundaries();
		if (!boundary?.isConnected || found.length !== 1 || found[0] !== boundary) {
			const same = found.length === 1 && found[0].matches(MODERN_ROW) && rowLabel &&
				headingLabel(ownHeadings(found[0])[0]) === rowLabel;
			if (!same || ++rebinds > MAX_REBINDS) {
				terminate('terminated_boundary', false);
				return;
			}
			boundary = found[0];
		}
		if (Date.now() - started >= MAX_TIME) {
			terminate('limit_time', false);
			return;
		}
		const cards = boundary.querySelectorAll(boundary.matches(MODERN_ROW) ? MODERN_CARD : '.ptrack-content');
		const owned = [];
		for (let index = 0; index < cards.length && state === 'capturing'; index++) {
			if (index >= MAX_ROWS) {
				terminate('limit_rows', false);
				break;
			}
			if (readCard(cards[index])) owned.push(cards[index]);
		}
		if (state === 'capturing') trackPositions(owned);
	}

	// ---- Completeness verdict -------------------------------------------
	function positionsConfirmed() {
		const needed = Math.min(idAt.length, reference.total) - 1;
		for (let k = 0; k < needed; k++) if (!confirmed.has(k)) return false;
		return true;
	}
	function orderCheck() {
		if (!reference) return 'not_applicable';
		if (mismatchSeen) return 'mismatch';
		return positionsConfirmed() ? 'match' : 'incomplete';
	}
	function verdict() {
		const captured = items.size;
		const base = { reportedTotal: reference?.total ?? null, captured };
		if (!reference) return { completeness: 'unknown', reason: referenceReason, ...base };
		const missingLoaded = reference.loaded.filter(edge => !items.has(edge.id)).length;
		const result = (completeness, reason) => ({ completeness, reason, missingLoaded, ...base });
		if (state === 'terminated') return result('partial', `ended_${code}`);
		if (marker === null) return result('partial', 'no_profile_guard');
		if (!stateUnchanged()) return result('partial', 'reference_changed');
		if (emptyCheck) return result('partial', 'checking_empty');
		if (code === 'list_empty') {
			if (boundaries().length) return result('partial', 'row_appeared');
			return captured === 0 && reference.total === 0 ? result('complete', 'reported_empty') : result('partial', 'unreadable_cards');
		}
		if (quarantined.size) return result('partial', 'conflicting_cards');
		if (rejected.size) return result('partial', 'unreadable_cards');
		if (captured > reference.total) return result('partial', 'above_total');
		if (missingLoaded) return result('partial', 'loaded_title_missing');
		if (mismatchSeen) return result('partial', 'order_mismatch');
		const everyKnown = reference.loaded.length === reference.total;
		if (everyKnown && [...items.keys()].some(id => !posOf.has(id))) return result('partial', 'not_in_listing');
		if (captured < reference.total) return result('partial', 'below_total');
		if (!positionsConfirmed()) return result('partial', 'positions_unconfirmed');
		if (!lapSeen) return result('partial', 'lap_not_finished');
		if (state === 'capturing') return result('partial', 'total_reached_still_capturing');
		return result('complete', 'reached_total');
	}

	// ---- Bounded assisted traversal -------------------------------------
	// The only control assisted mode presses: the single next arrow that sits
	// directly in the row's own scroller (scroller > wrapper > button), outside
	// any dialog, preview, card or other group. Anything else: don't click.
	function nextButton() {
		const scroller = ownScroller();
		if (!scroller) return null;
		const all = boundary.querySelectorAll(NEXT_BUTTON);
		if (all.length !== 1) return null;
		const button = all[0];
		const wrapper = button.parentElement;
		if (!wrapper || wrapper.parentElement !== scroller) return null;
		if (wrapper.matches(FOREIGN) || button.closest(`a, ${MODERN_CARD}, ${EXCLUDED}`)) return null;
		if (button.disabled || (button.getAttribute('type') || 'submit') !== 'button') return null;
		return button;
	}
	function finishAssist(reason) {
		assist.outcome = reason;
		assist.timer = null;
		if (state !== 'capturing') return;
		disconnect();
		state = 'stopped';
		code = 'stopped';
		ended = Date.now();
	}
	// Unsure about the arrow: keep capturing, and let the member click.
	function fallBackToManual() {
		if (assist.timer != null) clearTimeout(assist.timer);
		assist.timer = null;
		assist.outcome = 'manual_fallback';
	}
	const pastDeadline = () => Date.now() - started >= ASSIST_MAX_TIME;
	// Assisted timers never fire after the deadline.
	const later = (fn, ms) => setTimeout(fn, Math.max(0, Math.min(ms, started + ASSIST_MAX_TIME - Date.now())));
	function assistStep() {
		if (!assist || state !== 'capturing') return;
		assist.timer = null;
		scan();
		if (state !== 'capturing') {
			assist.outcome = `ended_${code}`;
			return;
		}
		if (pastDeadline()) return finishAssist('assist_time_limit');
		if (assist.advances === 0) {
			assist.fullCount = mountedIds().length;
			// Protocol G12: ceil(total / cards in view) + 3, plus a stall budget of 3,
			// fixed at Start and independent of how far each click moves the row.
			assist.maxAdvances = Math.ceil(reference.total / Math.max(1, assist.fullCount)) + ASSIST_EXTRA_ADVANCES;
		} else if (items.size > assist.countAtAdvance) {
			assist.stalls = 0;
		} else {
			assist.stalls++;
		}
		if (lapSeen && items.size < reference.total && !assist.finalWait) {
			assist.finalWait = true;
			assist.clickedAt = Date.now();
			assist.timer = later(assistWait, ASSIST_SETTLE_MS);
			return;
		}
		if (lapSeen) return finishAssist('lap_complete');
		if (assist.stalls >= ASSIST_STALL_LIMIT) return finishAssist('stalled');
		if (assist.advances >= assist.maxAdvances + ASSIST_STALL_LIMIT) return finishAssist('advance_limit');
		const button = nextButton();
		if (!button) return fallBackToManual();
		assist.countAtAdvance = items.size;
		assist.before = mountedIds().join(',');
		assist.advances++;
		assist.clickedAt = Date.now();
		button.click();
		assist.timer = later(assistWait, ASSIST_SETTLE_MS);
	}
	function assistWait() {
		if (!assist || state !== 'capturing') return;
		if (pastDeadline()) {
			scan();
			if (state === 'capturing') finishAssist('assist_time_limit');
			return;
		}
		const now = Date.now();
		if (assist.finalWait) {
			scan();
			if (items.size >= reference.total || now - assist.clickedAt >= ASSIST_MAX_WAIT_MS) {
				assist.timer = later(assistStep, STABLE_MS + 50);
			} else {
				assist.timer = later(assistWait, 150);
			}
			return;
		}
		const ids = mountedIds();
		const moved = ids.join(',') !== assist.before;
		const quiet = now - lastMutation >= ASSIST_SETTLE_MS;
		const filled = ids.length >= assist.fullCount;
		if (moved && quiet && filled) assist.fullCount = Math.max(assist.fullCount, ids.length);
		if ((moved && quiet && filled) || now - assist.clickedAt >= ASSIST_MAX_WAIT_MS) {
			scan();
			assist.timer = later(assistStep, STABLE_MS + 50);
		} else {
			assist.timer = later(assistWait, 150);
		}
	}

	function result() {
		const keep = ['capturing', 'stopped'].includes(state) ||
			(state === 'terminated' && !['terminated_navigation', 'terminated_profile'].includes(code));
		const v = verdict();
		return {
			version: VERSION,
			state,
			code,
			observedCount: items.size,
			rejectedCount: rejected.size,
			profileGuard: marker !== null,
			issues: [...issues].map(([code, count]) => ({ code, count })),
			verdict: v,
			reference: reference ? { found: true, total: reference.total, loaded: reference.loaded.length } : { found: false, reason: referenceReason },
			traversal: assist ? {
				mode: 'assisted', advances: assist.advances, stalls: assist.stalls,
				maxAdvances: assist.maxAdvances, outcome: assist.outcome,
			} : { mode: 'manual' },
			lapSeen,
			emptyCheck,
			rebinds,
			orderCheck: orderCheck(),
			elapsedMs: started ? (ended || Date.now()) - started : 0,
			...(keep ? {
				envelope: {
					format: 'goodwatch-wishlist',
					version: 1,
					source: 'netflix',
					exportedAt: new Date(Date.now()).toISOString(),
					completeness: v.completeness,
					items: [...items.values()].map((item) => ({ ...item })),
				},
			} : {}),
		};
	}
	function emptyListReference() {
		for (const label of MY_LIST_LABELS) {
			const read = readReference(label);
			if (read.reference && read.reference.total === 0) return read.reference;
		}
		return null;
	}
	function reset() {
		disconnect();
		items = new Map();
		quarantined = new Set();
		seenIds = new Set();
		rejected = new Set();
		pending = new WeakMap();
		stableIds = new WeakMap();
		issues.clear();
		boundary = null;
		rowLabel = null;
		marker = null;
		reference = null;
		referenceReason = 'not_read';
		assist = null;
		idAt = [];
		posOf = new Map();
		confirmed = new Set();
		mismatchSeen = false;
		prevWindow = [];
		maxWindow = 0;
		sinceIds = new Set();
		lapSeen = false;
		stateFingerprint = null;
		emptyCheck = false;
		rebinds = 0;
		started = 0;
		ended = 0;
		state = 'idle';
		code = 'idle';
	}

	globalThis.__goodwatchWishlistCaptureCommand = (command) => {
		if (!command || !['start', 'status', 'stop', 'cancel'].includes(command.action))
			return { ...result(), code: 'invalid_command' };
		if (command.action === 'start') {
			if (state === 'capturing') {
				scan();
				return result();
			}
			reset();
			if (!isMyList()) return { ...result(), code: 'wrong_page' };
			const found = boundaries();
			if (found.length !== 1) {
				if (!found.length) {
					const empty = emptyListReference();
					if (empty) {
						reference = empty;
						referenceReason = 'reference_found';
						marker = profileMarker();
						initialUrl = location.pathname;
						started = Date.now();
						emptyCheck = true;
						state = 'capturing';
						code = 'capturing';
						observer = new MutationObserver(scan);
						observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
						interval = setInterval(scan, 250);
						return result();
					}
				}
				return { ...result(), code: found.length ? 'boundary_ambiguous' : 'boundary_missing' };
			}
			boundary = found[0];
			rowLabel = boundary.matches(ROWS) ? headingLabel(ownHeadings(boundary)[0]) : null;
			({ reference, reason: referenceReason } = rowLabel ? readReference(rowLabel) : refuse('reference_grid_layout'));
			if (reference) {
				idAt = reference.loaded.map(edge => edge.id);
				posOf = new Map(reference.loaded.map(edge => [edge.id, edge.position]));
			}
			marker = profileMarker();
			initialUrl = location.pathname;
			started = Date.now();
			state = 'capturing';
			code = 'capturing';
			observer = new MutationObserver(() => {
				lastMutation = Date.now();
				scan();
			});
			observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
			interval = setInterval(scan, 500);
			scan();
			if (command.mode === 'assisted') {
				if (!reference || !boundary.matches(MODERN_ROW) || marker === null) {
					// No safe bound or no profile guard: continue as a manual capture.
					assist = { advances: 0, stalls: 0, maxAdvances: null, outcome: 'needs_reference', timer: null };
				} else {
					assist = {
						advances: 0, stalls: 0, maxAdvances: null, outcome: null,
						countAtAdvance: 0, clickedAt: 0, timer: null, finalWait: false,
					};
					assist.timer = later(assistStep, STABLE_MS + 200);
				}
			}
			return result();
		}
		if (command.action === 'cancel') {
			disconnect();
			clearAll();
			state = 'cancelled';
			code = 'cancelled';
			return result();
		}
		// Every guard runs on a finished capture too, including an empty one.
		if (state === 'stopped') {
			if (!isMyList() || location.pathname !== initialUrl) terminate('terminated_navigation', true);
			else if (profileMarker() !== marker) terminate('terminated_profile', true);
			else if (code === 'list_empty' && (boundaries().length || !stateUnchanged())) terminate('terminated_row_appeared', true);
		}
		scan();
		if (command.action === 'stop' && state === 'capturing') {
			if (assist && assist.outcome === null) assist.outcome = 'member_stopped';
			disconnect();
			state = 'stopped';
			code = 'stopped';
			ended = Date.now();
		}
		return result();
	};
})();
