// Build-only fixture adapter. Never load the production server entry or execute a real loader.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

export default function fixturePlugin({ app, payload }) {
	const require = createRequire(path.join(app, "package.json"));
	const {
		removeExports,
	} = require("@remix-run/dev/dist/vite/remove-exports.js");
	const fixtures = JSON.parse(readFileSync(payload, "utf8"));
	const routeIds = new Set(
		Object.values(fixtures).flatMap((data) => Object.keys(data)),
	);
	let isServer = false;
	let safeEntryLoaded = false;
	const replacedRoutes = new Set();
	return [
		{
			name: "cwv-isolated-fixtures",
			enforce: "pre",
			configResolved(config) {
				isServer = Boolean(config.build.ssr);
			},
			generateBundle() {
				if (!isServer) return;
				if (!safeEntryLoaded)
					this.error("Refusing SSR build without safe fixture entry");
				for (const route of routeIds)
					if (!replacedRoutes.has(route))
						this.error(`Frozen loader was not installed: ${route}`);
			},
			load(id, options) {
				if (!options?.ssr || id !== path.join(app, "app/entry.server.tsx"))
					return;
				safeEntryLoaded = true;
				return `
import { RemixServer } from "@remix-run/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { setServerAssetBase, manifestAt } from "~/utils/asset-url";
import { earlyHintLinks } from "~/server/early-hints";
import site from "~/tailwind.css?url";
import font from "~/fonts/gabarito-latin.woff2";
import { START_SHEETS } from "~/ui/start/start-sheets";
import { WHITE_MARK } from "~/ui/brand/white-mark";
import { START_ROOM_ART, START_ROOM_PHONE_ART } from "~/ui/start/room/room-pictures";
export const fixtureHints = (request, base) => earlyHintLinks(request, base, {site, font, home: [...START_SHEETS], room:{phone:[START_ROOM_PHONE_ART.avif],desktop:[START_ROOM_ART.avif]}, marks:{images:[WHITE_MARK],masks:[]}});
export default function handle(request, status, headers, context) {
 const base = globalThis.__CWV_ASSET_BASE__ || "";
 setServerAssetBase(() => base);
 headers.set("Content-Type", "text/html; charset=utf-8");
 const html = renderToString(createElement(RemixServer, {context: {...context, manifest: manifestAt(context.manifest, base)}, url: request.url}));
 return new Response("<!DOCTYPE html>" + html, {status, headers});
}`;
			},
		},
		{
			name: "cwv-fixture-route-loaders",
			transform(source, id, options) {
				if (!options?.ssr) return;
				const file = id.split("?", 1)[0];
				const relative = path
					.relative(path.join(app, "app"), file)
					.replaceAll(path.sep, "/");
				if (
					!(
						relative === "root.tsx" || /^routes\/[^/]+\.[jt]sx?$/.test(relative)
					)
				)
					return;
				const routeId = relative.replace(/\.[^.]+$/, "");
				let { code } = removeExports(source, ["loader", "action", "headers"]);
				if (routeIds.has(routeId)) {
					replacedRoutes.add(routeId);
					code += `\nexport async function loader({request}) {
 const path = new URL(request.url).pathname;
 const data = globalThis.__CWV_FIXTURES__[path];
 if (!data || !Object.hasOwn(data, ${JSON.stringify(routeId)})) throw new Response("Missing frozen fixture", {status:404});
 return data[${JSON.stringify(routeId)}];
}\n`;
				}
				return { code, map: null };
			},
		},
	];
}
