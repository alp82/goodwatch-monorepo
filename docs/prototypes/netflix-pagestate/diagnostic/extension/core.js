/* GoodWatch capture diagnostic: shared core (ticket #730, DESIGN.md revision 3).
 * Service-independent session machinery: states, traversal bounds, the
 * observer bridge, membership assembly, finalize and the counts-only report.
 * Completeness rules come from the service module's verdict(). */
(() => {
	const LIMITS = {
		guardMs: 250, firstStepMs: 600, settleMs: 300, waitPollMs: 200, waitMaxMs: 8000,
		stallLimit: 3, extraClicks: 3, deadlineMs: 3 * 60 * 1000, sessionMs: 10 * 60 * 1000,
		drainMs: 3000, drainPollMs: 100, finalizeMs: 5000, stableCardMs: 400,
	};
	const STICKY_PRIORITY = [
		'observer_displaced', 'cleanup_failed', 'pending_unresolved', 'observer_error', 'observer_lost', 'observer_overloaded',
		'response_too_large', 'response_unreadable', 'request_too_large', 'unsupported_input', 'unsupported_body',
		'unsupported_response_type', 'xhr_reused', 'entries_limit', 'entry_malformed', 'profile_changed',
		'page_conflict', 'position_conflict', 'id_conflict',
	];

	function createSession({ module, bridge, clock, random }) {
		const rand = random || (() => {
			const a = new Uint32Array(4);
			crypto.getRandomValues(a);
			return [...a].map(x => x.toString(16)).join('');
		});
		let state = 'idle';
		let reference = null;
		let referenceReason = null;
		let marker = null;
		let started = 0;
		let traversalStoppedAt = null;
		let traversalOutcome = null;
		let ended = null;
		let result = null;
		let installedAtMsAfterLoad = null;
		const timers = new Set();
		const membership = new Map(); // position -> entry
		const positionOf = new Map(); // id -> position
		const pageSignatures = new Map(); // afterPosition -> signature
		const sticky = new Set();
		let observerCounters = {};
		let observerSticky = [];
		let lastPending = 0;
		let observerDisplaced = false;
		let duplicateIdentical = 0;
		let acceptedRanges = 0;
		let cleanupResult = null;
		const cardSeen = new Map(); // id -> title
		// Element -> evidence signature while a card settles. A Map, pruned every
		// scan and cleared on release, so nothing survives in a weak structure.
		const cardStability = new Map();
		let titleConflicts = 0;
		// Traversal
		let clickCap = 0;
		let maxClicks = 0;
		let advances = 0;
		let stalls = 0;
		let deadline = 0;
		let coveredAtClick = 0;
		let clickedAt = 0;
		let guardInterval = null;

		const later = (fn, ms, cap = true) => {
			const delay = cap && deadline ? Math.max(0, Math.min(ms, deadline - clock.now())) : ms;
			const id = clock.setTimeout(() => { timers.delete(id); fn(); }, delay);
			timers.add(id);
			return id;
		};
		const clearTimers = () => {
			for (const id of timers) clock.clearTimeout(id);
			timers.clear();
			if (guardInterval !== null) clock.clearInterval(guardInterval);
			guardInterval = null;
		};
		const covered = () => membership.size;
		const total = () => (reference ? reference.total : 0);

		function addEntry(e, viaPage) {
			const existing = membership.get(e.position);
			if (existing) {
				if (existing.id !== e.id) sticky.add('position_conflict');
				return;
			}
			const otherPos = positionOf.get(e.id);
			if (otherPos !== undefined && otherPos !== e.position) { sticky.add('id_conflict'); return; }
			membership.set(e.position, { id: e.id, title: e.title, entityType: e.entityType, treatment: e.treatment, viaPage });
			positionOf.set(e.id, e.position);
		}
		function merge(reply) {
			if (!reply) { sticky.add('observer_lost'); return false; }
			observerCounters = reply.counters || {};
			observerSticky = reply.sticky || [];
			lastPending = reply.pending || 0;
			if (reply.integrity && (!reply.integrity.fetch || !reply.integrity.open || !reply.integrity.send)) observerDisplaced = true;
			for (const page of reply.outbox || []) {
				const signature = page.entries.map(e => `${e.position}:${e.id}`).join(',');
				const prior = pageSignatures.get(page.afterPosition);
				if (prior !== undefined) {
					if (prior === signature) { duplicateIdentical++; continue; }
					sticky.add('page_conflict');
					continue;
				}
				pageSignatures.set(page.afterPosition, signature);
				acceptedRanges++;
				for (const e of page.entries) addEntry(e, true);
			}
			return true;
		}
		const pull = () => (state === 'finalized' || state === 'discarded' ? false : merge(bridge.request('pull')));

		function readCards() {
			const now = clock.now();
			const cards = module.readCards() || [];
			const present = new Set(cards.map(card => card.element));
			for (const element of cardStability.keys()) if (!present.has(element)) cardStability.delete(element);
			for (const card of cards) {
				const signature = `${card.sourceId}\n${card.title}`;
				const seen = cardStability.get(card.element);
				if (!seen || seen.signature !== signature) { cardStability.set(card.element, { signature, since: now }); continue; }
				if (now - seen.since < LIMITS.stableCardMs) continue;
				const prior = cardSeen.get(card.sourceId);
				if (prior !== undefined && prior !== card.title) titleConflicts++;
				cardSeen.set(card.sourceId, card.title);
			}
		}
		function guardFailure() {
			if (!module.matchesPage()) return 'terminated_navigation';
			if (module.profileMarker() !== marker) return 'terminated_profile';
			if (!module.referenceUnchanged(reference)) return 'reference_changed';
			if (!module.rowPresent()) return 'terminated_boundary';
			if (clock.now() - started >= LIMITS.sessionMs) return 'session_timeout';
			return null;
		}
		function guardTick() {
			if (state !== 'collecting' && state !== 'traversal_stopped') return;
			const failure = guardFailure();
			if (failure) { discard(failure); return; }
			pull();
			if (observerSticky.includes('profile_changed')) { discard('terminated_profile'); return; }
			readCards();
		}

		// ---- Traversal -------------------------------------------------------------
		function stopTraversal(outcome) {
			if (state !== 'collecting') return;
			state = 'traversal_stopped';
			if (outcome !== null) traversalOutcome = traversalOutcome === 'manual_fallback' && outcome === 'assist_time_limit' ? 'manual_fallback' : outcome;
			traversalStoppedAt = clock.now();
			for (const id of timers) clock.clearTimeout(id);
			timers.clear();
			merge(bridge.request('cutoff'));
		}
		function step() {
			if (state !== 'collecting') return;
			pull();
			if (covered() >= total()) return stopTraversal('coverage_reached');
			if (clock.now() >= deadline) return stopTraversal('assist_time_limit');
			if (stalls >= LIMITS.stallLimit) return stopTraversal('stalled');
			if (advances >= maxClicks) return stopTraversal('advance_limit');
			// Every guard runs synchronously right before the arrow is chosen and
			// clicked, not only on the guard interval.
			const failure = guardFailure();
			if (failure) { discard(failure); return; }
			pull();
			if (observerSticky.includes('profile_changed')) { discard('terminated_profile'); return; }
			const button = module.nextButton();
			if (!button) {
				// Unsure about the arrow: stop clicking; the member may click. The
				// deadline still ends the traversal.
				traversalOutcome = 'manual_fallback';
				later(() => stopTraversal('assist_time_limit'), deadline - clock.now());
				return;
			}
			coveredAtClick = covered();
			clickedAt = clock.now();
			advances++;
			try { button.click(); } catch { sticky.add('observer_error'); }
			later(wait, LIMITS.waitPollMs);
		}
		function wait() {
			if (state !== 'collecting') return;
			pull();
			if (covered() > coveredAtClick) { stalls = 0; later(step, LIMITS.settleMs); return; }
			if (clock.now() >= deadline) { stopTraversal('assist_time_limit'); return; }
			if (clock.now() - clickedAt >= LIMITS.waitMaxMs) { stalls++; step(); return; }
			later(wait, LIMITS.waitPollMs);
		}

		// ---- Results -----------------------------------------------------------------
		function facts() {
			const allSticky = new Set([...sticky, ...observerSticky]);
			if (observerDisplaced) allSticky.add('observer_displaced');
			const typeCounts = { movie: 0, show: 0, unknown: 0 };
			for (const e of membership.values()) {
				if (e.entityType === 'Movie') typeCounts.movie++;
				else if (e.entityType === 'Show') typeCounts.show++;
				else typeCounts.unknown++;
			}
			let cardsOutside = 0;
			let cardTitleMismatch = 0;
			for (const [id, title] of cardSeen) {
				const pos = positionOf.get(id);
				if (pos === undefined) cardsOutside++;
				else if (membership.get(pos).title !== title) cardTitleMismatch++;
			}
			const neverRendered = [...membership.values()].filter(e => !cardSeen.has(e.id)).length;
			return {
				reference: Boolean(reference), referenceReason, ended, profileGuard: marker !== null,
				sticky: STICKY_PRIORITY.filter(c => allSticky.has(c)).concat([...allSticky].filter(c => !STICKY_PRIORITY.includes(c)).sort()),
				unobserved: reference ? Math.max(0, reference.total - covered()) : 0,
				unknownTypes: typeCounts.unknown, typeCounts, cardsOutside, titleConflicts: titleConflicts + cardTitleMismatch,
				neverRendered,
			};
		}
		function report(f) {
			const c = observerCounters;
			return {
				reportVersion: 1,
				module: 'netflix',
				mode: traversalOutcome === 'manual_fallback' ? 'manual_fallback' : 'assisted',
				state,
				stickyCodes: f.sticky,
				reportedTotal: reference ? reference.total : null,
				inlineEntries: reference ? reference.entries.length : 0,
				versionPresent: reference ? typeof reference.version === 'string' && reference.version.length > 0 : false,
				installedAtMsAfterLoad,
				transport: { fetch: c.transportFetch || 0, xhr: c.transportXhr || 0 },
				bodyForm: { get: c.bodyFormGet || 0, string: c.bodyFormString || 0, unsupported: c.unsupportedBody || 0 },
				endpointOther: c.endpointOther || 0,
				myListBindings: c.myListBindings || 0,
				ignoredBindings: c.ignoredBindings || 0,
				afterCutoff: c.afterCutoff || 0,
				pendingAtFinalize: lastPending,
				lateDropped: c.lateDropped || 0,
				accepted: c.accepted || 0,
				rejected: { ...(c.rejected || {}) },
				duplicateIdentical,
				sizeDrops: c.sizeDrops || 0,
				requestTooLarge: c.requestTooLarge || 0,
				responseUnreadable: c.responseUnreadable || 0,
				xhrReused: c.xhrReused || 0,
				networkErrors: c.networkErrors || 0,
				unsupportedInput: c.unsupportedInput || 0,
				budgetPeakBytes: c.budgetPeakBytes || 0,
				positionsCovered: covered(),
				acceptedRanges,
				unobservedPositions: f.unobserved,
				typeCounts: { ...f.typeCounts },
				unentitledEntries: c.unentitledEntries || 0,
				cardsSeen: cardSeen.size,
				cardsOutsideEntries: f.cardsOutside,
				cardTitleConflicts: f.titleConflicts,
				entriesNeverRendered: f.neverRendered,
				observerDisplaced,
				cleanupResult,
				traversalOutcome,
				advances,
				clickCap: maxClicks,
				stalls,
				traversalStoppedAfterMs: traversalStoppedAt !== null ? traversalStoppedAt - started : null,
				elapsedMs: started ? clock.now() - started : 0,
			};
		}
		function freezeResult(verdict, f) {
			const r = { verdict: verdict.verdict, reason: verdict.reason, report: report(f) };
			Object.freeze(r.report.transport); Object.freeze(r.report.bodyForm); Object.freeze(r.report.rejected);
			Object.freeze(r.report.typeCounts); Object.freeze(r.report.stickyCodes); Object.freeze(r.report);
			return Object.freeze(r);
		}
		function sealAndClean() {
			merge(bridge.request('seal'));
			const reply = bridge.request('cleanup');
			if (reply) {
				observerCounters = reply.counters || observerCounters;
				observerSticky = reply.sticky || observerSticky;
				cleanupResult = reply.cleanupResult || 'failed';
			} else {
				cleanupResult = 'failed';
			}
			if (cleanupResult === 'failed') sticky.add('cleanup_failed');
		}
		// After a result exists, only the counts-only result is kept.
		function releaseEvidence() {
			clearTimers();
			membership.clear();
			positionOf.clear();
			pageSignatures.clear();
			cardSeen.clear();
			cardStability.clear();
			reference = null;
			marker = null;
			try { if (typeof module.release === 'function') module.release(); } catch {}
		}
		function discard(code) {
			if (state === 'finalized' || state === 'discarded') return;
			clearTimers();
			const wasActive = state !== 'idle' && state !== 'preparing';
			ended = code;
			if (wasActive) sealAndClean();
			state = 'discarded';
			const f = facts();
			result = freezeResult(module.verdict(f), f);
			releaseEvidence();
		}

		return {
			prepare() {
				if (state !== 'idle') return { ok: false };
				state = 'preparing';
				if (!module.matchesPage()) { referenceReason = 'wrong_page'; return this.refuse(); }
				const read = module.readReference();
				if (!read.reference) { referenceReason = read.refusal; return this.refuse(); }
				if (!module.rowPresent()) { referenceReason = 'boundary_missing'; return this.refuse(); }
				reference = read.reference;
				marker = module.profileMarker();
				if (marker === null) { referenceReason = 'no_profile_guard'; reference = null; return this.refuse(); }
				const token = rand();
				const channel = `gw-diag-${rand()}`;
				return { ok: true, cfg: module.observerConfig(reference, marker, token, channel) };
			},
			refuse() {
				state = 'finalized';
				const f = facts();
				result = freezeResult(module.verdict(f), f);
				releaseEvidence();
				return { ok: false, result };
			},
			begin(install) {
				if (state !== 'preparing' || !reference) return this.status();
				started = clock.now();
				if (!install || !install.ok) { referenceReason = 'observer_install_failed'; reference = null; this.refuse(); return this.status(); }
				installedAtMsAfterLoad = install.installedAtMsAfterLoad ?? null;
				for (const e of reference.entries) addEntry(e, false);
				state = 'collecting';
				const inView = Math.max(1, module.cardsInView() || 1);
				clickCap = Math.ceil(reference.total / inView) + LIMITS.extraClicks;
				maxClicks = clickCap + LIMITS.stallLimit;
				deadline = started + LIMITS.deadlineMs;
				guardInterval = clock.setInterval(guardTick, LIMITS.guardMs);
				later(step, LIMITS.firstStepMs);
				return this.status();
			},
			stop() {
				if (state === 'collecting') stopTraversal('member_stopped');
				return this.status();
			},
			cancel() {
				discard('cancelled');
				return this.status();
			},
			finalize() {
				if (state === 'collecting') stopTraversal('member_stopped');
				if (state !== 'traversal_stopped') return this.status();
				state = 'finalizing';
				const t0 = clock.now();
				const hardStop = clock.setTimeout(() => { if (state === 'finalizing') discard('finalize_timeout'); }, LIMITS.finalizeMs);
				const drain = () => {
					if (state !== 'finalizing') return;
					merge(bridge.request('pull'));
					if (lastPending > 0 && clock.now() - t0 < LIMITS.drainMs) { later(drain, LIMITS.drainPollMs, false); return; }
					clock.clearTimeout(hardStop);
					clearTimers();
					// Seal, freeze, clean up, recheck guards, then compute one result.
					sealAndClean();
					const failure = guardFailure();
					if (failure && failure !== 'session_timeout') ended = failure;
					state = 'finalized';
					const f = facts();
					result = freezeResult(module.verdict(f), f);
					releaseEvidence();
				};
				drain();
				return this.status();
			},
			status() {
				const live = result ? null : report(facts());
				return {
					state,
					observed: result ? result.report.positionsCovered : covered(),
					reportedTotal: result ? result.report.reportedTotal : reference ? reference.total : null,
					traversalOutcome,
					pending: lastPending,
					report: result ? result.report : live,
					result,
				};
			},
			// Test hook: sizes of what the session still holds.
			retainedEvidence() {
				return Object.freeze({
					membership: membership.size, positions: positionOf.size, signatures: pageSignatures.size, cards: cardSeen.size, cardStates: cardStability.size,
					reference: reference !== null, marker: marker !== null, timers: timers.size + (guardInterval !== null ? 1 : 0),
				});
			},
		};
	}

	globalThis.GWCore = { createSession, LIMITS };
})();
