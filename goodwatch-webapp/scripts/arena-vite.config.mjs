import { fileURLToPath } from "node:url";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default {
	resolve: {
		alias: [{ find: /^~\//, replacement: `${here("../app")}/` }],
	},
};
