import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
	paths,
	type GuestAdmission,
} from "../../../packages/yepwatch-contracts/continuous.ts";
import { ContinuousService } from "./continuous-service.server.ts";
import {
	ContinuousMemoryRepository,
	continuousFixtureCatalog,
} from "./continuous-test-support.ts";
import { IndeterminateWrite } from "./errors.ts";
import { createContinuousHandler } from "./continuous-http.server.ts";
const admission = (nickname: string) => ({
	contractVersion: 2 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
});
test("HTTP exact admission replay recovers lost acknowledgements, but revoked create/join replay denies without disclosure or mutation", async () => {
	const repo = new ContinuousMemoryRepository();
	const service = new ContinuousService(
		repo,
		continuousFixtureCatalog,
		"admission-revocation-test-secret-at-least-32",
	);
	const handler = createContinuousHandler(service, {
		serviceSecret: "admission-gateway-test-secret-at-least-32",
		allowedOrigins: ["http://127.0.0.1:8132"],
		secureCookies: false,
	});
	const post = (path: string, value: unknown) =>
		handler(
			new Request("http://127.0.0.1:15993" + path, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-yepwatch-client": "native",
				},
				body: JSON.stringify(value),
			}),
		);
	const insert = repo.insert.bind(repo);
	let loseInsertAck = true;
	repo.insert = async (room) => {
		const inserted = await insert(room);
		if (loseInsertAck) {
			loseInsertAck = false;
			throw new IndeterminateWrite(
				"Injected committed admission acknowledgement loss",
			);
		}
		return inserted;
	};
	const create = admission("Host");
	const first = await post(paths.rooms, create);
	assert.equal(first.status, 200);
	const a = (await first.json()) as GuestAdmission;
	const id = a.credential.roomId;
	const retry = await post(paths.rooms, create);
	assert.equal(retry.status, 200);
	const replay = (await retry.json()) as GuestAdmission;
	assert.deepEqual(replay.credential, a.credential);
	assert.equal(replay.snapshot.shared.participants.length, 1);
	const join = { ...admission("Guest"), inviteCode: a.invite.code };
	repo.ambiguousNext = true;
	const joined = await post(paths.join(id), join);
	assert.equal(joined.status, 200);
	const b = (await joined.json()) as GuestAdmission;
	const joinedRetry = await post(paths.join(id), join);
	assert.equal(joinedRetry.status, 200);
	assert.deepEqual(
		((await joinedRetry.json()) as GuestAdmission).credential,
		b.credential,
	);
	await service.revokeParticipant(id, a.credential.participantId);
	await service.revokeParticipant(id, b.credential.participantId);
	const before = structuredClone((await repo.read(id))!.room);
	for (const [path, body] of [
		[paths.rooms, create],
		[paths.join(id), join],
	] as const) {
		const denied = await post(path, body);
		assert.equal(denied.status, 401);
		assert.equal(denied.headers.get("set-cookie"), null);
		const value = await denied.json();
		assert.equal(value.error.code, "unauthorized");
		for (const field of ["snapshot", "credential", "invite", "shared", "own"])
			assert.equal(value[field], undefined);
		assert.deepEqual((await repo.read(id))!.room, before);
	}
	assert.equal(before.participants.length, 2);
	assert.ok(before.participants.every((p) => p.revoked));
	assert.equal(before.decision, null);
});
test("Admission recovery also denies independently rotated token verifier or capability epoch", async () => {
	for (const change of ["token", "epoch"] as const) {
		const repo = new ContinuousMemoryRepository();
		const service = new ContinuousService(
			repo,
			continuousFixtureCatalog,
			"admission-revocation-test-secret-at-least-32",
		);
		const request = admission("Host");
		const a = await service.create(request);
		const stored = (await repo.read(a.credential.roomId))!;
		if (change === "token") stored.room.participants[0].tokenHash = "rotated";
		else stored.room.participants[0].epoch++;
		await repo.compareAndSwap(
			(await repo.read(a.credential.roomId))!,
			stored.room,
			false,
		);
		const before = structuredClone(
			(await repo.read(a.credential.roomId))!.room,
		);
		await assert.rejects(
			() => service.create(request),
			(e: unknown) =>
				!!e &&
				typeof e === "object" &&
				"code" in e &&
				e.code === "unauthorized",
		);
		assert.deepEqual((await repo.read(a.credential.roomId))!.room, before);
	}
});
