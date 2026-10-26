// Input preparation is outside navigation latency: a phone poster's first tap can
// reveal actions instead of navigating. Only its explicit Open anchor is safe.
export const HUB = 'header button[aria-haspopup="dialog"]:visible, button[aria-label^="Browse GoodWatch"]:visible'

export async function openPhoneCard(page, pick, target) {
	const card = pick.locator('xpath=ancestor::*[@data-poster-card][1]')
	if (!(await card.count())) return false
	const open = card.locator('a[aria-label^="Open "]:visible')
	// React can paint the reveal after Playwright's tap promise resolves.
	try { await open.first().waitFor({ state: 'visible', timeout: 2000 }) }
	catch { return false }
	const navigation = await open.first().getAttribute('href')
	if (navigation !== target) throw new Error('Card Open destination changed')
	await open.first().evaluate((a) => {
		document.querySelectorAll('[data-gwnav]').forEach(el => el.removeAttribute('data-gwnav'))
		a.setAttribute('data-gwnav', '1')
	})
	return true
}

export function assertCoverage(runs) {
	const bad = runs.flatMap((run, i) => run.filter(s => s.error || s.commit == null || s.paint == null || !s.verified).map(s => `${i + 1}:${s.step}`))
	if (runs.some(run => run.length !== 13) || bad.length) throw new Error(`Incomplete navigation coverage: ${bad.join(', ')}`)
}

export const INIT = () => {
	// Block writes in page APIs without Playwright routing, which disables HTTP
	// caching and would change the benchmark. No form or beacon writes either.
	// Catalog query POSTs from app/navigation/loader-cache.ts READ_ONLY_POSTS.
	// Telemetry, impressions and image warming stay blocked.
	const queryPosts = ['/api/combined-search', '/api/discover/results', '/api/explorer/',
		'/api/living-room/picks', '/api/taste/match', '/api/taste/portrait', '/api/title-cards',
		'/api/tonight', '/api/watch-next', '/api/watch-next/cards', '/api/watchability']
	const readOnly = (method, input) => {
		if (/^(GET|HEAD|OPTIONS)$/i.test(method || 'GET')) return true
		const url = new URL(input?.url || input, location.href)
		return /^POST$/i.test(method) && url.origin === location.origin && queryPosts.some(path =>
			path.endsWith('/') ? url.pathname.startsWith(path) : url.pathname === path)
	}
	const fetch = window.fetch
	window.fetch = function(input, init) {
		if (!readOnly(init?.method || input?.method, input)) return Promise.reject(new Error('Read-only benchmark'))
		return fetch.call(this, input, init)
	}
	const open = XMLHttpRequest.prototype.open
	XMLHttpRequest.prototype.open = function(method, ...args) {
		if (!readOnly(method, args[0])) throw new Error('Read-only benchmark')
		return open.call(this, method, ...args)
	}
	navigator.sendBeacon = () => false
	addEventListener('submit', event => event.preventDefault(), true)
	HTMLFormElement.prototype.submit = () => { throw new Error('Read-only benchmark') }

	try { performance.setResourceTimingBufferSize(10000) } catch {}
	window.__gw = { t0: null, commit: null, paint: null, origin: performance.timeOrigin }
	const mark = () => { window.__gw = { ...window.__gw, t0: performance.now(), commit: null, paint: null } }
	addEventListener('pointerdown', (e) => { if (e.target.closest?.('[data-gwnav]')) mark() }, true)
	window.__gwMark = mark
	const hook = () => {
		const r = window.__remixRouter
		if (!r) return setTimeout(hook, 50)
		let key = r.state.location.key
		r.subscribe((s) => {
			if (s.navigation.state === 'idle' && s.location.key !== key) {
				key = s.location.key
				const sample = window.__gw
				if (sample.t0 == null || sample.commit != null) return
				sample.commit = performance.now()
				requestAnimationFrame(() => setTimeout(() => {
					if (window.__gw === sample) sample.paint = performance.now()
				}, 0))
			}
		})
	}
	hook()
}

// A bare Discover link can restore the member's default query without leaving
// its destination. Explicit queries and history entries still match exactly.
export function matchesDestination(actual, expected, history = false) {
	if (actual === expected) return true
	return !history && expected === '/discover' && actual.startsWith('/discover?')
}
