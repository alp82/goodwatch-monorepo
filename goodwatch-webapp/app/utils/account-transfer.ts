import type { User } from "@supabase/auth-js";
import {
	clearGuestProgress,
	snapshotGuestProgress,
} from "~/utils/guest-progress";

export type TransferChange = {
	id: string;
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
export function pendingTransfer(accountId: string) {
	return read<PendingTransfer[]>(pendingKey, []).find(
		(t) => t.accountId === accountId,
	);
}
export function beginAuthentication(
	mode: "sign-in" | "sign-up" | "oauth",
	returnTo?: string,
) {
	const snapshot = snapshotGuestProgress();
	const transfers = read<PendingTransfer[]>(pendingKey, []);
	// Bound snapshots belong to their original account, even after signing out.
	const alreadyOwned = transfers.some(
		(t) =>
			t.accountId &&
			JSON.stringify(t.snapshot.interactions) ===
				JSON.stringify(snapshot.interactions),
	);
	const transfer = !alreadyOwned
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
		const snapshot = snapshotGuestProgress();
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
export function completeTransfer(transfer: PendingTransfer) {
	// Preserve a completion marker until cleanup succeeds, preventing stale in-memory progress resurfacing.
	write("goodwatch_transfer_completed", transfer.accountId);
	clearGuestProgress();
	if (JSON.parse(localStorage.getItem("onboarding_ratings") || "[]").length)
		throw new Error("Browser cleanup could not finish. Please retry.");
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
