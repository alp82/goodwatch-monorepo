import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type {
	GuestAdmission,
	RoomCommand,
} from "../../../packages/yepwatch-contracts/proposal.ts";
import type { RoomAccount } from "./proposal-types.ts";
import { ProposalService } from "./proposal-service.server.ts";
import {
	ProposalMemoryRepository,
	proposalFixtureCatalog,
} from "./proposal-test-support.ts";
import { RoomError } from "./errors.ts";

const secret = "account-identity-tests-at-least-thirty-two-characters";
const request = (nickname = "Alex") => ({
	contractVersion: 3 as const,
	commandId: randomBytes(16).toString("hex"),
	admissionSecret: randomBytes(32).toString("base64url"),
	nickname,
});
const account = (sessionId: string, userId = "alex"): RoomAccount => ({
	sessionId,
	userId,
	expiresAt: Date.now() + 86400000,
});
const credential = (a: GuestAdmission, who?: RoomAccount) => ({
	participantId: a.credential.participantId,
	token: a.credential.token,
	...(who ? { accountId: who.userId, sessionId: who.sessionId } : {}),
});
const isError = (code: string) => (e: unknown) =>
	e instanceof RoomError && e.code === code;
async function send(
	service: ProposalService,
	a: GuestAdmission,
	who: RoomAccount | undefined,
	command: RoomCommand,
) {
	const c = credential(a, who),
		id = a.credential.roomId;
	const snapshot = await service.read(id, c);
	return service.command(id, c, {
		commandId: randomBytes(16).toString("hex"),
		sequence: snapshot.own.nextSequence,
		command,
	});
}
async function choosing(
	service: ProposalService,
	a: GuestAdmission,
	who?: RoomAccount,
) {
	const setup = await send(service, a, who, {
		type: "setup",
		expectedContextVersion: 1,
		screens: [
			{
				id: "room",
				label: "Our room",
				country: "DE",
				serviceIds: [1],
				confirmed: true,
			},
		],
		constraints: { kinds: ["movie"], moods: [], maxMinutes: null },
		screenId: "room",
	});
	return send(service, a, who, {
		type: "start",
		expectedContextVersion: setup.snapshot.shared.contextVersion,
		expectedRosterVersion: setup.snapshot.shared.rosterVersion,
		hostReady: true,
	});
}

test("simultaneous joins across API instances recover one account participant and independent device commands", async () => {
	const repo = new ProposalMemoryRepository();
	const first = new ProposalService(repo, proposalFixtureCatalog, secret);
	const second = new ProposalService(repo, proposalFixtureCatalog, secret);
	const host = await first.create(request("Host"));
	const id = host.credential.roomId;
	const phone = account("phone"),
		pc = account("pc");
	const [a, b] = await Promise.all([
		first.join(id, { ...request(), inviteCode: host.invite.code }, phone),
		second.join(id, { ...request(), inviteCode: host.invite.code }, pc),
	]);
	assert.equal(a.credential.participantId, b.credential.participantId);
	assert.notEqual(a.credential.token, b.credential.token);
	assert.equal((await repo.read(id))!.room.participants.length, 2);
	const [one, two] = await Promise.all([
		send(first, a, phone, { type: "rename", nickname: "Alex on phone" }),
		send(second, b, pc, { type: "rename", nickname: "Alex on PC" }),
	]);
	assert.equal(one.receipt.sequence, 1);
	assert.equal(two.receipt.sequence, 1);
	assert.equal(
		(await first.read(id, credential(a, phone))).own.nextSequence,
		2,
	);
	assert.equal((await second.read(id, credential(b, pc))).own.nextSequence, 2);
	const again = await second.join(
		id,
		{ ...request(), inviteCode: host.invite.code },
		pc,
	);
	assert.equal(again.credential.participantId, a.credential.participantId);
	assert.equal((await repo.read(id))!.room.rosterVersion, 2);
	const wrong = { ...credential(a, phone), accountId: "someone-else" };
	await assert.rejects(first.read(id, wrong), isError("unauthorized"));
	await assert.rejects(first.read(id, a.credential), isError("unauthorized"));
});

