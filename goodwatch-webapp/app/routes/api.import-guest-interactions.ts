import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node";
import { z } from "zod";
import { getAuthFromRequest } from "~/utils/auth";
import { execute, query, upsert } from "~/utils/crate";
import { canonicalTitleId } from "~/utils/title-identity";
import { getUserData, resetUserDataCache } from "~/server/userData.server";
import { resetUserSettingsCache } from "~/server/user-settings.server";

const changeSchema = z
	.object({
		id: z.string().min(1),
		kind: z.enum(["score", "plan", "skip", "country", "services"]),
		tmdb_id: z.number().int().positive().optional(),
		media_type: z.enum(["movie", "show"]).optional(),
		value: z.string(),
		before: z.string().nullable(),
	})
	.superRefine((c, ctx) => {
		const invalid =
			(["score", "plan", "skip"].includes(c.kind) &&
				(!c.tmdb_id || !c.media_type)) ||
			(c.kind === "score" &&
				(!/^(10|[1-9])$/.test(c.value) ||
					(c.before !== null && !/^(10|[1-9])$/.test(c.before)))) ||
			(c.kind === "country" && !/^[A-Z]{2}$/.test(c.value)) ||
			(c.kind === "services" && !/^(\d+(,\d+)*)?$/.test(c.value));
		if (invalid)
			ctx.addIssue({ code: "custom", message: "Invalid selected change" });
	});
