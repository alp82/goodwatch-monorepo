/* GoodWatch capture diagnostic: Netflix module (ticket #730, DESIGN.md revision 3).
 * Netflix-specific page rules reused from the reviewed 0.0.7 collector:
 * provenance-checked reference, My List row, the reviewed next arrow and
 * validated card evidence. Plus Netflix's verdict rule, which never writes
 * complete while snapshot proof is absent (owner question Q26). */
(() => {
	// ---- Verdict (pure; also loaded by the Node tests) ------------------------
	function verdict(f) {
		if (!f.reference) return { verdict: 'unknown', reason: f.referenceReason || 'reference_missing' };
		if (f.ended) return { verdict: 'partial', reason: `ended_${f.ended}` };
		if (!f.profileGuard) return { verdict: 'partial', reason: 'no_profile_guard' };
		if (f.sticky.length) return { verdict: 'partial', reason: f.sticky[0] };
		if (f.unobserved > 0) return { verdict: 'partial', reason: 'unobserved_positions' };
		if (f.unknownTypes > 0) return { verdict: 'partial', reason: 'entity_type_unknown' };
		if (f.cardsOutside > 0) return { verdict: 'partial', reason: 'card_outside_entries' };
		if (f.titleConflicts > 0) return { verdict: 'partial', reason: 'card_title_conflict' };
		// Full positional coverage, clean session: still no snapshot proof.
		return { verdict: 'partial', reason: 'snapshot_unproven' };
	}
	globalThis.GWNetflixVerdict = verdict;
	if (typeof document === 'undefined') return;

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
	const REFERENCE_MAX_AGE_MS = 10 * 60 * 1000;
	let boundary = null;
	let reference = null;
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
	function fingerprint(text) {
		let h = 0x811c9dc5;
		for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
		return `${text.length}:${h >>> 0}`;
	}
	function stateUnchanged() {
		const scripts = [...document.querySelectorAll('script:not([src])')].filter(script => (script.textContent || '').includes(STATE_MARKER));
		return scripts.length === 1 && fingerprint(scripts[0].textContent) === reference?.fingerprint;
	}
	function ownScroller() {
		if (!boundary?.matches(MODERN_ROW)) return null;
		const scrollers = [...boundary.querySelectorAll(SCROLLER)].filter(s => s.closest(MODERN_ROW) === boundary);
		if (scrollers.length !== 1) return null;
		for (let p = scrollers[0].parentElement; p && p !== boundary; p = p.parentElement) {
			if (p.matches(FOREIGN)) return null;
		}
		return scrollers[0];
	}
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
	function rawId(card) {
		try {
			const url = new URL(card.getAttribute('href') || '', location.href);
			return nativeId(url.searchParams.get('jbv') || '');
		} catch {
			return null;
		}
	}
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
	const refuse = reason => ({ reference: null, reason });
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
			const title = treatment?.displayString;
			if (!validText(title)) return refuse('reference_bad_edge');
			loaded.push({ id, position, title, entityType: typeof entity?.__typename === 'string' ? entity.__typename : '', treatment: treatment?.__typename === 'PinotUnentitledBoxshotEntityTreatment' ? 'unentitled' : 'standard' });
		}
		loaded.sort((a, b) => a.position - b.position);
		// Known positions must run 0, 1, 2, ... without gaps.
		if (loaded.some((edge, k) => edge.position !== k)) return refuse('reference_bad_edge');
		if (typeof section._id !== 'string' || !section._id || section._id.length > 512) return refuse('reference_no_row_id');
		if (typeof section.version !== 'string' || section.version.length > 64) return refuse('reference_no_version');
		return { reference: { rowId: section._id, label, total, version: section.version, entries: loaded.map(e => ({ position: e.position, id: e.id, title: e.title, entityType: e.entityType, treatment: e.treatment })), fingerprint: fingerprint(text) }, reason: 'reference_found' };
	}
	function currentRow() {
		const found = boundaries().filter(node => node.matches(MODERN_ROW));
		boundary = found.length === 1 ? found[0] : null;
		return boundary;
	}

	globalThis.GWNetflix = {
		matchesPage: () => isMyList(),
		profileMarker: () => profileMarker(),
		readReference() {
			const row = currentRow();
			if (!row) return { refusal: 'boundary_missing' };
			const label = headingLabel(ownHeadings(row)[0]);
			const read = readReference(label);
			if (!read.reference) return { refusal: read.reason };
			reference = read.reference;
			return { reference };
		},
		referenceUnchanged: () => Boolean(reference) && stateUnchanged(),
		rowPresent: () => Boolean(currentRow()),
		nextButton: () => (currentRow() ? nextButton() : null),
		cardsInView: () => (currentRow() ? [...boundary.querySelectorAll(MODERN_CARD)].filter(cardOwned).length : 0),
		// Validated evidence for the cross-check: owned cards with one Netflix ID
		// from the card's own link and a valid title.
		readCards() {
			if (!currentRow()) return [];
			const out = [];
			for (const card of boundary.querySelectorAll(MODERN_CARD)) {
				if (!cardOwned(card)) continue;
				const e = cardEvidence(card);
				if (typeof e === 'string' || e.ids.size !== 1 || !validText(e.title)) continue;
				out.push({ element: card, sourceId: [...e.ids][0], title: e.title });
			}
			return out;
		},
		observerConfig: (ref, marker, token, channel) => ({
			token, channel, rowId: ref.rowId, version: ref.version, total: ref.total, label: ref.label, profileMarker: marker,
			endpoints: ['https://www.netflix.com/graphql'],
			otherGraphqlOrigins: ['https://web.prod.cloud.netflix.com', 'https://sgw.prod.cloud.netflix.com'],
		}),
		verdict,
	};
})();
