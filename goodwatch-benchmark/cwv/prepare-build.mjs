// node prepare-build.mjs APP_DIR OUTPUT_DIR CAPTURED_LOADER_DATA
// The generated config lives in ignored build/. Client configuration/chunking remains the real production one.
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length !== 3 || args.some((value) => !value))
	throw new Error("Expected APP_DIR OUTPUT_DIR CAPTURED_LOADER_DATA");
const [app, output, payload] = args.map((value) => path.resolve(value));
const replaceOnce = (source, target, replacement) => {
	if (source.split(target).length !== 2)
		throw new Error(`Fixture config expected exactly one ${target}`);
	return source.replace(target, replacement);
};
const helper = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"fixture-plugin.mjs",
);
const configDir = path.join(app, "build/cwv-fixture-config");
await mkdir(configDir, { recursive: true });
await mkdir(path.join(configDir, "empty-env"), { recursive: true });
await mkdir(output, { recursive: true });
try {
	await symlink(
		path.join(app, "node_modules"),
		path.join(output, "node_modules"),
	);
} catch (error) {
	if (error.code !== "EEXIST") throw error;
}
let source = await readFile(path.join(app, "vite.config.js"), "utf8");
source = replaceOnce(
	source,
	'"./app/utils/blog-linked-titles.js"',
	JSON.stringify(path.join(app, "app/utils/blog-linked-titles.js")),
);
source = `import fixturePlugin from ${JSON.stringify(helper)};\n${source}`;
source = replaceOnce(
	source,
	"export default defineConfig(({ mode, isSsrBuild }) => ({",
	`export default defineConfig(({ mode, isSsrBuild }) => ({\nroot: ${JSON.stringify(app)},\nenvDir: ${JSON.stringify(path.join(configDir, "empty-env"))},`,
);
source = replaceOnce(
	source,
	"plugins: [",
	`plugins: [fixturePlugin(${JSON.stringify({ app, payload })}),`,
);
source = replaceOnce(
	source,
	"remix({",
	`remix({buildDirectory: ${JSON.stringify(output)},`,
);
source = replaceOnce(
	source,
	"sentryVitePlugin({",
	"sentryVitePlugin({telemetry: false,",
);
const config = path.join(configDir, "vite.config.mjs");
await writeFile(config, source);
console.log(config);
