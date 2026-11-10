import type { AccountDecision } from "../../../packages/yepwatch-contracts/proposal.ts";
import type {
	AccountRoomIndex,
	AccountRoomsStore,
	HistoricalDecision,
} from "./proposal-types.ts";
import type { Sql } from "./repository.server.ts";
import {
	accountIndexTable,
	accountHistoryTable,
	revokedSessionTable,
	columns,
	parseRow,
} from "./proposal-storage-schema.ts";
import { keyed } from "./crypto.server.ts";
import { IndeterminateWrite, RoomError } from "./errors.ts";

export const publicDecision = ({
	accountIds: _a,
	participantIds: _p,
	...decision
}: HistoricalDecision): AccountDecision => decision;

export function encodeDecision(d: HistoricalDecision) {
	return {
		id: d.id,
		room_id: d.roomId,
		room_label: d.roomLabel,
		title: d.title,
		year: d.year,
		poster_url: d.posterUrl,
		decided_at: d.decidedAt,
		people: d.people,
		account_ids: d.accountIds,
		participant_ids: d.participantIds,
	};
}
export function decodeDecision(d: Record<string, any>): HistoricalDecision {
	return {
		id: d.id,
		roomId: d.room_id,
		roomLabel: d.room_label,
		title: d.title,
		year: d.year,
		posterUrl: d.poster_url,
		decidedAt: d.decided_at,
		people: d.people,
		accountIds: d.account_ids,
		participantIds: d.participant_ids,
	};
}

