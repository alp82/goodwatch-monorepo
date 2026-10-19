/* GoodWatch capture diagnostic: isolated-world entry (ticket #730).
 * Wires the shared core to the Netflix module and to the page-world observer.
 * The bridge uses a per-session DOM event channel with a random name and
 * token; it separates sessions but isn't authentication (DESIGN.md). */
(() => {
	if (globalThis.__gwDiagCommand) return;
	let session = null;
	let channel = null;
	let token = null;
	const bridge = {
		request(op) {
			if (!channel) return null;
			let reply = null;
			const onReply = event => { if (typeof event.detail === 'string') reply = event.detail; };
			document.addEventListener(`${channel}:res`, onReply);
			document.dispatchEvent(new CustomEvent(`${channel}:req`, { detail: JSON.stringify({ token, op }) }));
			document.removeEventListener(`${channel}:res`, onReply);
			try {
				return reply ? JSON.parse(reply) : null;
			} catch {
				return null;
			}
		},
	};
	const clock = {
		now: () => Date.now(),
		setTimeout: (fn, ms) => setTimeout(fn, ms),
		clearTimeout: id => clearTimeout(id),
		setInterval: (fn, ms) => setInterval(fn, ms),
		clearInterval: id => clearInterval(id),
	};
	const active = () => session && !['finalized', 'discarded', 'idle'].includes(session.status().state);
	globalThis.__gwDiagCommand = command => {
		const action = command && command.action;
		if (action === 'prepare') {
			if (active()) return { ok: false, status: session.status() };
			session = globalThis.GWCore.createSession({ module: globalThis.GWNetflix, bridge, clock });
			const r = session.prepare();
			if (r.ok) {
				channel = r.cfg.channel;
				token = r.cfg.token;
			}
			return { ok: r.ok, cfg: r.ok ? r.cfg : null, status: session.status() };
		}
		if (!session) return { status: { state: 'idle' } };
		let status;
		if (action === 'begin') status = session.begin(command.install);
		else if (action === 'stop') status = session.stop();
		else if (action === 'finalize') status = session.finalize();
		else if (action === 'cancel') status = session.cancel();
		else status = session.status();
		// Once a result exists, drop the channel and token; keep only the result.
		if (status.result) { channel = null; token = null; }
		return { status };
	};
})();
