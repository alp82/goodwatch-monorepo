import { z } from "zod"
import { randomBytes } from 'node:crypto'
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { requireNotDeleting } from './proposal-deletion.ts'
import {
	API_PREFIX,
	MEMBER_SESSION_HEADER,
	paths,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { isAccountState, type MemberSession } from "./continuous-members.server.ts"
import { equal, random } from "./crypto.server.ts"
import { RoomError } from "./errors.ts"
import { inviteCardPng, LinkCardBusyError } from "./link-card-renderer.server.ts"
import { ProposalService } from "./proposal-service.server.ts"
import type { ActorCredential } from "./service.server.ts"
import { attachSchema, parse, resolveSchema, viewSchema } from "./validation.ts"
import {
	proposalCreateSchema as createSchema,
	proposalJoinSchema as joinSchema,
	proposalCommandSchema as commandSchema,
	proposalPreviewSchema,
	realtimeViewsSchema,
} from "./proposal-validation.ts"
/** This browser's GoodWatch sign-in (sealed, HttpOnly) and its short-lived sign-in intent. */
export const MEMBER_COOKIE = "yepwatch3_member"
export const MEMBER_INTENT_COOKIE = "yepwatch3_member_intent"
export const CREATOR_COOKIE = 'yepwatch3_creator'
export const CREATOR_HEADER = 'x-yepwatch-creator'
export interface HttpOptions {
	serviceSecret: string
	allowedOrigins: string[]
	secureCookies?: boolean
	members?: ContinuousMembers
	/** Draws the room invite link-preview card; defaults to the child process renderer. */
	inviteCard?: (hostName: string | null) => Promise<Uint8Array>
}
const INVITE_CARD = /^\/api\/yepwatch\/v1\/proposal\/invites\/([A-Za-z0-9._-]{1,200})\/card\.png$/
async function body(request: Request) {
	if (
		!(request.headers.get("content-type") ?? "").startsWith("application/json")
	)
		throw new RoomError("invalid_request", "JSON body required", 415)
	const reader = request.body?.getReader()
	if (!reader) throw new RoomError("invalid_request", "Body required", 400)
	const parts: Uint8Array[] = []
	let size = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		size += value.length
		if (size > 65_536) {
			await reader.cancel()
			throw new RoomError("invalid_request", "Body too large", 413)
		}
		parts.push(value)
	}
	try {
		return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown
	} catch {
		throw new RoomError("invalid_request", "Malformed JSON", 400)
	}
}
export function createProposalHandler(
	service: ProposalService,
	options: HttpOptions
) {
	if (options.serviceSecret.length < 32)
		throw new Error(
			"Gateway service secret must contain at least 32 characters"
		)
	const allowed = new Set(options.allowedOrigins)
	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url)
		const origin = request.headers.get("origin")
		const headers = new Headers({
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
			vary: "Origin",
			"access-control-expose-headers": "x-yepwatch-session",
		})
		if (origin && allowed.has(origin)) {
			headers.set("access-control-allow-origin", origin)
			headers.set("access-control-allow-credentials", "true")
		}
		const reply = (data: unknown, status = 200) =>
			new Response(JSON.stringify(data), { status, headers })
		const cookie = (name: string) =>
			(request.headers.get("cookie") ?? "")
				.split(";")
				.map((v) => v.trim())
				.find((v) => v.startsWith(`${name}=`))
				?.slice(name.length + 1) ?? null
		const setCookie = (name: string, value: string, maxAge: number) =>
			headers.append(
				"set-cookie",
				`${name}=${value}; Path=${API_PREFIX}; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, maxAge)}${
					options.secureCookies === false ? "" : "; Secure"
				}`
			)
		const nativeRequest = () => request.headers.has(MEMBER_SESSION_HEADER) || request.headers.get("x-yepwatch-client") === "native"
		const guestCreator = () => {
			const nativeId = request.headers.get(CREATOR_HEADER)
			if (nativeId && (!nativeRequest() || !/^[a-f0-9]{64}$/.test(nativeId))) throw new RoomError('invalid_request', 'Invalid app installation identifier', 400)
			if (nativeId) return nativeId
			const previous = cookie(CREATOR_COOKIE)
			if (previous && /^[a-f0-9]{64}$/.test(previous)) return previous
			const value = randomBytes(32).toString('hex')
			setCookie(CREATOR_COOKIE, value, 30 * 24 * 60 * 60)
			return value
		}
		/** The device session: native apps send it in a header, browsers in the cookie. */
		const memberSession = () => request.headers.get(MEMBER_SESSION_HEADER) ?? cookie(MEMBER_COOKIE)
		/**
		 * Browsers get a renewed or ended session as a cookie; apps get the renewed session in the body.
		 * Only a session the request itself sent in the header goes back in the body: a cookie session
		 * stays HttpOnly whatever the request claims to be.
		 */
		const keepSession = (session: MemberSession | null, changed: boolean) => {
			if (!changed || !options.members) return undefined
			if (request.headers.has(MEMBER_SESSION_HEADER)) return session ? options.members.sealSession(session) : undefined
			if (session) setCookie(MEMBER_COOKIE, options.members.sealSession(session), options.members.sessionMaxAge(session))
			else setCookie(MEMBER_COOKIE, "", 0)
			return undefined
		}
		const originCheck = (required: boolean) => {
			if (origin ? !allowed.has(origin) : required)
				throw new RoomError("forbidden", "Allowed Origin required", 403)
		}
		const credential = (roomId: string): ActorCredential => {
			const authorization = request.headers.get("authorization")
			if (authorization?.startsWith("Bearer ")) {
				const participantId = request.headers.get("x-yepwatch-participant")
				if (!participantId)
					throw new RoomError("unauthorized", "Participant ID required", 401)
				return { participantId, token: authorization.slice(7) }
			}
			if (request.method !== "GET") originCheck(true)
			const name = `yepwatch3_${roomId}`
			const value = (request.headers.get("cookie") ?? "")
				.split(";")
				.map((v) => v.trim())
				.find((v) => v.startsWith(`${name}=`))
				?.slice(name.length + 1)
			const [participantId, token, extra] = (value ?? "").split(".")
			if (!participantId || !token || extra)
				throw new RoomError("unauthorized", "Room credential required", 401)
			return { participantId, token }
		}
    let accountRead: Promise<import('./proposal-types.ts').RoomAccount | null> | undefined
    let freshMemberSession: MemberSession | null = null
    /** `roomScoped`: a signed-out (revoked) sign-in on a room request is no sign-in; the room credential decides. */
    const account = (required = false, roomScoped = false) => {
      accountRead ??= (async () => {
        const raw = memberSession()
        if (!raw || !options.members) return null
        const result = await options.members.account(raw)
        const renewed = keepSession(result.session, result.changed)
        if (renewed) headers.set('x-yepwatch-session', renewed)
        const session = result.session
        if (!session?.sessionId || !(await service.accounts.sessionActive(session.sessionId))) {
          if (!nativeRequest()) setCookie(MEMBER_COOKIE, '', 0)
          // Log out keeps this device's room places as guests: a read racing the logout (its cookie not yet
          // cleared) reads as that guest instead of failing.
          if (roomScoped && session?.sessionId) return null
          throw new RoomError('member_required', 'Sign in with GoodWatch again', 403)
        }
        if (session.unverified || result.status.unavailable) throw new RoomError('busy', 'GoodWatch is temporarily unavailable', 503, true)
        freshMemberSession = session
        if (![`${paths.account}/deletion`, `${paths.account}/restore`].includes(url.pathname)) await service.requireAccountActive(session.userId)
        return { userId: session.userId, sessionId: session.sessionId,
          expiresAt: Date.now() + options.members.sessionMaxAge(session) * 1000 }
      })()
      return accountRead.then(value => {
        if (required && !value) throw new RoomError('member_required', 'Sign in with GoodWatch again', 403)
        return value
      })
    }
    /** `deferDeletionCheck`: takes a guest's deletion check still running instead of waiting for it here. */
    const scopedCredential = async (roomId: string, deferDeletionCheck?: (check: Promise<void>) => void) => {
      const c = credential(roomId)
      const a = await account(false, true)
      if (!a && !url.pathname.endsWith('/deletion') && !url.pathname.endsWith('/restore')) {
        const check = requireNotDeleting(service.deletions, { kind: 'guest', roomId, participantId: c.participantId })
        if (deferDeletionCheck) { check.catch(() => {}); deferDeletionCheck(check) } else await check
      }
      return a ? { ...c, accountId: a.userId, sessionId: a.sessionId } : c
    }
    const sendAdmission = async (admission: import('../../../packages/yepwatch-contracts/proposal.ts').GuestAdmission, a: import('./proposal-types.ts').RoomAccount | null, setup?: import('../../../packages/yepwatch-contracts/proposal.ts').RoomSetupRequest) => {
      const c = admission.credential
      if (a && options.members && freshMemberSession) {
        await options.members.linkRoom(c.roomId, c.participantId, options.members.sealSession(freshMemberSession))
        await service.notify(c.roomId)
        const scoped = { participantId: c.participantId, token: c.token, accountId: a.userId, sessionId: a.sessionId }
        admission.snapshot = await service.read(c.roomId, scoped)
        // A new room takes the member's GoodWatch country over the device's (the country the create
        // request carried), as the app's own country step does. Only before anything else was sent.
        const snapshot = admission.snapshot
        const prefill = snapshot.own.member.prefill?.country
        if (setup && prefill && prefill !== setup.country && snapshot.shared.screens[0]?.country === setup.country && snapshot.own.nextSequence === 1 && snapshot.shared.phase === 'setup') {
          try {
            admission.snapshot = (await service.command(c.roomId, scoped, { commandId: `setup-${c.participantId}`, sequence: 1, command: { type: 'configure', expectedContextVersion: snapshot.shared.contextVersion, country: prefill } })).snapshot
          } catch (e) {
            if (!(e instanceof RoomError)) throw e
          }
        }
      }
      if (request.headers.get('x-yepwatch-client') !== 'native') {
        setCookie(`yepwatch3_${c.roomId}`, `${c.participantId}.${c.token}`, Math.floor((c.expiresAt - Date.now()) / 1000))
        c.token = ''
      }
      return reply({ ...admission, ...admission.snapshot.own.member })
    }

		try {
			if (!url.pathname.startsWith(`${API_PREFIX}/`))
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			if (request.method === "OPTIONS") {
				originCheck(true)
				headers.set("access-control-allow-methods", "GET,POST,OPTIONS")
				headers.set(
					"access-control-allow-headers",
					`content-type,authorization,x-yepwatch-participant,x-yepwatch-client,${MEMBER_SESSION_HEADER},${CREATOR_HEADER}`
				)
				return new Response(null, { status: 204, headers })
			}
			if (url.pathname.startsWith(`${API_PREFIX}/realtime/internal/`)) {
				if (
					!equal(
						request.headers.get("authorization") ?? "",
						`Bearer ${options.serviceSecret}`
					)
				)
					throw new RoomError(
						"unauthorized",
						"Gateway service credential required",
						401
					)
				if (origin)
					throw new RoomError(
						"forbidden",
						"Internal endpoint disallows browser Origin",
						403
					)
				if (request.method !== "POST")
					throw new RoomError("not_found", "Endpoint unavailable", 404)
				if (url.pathname === paths.realtimeAttach) {
					const value = parse(attachSchema, await body(request))
					return reply(await service.attach(value.roomId, value.ticket))
				}
				if (url.pathname === paths.realtimeView) {
					const value = parse(viewSchema, await body(request))
					return reply(await service.view(value.roomId, value.lease))
				}
				if (url.pathname === paths.realtimeViews) {
					const value = parse(realtimeViewsSchema, await body(request))
					return reply(await service.views(value.roomId, value.leases))
				}
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			}
			if (request.method === "POST") originCheck(false)
			if (url.pathname === paths.account || url.pathname.startsWith(`${paths.account}/`)) {
				const members = options.members
				if (!members)
					throw new RoomError(
						"not_implemented",
						"GoodWatch sign-in is not configured on this runtime",
						501
					)
				if (request.method === "GET" && url.pathname === paths.account) {
					const result = await members.account(memberSession())
					if (result.session?.sessionId && !(await service.accounts.sessionActive(result.session.sessionId))) {
						setCookie(MEMBER_COOKIE, "", 0)
						return reply({ state: "guest", displayName: null })
					}
					const session = keepSession(result.session, result.changed)
					return reply({ ...result.status, ...(session ? { session } : {}) })
				}
				if (request.method === "GET" && url.pathname === paths.accountHome) {
					const a = (await account(true))!
					return reply(await service.accountHome(a))
				}
				if (url.pathname === `${paths.account}/deletion`) {
					const a = (await account(true))!
					if (request.method === 'GET') return reply({ deletion: await service.deletions.get({ kind: 'account', userId: a.userId }), accountTag: service.accountDeletionTag(a.userId) })
					if (request.method === 'POST') {
						originCheck(!nativeRequest())
						parse(z.object({ confirm: z.literal('DELETE') }).strict(), await body(request))
						const deletion = await service.deleteAccount(a)
						setCookie(MEMBER_COOKIE, '', 0)
						return reply({ deletion })
					}
				}
				if (request.method === 'POST' && url.pathname === `${paths.account}/restore`) {
					originCheck(!nativeRequest())
					parse(z.object({ confirm: z.literal('RESTORE') }).strict(), await body(request))
					const a = (await account(true))!
					await service.deletions.restore({ kind: 'account', userId: a.userId }, Date.now())
					return reply({ restored: true })
				}
				if (request.method === "POST" && url.pathname === paths.accountStart) {
					const value = parse(
						z
							.object({
								returnTo: z.string().url().max(1000),
								client: z.enum(["browser", "native"]),
								codeChallenge: z
									.string()
									.regex(/^[A-Za-z0-9_-]{43}$/)
									.optional(),
							})
							.strict(),
						await body(request)
					)
					if (value.client === "browser") originCheck(true)
					const started = members.startAccount(value)
					if (started.intent) setCookie(MEMBER_INTENT_COOKIE, started.intent, 600)
					return reply({
						authorizeUrl: started.authorizeUrl,
						expiresAt: started.expiresAt,
						state: started.state,
					})
				}
				if (request.method === "POST" && url.pathname === paths.accountExchange) {
					const value = parse(
						z
							.object({
								state: z.string().min(40).max(160),
								code: z.string().min(1).max(4096),
								codeVerifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
							})
							.strict(),
						await body(request)
					)
					const session = await members.accountExchange(value)
					return reply({
						state: "member",
						displayName: session.displayName,
						session: members.sealSession(session),
					})
				}
				if (request.method === "POST" && url.pathname === paths.accountLogout) {
					originCheck(!nativeRequest())
					const opened = members.openSession(memberSession())
					// This device stays in its rooms as a guest; the app lists them on the device again.
					const keptRooms = opened?.sessionId ? await service.logoutAccount({ userId: opened.userId, sessionId: opened.sessionId, expiresAt: Date.now() + 90 * 86400000 }) : []
					// Ends this device's sign-in for YepWatch only. GoodWatch's own session is untouched.
					setCookie(MEMBER_COOKIE, "", 0)
					setCookie(MEMBER_INTENT_COOKIE, "", 0)
					return reply({ state: "guest", displayName: null, keptRooms })
				}
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			}
			if (request.method === 'POST' && /^\/api\/yepwatch\/v1\/proposal\/rooms\/[A-Za-z0-9_-]+\/(deletion|restore)$/.test(url.pathname)) {
				const id = url.pathname.split('/').at(-2)!
				const restoring = url.pathname.endsWith('/restore')
				parse(z.object({ confirm: z.literal(restoring ? 'RESTORE' : 'DELETE') }).strict(), await body(request))
				const access = await scopedCredential(id)
				return reply(restoring ? await service.restoreGuest(id, access) : { deletion: await service.deleteGuest(id, access) })
			}
			if (url.pathname.startsWith(`${API_PREFIX}/member/`)) {
				const members = options.members
				if (!members)
					throw new RoomError(
						"not_implemented",
						"GoodWatch sign-in is not configured on this runtime",
						501
					)
				if (request.method === "GET" && url.pathname === paths.memberCallback) {
					const state = url.searchParams.get("state") ?? ""
					const code = url.searchParams.get("code") ?? ""
					if (!state || state.length > 160 || !code || code.length > 4096)
						throw new RoomError(
							"unauthorized",
							"Sign-in did not complete; restart sign-in",
							401
						)
          if (!isAccountState(state)) throw new RoomError("unauthorized", "Restart GoodWatch sign-in", 401)
          const kind = members.accountClient(state)
          let destination: string
          if (kind === "native") destination = members.accountNativeReturn(state, code)
          else {
            const signedIn = await members.accountCallback(state, code, cookie(MEMBER_INTENT_COOKIE))
            setCookie(MEMBER_INTENT_COOKIE, "", 0)
            setCookie(MEMBER_COOKIE, members.sealSession(signedIn.session), members.sessionMaxAge(signedIn.session))
            destination = signedIn.returnTo
          }
					// End the issuer's consent form navigation at its allowlisted API
					// callback. A further HTTP redirect (app origin or native scheme) can
					// violate form-action. This document starts a new checked navigation.
					// Only native receives a one-use code/state; browser returns no code.
					const nonce = random()
					headers.set("content-type", "text/html; charset=utf-8")
					headers.set("referrer-policy", "no-referrer")
					headers.set("x-frame-options", "DENY")
					headers.set(
						"content-security-policy",
						`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`
					)
					const safe = destination.replace(
						/[&<>"']/g,
						(c) =>
							({
								"&": "&amp;",
								"<": "&lt;",
								">": "&gt;",
								'"': "&quot;",
								"'": "&#39;",
							}[c]!)
					)
					return new Response(
						`<!doctype html><meta name="viewport" content="width=device-width"><title>Return to YepWatch</title><p>GoodWatch connection ready. <a href="${safe}">Return to YepWatch</a></p><script nonce="${nonce}">location.replace(${JSON.stringify(
							destination
						).replace(/</g, "\\u003c")})</script>`,
						{ headers }
					)
				}
				throw new RoomError("not_found", "Endpoint unavailable", 404)
			}
			const card = request.method === "GET" || request.method === "HEAD" ? url.pathname.match(INVITE_CARD) : null
			if (card) {
				// Link-preview bots fetch this for yepwatch.com/r/<code>. An unknown or ended invite still gets the generic card.
				let hostName: string | null = null
				try {
					hostName = (await service.invitePreview(card[1]!)).hostName
				} catch (error) {
					if (!(error instanceof RoomError && (error.status === 404 || error.status === 410))) throw error
				}
				try {
					const png = await (options.inviteCard ?? inviteCardPng)(hostName)
					return new Response(png, {
						headers: { "content-type": "image/png", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" },
					})
				} catch (error) {
					if (error instanceof LinkCardBusyError) return new Response(null, { status: 503, headers: { "retry-after": "5", "cache-control": "no-store" } })
					throw error
				}
			}
			if (request.method === "GET" && url.pathname === paths.metadata) {
				const country = url.searchParams.get("country")
				if (country && !/^[A-Z]{2}$/.test(country))
					throw new RoomError("invalid_request", "Invalid country", 400)
				return reply(await service.catalog.metadata(country))
			}
			if (request.method === "POST" &&
				(url.pathname === paths.resolveInvite || url.pathname === paths.invitePreview)) {
				const value = parse(resolveSchema, await body(request))
				if (url.pathname === paths.invitePreview) return reply(await service.invitePreview(value.code))
				const resolved = await service.resolveInvite(value.code)
				// Whether this request carries a credential for the room: a browser without one skips the
				// membership read before joining (it could only answer 401).
				const credential = request.headers.has("authorization") || (request.headers.get("cookie") ?? "")
					.split(";")
					.some((c) => c.trim().startsWith(`yepwatch3_${resolved.roomId}=`))
				return reply({ ...resolved, credential })
			}
			const match = url.pathname.match(
				/^\/api\/yepwatch\/v1\/proposal\/rooms\/([A-Za-z0-9_-]{32})(?:\/(join|resume|archive|commands|preview|realtime-ticket|member(?:\/progress|\/link)?))?$/
			)
			if (
				request.method === "POST" &&
				(url.pathname === paths.rooms || match?.[2] === "join")
			) {
				const native = request.headers.get("x-yepwatch-client") === "native"
				if (!native) originCheck(true)
				const value = await body(request)
				const a = await account()
				let admission
				let setup
				if (url.pathname === paths.rooms) {
					const create = parse(createSchema, value)
					setup = create.setup
					admission = await service.create(create, a ?? undefined, a ? undefined : guestCreator())
				} else {
					const join = parse(joinSchema, value)
					const roomId = match![1]
					const hasCredential =
						request.headers.has("authorization") ||
						(request.headers.get("cookie") ?? "")
							.split(";")
							.some((c) => c.trim().startsWith(`yepwatch3_${roomId}=`))
          // A signed-in join can still carry this device's earlier guest credential.
          // Claim that place before allocating anything, including after a lost create acknowledgement.
          if (a && hasCredential) {
            const resolved = await service.resolveInvite(join.inviteCode)
            if (resolved.roomId !== roomId) throw new RoomError("not_found", "Invite unavailable", 404)
            const scoped = await scopedCredential(roomId)
            try {
              await service.read(roomId, scoped)
              return sendAdmission(await service.linkAccount(roomId, scoped, a), a)
            } catch (e) {
              if (!(e instanceof RoomError) || !["unauthorized", "forbidden", "not_found"].includes(e.code)) throw e
            }
          }
					// A reopened invite is a return to the existing participant.
					admission = a
						? await service.join(roomId, join, a)
						: hasCredential
						? await service.resumeOrJoin(roomId, credential(roomId), join)
						: await service.join(roomId, join)
				}
				return sendAdmission(admission, a, setup)
			}
			if (match) {
				const [, id, operation] = match
        if (request.method === 'POST' && operation === 'resume') {
          originCheck(!nativeRequest())
          const value = parse(z.object({ returnAfterLeave: z.boolean().optional() }).strict(), await body(request))
          const a = (await account(true))!
          return sendAdmission(await service.resumeAccount(id, a, value.returnAfterLeave === true), a)
        }
        if (request.method === 'POST' && operation === 'archive') {
          originCheck(!nativeRequest())
          const value = parse(z.object({ archived: z.boolean() }).strict(), await body(request))
          await service.archiveAccountRoom(id, (await account(true))!, value.archived)
          return reply({ ok: true })
        }
				// A command's deletion check runs alongside its room read (the command waits for it before any write or answer).
				let deletionCheck: Promise<void> | undefined
				const actor = await scopedCredential(id, request.method === "POST" && operation === "commands" ? (check) => { deletionCheck = check } : undefined)
				if (request.method === "POST" && operation === "preview")
					return reply(await service.preview(id, actor, parse(proposalPreviewSchema, await body(request))))
				if (request.method === "GET" && !operation) {
					let snapshot = await service.read(id, actor)
					if (options.members) {
						const member = await options.members.status(id, snapshot.own.participantId)
						// Status may repair a legacy Guest name; return its newly committed roster.
						if (member.state === "linked" && ["Guest", ""].includes(snapshot.shared.participants.find(
							(p) => p.participantId === snapshot.own.participantId,
						)?.nickname ?? "unknown")) snapshot = await service.read(id, actor)
						snapshot.own.member = member
					}
					return reply(snapshot)
				}
				if (request.method === "GET" && operation === "member/progress") {
					const own = await service.read(id, actor)
					if (!options.members)
						throw new RoomError(
							"not_implemented",
							"GoodWatch sign-in not configured",
							501
						)
					return reply(
						await options.members.ownProgress(id, own.own.participantId)
					)
				}
				if (request.method === "GET" && operation === "member") {
					const own = await service.read(id, actor)
					return reply(
						options.members
							? await options.members.status(id, own.own.participantId)
							: own.own.member
					)
				}
				if (request.method === "POST" && operation === "commands")
					return reply(
						await service.command(
							id,
							actor,
							parse(commandSchema, await body(request)),
							deletionCheck
						)
					)
				if (request.method === "POST" && operation === "member/link") {
					if (!options.members)
						throw new RoomError("not_implemented", "GoodWatch sign-in not configured", 501)
          const a = (await account(true))!
          return sendAdmission(await service.linkAccount(id, actor, a), a)
				}
				if (request.method === "POST" && operation === "realtime-ticket")
					return reply(await service.ticket(id, actor))
			}
			throw new RoomError("not_found", "Endpoint unavailable", 404)
		} catch (error) {
			const e =
				error instanceof RoomError
					? error
					: new RoomError("busy", "Service unavailable", 503, true)
			const retryAfter =
				"retryAfterSeconds" in e ? Number(e.retryAfterSeconds) : NaN
			if (Number.isInteger(retryAfter) && retryAfter > 0)
				headers.set("retry-after", String(retryAfter))
			return reply(
				{
					error: {
						code: e.code,
						message: e.message,
						retryable: e.retryable,
						...(e.details ? { details: e.details } : {}),
					},
				},
				e.status
			)
		}
	}
}
