import type { User } from "@supabase/auth-js";
import {
	clearGuestProgress,
	normalizeGuestInteractions,
	readGuestInteractions,
	snapshotGuestProgress,
} from "~/utils/guest-progress";

export type TransferChange = {
	id: string;
	// "skip" only appears in transfers saved by earlier versions and is never sent.
	kind: "score" | "plan" | "skip" | "country" | "services";
	tmdb_id?: number;
	media_type?: "movie" | "show";
	value: string;
	before: string | null;
	title: string;
	accountLabel: string;
	browserLabel: string;
	fresh: boolean;
};
export type PendingTransfer = {
	id: string;
	accountId?: string;
	snapshot: ReturnType<typeof snapshotGuestProgress>;
	returnTo: string;
	automatic: boolean;
	changes?: TransferChange[];
	selected?: string[];
	confirmed?: TransferChange[];
};
const pendingKey = "goodwatch_account_transfers";
const authKey = "goodwatch_auth_attempt";
export const transferEvent = "goodwatch-transfer-changed";
function read<T>(key: string, fallback: T): T {
	try {
		return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
	} catch {
		return fallback;
	}
}
function write(key: string, value: unknown) {
	localStorage.setItem(key, JSON.stringify(value));
	window.dispatchEvent(new Event(transferEvent));
}
export function safeReturnTo(value?: string | null) {
	if (
		value?.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\") &&
		!/[\u0000-\u0020]/.test(value) &&
		!/^\/(sign-in|sign-up|forgot-password)(\/|\?|$)/.test(value)
	)
		return value;
	return "/taste/quiz";
}
export function discoveryReturnTo(value?: string | null) {
	if (value) return safeReturnTo(value);
	const discovery = read<{ last?: { url: string } }>("goodwatch_discovery", {});
	return safeReturnTo(discovery.last?.url);
}
export function saveTransfer(transfer: PendingTransfer) {
	const transfers = read<PendingTransfer[]>(pendingKey, []);
	write(pendingKey, [
		...transfers.filter((t) => t.id !== transfer.id),
		transfer,
	]);
}
export function normalizeTransferSnapshot(
	snapshot: PendingTransfer["snapshot"],
) {
	return {
		...snapshot,
		interactions: normalizeGuestInteractions(snapshot.interactions),
		country:
			typeof snapshot.country === "string" &&
			/^[A-Z]{2}$/.test(snapshot.country)
				? snapshot.country
				: null,
		services:
			typeof snapshot.services === "string" &&
			/^(\d+(,\d+)*)?$/.test(snapshot.services)
				? [...new Set(snapshot.services.split(",").filter(Boolean))]
						.sort((a, b) => Number(a) - Number(b))
						.join(",")
				: null,
	};
}
// Reviews saved by earlier versions may include skips, which are never transferred.
function withoutSkips(transfer: PendingTransfer): PendingTransfer {
	const keep = (c: TransferChange) => c.kind !== "skip";
	return {
		...transfer,
		changes: transfer.changes?.filter(keep),
		confirmed: transfer.confirmed?.filter(keep),
		selected: transfer.selected?.filter(
			(id) => !transfer.changes?.some((c) => c.id === id && !keep(c)),
		),
	};
}
export function pendingTransfer(accountId: string) {
	const found = read<PendingTransfer[]>(pendingKey, []).find(
		(t) => t.accountId === accountId,
	);
	const transfer = found && withoutSkips(found);
	// A confirmed payload is immutable, including partially written retries.
	return transfer && !transfer.confirmed?.length
		? { ...transfer, snapshot: normalizeTransferSnapshot(transfer.snapshot) }
		: transfer;
}