const requestSchema = z.object({
	id: z.string().uuid(),
	accountId: z.string().uuid(),
	changes: z.array(changeSchema),
});
type Change = z.infer<typeof changeSchema>;
type Journal = { changes: Change[]; completed: string[]; done: boolean };
const wait = () => new Promise((resolve) => setTimeout(resolve, 250));
async function visible<T>(
	read: () => Promise<T>,
	matches: (value: T) => boolean,
): Promise<T> {
	for (let attempt = 0; attempt < 24; attempt++) {
		const value = await read();
		if (matches(value)) return value;
		await wait();
	}
	throw new Error(
		"Persistence could not be confirmed. Your selection is retained; retry to finish.",
	);
}
async function setting(userId: string, key: string) {
	const rows = await query<{ value: string }>(
		"SELECT value FROM user_setting WHERE user_id = ? AND key = ?",
		[userId, key],
	);
	return rows[0]?.value ?? null;
}
async function saveJournal(
	userId: string,
	key: string,
	journal: Journal,
	initial = false,
): Promise<Journal> {
	if (initial) {
		await upsert({
			table: "user_setting",
			data: [{ user_id: userId, key, value: JSON.stringify(journal) }],
			conflictColumns: ["user_id", "key"],
			ignoreUpdate: true,
		});
		return JSON.parse(
			(await visible(
				() => setting(userId, key),
				(v) => v !== null,
			))!,
		) as Journal;
	}
	// Completion only advances, including overlapping retries in separate browser tabs/processes.
	for (let attempt = 0; attempt < 24; attempt++) {
		const prior = await setting(userId, key);
		if (!prior) {
			await wait();
			continue;
		}
		const current = JSON.parse(prior) as Journal;
		if (JSON.stringify(current.changes) !== JSON.stringify(journal.changes))
			throw new Error("The confirmed selection cannot change during retry.");
		const next = {
			changes: current.changes,
			completed: [...new Set([...current.completed, ...journal.completed])],
			done: current.done || journal.done,
		};
		if (JSON.stringify(next) === prior) return current;
		const result = await execute(
			"UPDATE user_setting SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ? AND value = ?",
			[JSON.stringify(next), userId, key, prior],
		);
		if (result.rowcount === 1) {
			const stored = await visible(
				() => setting(userId, key),
				(v) => {
					if (!v) return false;
					const observed = JSON.parse(v) as Journal;
					return (
						(!next.done || observed.done) &&
						next.completed.every((id) => observed.completed.includes(id))
					);
				},
			);
			return JSON.parse(stored!) as Journal;
		}
		await wait();
	}
	throw new Error(
		"Persistence could not be confirmed. Your selection is retained; retry to finish.",
	);
}
async function persistChange(userId: string, c: Change) {
	if (c.kind === "country" || c.kind === "services") {
		const key =
			c.kind === "country" ? "country_default" : "streaming_providers_default";
		const current = await setting(userId, key);
		if (current !== c.value) {
			if (current !== c.before)
				throw new Error(
					"An account preference changed since this review. Your transfer is retained; restore that preference before retrying.",
				);
			if (current === null)
				await upsert({
					table: "user_setting",
					data: [{ user_id: userId, key, value: c.value }],
					conflictColumns: ["user_id", "key"],
					ignoreUpdate: true,
				});
			else
				await execute(
					"UPDATE user_setting SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ? AND value = ?",
					[c.value, userId, key, current],
				);
		}
		await visible(
			() => setting(userId, key),
			(v) => v === c.value,
		);
		const completedKey =
			c.kind === "country"
				? "onboarding_country_completed"
				: "onboarding_streaming_completed";
		await upsert({
			table: "user_setting",
			data: [{ user_id: userId, key: completedKey, value: "yes" }],
			conflictColumns: ["user_id", "key"],
		});
		await visible(
			() => setting(userId, completedKey),
			(v) => v === "yes",
		);
		return;
	}
	const id = canonicalTitleId(c.media_type!, c.tmdb_id!);
	const table =
		c.kind === "score"
			? "user_score"
			: c.kind === "plan"
				? "user_wishlist"
				: "user_skipped";
	const read = () =>
		query<{ score?: number }>(
			`SELECT ${c.kind === "score" ? "score" : "tmdb_id"} FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			[userId, id, c.media_type!],
		);
	const current = (await read())[0];
	if (c.kind === "score") {
		if (current && String(current.score) !== c.value) {
			if (String(current.score) !== c.before)
				throw new Error(
					"An account rating changed since this review. Your transfer is retained; restore that rating before retrying.",
				);
			// Only score changes: never overwrite an existing written review or independent library flags.
			await execute(
				"UPDATE user_score SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND score = ?",
				[Number(c.value), userId, id, c.media_type!, Number(c.before)],
			);
		} else if (!current) {
			if (c.before !== null)
				throw new Error(
					"An account rating was removed since review. Your transfer remains pending.",
				);
			await upsert({
				table,
				data: [
					{
						user_id: userId,
						tmdb_id: id,
						media_type: c.media_type,
						score: Number(c.value),
					},
				],
				conflictColumns: ["user_id", "tmdb_id", "media_type"],
				ignoreUpdate: true,
			});
		}
	} else if (!current)
		await upsert({
			table,
			data: [{ user_id: userId, tmdb_id: id, media_type: c.media_type }],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: true,
		});
	await visible(
		read,
		(rows) =>
			!!rows[0] && (c.kind !== "score" || String(rows[0].score) === c.value),
	);
}
export async function action({ request }: ActionFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request });
	headers.set("Cache-Control", "private, no-store");
	if (!user)
		return json(
			{ error: "Sign in again to finish transferring your progress." },
			{ status: 401, headers },
		);
	const parsed = requestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success)
		return json(
			{ error: "Invalid transfer selection." },
			{ status: 400, headers },
		);
	const { id, accountId, changes } = parsed.data;
	if (accountId !== user.id)
		return json(
			{
				error:
					"This transfer belongs to another account. Sign into the original account to continue.",
			},
			{ status: 403, headers },
		);
	if (new Set(changes.map((c) => c.id)).size !== changes.length)
		return json(
			{ error: "Duplicate selected changes." },
			{ status: 400, headers },
		);
	const key = `browser_transfer:${id}`;
	let completed: string[] = [];
	try {
		const prior = await setting(user.id, key);
		const journal = prior
			? (JSON.parse(prior) as Journal)
			: await saveJournal(
					user.id,
					key,
					{ changes, completed: [], done: false },
					true,
				);
		if (JSON.stringify(journal.changes) !== JSON.stringify(changes))
			return json(
				{ error: "The confirmed selection cannot change during retry." },
				{ status: 409, headers },
			);
		completed = journal.completed;
		if (!journal.done) {
			for (const c of changes) {
				if (completed.includes(c.id)) continue;
				await persistChange(user.id, c);
				completed = [...completed, c.id];
				await saveJournal(user.id, key, { changes, completed, done: false });
			}
			await saveJournal(user.id, key, { changes, completed, done: true });
		}
		return json({ success: true, completed }, { headers });
	} catch (error) {
		return json(
			{
				error:
					error instanceof Error &&
					/^(An account|Persistence|The confirmed)/.test(error.message)
						? error.message
						: "Transfer interrupted. Retry to finish.",
				completed,
			},
			{ status: 503, headers },
		);
	} finally {
		await Promise.all([
			resetUserDataCache({ user_id: user.id }),
			resetUserSettingsCache({ user_id: user.id }),
		]);
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request });
	headers.set("Cache-Control", "private, no-store");
	if (!user)
		return json(
			{ error: "Sign in to review your progress." },
			{ status: 401, headers },
		);
	const [data, rows] = await Promise.all([
		getUserData({ user_id: user.id }),
		query<{ key: string; value: string }>(
			"SELECT key, value FROM user_setting WHERE user_id = ?",
			[user.id],
		),
	]);
	return json(
		{
			accountId: user.id,
			data,
			settings: Object.fromEntries(
				rows
					.filter((r) => !r.key.startsWith("browser_transfer:"))
					.map((r) => [r.key, r.value]),
			),
		},
		{ headers },
	);
}
