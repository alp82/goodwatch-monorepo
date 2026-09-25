import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Link, useLocation } from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useUser } from "~/utils/auth";
import {
	attachTransfer,
	completeTransfer,
	completeEmptyTransfer,
	pendingTransfer,
	saveTransfer,
	transferEvent,
	type PendingTransfer,
	type TransferChange,
} from "~/utils/account-transfer";
import { useStreamingProviders } from "~/routes/api.streaming-providers";
import { getCountryName } from "~/server/resources/country-names";
import type { UserData } from "~/types/user-data";
import { SmartOnboardingBanner } from "./SmartOnboardingBanner";

type Review = {
	accountId: string;
	data: UserData;
	settings: Record<string, string>;
};
export function AccountTransfer() {
	const { pathname } = useLocation();
	const { user } = useUser();
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<PendingTransfer | undefined>();
	const [ready, setReady] = useState(false);
	const [open, setOpen] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const [finished, setFinished] = useState<string>();
	const running = useRef(false);
	const autoStarted = useRef<string>();
	const { data: providers = [], isFetched: providersReady } =
		useStreamingProviders();
	useEffect(() => {
		if (!user) return;
		const sync = () => setPending(pendingTransfer(user.id));
		try {
			attachTransfer(user);
			sync();
		} catch {
			setError(
				"Allow browser storage to keep your transfer recoverable, then reload.",
			);
		}
		setReady(true);
		window.addEventListener(transferEvent, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(transferEvent, sync);
			window.removeEventListener("storage", sync);
		};
	}, [user?.id]);
	const review = useQuery<Review>({
		queryKey: ["account-transfer-review", user?.id, pending?.id],
		enabled: !!pending && !pending.changes && !pending.confirmed?.length,
		queryFn: async () => {
			const response = await fetch("/api/import-guest-interactions");
			if (!response.ok)
				throw new Error(
					"Unable to load your account. Retry to review your progress.",
				);
			return response.json();
		},
	});
	const titles = useQuery<Record<string, string>>({
		queryKey: ["account-transfer-titles", pending?.id],
		enabled: !!pending && !pending.changes && !pending.confirmed?.length,
		queryFn: async () => {
			const items = pending!.snapshot.interactions;
			const result: Record<string, string> = {};
			for (let offset = 0; offset < items.length; offset += 100) {
				const keys = items
					.slice(offset, offset + 100)
					.map((i) => `${i.media_type}-${i.tmdb_id}`);
				const response = await fetch(
					`/api/wishlist-titles?keys=${encodeURIComponent(keys.join(","))}`,
				);
				if (!response.ok)
					throw new Error(
						"Unable to load title names. Retry to review your progress.",
					);
				for (const title of (await response.json()).titles)
					result[`${title.media_type}-${title.tmdb_id}`] = title.title;
			}
			return result;
		},
	});
	useEffect(() => {
		if (
			!pending ||
			pending.changes ||
			pending.confirmed?.length ||
			!review.data ||
			!titles.data ||
			!providersReady ||
			review.data.accountId !== user?.id
		)
			return;
		const changes: TransferChange[] = [];
		const account = review.data.data;
		for (const i of pending.snapshot.interactions) {
			// Skips are quiz navigation, not a preference. They stay in this browser only.
			if (i.type === "skip") continue;
			const key = `${i.media_type}-${i.tmdb_id}` as const;
			const score = account.scores[key]?.score;
			const before = i.type === "score" ? score : null;
			const known =
				score !== undefined && score !== null
					? `${score}/10`
					: account.watched[key]
						? "Watched"
						: account.favorites[key]
							? "Favorite"
							: account.wishlist[key]
								? "On Wishlist"
								: null;
			if (
				(i.type === "score" && before === i.score) ||
				// A title the account already rated, watched, or listed never regresses to plan-to-watch.
				(i.type === "plan" && known !== null)
			)
				continue;
			changes.push({
				id: key,
				kind: i.type,
				tmdb_id: i.tmdb_id,
				media_type: i.media_type,
				value: i.type === "score" ? String(i.score) : "add",
				before: before === undefined || before === null ? null : String(before),
				title:
					titles.data[key] ||
					`${i.media_type === "movie" ? "Movie" : "Show"} ${i.tmdb_id}`,
				accountLabel: known ?? "Not added",
				browserLabel: i.type === "score" ? `${i.score}/10` : "Add to Wishlist",
				fresh: !before,
			});
		}
		const services = (value: string) =>
			value
				? value
						.split(",")
						.map(
							(id) =>
								providers.find((p) => String(p.id) === id)?.name ||
								`Service ${id}`,
						)
						.join(", ")
				: "No services selected";
		for (const kind of ["country", "services"] as const) {
			const value = pending.snapshot[kind];
			const before =
				review.data.settings[
					kind === "country" ? "country_default" : "streaming_providers_default"
				] ?? null;
			const normalizedBefore =
				kind === "services"
					? [...new Set((before || "").split(",").filter(Boolean))]
							.sort((a, b) => Number(a) - Number(b))
							.join(",")
					: before;
			if (value === null || value === normalizedBefore) continue;
			changes.push({
				id: kind,
				kind,
				value,
				before,
				title: kind === "country" ? "Country" : "Streaming services",
				accountLabel:
					before === null
						? "Not set"
						: kind === "country"
							? getCountryName(before)
							: services(before),
				browserLabel:
					kind === "country" ? getCountryName(value) : services(value),
				fresh: false,
			});
		}
		try {
			saveTransfer({ ...pending, changes, selected: changes.map((c) => c.id) });
		} catch {
			setError(
				"Your review could not be saved in this browser. Allow browser storage and reload.",
			);
		}
	}, [pending, review.data, titles.data, providers, providersReady, user?.id]);
	const finish = async () => {
		if (!pending || !user || running.current) return;
		running.current = true;
		setBusy(true);
		setError(undefined);
		try {
			const confirmed =
				pending.confirmed ??
				pending.changes!.filter((c) => pending.selected!.includes(c.id));
			const transfer = { ...pending, confirmed };
			saveTransfer(transfer);
			const response = await fetch("/api/import-guest-interactions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: transfer.id,
					accountId: user.id,
					changes: confirmed,
				}),
			});
			const result = await response.json();
			if (!response.ok || result.success !== true)
				throw new Error(
					result.error || "Transfer interrupted. Retry to finish.",
				);
			completeTransfer(transfer);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["user-data", user.id] }),
				queryClient.invalidateQueries({ queryKey: ["user-settings", user.id] }),
				queryClient.invalidateQueries({ queryKey: ["streaming-providers"] }),
			]);
			setFinished("Your progress is now in your account.");
			setOpen(false);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "Transfer interrupted. Retry to finish.",
			);
		} finally {
			running.current = false;
			setBusy(false);
		}
	};
	useEffect(() => {
		if (
			pending?.automatic &&
			pending.changes?.length &&
			!pending.confirmed &&
			autoStarted.current !== pending.id
		) {
			autoStarted.current = pending.id;
			void finish();
		}
	}, [pending]);
	useEffect(() => {
		if (pending?.changes?.length === 0 && !pending.confirmed?.length && !busy) {
			try {
				completeEmptyTransfer(pending);
			} catch {
				setError("Browser cleanup could not finish. Reload to retry.");
			}
		}
	}, [pending, busy]);
	if (!ready) return null;
	// The share flow brings new accounts back to the list editor with a handle dialog open. Onboarding's drawer would
	// cover it, so onboarding waits for the next page.
	const onListEditor = /^\/lists\/new$|^\/u\/[^/]+\/lists\/[^/]+\/edit$/.test(pathname);
	if (!pending)
		return error ? (
			<div role="alert" className="mt-16 p-4 text-amber-200">
				{error}
			</div>
		) : finished ? (
			<div role="status" className="mt-16 -mb-16 bg-slate-800 p-4 text-white">
				{finished}
			</div>
		) : onListEditor ? null : (
			<SmartOnboardingBanner />
		);
	// Do not open an empty dialog while differences load, or after a no-op comparison.
	// Failed/in-progress confirmed transfers retain their recovery controls.
	if (!pending.changes?.length && !pending.confirmed?.length) {
		const failure = error || review.error?.message || titles.error?.message;
		return failure ? (
			<div role="alert" className="mt-16 p-4 text-amber-200">
				<p>{failure}</p>
				<button
					type="button"
					className="underline py-2"
					onClick={() => {
						void review.refetch();
						void titles.refetch();
					}}
				>
					Retry loading progress
				</button>
			</div>
		) : null;
	}
	const locked = !!pending.confirmed || busy;
	const changes = pending.confirmed || pending.changes || [];
	const selected =
		pending.confirmed?.map((change) => change.id) || pending.selected || [];
	const changeSelection = (ids: string[]) => {
		try {
			saveTransfer({ ...pending, selected: ids });
		} catch {
			setError(
				"Selection could not be saved. Allow browser storage and retry.",
			);
		}
	};
	const close = () => setOpen(false);
	const decline = () => {
		try {
			completeTransfer(pending);
			setFinished("Your account is unchanged.");
			setOpen(false);
		} catch {
			setError("Browser cleanup could not finish. Please retry.");
		}
	};
	const loadError = review.error || titles.error;
	return (
		<>
			<div className="mt-16 -mb-16 bg-slate-800 text-white border-b border-slate-600">
				<div className="max-w-5xl mx-auto p-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="font-semibold">You have progress in this browser</p>
						<p className="text-sm text-slate-300">
							{locked
								? "Your selected transfer is pending. Reopen to finish."
								: "Review what to add to your account. Nothing changes until you confirm."}
						</p>
					</div>
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 font-semibold"
					>
						Review progress
					</button>
				</div>
			</div>
			<Dialog open={open} onClose={close} className="relative z-[600]">
				<div className="fixed inset-0 bg-black/65" aria-hidden="true" />
				<div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6">
					<DialogPanel className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-xl md:rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-600">
						<div className="px-5 pt-5 pb-3 flex justify-between gap-4">
							<div>
								<DialogTitle className="text-xl font-bold">
									Bring your progress with you
								</DialogTitle>
								<p className="text-sm text-slate-300 mt-2">
									{pending.automatic
										? "Adding this browser’s progress to your new account."
										: "Choose what to add to your account. All changes start selected; uncheck anything you want to keep as it is."}
								</p>
							</div>
							<button
								type="button"
								aria-label="Close review and keep transfer pending"
								onClick={close}
								className="h-11 w-11 shrink-0 rounded-lg hover:bg-slate-700 text-2xl"
							>
								×
							</button>
						</div>
						<div className="overflow-y-auto px-5 pb-4">
							{!pending.changes && !loadError && (
								<p role="status">Loading your account and titles…</p>
							)}
							{loadError && (
								<div role="alert">
									<p>{loadError.message}</p>
									<button
										className="underline py-3"
										type="button"
										onClick={() => {
											void review.refetch();
											void titles.refetch();
										}}
									>
										Retry loading review
									</button>
								</div>
							)}
							{pending.changes && !changes.length && (
								<p>
									Your account already has these interactions and preferences.
								</p>
							)}
							{["New entries", "Score changes", "Preferences"].map((group) => {
								const entries = changes.filter((c) =>
									c.kind === "country" || c.kind === "services"
										? group === "Preferences"
										: c.fresh
											? group === "New entries"
											: group === "Score changes",
								);
								return (
									entries.length > 0 && (
										<section key={group} className="mt-4">
											<div className="flex justify-between items-center gap-3 mb-2">
												<h3 className="font-semibold">{group}</h3>
												{group === "New entries" && (
													<button
														type="button"
														disabled={locked}
														className="text-sm text-emerald-300 underline py-2 disabled:opacity-50"
														onClick={() =>
															changeSelection([
																...new Set([
																	...selected,
																	...entries.map((c) => c.id),
																]),
															])
														}
													>
														Select all new entries
													</button>
												)}
											</div>
											<div className="divide-y divide-slate-700 rounded-lg border border-slate-700">
												{entries.map((c) => (
													<label
														key={c.id}
														className="flex gap-3 p-3 cursor-pointer"
													>
														<input
															type="checkbox"
															checked={selected.includes(c.id)}
															disabled={locked}
															onChange={() =>
																changeSelection(
																	selected.includes(c.id)
																		? selected.filter((id) => id !== c.id)
																		: [...selected, c.id],
																)
															}
															className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
														/>
														<div className="min-w-0 flex-1">
															<span className="block font-medium text-sm">
																{c.title}
															</span>
															<div className="grid grid-cols-2 gap-3 text-sm mt-2">
																<div>
																	<span className="block text-xs text-slate-400">
																		Account
																	</span>
																	{c.accountLabel}
																</div>
																<div>
																	<span className="block text-xs text-slate-400">
																		This browser
																	</span>
																	{c.browserLabel}
																</div>
															</div>
															{c.kind === "score" && !c.fresh && (
																<p className="text-sm text-slate-300 mt-1">
																	Your written review and watched status stay
																	unchanged.
																</p>
															)}
														</div>
													</label>
												))}
											</div>
										</section>
									)
								);
							})}
						</div>
						<div className="border-t border-slate-700 p-5">
							{error && (
								<p role="alert" className="text-sm text-amber-200 mb-3">
									{error}
								</p>
							)}
							{locked ? (
								<p className="text-sm text-slate-300 mb-3">
									Some selected changes may already be saved. Your selection is
									kept in this browser. Retry finishes the same transfer.
								</p>
							) : (
								<p className="text-sm text-slate-300 mb-3">
									After a successful transfer, unselected changes from this
									browser are discarded. Keeping the account unchanged discards
									all these browser changes. Closing keeps everything pending.
								</p>
							)}
							<div className="flex flex-col sm:flex-row gap-2">
								<button
									type="button"
									disabled={
										busy ||
										!pending.changes ||
										(!selected.length && changes.length > 0 && !locked)
									}
									onClick={() => void finish()}
									className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 px-4 py-3 font-semibold"
								>
									{busy
										? "Transferring…"
										: locked
											? "Retry transfer"
											: changes.length
												? `Transfer ${selected.length} selected ${selected.length === 1 ? "change" : "changes"}`
												: "Finish and continue"}
								</button>
								{!locked && (
									<button
										type="button"
										onClick={decline}
										className="rounded-lg border border-slate-500 px-4 py-3"
									>
										Keep account unchanged
									</button>
								)}
							</div>
							<Link
								to={pending.returnTo}
								onClick={close}
								className="inline-block text-sm text-emerald-300 underline mt-3"
							>
								Return to where you left off
							</Link>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	);
}
