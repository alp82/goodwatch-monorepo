import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { queryBatch } from "./qdrant-http.server.ts";

test("real HTTP phase evidence survives delayed completion and excludes request data", async () => {
	const events: Record<string, any>[] = [];
	const original = console.info;
	const originalUrl = process.env.QDRANT_URL;
	console.info = (value) => events.push(JSON.parse(value));
	let mode = "normal";
	let release: (() => void) | undefined;
	const poolReleases: (() => void)[] = [];
	let poolReady: (() => void) | undefined;
	const server = http.createServer((_request, response) => {
		if (mode === "status") {
			response.writeHead(503);
			response.end("secret backend error");
			return;
		}
		if (mode === "invalid") {
			response.end("secret invalid JSON");
			return;
		}
		const send = () => {
			response.writeHead(200);
			response.write('{"time":0.002,"result":[');
			const end = () => response.end('{"points":[]}]}');
			if (mode === "body") release = end;
			else end();
		};
		if (mode === "pool") {
			poolReleases.push(send);
			if (poolReleases.length === 16) poolReady?.();
		} else if (mode === "headers") release = send;
		else send();
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	process.env.QDRANT_URL = `http://127.0.0.1:${address.port}`;
	try {
		await queryBatch("private-collection", [
			{ query: "private-vector", account: "private-account" },
		]);
		assert.equal(events.length, 1);
		assert.equal(events[0].event, "search.qdrant-http.v1");
		assert.equal(events[0].reusedSocket, false);
		assert.ok(events[0].connectMs >= 0);
		await queryBatch("private-collection", []);
		assert.equal(events[1].reusedSocket, true);
		for (const phase of ["headers", "body"]) {
			mode = phase;
			let completed = false;
			const pending = queryBatch("secret", [{}]).then(() => {
				completed = true;
			});
			assert.equal(
				await Promise.race([
					pending.then(() => "completed"),
					new Promise<string>((done) =>
						setTimeout(() => done("caller-deadline"), 35),
					),
				]),
				"caller-deadline",
			);
			assert.equal(completed, false);
			assert.equal(events.length, phase === "headers" ? 2 : 3);
			assert.ok(release);
			release();
			await pending;
			const event = events.at(-1)!;
			assert.ok(
				phase === "headers"
					? event.headersMs >= 25
					: event.responseEndMs - event.headersMs >= 25,
			);
			assert.equal(event.status, "completed");
			assert.equal(event.serverMs, 2);
		}
		mode = "headers";
		await assert.rejects(queryBatch("secret", [{}], { timeoutMs: 25 }));
		assert.equal(events.at(-1)!.reason, "timeout");
		for (const [failure, reason] of [
			["status", "http_status"],
			["invalid", "invalid_response"],
		]) {
			mode = failure;
			await assert.rejects(queryBatch("secret", [{}]));
			assert.equal(events.at(-1)!.reason, reason);
		}
		mode = "pool";
		const beforePool = events.length;
		const ready = new Promise<void>((done) => {
			poolReady = done;
		});
		const pendingPool = Array.from({ length: 17 }, () =>
			queryBatch("secret", [{}]),
		);
		await ready;
		await new Promise((done) => setTimeout(done, 50));
		assert.equal(poolReleases.length, 16);
		mode = "normal";
		poolReleases.forEach((send) => send());
		await Promise.all(pendingPool);
		assert.equal(events.length - beforePool, 17);
		assert.ok(events.slice(beforePool).some((event) => event.socketMs >= 40));
		assert.doesNotMatch(
			JSON.stringify(events),
			/private|secret|vector|account|collection/,
		);
		console.info = () => {
			throw new Error("sink secret");
		};
		mode = "normal";
		assert.deepEqual((await queryBatch("secret", [{}])).results, [[]]);
		mode = "status";
		await assert.rejects(queryBatch("secret", [{}]), /HTTP 503/);
	} finally {
		console.info = original;
		if (originalUrl === undefined) delete process.env.QDRANT_URL;
		else process.env.QDRANT_URL = originalUrl;
		server.closeAllConnections();
		await new Promise<void>((done) => server.close(() => done()));
	}
});