test("a second device retains host rights; stale votes conflict and exact retries do not vote twice", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret);
	const phone = account("phone"),
		pc = account("pc");
	const a = await service.create(request(), phone),
		id = a.credential.roomId;
	const b = await service.resumeAccount(id, pc);
	assert.equal(b.snapshot.own.canHost, true);
	const state = (await choosing(service, a, phone)).snapshot;
	const candidateId = state.shared.candidates[0].id;
	const command = {
		type: "vote" as const,
		generation: state.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "watch" as const,
	};
	const envelope = {
		commandId: "phone-vote",
		sequence: state.own.nextSequence,
		command,
	};
	const voted = await service.command(id, credential(a, phone), envelope);
	const replay = await service.command(id, credential(a, phone), envelope);
	assert.equal(replay.receipt.replayed, true);
	assert.equal(replay.receipt.appliedRevision, voted.receipt.appliedRevision);
	await assert.rejects(
		send(service, b, pc, { ...command, value: "pass" }),
		isError("conflict"),
	);
	const other = await service.read(id, credential(b, pc));
	assert.equal(other.own.votes[0].value, "watch");
	assert.equal(
		other.own.nextSequence,
		1,
		"the PC never consumes the phone command sequence",
	);
	assert.equal(
		other.shared.matches.length,
		1,
		"one account is one required vote",
	);
	await send(service, b, pc, {
		...command,
		expectedVoteRevision: 1,
		value: "pass",
	});
	assert.equal(
		(await service.read(id, credential(a, phone))).own.votes[0].value,
		"pass",
	);
});

test("Leave applies to all devices; sign-in and listing do not rejoin; explicit Return recovers the same place", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret);
	const phone = account("phone"),
		pc = account("pc");
	const a = await service.create(request(), phone),
		id = a.credential.roomId;
	const b = await service.resumeAccount(id, pc);
	const guest = await service.join(id, {
		...request("Friend"),
		inviteCode: a.invite.code,
	});
	const ticket = await service.ticket(id, credential(b, pc)),
		lease = await service.attach(id, ticket.ticket);
	await send(service, a, phone, { type: "leave" });
	assert.equal((await service.read(id, credential(b, pc))).own.left, true);
	await assert.rejects(service.view(id, lease.lease), isError("forbidden"));
	await assert.rejects(service.resumeAccount(id, pc), isError("forbidden"));
	assert.equal(
		(await service.accountHome(pc)).rooms[0].snapshot.own.left,
		true,
	);
	assert.equal((await service.read(id, credential(guest))).own.canHost, true);
	const returned = await service.resumeAccount(id, pc, true);
	assert.equal(returned.credential.participantId, a.credential.participantId);
	assert.equal(
		returned.snapshot.own.canHost,
		false,
		"the current host retains hosting",
	);
	assert.equal((await repo.read(id))!.room.participants.length, 2);
});

test("logout revokes only one login and its leases, while membership, history and other devices survive", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret);
	const phone = account("phone"),
		pc = account("pc");
	const a = await service.create(request(), phone),
		id = a.credential.roomId;
	const b = await service.resumeAccount(id, pc);
	const ticket = await service.ticket(id, credential(a, phone)),
		lease = await service.attach(id, ticket.ticket);
	await service.logoutAccount(phone);
	assert.equal(await service.accounts.sessionActive(phone.sessionId), false);
	await assert.rejects(
		service.read(id, credential(a, phone)),
		isError("unauthorized"),
	);
	await assert.rejects(service.view(id, lease.lease), isError("forbidden"));
	assert.equal((await service.read(id, credential(b, pc))).own.canHost, true);
	assert.equal((await service.accountHome(pc)).rooms.length, 1);
});

test("guest upgrade preserves votes and host; a duplicate guest resumes the existing account without merging answers", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret);
	const a = await service.create(request()),
		id = a.credential.roomId;
	const state = (await choosing(service, a)).snapshot,
		candidateId = state.shared.candidates[0].id;
	await send(service, a, undefined, {
		type: "vote",
		generation: state.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "watch",
	});
	const phone = account("phone"),
		upgraded = await service.linkAccount(id, credential(a), phone);
	assert.equal(upgraded.credential.participantId, a.credential.participantId);
	assert.equal(upgraded.snapshot.own.votes[0].value, "watch");
	assert.equal(upgraded.snapshot.own.canHost, true);
	await assert.rejects(
		service.read(id, credential(a)),
		isError("unauthorized"),
	);
	const phoneTicket = await service.ticket(id, credential(upgraded, phone));
	const phoneLease = await service.attach(id, phoneTicket.ticket);
	const guest = await service.join(id, {
		...request("Temporary guest"),
		inviteCode: a.invite.code,
	});
	await send(service, guest, undefined, {
		type: "vote",
		generation: state.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "pass",
	});
	const pc = account("pc"),
		recovered = await service.linkAccount(id, credential(guest), pc);
	assert.equal(recovered.credential.participantId, a.credential.participantId);
	assert.equal(recovered.snapshot.own.votes[0].value, "watch");
	assert.equal(recovered.snapshot.shared.participants.length, 1);
	assert.equal(
		(await service.view(id, phoneLease.lease)).snapshot.participants.length,
		1,
		"the existing account device stays authorized",
	);
	assert.equal(recovered.replacedGuest, true);
	assert.equal(recovered.snapshot.own.agreement.agreed, false);
	await assert.rejects(
		service.read(id, credential(guest)),
		isError("forbidden"),
	);
});

