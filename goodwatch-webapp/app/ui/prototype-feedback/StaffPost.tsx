// PROTOTYPE - throwaway. A mock of the private staff Discord forum post a report becomes (dark Discord look, not
// GoodWatch's). Three posts: a data correction, a bug with a screenshot, a contact message. The correction's buttons
// follow ?as=: a trusted member's fix is already live (Keep / Revert); anyone else's waits (Approve / Reject).
// - A: one embed with every field in a grid, the screenshot, link buttons, then the staff buttons.
// - B: the change first, big "was → now"; details in one footer line; duplicates as their own line with a count.
// - C: the forum's post list beside a compact post, and every status change as a bot reply in the thread.
import { useState } from "react"
import type { ReactNode } from "react"
import { useFeedback } from "~/ui/prototype-feedback/store"
import { assetUrl } from "~/utils/asset-url"
import shot from "~/ui/prototype-feedback/staff-screenshot.jpg"

const D = {
	bg: "bg-[#313338]",
	side: "bg-[#2b2d31]",
	dark: "bg-[#1e1f22]",
	text: "text-[#dbdee1]",
	muted: "text-[#949ba4]",
	link: "text-[#00a8fc]",
}

type PostId = "data" | "bug" | "contact"
const TAGS: Record<PostId, { tag: string; color: string; title: string; when: string }> = {
	data: { tag: "data", color: "#f0b232", title: "The Bear · Where to watch: not on Hulu (US)", when: "Today at 14:02" },
	bug: { tag: "bug", color: "#f23f43", title: "Episodes grid doesn't scroll on my phone", when: "Today at 13:47" },
	contact: { tag: "contact", color: "#23a55a", title: "Account · Can I change my handle?", when: "Today at 11:20" },
}

