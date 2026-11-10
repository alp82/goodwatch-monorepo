import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { denyOutboundConnections } from "./fixture-safety.mjs";
import fixturePlugin from "./fixture-plugin.mjs";

test("outbound TCP and fetch fail before connecting while a listener can still start", async () => {
	denyOutboundConnections();
	assert.throws(
		() => net.connect({ host: "127.0.0.1", port: 9 }),
		/Fixture forbids outbound socket/,
	);
	await assert.rejects(
		fetch("https://fixture.invalid"),
		/Fixture forbids outbound fetch/,
	);
	const server = net.createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	assert.ok(server.address().port > 0);
	await new Promise((resolve) => server.close(resolve));
});

test("fixture server build fails closed if the safe entry or a frozen loader wasn't installed", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "gw-cwv-fixture-test-"));
	const app = path.resolve(import.meta.dirname, "../../goodwatch-webapp");
	const payload = path.join(directory, "loader-data.json");
	writeFileSync(
		payload,
		JSON.stringify({
			"/": { root: { user: null }, "routes/_index": { titles: [] } },
		}),
	);
	try {
		const [entry, routes] = fixturePlugin({ app, payload });
		entry.configResolved({ build: { ssr: true } });
		const context = {
			error(message) {
				throw new Error(message);
			},
		};
		assert.throws(
			() => entry.generateBundle.call(context),
			/without safe fixture entry/,
		);
		const code = entry.load(path.join(app, "app/entry.server.tsx"), {
			ssr: true,
		});
		assert.match(code, /RemixServer/);
		assert.doesNotMatch(
			code,
			/import.*entry\.server|startLifecycle|startTitleSnapshot/,
		);
		assert.throws(
			() => entry.generateBundle.call(context),
			/Frozen loader was not installed/,
		);
		for (const id of ["root", "routes/_index"]) {
			const result = routes.transform(
				'import { live } from "./database.server"; export const loader = () => live(); export default function Page(){return null}',
				path.join(app, `app/${id}.tsx`),
				{ ssr: true },
			);
			assert.doesNotMatch(result.code, /database\.server|live\(\)/);
			assert.match(result.code, /__CWV_FIXTURES__/);
		}
		assert.doesNotThrow(() => entry.generateBundle.call(context));
	} finally {
		rmSync(directory, { recursive: true });
	}
});