test("server records history with no observing device; repair after a crash retains it across restart and expiry", async () => {
	let now = Date.now();
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			secret,
			async () => {},
			() => now,
		);
	const phone = account("phone"),
		pc = account("pc"),
		other = account("other", "other-account");
	const a = await service.create(request(), phone),
		id = a.credential.roomId;
	await service.archiveAccountRoom(id, phone, true);
	assert.ok((await service.accountHome(pc)).rooms[0].archivedAt);
	assert.equal((await service.accountHome(other)).rooms.length, 0);
	const state = (await choosing(service, a, phone)).snapshot,
		candidateId = state.shared.candidates[0].id;
	await send(service, a, phone, {
		type: "vote",
		generation: state.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "watch",
	});
	const publish = repo.accountStore.publish.bind(repo.accountStore);
	repo.accountStore.publish = async () => {
		throw new Error("archive temporarily unavailable");
	};
	const voted = await service.read(id, credential(a, phone));
	const decided = await send(service, a, phone, {
		type: "propose",
		generation: voted.shared.generation,
		expectedRosterVersion: voted.shared.rosterVersion,
		expectedProposalVersion: voted.shared.proposalVersion,
		candidateId,
	});
	assert.equal(decided.snapshot.shared.phase, "decided");
	assert.equal((await repo.accountStore.history(phone.userId)).length, 0);
	assert.ok(
		(await repo.read(id))!.pendingRevision,
		"unprojected decisions remain in the durable outbox",
	);
	repo.accountStore.publish = publish;
	const restarted = new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		() => now,
	);
	await restarted.repair();
	const history = (await restarted.accountHome(pc)).decisions;
	assert.equal(history.length, 1);
	assert.equal(
		history[0].title,
		decided.snapshot.shared.candidates.find((c) => c.id === candidateId)!.title,
	);
	await send(restarted, a, phone, {
		type: "restart",
		expectedRevision: decided.snapshot.shared.revision,
	});
	assert.deepEqual((await restarted.accountHome(pc)).decisions, history);
	now = (await repo.read(id))!.room.expiresAt + 1;
	repo.rows.delete(id);
	assert.deepEqual((await restarted.accountHome(pc)).decisions, history);
	assert.equal((await restarted.accountHome(other)).decisions.length, 0);
	assert.equal(JSON.stringify(history).includes("accountIds"), false);
});

test("a lost guest-upgrade acknowledgement recovers the canonical account place with the original credential", async () => {
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(repo, proposalFixtureCatalog, secret);
	const guest = await service.create(request()),
		phone = account("phone");
	repo.ambiguousNext = true;
	const linked = await service.linkAccount(
		guest.credential.roomId,
		credential(guest),
		phone,
	);
	assert.equal(linked.credential.participantId, guest.credential.participantId);
	const retried = await service.linkAccount(
		guest.credential.roomId,
		credential(guest),
		phone,
	);
	assert.deepEqual(retried.credential, linked.credential);
	assert.equal(
		(await repo.read(guest.credential.roomId))!.room.participants.length,
		1,
	);
});

test("an unprojected committed decision is repaired even after the live room has expired", async () => {
	let now = Date.now();
	const repo = new ProposalMemoryRepository(),
		service = new ProposalService(
			repo,
			proposalFixtureCatalog,
			secret,
			async () => {},
			() => now,
		);
	const phone = account("phone"),
		room = await service.create(request(), phone),
		id = room.credential.roomId;
	const state = (await choosing(service, room, phone)).snapshot,
		candidateId = state.shared.candidates[0].id;
	await send(service, room, phone, {
		type: "vote",
		generation: state.shared.generation,
		candidateId,
		expectedVoteRevision: 0,
		value: "watch",
	});
	const publish = repo.accountStore.publish.bind(repo.accountStore);
	repo.accountStore.publish = async () => {
		throw new Error("archive unavailable");
	};
	const voted = await service.read(id, credential(room, phone));
	await send(service, room, phone, {
		type: "propose",
		generation: voted.shared.generation,
		candidateId,
		expectedProposalVersion: voted.shared.proposalVersion,
		expectedRosterVersion: voted.shared.rosterVersion,
	});
	now = (await repo.read(id))!.room.expiresAt + 1;
	repo.accountStore.publish = publish;
	await new ProposalService(
		repo,
		proposalFixtureCatalog,
		secret,
		async () => {},
		() => now,
	).repair();
	assert.equal((await repo.accountStore.history(phone.userId)).length, 1);
	assert.equal((await repo.read(id))!.pendingRevision, 0);
});
