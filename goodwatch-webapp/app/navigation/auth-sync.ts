// Tells the site's other tabs that the signed-in person may have changed. All tabs share the session cookie, but each
// keeps its own loader cache under the identity its root's data names. Without a note, a tab still showing member A
// would answer from A's pages after the cookie names B. Better Auth's client doesn't tell other tabs at all.
//
// A note goes out over a BroadcastChannel, and is also written to localStorage: that write reaches other tabs as a
// `storage` event where BroadcastChannel is missing, and a tab that was asleep (hidden, or in the back/forward cache)
// compares it when it shows again. A note names the member when it is known ("member:<id>" or "visitor"), or nobody
// while a sign-in or sign-out has just been answered. A tab that already shows the named member ignores it; any other
// tab holds its cache and reloads its root.
// This file has no browser or Remix imports, so `node --test` runs its tests directly.

export const AUTH_SYNC_KEY = "gw-auth-sync"

export interface AuthNote {
	/** Unique per note, so a tab that heard it over both paths acts once. */
	id: string
	/** Who the session names now, or undefined when unknown. */
	member?: string
}

export interface AuthSyncEnv {
	/** Reads the last note's text. May throw (storage blocked). */
	read: () => string | null
	/** Writes a note's text. May throw (storage blocked or full). */
	write: (value: string) => void
	/** Posts to the other tabs, or null without BroadcastChannel. */
	post: ((note: AuthNote) => void) | null
	newId: () => string
}

function parse(text: string | null): AuthNote | null {
	if (!text) return null
	try {
		const note = JSON.parse(text) as Partial<AuthNote> | null
		if (!note || typeof note.id !== "string") return null
		return {
			id: note.id,
			member: typeof note.member === "string" ? note.member : undefined,
		}
	} catch {
		return null
	}
}

export class AuthSync {
	private seen: string | null = null
	private readonly env: AuthSyncEnv
	private readonly ownMember: () => string | null
	private readonly onChange: () => void

	/**
	 * `ownMember` gives the member this tab's root data names, or null when it has none (an error page). `onChange`
	 * holds the cache and reloads the root.
	 */
	constructor(
		env: AuthSyncEnv,
		ownMember: () => string | null,
		onChange: () => void,
	) {
		this.env = env
		this.ownMember = ownMember
		this.onChange = onChange
	}

	private stored(): AuthNote | null {
		try {
			return parse(this.env.read())
		} catch {
			return null
		}
	}

	/**
	 * Call once the router exists. The page's own data is the server's latest answer: when the last note names
	 * someone else (a sign-in that ended in a full page load, such as an OAuth callback), the other tabs hear of it.
	 */
	start(): void {
		const note = this.stored()
		this.seen = note?.id ?? null
		const own = this.ownMember()
		if (own !== null && note?.member !== own) this.announce(own)
	}

	/** Tells the other tabs. Without `member`, a sign-in or sign-out was answered and nobody knows who yet. */
	announce(member?: string): void {
		const note: AuthNote = { id: this.env.newId(), member }
		this.seen = note.id
		try {
			this.env.write(JSON.stringify(note))
		} catch {}
		try {
			this.env.post?.(note)
		} catch {}
	}

	/** The root's member changed in this tab. Tells the others unless the last note named the same member. */
	memberChanged(member: string): void {
		if (this.stored()?.member !== member) this.announce(member)
	}

	/** A note from another tab, over the channel or a `storage` event. */
	receive(value: AuthNote | string | null): void {
		const note =
			typeof value === "string" || value === null ? parse(value) : value
		if (!note || note.id === this.seen) return
		this.seen = note.id
		if (note.member !== undefined && note.member === this.ownMember()) return
		this.onChange()
	}

	/** When the tab shows again: acts on a note that came while the tab couldn't hear it. One storage read. */
	check(): void {
		this.receive(this.stored())
	}
}
