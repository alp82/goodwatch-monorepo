import {
	CheckIcon,
	LockClosedIcon,
	PlusIcon,
	TrashIcon,
	UserGroupIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { Link, useLocation } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "react-toastify";
import {
	AUDIENCES,
	AVATAR_COLORS,
	type Audience,
	BIO_MAX,
	DEFAULT_VISIBILITY,
	LINK_SERVICES,
	type LinkService,
	MAX_LINKS,
	type ProfilePart,
	type ProfileSettings,
	type ProfileShell,
	type ProfileTitle,
} from "~/domain/profile";
import { LINK_RULES, normalizeLinkValue } from "~/domain/profile-settings";
import {
	queryKeyAccountSummary,
	useAccountSummary,
} from "~/ui/account/useAccountSummary";
import { FOLLOW_PHONE_BAR, STICKY_BAR } from "~/ui/layers";
import { DISPLAY } from "~/ui/my-pages/bits";
// Edit profile (/settings/profile): the picture (an uploaded photo cropped in the browser, the sign-in provider's photo,
// the handle's initial on a colour, or a favorite's poster), the cover, the bio, links to other profiles, and who sees
// each part. A live preview beside the form; Save checks with the same rules as the server (domain/profile-settings).
// No display name: profiles and cards are signed with the permanent @handle (#170).
import { assetUrl } from "~/utils/asset-url";
import { ProfileAvatar } from "../ProfileFrame";
import { LINK_SERVICE_INFO, profileTabPath } from "../links";
import { AMBER_BUTTON, QUIET_BUTTON, TILE, posterUrl } from "../parts";
import { PhotoCropper } from "./PhotoCropper";

const PARTS: { part: ProfilePart; name: string; line: string }[] = [
	{
		part: "scores",
		name: "Scores",
		line: "Every score by tier, favorites and hot takes",
	},
	{ part: "seen", name: "Seen", line: "The diary of what you watched" },
	{ part: "wishlist", name: "Wishlist", line: "What you want to see" },
	{
		part: "shows",
		name: "Shows",
		line: "Shows in progress, waiting and on hold",
	},
	{
		part: "lists",
		name: "Lists",
		line: "The Lists tab (each list keeps its own Public or Unlisted)",
	},
	{
		part: "taste",
		name: "Taste",
		line: "Viewer type, fingerprint, sides, vs everyone, stats, and the match",
	},
	{
		part: "hours",
		name: "Time watched",
		line: "Days, hours and episodes in the stat strip",
	},
	{
		part: "activity",
		name: "Recent activity",
		line: "Latest ratings, watching now, newest on the Wishlist",
	},
];

const AUDIENCE_LABEL: Record<Audience, string> = {
	everyone: "Everyone",
	members: "Members",
	me: "Only me",
};

export interface EditProfileData {
	handle: string;
	settings: ProfileSettings;
	/** The uploaded photo's address, or null. */
	photo: string | null;
	/** The sign-in provider's photo, or null. */
	providerPhoto: string | null;
	/** Their 10s (then 9s) with posters, for the picture. */
	favorites: ProfileTitle[];
	/** Their 9s and 10s with backdrops, for the cover. */
	covers: ProfileTitle[];
}

export function EditProfile({ data }: { data: EditProfileData }) {
	const queryClient = useQueryClient();
	const [saved, setSaved] = useState(data.settings);
	const [draft, setDraft] = useState(data.settings);
	const [photo, setPhoto] = useState(data.photo);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const set = (patch: Partial<ProfileSettings>) =>
		setDraft((d) => ({ ...d, ...patch }));
	const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

	const linkProblems = draft.links.map((l) => {
		const value = normalizeLinkValue(l.service, l.value);
		return value && !LINK_RULES[l.service].pattern.test(value)
			? `That doesn't look like a ${LINK_RULES[l.service].name} ${LINK_RULES[l.service].placeholder}.`
			: null;
	});
	const valid = draft.bio.length <= BIO_MAX && linkProblems.every((p) => !p);

	// The "GoodWatch has profiles now" strip leads here (?confirm=1): scroll to Who sees what and highlight it, each
	// time the strip is followed. Confirm (or any save) retires the strip.
	const { profilesStrip } = useAccountSummary();
	const location = useLocation();
	const whoRef = useRef<HTMLElement>(null);
	const [glow, setGlow] = useState(0);
	useEffect(() => {
		if (!new URLSearchParams(location.search).has("confirm")) return;
		const timer = setTimeout(() => {
			whoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
			setGlow((g) => g + 1);
		}, 250);
		return () => clearTimeout(timer);
	}, [location.key, location.search]);

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			const body: ProfileSettings = {
				...draft,
				links: draft.links
					.map((l) => ({ ...l, value: normalizeLinkValue(l.service, l.value) }))
					.filter((l) => l.value),
			};
			const res = await fetch("/api/profile/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const out = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
				settings?: ProfileSettings;
			};
			if (!res.ok || !out.ok)
				throw new Error(out.error ?? "Saving failed. Try again.");
			const next = out.settings ?? body;
			setSaved(next);
			setDraft(next);
			toast.success(profilesStrip ? "All set." : "Profile saved.");
			// The account menu shows the chosen picture.
			void queryClient.invalidateQueries({ queryKey: queryKeyAccountSummary });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Saving failed. Try again.");
		} finally {
			setSaving(false);
		}
	};

	const avatarUrl =
		draft.avatar.kind === "photo"
			? photo
			: draft.avatar.kind === "provider"
				? data.providerPhoto
				: draft.avatar.kind === "poster"
					? posterUrl(
							data.favorites.find(
								(t) => t.key === (draft.avatar as { title: string }).title,
							)?.poster ?? null,
						)
					: null;
	const previewAvatar: ProfileShell["avatar"] = {
		url: avatarUrl,
		color: draft.avatar.kind === "initial" ? draft.avatar.color : "amber",
	};
	const cover = data.covers.find((t) => t.key === draft.cover) ?? null;

	return (
		<div className="flex flex-col gap-6">
			<div className={`sticky top-16 ${STICKY_BAR} ${FOLLOW_PHONE_BAR} -mx-4 flex flex-wrap items-center gap-3 border-b border-white/10 bg-gray-950/95 px-4 py-3 md:top-16 md:-mx-8 md:px-8`}>
				<Link
					to={profileTabPath(data.handle)}
					className="text-sm font-semibold text-amber-500 hover:text-amber-400"
				>
					View your profile
				</Link>
				<span className="grow" />
				{error && <span className="text-sm text-rose-300">{error}</span>}
				<button
					type="button"
					onClick={() => setDraft(saved)}
					disabled={!dirty || saving}
					className={`${QUIET_BUTTON} disabled:opacity-40`}
				>
					Undo changes
				</button>
				<button
					type="button"
					onClick={save}
					disabled={!dirty || !valid || saving}
					className={`${AMBER_BUTTON} disabled:opacity-40`}
				>
					<CheckIcon className="size-4" aria-hidden />
					{saving ? "Saving…" : "Save"}
				</button>
			</div>

			<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-10">
					<Group
						title="Picture"
						line="A photo, your sign-in photo, your initial on a colour, or a poster from your favorites."
					>
						<PictureChooser
							data={data}
							draft={draft}
							set={set}
							photo={photo}
							setPhoto={setPhoto}
						/>
					</Group>

					{data.covers.length > 0 && (
						<Group
							title="Cover"
							line="A backdrop behind your header, from the titles you scored 9 or 10."
						>
							<div
								className="grid grid-cols-2 gap-2 sm:grid-cols-4"
								role="radiogroup"
								aria-label="Cover"
							>
								<button
									type="button"
									// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
									role="radio"
									aria-checked={draft.cover === null}
									onClick={() => set({ cover: null })}
									className={`flex aspect-video items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-gray-400 ${draft.cover === null ? "ring-2 ring-white" : "ring-1 ring-white/10"}`}
								>
									No cover
								</button>
								{data.covers.map((t) => (
									<button
										key={t.key}
										type="button"
										// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
										role="radio"
										aria-checked={draft.cover === t.key}
										aria-label={t.title}
										onClick={() => set({ cover: t.key })}
										className={`relative aspect-video overflow-hidden rounded-lg ${draft.cover === t.key ? "ring-2 ring-white" : "ring-1 ring-white/10"}`}
									>
										<img
											src={posterUrl(t.backdrop, "w500") ?? ""}
											alt=""
											loading="lazy"
											className="size-full object-cover"
										/>
										<span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/90 px-2 pt-4 pb-1 text-left text-xs font-semibold text-white">
											{t.title}
										</span>
									</button>
								))}
							</div>
						</Group>
					)}

					<Group title="About you">
						<Field
							label="Handle"
							hint={`Your profile lives at goodwatch.app/u/${data.handle}. Handles are permanent.`}
						>
							{(id) => (
								<input
									id={id}
									className={`${INPUT} text-gray-500`}
									value={`@${data.handle}`}
									readOnly
								/>
							)}
						</Field>
						<Field
							label="Bio"
							hint={`${draft.bio.length} of ${BIO_MAX} characters. Shown under your handle and in link previews.`}
						>
							{(id) => (
								<textarea
									id={id}
									rows={3}
									maxLength={BIO_MAX}
									className={`${INPUT} py-2.5`}
									value={draft.bio}
									placeholder="What you love to watch, in a line"
									onChange={(e) => set({ bio: e.target.value })}
								/>
							)}
						</Field>
					</Group>

					<Group
						title="Your other profiles"
						line={`Up to ${MAX_LINKS}, shown as logos in your header. They open in a new tab.`}
					>
						<LinksEditor draft={draft} set={set} problems={linkProblems} />
					</Group>

					<section
						id="who-sees-what"
						ref={whoRef}
						className="relative scroll-mt-36 md:scroll-mt-40"
					>
						{glow > 0 && (
							<span
								key={glow}
								aria-hidden
								className="section-glow pointer-events-none absolute -inset-3 rounded-3xl bg-amber-400/[0.06] ring-2 ring-amber-400/80 sm:-inset-4"
							/>
						)}
						<Group
							title="Who sees what"
							line="Everything starts open to everyone. Narrow any part to members, or keep it to yourself."
						>
							<ul className={`${TILE} divide-y divide-white/5`}>
								{PARTS.map(({ part, name, line }) => (
									<li
										key={part}
										className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
									>
										<span className="min-w-0 flex-1 basis-48">
											<span className="block font-semibold text-gray-100">
												{name}
											</span>
											<span className="block text-xs text-gray-500">
												{line}
											</span>
										</span>
										<AudiencePicker
											name={name}
											value={draft.visibility[part]}
											onChange={(audience) =>
												set({
													visibility: { ...draft.visibility, [part]: audience },
												})
											}
										/>
									</li>
								))}
							</ul>
							{profilesStrip && (
								<div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-[#2a2414] px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,.5)] ring-1 ring-amber-300/40 lg:bottom-4">
									<span className="min-w-0 flex-1 basis-56 text-sm text-amber-50">
										<b>Happy with who sees what?</b> Confirm and you're all set.
										You can change it here any time.
									</span>
									<button
										type="button"
										onClick={save}
										disabled={!valid || saving}
										className={`${AMBER_BUTTON} disabled:opacity-40`}
									>
										<CheckIcon className="size-4" aria-hidden />
										{saving ? "Saving…" : "Confirm"}
									</button>
								</div>
							)}
							<button
								type="button"
								onClick={() => set({ visibility: DEFAULT_VISIBILITY })}
								className="self-start text-sm font-semibold text-gray-400 hover:text-white"
							>
								Open everything again
							</button>
						</Group>
					</section>
				</div>

				<aside className="lg:sticky lg:top-36 lg:self-start">
					<p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
						Preview
					</p>
					<div className={`${TILE} relative isolate overflow-hidden`}>
						{cover?.backdrop && (
							<img
								src={posterUrl(cover.backdrop, "w780") ?? ""}
								alt=""
								className="absolute inset-0 -z-10 size-full object-cover opacity-30"
							/>
						)}
						<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/80 to-gray-950/30" />
						<div className="flex flex-col gap-3 p-5">
							<ProfileAvatar
								handle={data.handle}
								avatar={previewAvatar}
								size="md"
							/>
							<p className={`${DISPLAY} text-2xl text-white`}>@{data.handle}</p>
							{draft.bio && (
								<p className="text-sm text-gray-200">{draft.bio}</p>
							)}
							<div className="flex gap-1.5">
								{draft.links
									.filter((l) => l.value.trim())
									.map((l) => {
										const s = LINK_SERVICE_INFO[l.service];
										return (
											<span
												key={l.service}
												className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/15"
											>
												{s.logo ? (
													<img
														src={assetUrl(s.logo)}
														alt={s.name}
														className="size-4 object-contain"
													/>
												) : (
													<b className="text-xs text-gray-200">{s.letter}</b>
												)}
											</span>
										);
									})}
							</div>
						</div>
					</div>
					<div className={`${TILE} mt-4 flex flex-col gap-2 p-4 text-sm`}>
						<p className="font-semibold text-gray-100">Who sees what</p>
						<Audiences visibility={draft.visibility} />
						<Link
							to={profileTabPath(data.handle)}
							className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-500 hover:text-amber-400"
						>
							<GlobeAltIcon className="size-4" aria-hidden />
							View your profile
						</Link>
					</div>
				</aside>
			</div>
		</div>
	);
}