export function beginAuthentication(
	mode: "sign-in" | "sign-up" | "oauth",
	returnTo?: string,
) {
	const snapshot = normalizeTransferSnapshot(snapshotGuestProgress());
	const transfers = read<PendingTransfer[]>(pendingKey, []);
	// Bound snapshots belong to their original account, even after signing out.
	const alreadyOwned = transfers.some(
		(t) =>
			t.accountId &&
			JSON.stringify(t.snapshot.interactions) ===
				JSON.stringify(snapshot.interactions),
	);
	const hasProgress =
		snapshot.interactions.length > 0 ||
		snapshot.country !== null ||
		snapshot.services !== null;
	const transfer =
		!alreadyOwned && hasProgress
			? {
					id: crypto.randomUUID(),
					snapshot,
					returnTo: discoveryReturnTo(returnTo),
					automatic: false,
				}
			: undefined;
	if (transfer) {
		write(pendingKey, [...transfers.filter((t) => t.accountId), transfer]);
	}
	write(authKey, {
		mode,
		startedAt: Date.now(),
		transferId: transfer?.id,
		returnTo: discoveryReturnTo(returnTo),
	});
}
export function noteCreatedAccount(user: User | null) {
	const attempt = read<any>(authKey, null);
	if (
		attempt?.mode === "sign-up" &&
		user?.identities?.length &&
		Date.parse(user.created_at) >= attempt.startedAt
	) {
		write(authKey, { ...attempt, createdAccountId: user.id });
		write("goodwatch_created_accounts", [
			...read<string[]>("goodwatch_created_accounts", []),
			user.id,
		]);
		const transfer = read<PendingTransfer[]>(pendingKey, []).find(
			(t) => t.id === attempt.transferId,
		);
		if (transfer)
			saveTransfer({ ...transfer, accountId: user.id, automatic: true });
	}
}
export function attachTransfer(user: User) {
	if (pendingTransfer(user.id)) return;
	const attempt = read<any>(authKey, null);
	const transfers = read<PendingTransfer[]>(pendingKey, []);
	let transfer = transfers.find(
		(t) => !t.accountId && t.id === attempt?.transferId,
	);
	// Migrate interactions left by the earlier onboarding implementation. Never infer newness from onboarding.
	if (!transfer && !transfers.some((t) => t.accountId)) {
		const snapshot = normalizeTransferSnapshot(snapshotGuestProgress());
		if (snapshot.interactions.length)
			transfer = {
				id: crypto.randomUUID(),
				snapshot,
				returnTo: discoveryReturnTo(),
				automatic: false,
			};
	}
	if (!transfer) return;
	const createdDuringOAuth =
		attempt?.mode === "oauth" &&
		Date.parse(user.created_at) >= attempt.startedAt;
	saveTransfer({
		...transfer,
		accountId: user.id,
		automatic:
			read<string[]>("goodwatch_created_accounts", []).includes(user.id) ||
			createdDuringOAuth,
	});
}
export function completeTransfer(
	transfer: PendingTransfer,
	clearProgress = true,
) {
	// Preserve a completion marker until cleanup succeeds, preventing stale in-memory progress resurfacing.
	if (clearProgress) {
		write("goodwatch_transfer_completed", transfer.accountId);
		clearGuestProgress();
		if (JSON.parse(localStorage.getItem("onboarding_ratings") || "[]").length)
			throw new Error("Browser cleanup could not finish. Please retry.");
	}

	write(
		pendingKey,
		read<PendingTransfer[]>(pendingKey, []).filter((t) => t.id !== transfer.id),
	);
	localStorage.removeItem(authKey);
	write(
		"goodwatch_created_accounts",
		read<string[]>("goodwatch_created_accounts", []).filter(
			(id) => id !== transfer.accountId,
		),
	);
}

export function cleanupCompletedTransferOnLogout(accountId: string) {
	if (
		read<string | null>("goodwatch_transfer_completed", null) === accountId &&
		!pendingTransfer(accountId)
	) {
		clearGuestProgress();
		localStorage.removeItem("goodwatch_transfer_completed");
	}
}

// No selected work exists and no request can be in flight. Retire bookkeeping silently,
// clearing only the same source snapshot, never newer browser interactions.
export function completeEmptyTransfer(transfer: PendingTransfer) {
	if (
		transfer.confirmed?.length ||
		!transfer.changes ||
		transfer.changes.length
	)
		return;
	const sameSource =
		JSON.stringify(readGuestInteractions()) ===
		JSON.stringify(transfer.snapshot.interactions);
	completeTransfer(transfer, sameSource);
}