/** The index is a locator only. Callers must check membership against the committed room head. */
export class SqlAccountRooms implements AccountRoomsStore {
	private published = new Map<string, string>();
	private sql: Sql;
	private secret: string;
	private now: () => number;
	constructor(sql: Sql, secret: string, now = Date.now) {
		this.sql = sql;
		this.secret = secret;
		this.now = now;
	}
	private key(userId: string) {
		return keyed(this.secret, "account-rooms", userId);
	}
	async revokeSession(id: string, expiresAt: number) {
		const key = this.key(id);
		try {
			await this.sql(
				`INSERT INTO ${revokedSessionTable.name} (id,expires_at) VALUES (?,?) ON CONFLICT DO NOTHING`,
				[key, expiresAt],
			);
		} catch (e) {
			if (!(e instanceof IndeterminateWrite)) throw e;
		}
		if (await this.sessionActive(id))
			throw new RoomError("busy", "Log out could not be confirmed", 503, true);
	}
	async sessionActive(id: string) {
		return !(
			await this.sql(`SELECT id FROM ${revokedSessionTable.name} WHERE id=?`, [
				this.key(id),
			])
		).rows.length;
	}
	async rooms(userId: string): Promise<AccountRoomIndex[]> {
		const row = (
			await this.sql(`SELECT rooms FROM ${accountIndexTable.name} WHERE id=?`, [
				this.key(userId),
			])
		).rows[0];
		return row
			? parseRow(accountIndexTable, { id: this.key(userId), rooms: row[0] })
					.rooms
			: [];
	}
	async remember(userId: string, entry: AccountRoomIndex) {
		const id = this.key(userId);
		for (let attempt = 0; attempt < 12; attempt++) {
			const row = (
				await this.sql(
					`SELECT rooms,_seq_no,_primary_term FROM ${accountIndexTable.name} WHERE id=?`,
					[id],
				)
			).rows[0];
			const old: AccountRoomIndex[] = row
				? parseRow(accountIndexTable, { id, rooms: row[0] }).rooms
				: [];
			if (
				old.some(
					(r) => r.roomId === entry.roomId && r.expiresAt === entry.expiresAt,
				)
			)
				return;
			const rooms = [
				...old.filter(
					(r) => r.expiresAt > this.now() && r.roomId !== entry.roomId,
				),
				entry,
			];
			parseRow(accountIndexTable, { id, rooms });
			try {
				const result = row
					? await this.sql(
							`UPDATE ${accountIndexTable.name} SET rooms=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
							[rooms, id, row[1], row[2]],
						)
					: await this.sql(
							`INSERT INTO ${accountIndexTable.name} (id,rooms) VALUES (?,?) ON CONFLICT DO NOTHING`,
							[id, rooms],
						);
				if (result.rowcount === 1) return;
			} catch (e) {
				if (!(e instanceof IndeterminateWrite)) throw e;
			}
		}
		throw new RoomError(
			"busy",
			"Your rooms could not be updated; retry shortly",
			503,
			true,
		);
	}
	async publish(decisions: HistoricalDecision[]) {
		const names = columns(accountHistoryTable);
		for (const decision of decisions) {
			const row = parseRow(accountHistoryTable, encodeDecision(decision));
			const fingerprint = JSON.stringify(row);
			if (this.published.get(decision.id) === fingerprint) continue;
			for (let attempt = 0; ; attempt++) {
				if (attempt >= 12)
					throw new RoomError(
						"busy",
						"Decision history is awaiting confirmation",
						503,
						true,
					);
				try {
					await this.sql(
						`INSERT INTO ${accountHistoryTable.name} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")}) ON CONFLICT DO NOTHING`,
						names.map((k) => row[k]),
					);
				} catch (e) {
					if (!(e instanceof IndeterminateWrite)) throw e;
				}
				const proof = (
					await this.sql(
						`SELECT ${names.join(",")},_seq_no,_primary_term FROM ${accountHistoryTable.name} WHERE id=?`,
						[decision.id],
					)
				).rows[0];
				if (!proof) continue;
				if (
					names.some(
						(k, i) =>
							k !== "account_ids" &&
							JSON.stringify(proof[i]) !== JSON.stringify(row[k]),
					)
				)
					throw new RoomError(
						"busy",
						"Decision history is inconsistent",
						503,
						true,
					);
				const previous = parseRow(
					accountHistoryTable,
					Object.fromEntries(names.map((k, i) => [k, proof[i]])),
				).account_ids as string[];
				if (decision.accountIds.every((id) => previous.includes(id))) break;
				const accountIds = [...new Set([...previous, ...decision.accountIds])];
				try {
					if (
						(
							await this.sql(
								`UPDATE ${accountHistoryTable.name} SET account_ids=? WHERE id=? AND _seq_no=? AND _primary_term=?`,
								[
									accountIds,
									decision.id,
									proof[names.length],
									proof[names.length + 1],
								],
							)
						).rowcount === 1
					)
						break;
				} catch (e) {
					if (!(e instanceof IndeterminateWrite)) throw e;
				}
			}
			this.published.set(decision.id, fingerprint);
			if (this.published.size > 2048)
				this.published.delete(this.published.keys().next().value!);
		}
	}
	async history(userId: string): Promise<AccountDecision[]> {
		// Listing may use search; explicit refresh makes a just-committed decision visible on another device.
		await this.sql(`REFRESH TABLE ${accountHistoryTable.name}`);
		const names = columns(accountHistoryTable);
		return (
			await this.sql(
				`SELECT ${names.join(",")} FROM ${accountHistoryTable.name} WHERE ?=ANY(account_ids) ORDER BY decided_at DESC,id DESC`,
				[userId],
			)
		).rows.map((values) =>
			publicDecision(
				decodeDecision(
					parseRow(
						accountHistoryTable,
						Object.fromEntries(names.map((k, i) => [k, values[i]])),
					),
				),
			),
		);
	}
}

export class MemoryAccountRooms implements AccountRoomsStore {
	private indexes = new Map<string, AccountRoomIndex[]>();
	private decisions = new Map<string, HistoricalDecision>();
	private revoked = new Set<string>();
	async revokeSession(id: string, _expiresAt: number) {
		this.revoked.add(id);
	}
	async sessionActive(id: string) {
		return !this.revoked.has(id);
	}
	async rooms(userId: string) {
		return structuredClone(this.indexes.get(userId) ?? []);
	}
	async remember(userId: string, entry: AccountRoomIndex) {
		this.indexes.set(userId, [
			...(this.indexes.get(userId) ?? []).filter(
				(r) => r.roomId !== entry.roomId,
			),
			structuredClone(entry),
		]);
	}
	async publish(decisions: HistoricalDecision[]) {
		for (const d of decisions) {
			const previous = this.decisions.get(d.id);
			this.decisions.set(
				d.id,
				structuredClone({
					...d,
					accountIds: [
						...new Set([...(previous?.accountIds ?? []), ...d.accountIds]),
					],
				}),
			);
		}
	}
	async history(userId: string) {
		return [...this.decisions.values()]
			.filter((d) => d.accountIds.includes(userId))
			.map((d) => publicDecision(structuredClone(d)))
			.sort((a, b) => b.decidedAt - a.decidedAt || b.id.localeCompare(a.id));
	}
}
