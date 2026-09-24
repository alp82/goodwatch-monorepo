import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default {
	resolve: {
		alias: [
			{ find: /^~\//, replacement: `${here("../app")}/` },
			// Timing wrapper around undici fetch (Crate and TMDB calls), only for arena-stages.
			...(process.env.ARENA_TIMED_FETCH
				? [{ find: /^undici$/, replacement: here("./arena-timed-undici.ts") }]
				: []),
			// Full request/response capture of Crate and TMDB calls, only for arena-capture.
			...(process.env.ARENA_CAPTURE_FETCH
				? [{ find: /^undici$/, replacement: here("./arena-capture-undici.ts") }]
				: []),
		],
	},
};