const INPUT =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 ring-white/15 placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 focus:outline-none";

const COLORS: Record<string, [string, string, string]> = {
	amber: ["#fbbf24", "#b45309", "#451a03"],
	rose: ["#fb7185", "#be123c", "#4c0519"],
	violet: ["#a78bfa", "#6d28d9", "#2e1065"],
	sky: ["#38bdf8", "#0369a1", "#082f49"],
	emerald: ["#34d399", "#047857", "#022c22"],
	slate: ["#e2e8f0", "#64748b", "#0f172a"],
};

function PictureChooser({
	data,
	draft,
	set,
	photo,
	setPhoto,
}: {
	data: EditProfileData;
	draft: ProfileSettings;
	set: (patch: Partial<ProfileSettings>) => void;
	photo: string | null;
	setPhoto: (url: string | null) => void;
}) {
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const ring = (on: boolean) =>
		`ring-offset-2 ring-offset-gray-950 ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`;

	const upload = async (blob: Blob) => {
		setBusy(true);
		setError(null);
		try {
			const form = new FormData();
			form.append(
				"photo",
				blob,
				blob.type === "image/webp" ? "photo.webp" : "photo.jpg",
			);
			const res = await fetch("/api/profile/avatar", {
				method: "POST",
				body: form,
			});
			const out = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				url?: string;
				error?: string;
			};
			if (!res.ok || !out.ok || !out.url)
				throw new Error(out.error ?? "Uploading failed. Try again.");
			setPhoto(out.url);
			set({ avatar: { kind: "photo" } });
			void queryClient.invalidateQueries({ queryKey: queryKeyAccountSummary });
			setFile(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Uploading failed. Try again.");
		} finally {
			setBusy(false);
		}
	};
	const remove = async () => {
		setBusy(true);
		try {
			await fetch("/api/profile/avatar", { method: "DELETE" });
			setPhoto(null);
			void queryClient.invalidateQueries({ queryKey: queryKeyAccountSummary });
			if (draft.avatar.kind === "photo")
				set({ avatar: { kind: "initial", color: "amber" } });
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<div
				className="flex flex-wrap gap-3"
				role="radiogroup"
				aria-label="Picture"
			>
				{photo && (
					<button
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
						role="radio"
						aria-checked={draft.avatar.kind === "photo"}
						aria-label="Your photo"
						onClick={() => set({ avatar: { kind: "photo" } })}
						className={`size-14 overflow-hidden rounded-full ${ring(draft.avatar.kind === "photo")}`}
					>
						<img data-member-avatar src={photo} alt="" className="size-full object-cover" />
					</button>
				)}
				{data.providerPhoto && (
					<button
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
						role="radio"
						aria-checked={draft.avatar.kind === "provider"}
						aria-label="Your sign-in photo"
						onClick={() => set({ avatar: { kind: "provider" } })}
						className={`size-14 overflow-hidden rounded-full ${ring(draft.avatar.kind === "provider")}`}
					>
						<img
							src={data.providerPhoto}
							data-member-avatar
							alt=""
							referrerPolicy="no-referrer"
							className="size-full object-cover"
						/>
					</button>
				)}
				{AVATAR_COLORS.map((c) => {
					const on =
						draft.avatar.kind === "initial" && draft.avatar.color === c;
					const [from, to, ink] = COLORS[c];
					return (
						<button
							key={c}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
							role="radio"
							aria-checked={on}
							aria-label={`Initial on ${c}`}
							onClick={() => set({ avatar: { kind: "initial", color: c } })}
							className={`flex size-14 items-center justify-center rounded-full text-2xl font-extrabold ${ring(on)}`}
							style={{
								background: `linear-gradient(135deg, ${from}, ${to})`,
								color: ink,
							}}
						>
							{data.handle.charAt(0).toUpperCase()}
						</button>
					);
				})}
				{data.favorites.map((t) => {
					const on =
						draft.avatar.kind === "poster" && draft.avatar.title === t.key;
					return (
						<button
							key={t.key}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
							role="radio"
							aria-checked={on}
							aria-label={`${t.title} poster`}
							onClick={() => set({ avatar: { kind: "poster", title: t.key } })}
							className={`size-14 overflow-hidden rounded-full ${ring(on)}`}
						>
							{t.poster && (
								<img
									src={posterUrl(t.poster, "w185") ?? ""}
									alt=""
									loading="lazy"
									className="size-full object-cover object-top"
								/>
							)}
						</button>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<input
					ref={input}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					className="sr-only"
					onChange={(e) => {
						const f = e.target.files?.[0];
						e.target.value = "";
						if (!f) return;
						if (f.size > 20 * 1024 * 1024)
							return setError("That photo is too large. Pick one under 20 MB.");
						setError(null);
						setFile(f);
					}}
				/>
				<button
					type="button"
					onClick={() => input.current?.click()}
					className={QUIET_BUTTON}
					disabled={busy}
				>
					<PlusIcon className="size-4" aria-hidden />
					{photo ? "Upload a new photo" : "Upload a photo"}
				</button>
				{photo && (
					<button
						type="button"
						onClick={remove}
						className={QUIET_BUTTON}
						disabled={busy}
					>
						<TrashIcon className="size-4" aria-hidden />
						Remove photo
					</button>
				)}
				{error && <span className="text-sm text-rose-300">{error}</span>}
			</div>
			{file && (
				<PhotoCropper
					file={file}
					busy={busy}
					onCancel={() => setFile(null)}
					onCropped={upload}
				/>
			)}
		</>
	);
}

function LinksEditor({
	draft,
	set,
	problems,
}: {
	draft: ProfileSettings;
	set: (patch: Partial<ProfileSettings>) => void;
	problems: (string | null)[];
}) {
	const unused = useMemo(
		() =>
			LINK_SERVICES.filter((s) => !draft.links.some((l) => l.service === s)),
		[draft.links],
	);
	return (
		<>
			<ul className="flex flex-col gap-2">
				{draft.links.map((l, i) => {
					const s = LINK_SERVICE_INFO[l.service];
					return (
						<li key={l.service} className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
									{s.logo ? (
										<img
											src={assetUrl(s.logo)}
											alt=""
											className="size-6 object-contain"
										/>
									) : (
										<b className="text-gray-300">{s.letter}</b>
									)}
								</span>
								<label className="flex min-h-11 min-w-0 flex-1 items-center rounded-lg bg-gray-900 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-amber-400">
									<span className="shrink-0 pl-3 text-sm text-gray-500 max-sm:hidden">
										{s.prefix}
									</span>
									<span className="sr-only">{s.name}</span>
									<input
										className="min-w-0 flex-1 bg-transparent px-3 text-gray-100 placeholder:text-gray-600 focus:outline-none sm:pl-0.5"
										value={l.value}
										placeholder={`${s.name} ${s.placeholder}`}
										aria-invalid={!!problems[i]}
										onChange={(e) =>
											set({
												links: draft.links.map((x, j) =>
													j === i ? { ...x, value: e.target.value } : x,
												),
											})
										}
									/>
								</label>
								<button
									type="button"
									onClick={() =>
										set({ links: draft.links.filter((_, j) => j !== i) })
									}
									aria-label={`Remove ${s.name}`}
									className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white/[0.06] hover:text-white"
								>
									<XMarkIcon className="size-5" aria-hidden />
								</button>
							</div>
							{problems[i] && (
								<p className="pl-14 text-xs text-rose-300">{problems[i]}</p>
							)}
						</li>
					);
				})}
			</ul>
			{unused.length > 0 && draft.links.length < MAX_LINKS && (
				<div className="flex flex-wrap gap-2">
					{unused.map((service: LinkService) => (
						<button
							key={service}
							type="button"
							onClick={() =>
								set({ links: [...draft.links, { service, value: "" }] })
							}
							className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/[0.04] px-3 text-xs font-semibold text-gray-300 ring-1 ring-white/10 hover:text-white"
						>
							<PlusIcon className="size-3.5" aria-hidden />
							{LINK_SERVICE_INFO[service].name}
						</button>
					))}
				</div>
			)}
		</>
	);
}

function Audiences({
	visibility,
}: { visibility: ProfileSettings["visibility"] }) {
	const by = (a: Audience) =>
		PARTS.filter((p) => visibility[p.part] === a).map((p) => p.name);
	const rows: [string, string[], ReactNode][] = [
		[
			"Everyone",
			by("everyone"),
			<GlobeAltIcon key="e" className="size-4 text-emerald-400" aria-hidden />,
		],
		[
			"Members",
			by("members"),
			<UserGroupIcon key="m" className="size-4 text-sky-300" aria-hidden />,
		],
		[
			"Only you",
			by("me"),
			<LockClosedIcon key="o" className="size-4 text-amber-300" aria-hidden />,
		],
	];
	return (
		<ul className="flex flex-col gap-1.5">
			{rows
				.filter(([, names]) => names.length)
				.map(([label, names, icon]) => (
					<li key={label} className="flex gap-2 text-gray-400">
						<span className="mt-0.5 shrink-0">{icon}</span>
						<span>
							<b className="text-gray-200">{label}:</b> {names.join(", ")}
						</span>
					</li>
				))}
		</ul>
	);
}

function AudiencePicker({
	name,
	value,
	onChange,
}: { name: string; value: Audience; onChange: (a: Audience) => void }) {
	return (
		<div
			role="radiogroup"
			aria-label={`Who sees ${name}`}
			className="flex shrink-0 rounded-full bg-gray-900 p-0.5 ring-1 ring-white/10"
		>
			{AUDIENCES.map((a) => (
				<button
					key={a}
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: the ARIA radio pattern on styled buttons, with aria-checked
					role="radio"
					aria-checked={value === a}
					onClick={() => onChange(a)}
					className={`min-h-9 rounded-full px-3 text-xs font-semibold whitespace-nowrap ${
						value === a
							? a === "everyone"
								? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/40"
								: a === "members"
									? "bg-sky-400/15 text-sky-200 ring-1 ring-sky-400/40"
									: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/40"
							: "text-gray-400 hover:text-gray-100"
					}`}
				>
					{AUDIENCE_LABEL[a]}
				</button>
			))}
		</div>
	);
}

function Group({
	title,
	line,
	children,
}: { title: string; line?: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-4">
			<div>
				<h2 className={`${DISPLAY} text-2xl text-white`}>{title}</h2>
				{line && <p className="text-sm text-gray-400">{line}</p>}
			</div>
			{children}
		</section>
	);
}

function Field({
	label,
	hint,
	children,
}: { label: string; hint?: string; children: (id: string) => ReactNode }) {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-semibold text-gray-200">
				{label}
			</label>
			{children(id)}
			{hint && <p className="text-xs text-gray-500">{hint}</p>}
		</div>
	);
}
