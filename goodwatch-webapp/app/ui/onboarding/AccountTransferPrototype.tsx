import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";

// Throwaway presentation review for the confirmed guest-transfer rules.
// One incremental variant: earlier live feedback rejected replacement layouts.
// All fixture data and actions are memory-only; no auth, storage or API writes.
const changes = [
	{
		id: "rating",
		group: "New entries",
		title: "Forrest Gump",
		detail: "Rating: 6/10",
		fresh: true,
	},
	{
		id: "wishlist",
		group: "New entries",
		title: "The Lord of the Rings: The Fellowship of the Ring",
		detail: "Add to Wishlist",
		fresh: true,
	},
	{
		id: "skip",
		group: "New entries",
		title: "Breaking Bad",
		detail: "Skip in Taste and recommendations",
		fresh: true,
	},
	{
		id: "conflict",
		group: "Score changes",
		title: "Fight Club",
		account: "4/10",
		guest: "8/10",
		detail: "Your written review and watched status stay unchanged.",
		fresh: false,
	},
	{
		id: "country",
		group: "Preferences",
		title: "Country",
		account: "United States",
		guest: "Germany",
		fresh: false,
	},
	{
		id: "services",
		group: "Preferences",
		title: "Streaming services",
		account: "Prime Video",
		guest: "Netflix, Prime Video",
		fresh: false,
	},
];

export function AccountTransferPrototype() {
	const [open, setOpen] = useState(true);
	const [selected, setSelected] = useState<string[]>([]);
	const [status, setStatus] = useState("pending");
	const [fail, setFail] = useState(false);
	const [confirmed, setConfirmed] = useState<string[]>([]);
	const toggle = (id: string) =>
		setSelected((previous) =>
			previous.includes(id)
				? previous.filter((value) => value !== id)
				: [...previous, id],
		);
	const finish = () => {
		setConfirmed(selected);
		setStatus(fail ? "retry" : "completed");
		if (!fail) setOpen(false);
	};
	const close = () => setOpen(false);
	return (
		<>
			<div className="mt-16 -mb-16 bg-slate-800 text-white border-b border-slate-600">
				<div className="max-w-5xl mx-auto p-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="font-semibold">
							{status === "completed"
								? "Guest progress transferred"
								: status === "declined"
									? "Account kept unchanged"
									: "You have guest progress in this browser"}
						</p>
						<p className="text-sm text-slate-300">
							{status === "completed" || status === "declined"
								? "Continue where you left off."
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
								<p className="text-xs font-semibold uppercase tracking-wide text-amber-300 mb-2">
									Presentation preview · sample data
								</p>
								<DialogTitle className="text-xl font-bold">
									Bring your guest progress with you
								</DialogTitle>
								<p className="text-sm text-slate-300 mt-2">
									Choose what to add to your account. Your other account data
									stays unchanged.
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
							{["New entries", "Score changes", "Preferences"].map((group) => (
								<section key={group} className="mt-4">
									<div className="flex justify-between items-center gap-3 mb-2">
										<h3 className="font-semibold">{group}</h3>
										{group === "New entries" && (
											<button
												type="button"
												disabled={status === "retry"}
												className="text-sm text-emerald-300 underline py-2 disabled:opacity-50"
												onClick={() =>
													setSelected((previous) => [
														...new Set([
															...previous,
															...changes
																.filter((c) => c.fresh)
																.map((c) => c.id),
														]),
													])
												}
											>
												Select all new entries
											</button>
										)}
									</div>
									{group !== "New entries" && (
										<p className="text-xs text-slate-300 mb-2">
											Changes start unselected.
										</p>
									)}
									<div className="divide-y divide-slate-700 rounded-lg border border-slate-700">
										{changes
											.filter((change) => change.group === group)
											.map((change) => (
												<label
													key={change.id}
													className="flex gap-3 p-3 cursor-pointer"
												>
													<input
														type="checkbox"
														checked={selected.includes(change.id)}
														disabled={status === "retry"}
														onChange={() => toggle(change.id)}
														className="mt-1 h-5 w-5 shrink-0 accent-emerald-500"
													/>
													<div className="min-w-0 flex-1">
														<span className="block font-medium text-sm">
															{change.title}
														</span>
														{change.account && (
															<div className="grid grid-cols-2 gap-3 text-sm mt-2">
																<div>
																	<span className="block text-xs text-slate-400">
																		Account
																	</span>
																	{change.account}
																</div>
																<div>
																	<span className="block text-xs text-slate-400">
																		Guest
																	</span>
																	{change.guest}
																</div>
															</div>
														)}
														{change.detail && (
															<span className="block text-sm text-slate-300 mt-1">
																{change.detail}
															</span>
														)}
													</div>
												</label>
											))}
									</div>
								</section>
							))}
						</div>
						<div className="border-t border-slate-700 p-5">
							{status === "retry" ? (
								<p role="alert" className="text-sm text-amber-200 mb-3">
									Some selected changes may already be saved. Your selection is
									kept in this browser. Retry finishes the same transfer.
								</p>
							) : (
								<p className="text-sm text-slate-300 mb-3">
									After a successful transfer, unselected guest changes are
									discarded. Keeping the account unchanged discards all guest
									changes. Closing this review keeps everything pending.
								</p>
							)}
							<div className="flex flex-col sm:flex-row gap-2">
								<button
									type="button"
									disabled={!selected.length}
									onClick={finish}
									className="rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 px-4 py-3 font-semibold"
								>
									{status === "retry"
										? "Retry transfer"
										: `Transfer ${selected.length} selected ${selected.length === 1 ? "change" : "changes"}`}
								</button>
								{status !== "retry" && (
									<button
										type="button"
										onClick={() => {
											setStatus("declined");
											setConfirmed([]);
											setOpen(false);
										}}
										className="rounded-lg border border-slate-500 px-4 py-3"
									>
										Keep account unchanged
									</button>
								)}
							</div>
						</div>
					</DialogPanel>
				</div>
			</Dialog>
			<aside
				hidden={open}
				className="fixed bottom-20 right-3 z-[700] max-w-[calc(100vw-1.5rem)] rounded-lg border border-amber-500 bg-slate-950 p-3 text-xs text-white shadow-xl"
			>
				<details>
					<summary className="cursor-pointer">Preview controls / state</summary>
					<p className="mt-2">
						Memory only. No account or browser progress changes.
					</p>
					<label className="flex gap-2 py-2">
						<input
							type="checkbox"
							checked={fail}
							onChange={(event) => setFail(event.target.checked)}
						/>
						Simulate interrupted transfer
					</label>
					<p>
						Status: {status}; selected: {selected.join(", ") || "none"};
						confirmed: {confirmed.join(", ") || "none"}
					</p>
					<button
						type="button"
						className="underline py-2"
						onClick={() => {
							setSelected([]);
							setConfirmed([]);
							setStatus("pending");
							setFail(false);
							setOpen(true);
						}}
					>
						Reset preview
					</button>
				</details>
			</aside>
		</>
	);
}