function Btn({ tone, children, onClick, disabled }: { tone: "blurple" | "green" | "red" | "grey" | "link"; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
	const c = {
		blurple: "bg-[#5865f2] hover:bg-[#4752c4] text-white",
		green: "bg-[#248046] hover:bg-[#1a6334] text-white",
		red: "bg-[#da373c] hover:bg-[#a12828] text-white",
		grey: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
		link: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
	}[tone]
	return (
		<button type="button" disabled={disabled} onClick={onClick} className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[3px] px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${c}`}>
			{children}
			{tone === "link" && <span aria-hidden className="text-xs opacity-80">↗</span>}
		</button>
	)
}

function Field({ name, value, inline = true }: { name: string; value: ReactNode; inline?: boolean }) {
	return (
		<div className={inline ? "min-w-0" : "col-span-full min-w-0"}>
			<div className="text-xs font-bold text-white">{name}</div>
			<div className={`text-sm ${D.text} break-words`}>{value}</div>
		</div>
	)
}

function Bot({ children, when }: { children: ReactNode; when: string }) {
	return (
		<div className="flex gap-3 sm:gap-4">
			<div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0b232] text-sm font-black text-black">GW</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-x-2">
					<span className="font-medium text-white">GoodWatch Reports</span>
					<span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold text-white">APP</span>
					<span className={`text-xs ${D.muted}`}>{when}</span>
				</div>
				<div className="mt-1">{children}</div>
			</div>
		</div>
	)
}

function Embed({ color, children }: { color: string; children: ReactNode }) {
	return (
		<div className={`mt-1 max-w-[520px] rounded-[4px] border-l-4 ${D.side} p-3 pr-4`} style={{ borderLeftColor: color }}>
			{children}
		</div>
	)
}

function Links({ post }: { post: PostId }) {
	if (post === "contact") return null
	return (
		<div className="mt-2 flex flex-wrap gap-2">
			<Btn tone="link">GoodWatch page</Btn>
			{post === "data" && <Btn tone="link">TMDB</Btn>}
			{post === "data" && <Btn tone="link">IMDb</Btn>}
			{post === "data" && <Btn tone="link">Member's source</Btn>}
			{post === "bug" && <Btn tone="link">Replay</Btn>}
		</div>
	)
}

type Status = "live" | "pending" | "approved" | "rejected" | "reverted" | "kept"

function Actions({ status, set }: { status: Status; set: (s: Status) => void }) {
	if (status === "live")
		return (
			<div className="mt-2 flex flex-wrap gap-2">
				<Btn tone="green" onClick={() => set("kept")}>Keep</Btn>
				<Btn tone="red" onClick={() => set("reverted")}>Revert</Btn>
			</div>
		)
	if (status === "pending")
		return (
			<div className="mt-2 flex flex-wrap gap-2">
				<Btn tone="green" onClick={() => set("approved")}>Approve</Btn>
				<Btn tone="red" onClick={() => set("rejected")}>Reject</Btn>
			</div>
		)
	return (
		<div className="mt-2 flex flex-wrap gap-2">
			<Btn tone="grey" disabled>
				{{ approved: "Approved", rejected: "Rejected", reverted: "Reverted", kept: "Kept" }[status]} by alp
			</Btn>
			{status !== "rejected" && status !== "reverted" && <Btn tone="red" onClick={() => set("reverted")}>Revert</Btn>}
		</div>
	)
}

const STATUS_LINE: Record<Status, string> = {
	live: "Live now · from a trusted member",
	pending: "Waiting for review",
	approved: "Approved by alp · now live on GoodWatch",
	rejected: "Rejected by alp · the member sees “We kept the current value”",
	reverted: "Reverted by alp · the old value is back, caches cleared",
	kept: "Kept by alp",
}

function Meta({ viewer }: { viewer: string }) {
	return {
		member: viewer === "guest" ? "Guest · no account" : viewer === "trusted" ? "@sam (trusted · 14 kept fixes)" : "@sam (member since 2026-08)",
	}
}

function Post({ post, variant, status, setStatus }: { post: PostId; variant: "A" | "B" | "C"; status: Status; setStatus: (s: Status) => void }) {
	const { viewer } = useFeedback()
	const m = Meta({ viewer })
	const t = TAGS[post]
	const fieldsData = (
		<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
			<Field name="Kind" value="Data · Where to watch" />
			<Field name="Problem" value="It's not on a service listed here" />
			<Field name="Status" value={STATUS_LINE[status].split(" · ")[0]} />
			<Field name="Page" value={<span className={D.link}>/show/136315-the-bear</span>} />
			<Field name="Member" value={m.member} />
			<Field name="Country" value="US" />
			<Field name="Build" value={<code className="text-xs">8333a21</code>} />
			<Field name="Device" value="Phone · 390×844 · Safari" />
			<Field name="Reports" value="3 (2 more since 13:10)" />
		</div>
	)
	if (post === "data") {
		if (variant === "B")
			return (
				<Bot when={t.when}>
					<Embed color={t.color}>
						<div className="text-xs font-bold tracking-wide text-[#f0b232] uppercase">Where to watch · US · Stream</div>
						<div className="mt-1 text-base font-semibold text-white">The Bear (2022)</div>
						<div className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
							<span className={`text-xs ${D.muted}`}>Was</span>
							<span className={`text-lg ${D.text} line-through decoration-[#da373c]`}>Hulu · Stream · United States</span>
							<span className={`text-xs ${D.muted}`}>Now</span>
							<span className="text-lg font-semibold text-white">Not on Hulu</span>
							<span className={`text-xs ${D.muted}`}>Source</span>
							<span className={`text-sm ${D.link} truncate`}>hulu.com/series/the-bear-…</span>
						</div>
						<div className="mt-3 rounded-[3px] bg-[#1e1f22] px-2 py-1.5 text-sm text-[#f0b232]">3 members reported this · 2 more since 13:10</div>
						<div className={`mt-3 text-xs ${D.muted}`}>
							{m.member} · Phone 390×844 · build 8333a21 · {STATUS_LINE[status]}
						</div>
					</Embed>
					<Links post={post} />
					<Actions status={status} set={setStatus} />
				</Bot>
			)
		return (
			<Bot when={t.when}>
				<Embed color={t.color}>
					<div className="text-base font-semibold text-white">The Bear · Where to watch</div>
					<div className={`mt-1 text-sm ${D.text}`}>
						<span className={D.muted}>Was:</span> Hulu · Stream · United States
						<br />
						<span className={D.muted}>Suggested:</span> Not on Hulu
					</div>
					{variant === "A" ? fieldsData : <div className={`mt-2 text-xs ${D.muted}`}>{m.member} · US · build 8333a21 · 3 reports</div>}
				</Embed>
				<Links post={post} />
				<Actions status={status} set={setStatus} />
			</Bot>
		)
	}
	if (post === "bug")
		return (
			<Bot when={t.when}>
				<Embed color={t.color}>
					<div className={`text-sm whitespace-pre-line ${D.text}`}>
						On the Bear page the episode grid doesn't scroll sideways on my phone. I can only see seasons 1–3.
					</div>
					{variant === "A" && (
						<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
							<Field name="Kind" value="Bug" />
							<Field name="Page" value={<span className={D.link}>/show/136315-the-bear</span>} />
							<Field name="Member" value={m.member} />
							<Field name="Build" value={<code className="text-xs">8333a21</code>} />
							<Field name="Country" value="DE" />
							<Field name="Device" value="Phone · 390×844 · DPR 3" />
						</div>
					)}
					{variant !== "A" && <div className={`mt-2 text-xs ${D.muted}`}>/show/136315-the-bear · {m.member} · DE · Phone 390×844 · build 8333a21</div>}
					<img src={assetUrl(shot)} alt="Screenshot sent with the report" className="mt-3 w-full max-w-[400px] rounded-[4px]" />
				</Embed>
				<Links post={post} />
				<div className="mt-2 flex flex-wrap gap-2">
					<Btn tone="blurple">Mark fixed</Btn>
					<Btn tone="grey">Can't reproduce</Btn>
				</div>
			</Bot>
		)
	return (
		<Bot when={t.when}>
			<Embed color={t.color}>
				<div className="text-base font-semibold text-white">Can I change my handle?</div>
				<div className={`mt-1 text-sm ${D.text}`}>Hi! I picked a handle in a hurry. Is there a way to change it without losing my ratings?</div>
				<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
					<Field name="Topic" value="My account" />
					<Field name="From" value={viewer === "guest" ? "Guest" : "@sam (member)"} />
					<Field name="Reply to" value="Sent by email · not shown here" />
					<Field name="Email" value="Delivered to hello@goodwatch.app" />
				</div>
			</Embed>
			<div className="mt-2 flex flex-wrap gap-2">
				<Btn tone="blurple">Mark answered</Btn>
			</div>
		</Bot>
	)
}

export default function StaffPost() {
	const { variant, viewer } = useFeedback()
	const [post, setPost] = useState<PostId>("data")
	const start: Status = viewer === "trusted" ? "live" : "pending"
	const [statusBy, setStatusBy] = useState<Record<string, Status>>({})
	const status = statusBy[viewer] ?? start
	const setStatus = (s: Status) => setStatusBy((x) => ({ ...x, [viewer]: s }))
	const t = TAGS[post]
	const posts = (Object.keys(TAGS) as PostId[]).map((id) => (
		<button
			key={id}
			type="button"
			onClick={() => setPost(id)}
			className={`w-full cursor-pointer rounded-lg p-3 text-left transition-colors ${post === id ? "bg-[#404249]" : "bg-[#2b2d31] hover:bg-[#35373c]"}`}
		>
			<span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: `${TAGS[id].color}55` }}>
				{TAGS[id].tag}
			</span>
			<span className="mt-1 block truncate text-sm font-semibold text-white">{TAGS[id].title}</span>
			<span className={`block text-xs ${D.muted}`}>
				{TAGS[id].when}
				{id === "data" && " · 3 reports"}
			</span>
		</button>
	))
	return (
		<div className="mx-auto max-w-6xl px-3 pt-6 pb-48 sm:px-6">
			<p className="mb-3 text-sm text-gray-400">
				What staff see in the private <span className="font-semibold text-gray-200">#reports</span> forum. Only the correction's buttons change with “Viewing as”.
			</p>
			<div className={`overflow-hidden rounded-xl ${D.bg} font-sans ring-1 ring-black/40`}>
				<div className={`flex items-center gap-2 border-b border-black/30 px-4 py-3 ${D.text}`}>
					<span className={`text-xl ${D.muted}`}>#</span>
					<span className="font-semibold text-white">reports</span>
					<span className={`hidden text-sm sm:inline ${D.muted}`}>· Bugs, ideas, data and contact from goodwatch.app</span>
				</div>
				<div className={variant === "C" ? "grid md:grid-cols-[17rem_minmax(0,1fr)]" : ""}>
					{variant === "C" && <div className={`flex flex-col gap-2 border-black/30 p-3 max-md:border-b md:border-r ${D.dark}`}>{posts}</div>}
					<div className="min-w-0 p-4">
						{variant !== "C" && (
							<div className="mb-4 flex flex-wrap gap-2">
								{(Object.keys(TAGS) as PostId[]).map((id) => (
									<button
										key={id}
										type="button"
										onClick={() => setPost(id)}
										className={`cursor-pointer rounded-full px-3 py-1 text-sm ${post === id ? "bg-[#5865f2] text-white" : "bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]"}`}
									>
										{TAGS[id].tag} post
									</button>
								))}
							</div>
						)}
						<div className="mb-4 border-b border-white/5 pb-3">
							<span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: `${t.color}55` }}>
								{t.tag}
							</span>
							<h2 className="mt-1 text-xl font-bold text-white">{t.title}</h2>
						</div>
						<Post post={post} variant={variant} status={status} setStatus={setStatus} />
						{variant === "C" && post === "data" && (
							<div className="mt-5 flex flex-col gap-4">
								<Bot when="Today at 13:58">
									<p className={`text-sm ${D.text}`}>+1 · another member reported the same fix (guest, US)</p>
								</Bot>
								{status !== "live" && status !== "pending" && (
									<Bot when="Just now">
										<p className={`text-sm ${D.text}`}>{STATUS_LINE[status]}</p>
									</Bot>
								)}
							</div>
						)}
						{variant !== "C" && post === "data" && status !== "live" && status !== "pending" && (
							<p className={`mt-4 text-sm ${D.muted}`}>{STATUS_LINE[status]}</p>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
