// Freeze the same anonymous public loader payloads for both builds. Only GET navigation requests are sent.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [directory, origin = "https://goodwatch.app"] = process.argv.slice(2);
if (!directory) throw new Error("Expected OUTPUT_DIR [PUBLIC_ORIGIN]");
const pages = {
	home: "/",
	movie: "/movie/603-the-matrix",
	show: "/show/1396-breaking-bad",
	person: "/person/138-quentin-tarantino",
	discover: "/discover",
	share_list: "/u/alperortac/lists/o1H79d4fVu",
};
await mkdir(directory, { recursive: true });
const fixtures = {};
const evidence = { origin, capturedAt: new Date().toISOString(), pages: {} };
for (const [name, pathname] of Object.entries(pages)) {
	const response = await fetch(new URL(pathname, origin), {
		method: "GET",
		headers: {
			"User-Agent":
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",
			Accept: "text/html",
			"Accept-Language": "en-US,en;q=0.9",
		},
	});
	if (!response.ok) throw new Error(`${pathname}: ${response.status}`);
	const html = await response.text();
	const context = /window\.__remixContext = ([\s\S]*?);<\/script>/.exec(
		html,
	)?.[1];
	if (!context) throw new Error(`${pathname}: no Remix context`);
	const data = JSON.parse(context).state.loaderData;
	if (data.root?.user !== null)
		throw new Error(`${pathname}: expected anonymous root`);
	fixtures[pathname] = data;
	evidence.pages[name] = {
		pathname,
		status: response.status,
		routeIds: Object.keys(data),
		htmlBytes: Buffer.byteLength(html),
	};
	await writeFile(path.join(directory, `${name}.html`), html);
}
await writeFile(
	path.join(directory, "loader-data.json"),
	JSON.stringify(fixtures),
);
await writeFile(
	path.join(directory, "capture.json"),
	JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence, null, 2));
