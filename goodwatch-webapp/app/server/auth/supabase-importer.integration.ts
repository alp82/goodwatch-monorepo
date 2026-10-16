import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import { type Account, type User, betterAuth } from "@goodwatch/auth-stack"
import { verifyPassword } from "@goodwatch/auth-stack/crypto"
import { compare } from "bcryptjs"
import { SignJWT, generateKeyPair, jwtVerify } from "jose"
import { Client } from "pg"
import {
	fakePassword,
	ids,
	seedFakeAuth,
} from "../../../scripts/auth-importer/fixtures.ts"
import {
	CrateAuthRequestError,
	crateAuthAdapter,
	crateAuthTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import {
	SupabaseImportError,
	importSupabaseAuth,
} from "./supabase-importer.server.ts"

const source = new Client({
	host: "127.0.0.1",
	port: 15651,
	database: "auth_copy",
	user: "importer",
	password: "local-fake-only",
})
const sql = crateAuthTransport(["http://127.0.0.1:15648"])
const encryptionSecret = "disposable-local-importer-encryption-key-551"
const adapter = crateAuthAdapter({ sql, encryptionSecret })({
	verification: { storeIdentifier: "hashed" },
	advanced: { database: { defaultFindManyLimit: 10000 } },
})
let hashes: Map<string, string>
before(async () => {
	await source.connect()
	assert.equal(
		(await sql("SELECT name FROM sys.cluster")).rows[0][0],
		"goodwatch-local-importer-551",
	)
	assert.equal(
		(
			await source.query(
				"SELECT kind FROM public.goodwatch_auth_import_copy WHERE id=551",
			)
		).rows[0].kind,
		"fake",
	)
	await migrateAuthTables(sql)
	await sql("CREATE USER importer_551 WITH (password='fake-target-551')")
	await sql("GRANT DQL,DML ON SCHEMA doc TO importer_551")
	await sql("GRANT DQL ON TABLE sys.cluster TO importer_551")
	await sql("GRANT DQL ON TABLE sys.nodes TO importer_551")
	await sql(
		"CREATE TABLE IF NOT EXISTS doc.importer_member_fixture (user_id TEXT PRIMARY KEY, wishlist_title TEXT) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)",
	)
})
after(async () => {
	await source.end()
})
beforeEach(async () => {
	hashes = await seedFakeAuth(source)
	for (const table of [
		"user",
		"account",
		"user_email",
		"session",
		"verification",
	]) {
		await sql(`REFRESH TABLE doc.auth_${table}`)
		await sql(`DELETE FROM doc.auth_${table}`)
		await sql(`REFRESH TABLE doc.auth_${table}`)
	}
	await sql("REFRESH TABLE doc.importer_member_fixture")
	await sql("DELETE FROM doc.importer_member_fixture")
	await sql(
		"INSERT INTO doc.importer_member_fixture (user_id,wishlist_title) VALUES (?,?)",
		[ids.password, "Fake existing Wishlist title"],
	)
})

test("imports fake members with their UUIDs, verification state, Google subject and exact bcrypt hashes", async () => {
	await source.query(
		"UPDATE auth.identities SET provider_id='legacy-provider-id-551' WHERE user_id=$1 AND provider='google'",
		[ids.google],
	)
	const report = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(report.source, {
		users: 6,
		identities: 7,
		credential: 5,
		google: 2,
		verified: 5,
		unverified: 1,
	})
	assert.deepEqual(report.before, {
		users: 0,
		accounts: 0,
		credential: 0,
		google: 0,
		emailClaims: 0,
	})
	assert.deepEqual(report.after, {
		users: 6,
		accounts: 7,
		credential: 5,
		google: 2,
		emailClaims: 6,
	})
	for (const id of Object.values(ids)) {
		const member = await adapter.findOne<User>({
			model: "user",
			where: [{ field: "id", value: id }],
		})
		assert.equal(member?.id, id)
		assert.equal(member?.emailVerified, id !== ids.unconfirmed)
	}
	for (const id of [ids.password, ids.unconfirmed, ids.both, ids.mixedCase]) {
		const credential = (
			await adapter.findMany<Account>({
				model: "account",
				where: [
					{ field: "providerId", value: "credential" },
					{ field: "accountId", value: id },
				],
				limit: 2,
			})
		)[0]
		assert.equal(credential.password, hashes.get(id))
	}
	const google = (
		await adapter.findMany<Account>({
			model: "account",
			where: [
				{ field: "providerId", value: "google" },
				{ field: "accountId", value: "105510000000000000003" },
			],
			limit: 2,
		})
	)[0]
	assert.equal(google.userId, ids.google)
	assert.equal(google.password, null)
	assert.equal(
		(
			await adapter.findOne<User>({
				model: "user",
				where: [{ field: "email", value: "mixed.case@example.test" }],
			})
		)?.id,
		ids.mixedCase,
	)
})

test("count audits honor authenticated tombstones when their plaintext deletion hints are changed", async () => {
	const removed = await adapter.create({
		model: "user",
		forceAllowId: true,
		data: {
			id: "55100000-0000-4000-8000-000000000099",
			email: "deleted@example.test",
			name: "Fake removed",
			emailVerified: true,
		},
	})
	await adapter.delete({
		model: "user",
		where: [{ field: "id", value: removed.id }],
	})
	const unlinked = await adapter.create({
		model: "account",
		data: {
			providerId: "google",
			accountId: "deleted-sub-551",
			userId: ids.password,
		},
	})
	await adapter.delete({
		model: "account",
		where: [{ field: "id", value: unlinked.id }],
	})
	await sql("UPDATE doc.auth_user SET deleted=false WHERE id=?", [removed.id])
	await sql("UPDATE doc.auth_account SET deleted=false WHERE id=?", [
		unlinked.id,
	])
	const report = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(report.before, {
		users: 0,
		accounts: 0,
		credential: 0,
		google: 0,
		emailClaims: 0,
	})
	assert.deepEqual(report.after, {
		users: 6,
		accounts: 7,
		credential: 5,
		google: 2,
		emailClaims: 6,
	})
})

test("a known non-applied user insert releases its claim through the adapter and reruns without duplicates", async () => {
	const refused = async (statement: string, args?: unknown[]) => {
		if (statement.startsWith("INSERT INTO doc.auth_user "))
			throw new CrateAuthRequestError(
				"Simulated deterministic refusal",
				4000,
				400,
				true,
			)
		return sql(statement, args)
	}
	await assert.rejects(
		importSupabaseAuth({ source, sql: refused, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.equal(error.report.after.users, 0)
			assert.equal(error.report.after.emailClaims, 0)
			return true
		},
	)
	const first = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.equal(first.status, "complete")
	assert.deepEqual(first.created, { users: 6, accounts: 7 })
	const second = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(second.created, { users: 0, accounts: 0 })
	assert.deepEqual(second.unchanged, { users: 6, accounts: 7 })
	assert.deepEqual(second.before, second.after)
})

test("an unknown user insert outcome leaves its claim intact and the next run rejects the orphan before writes", async () => {
	const interrupted = async (statement: string, args?: unknown[]) => {
		if (statement.startsWith("INSERT INTO doc.auth_user "))
			throw new Error("Simulated unknown outcome")
		return sql(statement, args)
	}
	await assert.rejects(
		importSupabaseAuth({
			source,
			sql: interrupted,
			encryptionSecret,
			apply: true,
		}),
	)
	await assert.rejects(
		importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.equal(error.report.status, "rejected")
			assert.ok(
				error.report.issues.some(
					(issue) => issue.code === "target_orphan_email_claim",
				),
			)
			assert.deepEqual(error.report.before, error.report.after)
			assert.equal(error.report.after.users, 0)
			assert.equal(error.report.after.emailClaims, 1)
			return true
		},
	)
})

test("case variants belonging to different UUIDs reject the entire import without linking an unverified email", async () => {
	await source.query(
		"UPDATE auth.users SET email='PASSWORD@EXAMPLE.TEST' WHERE id=$1",
		[ids.unconfirmed],
	)
	await assert.rejects(
		importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.equal(error.report.status, "rejected")
			assert.ok(
				error.report.issues.some((i) => i.code === "source_email_collision"),
			)
			assert.deepEqual(error.report.after, error.report.before)
			assert.equal(error.report.after.users, 0)
			assert.equal(error.report.after.emailClaims, 0)
			assert.ok(!JSON.stringify(error.report).includes("PASSWORD@"))
			return true
		},
	)
})

test("dry run creates no users, claims or accounts; a partially imported user resumes missing accounts", async () => {
	const dry = await importSupabaseAuth({ source, sql, encryptionSecret })
	assert.equal(dry.status, "planned")
	assert.deepEqual(dry.after, dry.before)
	assert.equal(dry.after.emailClaims, 0)
	await importSupabaseAuth({ source, sql, encryptionSecret, apply: true })
	const google = (
		await adapter.findMany<Account>({
			model: "account",
			where: [
				{ field: "providerId", value: "google" },
				{ field: "accountId", value: "105510000000000000003" },
			],
			limit: 2,
		})
	)[0]
	await adapter.delete({
		model: "account",
		where: [{ field: "id", value: google.id }],
	})
	const resumed = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(resumed.created, { users: 0, accounts: 1 })
	assert.deepEqual(resumed.unchanged, { users: 6, accounts: 6 })
	assert.equal(resumed.after.accounts, 7)
})

test("imported passwords and local Google ID tokens sign in to their original UUID, while unconfirmed passwords and implicit linking fail", async () => {
	await importSupabaseAuth({ source, sql, encryptionSecret, apply: true })
	const { privateKey, publicKey } = await generateKeyPair("RS256")
	const auth = betterAuth({
		baseURL: "http://127.0.0.1:15680",
		secret: "disposable-better-auth-test-secret-for-551",
		database: crateAuthAdapter({ sql, encryptionSecret }),
		verification: { storeIdentifier: "hashed" },
		advanced: { database: { defaultFindManyLimit: 10000 } },
		logger: { disabled: true },
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			password: {
				verify: async ({ hash, password }) =>
					/^\$2[aby]\$/.test(hash)
						? compare(password, hash)
						: verifyPassword({ hash, password }),
			},
		},
		account: {
			accountLinking: {
				enabled: true,
				requireLocalEmailVerified: true,
				disableImplicitLinking: true,
			},
		},
		socialProviders: {
			google: {
				clientId: "fake-client-551",
				clientSecret: "fake-secret",
				disableImplicitSignUp: true,
				verifyIdToken: async (token) => {
					try {
						await jwtVerify(token, publicKey, {
							issuer: "https://accounts.google.com",
							audience: "fake-client-551",
							algorithms: ["RS256"],
						})
						return true
					} catch {
						return false
					}
				},
			},
		},
	})
	for (const [email, id] of [
		["password@example.test", ids.password],
		["both@example.test", ids.both],
		["MIXED.CASE@EXAMPLE.TEST", ids.mixedCase],
	]) {
		const response = await auth.api.signInEmail({
			body: { email, password: fakePassword },
			asResponse: true,
		})
		assert.equal(response.status, 200)
		const signed = await response.json()
		assert.equal(signed.user.id, id)
		const cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ")
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		})
		assert.equal(session?.user.id, id)
		if (id === ids.password)
			assert.deepEqual(
				(
					await sql(
						"SELECT wishlist_title FROM doc.importer_member_fixture WHERE user_id=?",
						[session?.user.id],
					)
				).rows,
				[["Fake existing Wishlist title"]],
			)
	}
	await assert.rejects(
		auth.api.signInEmail({
			body: { email: "unconfirmed@example.test", password: fakePassword },
		}),
		/Email not verified/,
	)
	const token = async (sub: string, email: string) =>
		new SignJWT({ sub, email, email_verified: true, name: "Fake Google" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer("https://accounts.google.com")
			.setAudience("fake-client-551")
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(privateKey)
	for (const [sub, email, id] of [
		["105510000000000000003", "google@example.test", ids.google],
		["105510000000000000004", "both@example.test", ids.both],
	]) {
		const signed = await auth.api.signInSocial({
			body: { provider: "google", idToken: { token: await token(sub, email) } },
		})
		assert.ok("user" in signed)
		assert.equal(signed.user.id, id)
	}
	await assert.rejects(
		auth.api.signInSocial({
			body: {
				provider: "google",
				idToken: {
					token: await token("new-unverified-sub", "unconfirmed@example.test"),
				},
			},
		}),
	)
	assert.equal(
		(
			await adapter.findMany({
				model: "account",
				where: [
					{ field: "providerId", value: "google" },
					{ field: "accountId", value: "new-unverified-sub" },
				],
				limit: 2,
			})
		).length,
		0,
	)
})

for (const [name, mutation, code] of [
	[
		"missing Google subject",
		"UPDATE auth.identities SET identity_data=identity_data-'sub' WHERE provider='google'",
		"missing_google_sub",
	],
	[
		"duplicate Google subject",
		"UPDATE auth.identities SET identity_data=jsonb_set(identity_data,'{sub}','\"same-sub\"') WHERE provider='google'",
		"source_account_collision",
	],
	[
		"unknown provider",
		"UPDATE auth.identities SET provider='github' WHERE user_id='55100000-0000-4000-8000-000000000003'",
		"unsupported_provider",
	],
	[
		"non-bcrypt password",
		"UPDATE auth.users SET encrypted_password='unsupported' WHERE id='55100000-0000-4000-8000-000000000001'",
		"unsupported_password_hash",
	],
	[
		"deleted member",
		"UPDATE auth.users SET deleted_at=now() WHERE id='55100000-0000-4000-8000-000000000001'",
		"unsupported_user_lifecycle",
	],
	[
		"phone-only member",
		"UPDATE auth.users SET email=null,phone='+15555550551' WHERE id='55100000-0000-4000-8000-000000000001'",
		"missing_or_invalid_email",
	],
] as const)
	test(`${name} rejects before any target writes`, async () => {
		await source.query(mutation)
		await assert.rejects(
			importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
			(error: unknown) => {
				assert.ok(error instanceof SupabaseImportError)
				assert.ok(error.report.issues.some((issue) => issue.code === code))
				assert.deepEqual(error.report.before, error.report.after)
				assert.equal(error.report.after.emailClaims, 0)
				return true
			},
		)
	})

test("existing target email ownership, Google ownership and changed password hashes are never overwritten", async () => {
	await adapter.create({
		model: "user",
		data: {
			id: "55100000-0000-4000-8000-000000000099",
			name: "Existing",
			email: "PASSWORD@example.test",
			emailVerified: false,
		},
		forceAllowId: true,
	})
	await adapter.create({
		model: "account",
		data: {
			userId: ids.password,
			providerId: "google",
			accountId: "105510000000000000003",
		},
	})
	await assert.rejects(
		importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.ok(
				error.report.issues.some((i) => i.code === "target_email_collision"),
			)
			assert.ok(
				error.report.issues.some((i) => i.code === "target_row_mismatch"),
			)
			assert.deepEqual(error.report.before, error.report.after)
			return true
		},
	)
	// Start with the exact imported snapshot, then model a changed password after cutover.
	await sql("DELETE FROM doc.auth_user")
	await sql("DELETE FROM doc.auth_account")
	await sql("DELETE FROM doc.auth_user_email")
	await importSupabaseAuth({ source, sql, encryptionSecret, apply: true })
	const credential = (
		await adapter.findMany<Account>({
			model: "account",
			where: [
				{ field: "providerId", value: "credential" },
				{ field: "accountId", value: ids.password },
			],
			limit: 2,
		})
	)[0]
	await adapter.update({
		model: "account",
		where: [{ field: "id", value: credential.id }],
		update: { password: "changed-after-import" },
	})
	await assert.rejects(
		importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.ok(
				error.report.issues.some((i) => i.code === "target_row_mismatch"),
			)
			assert.deepEqual(error.report.created, { users: 0, accounts: 0 })
			return true
		},
	)
	assert.equal(
		(
			await adapter.findMany<Account>({
				model: "account",
				where: [{ field: "id", value: credential.id }],
				limit: 2,
			})
		)[0].password,
		"changed-after-import",
	)
	await assert.rejects(
		adapter.update({
			model: "account",
			where: [{ field: "id", value: credential.id }],
			update: { providerId: "google" },
		}),
		/immutable/,
	)
})

test("another importer on the same source copy rejects before target writes", async () => {
	const other = new Client({
		host: "127.0.0.1",
		port: 15651,
		database: "auth_copy",
		user: "importer",
		password: "local-fake-only",
	})
	await other.connect()
	try {
		await other.query("SELECT pg_advisory_lock(551,551)")
		await assert.rejects(
			importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
			(error: unknown) => {
				assert.ok(error instanceof SupabaseImportError)
				assert.ok(
					error.report.issues.some((i) => i.code === "source_copy_in_use"),
				)
				assert.deepEqual(error.report.before, error.report.after)
				return true
			},
		)
	} finally {
		await other.end()
	}
})

test("a failed account insert leaves a resumable partial import and a sanitized failure report", async () => {
	const interrupted = async (statement: string, args?: unknown[]) => {
		if (statement.startsWith("INSERT INTO doc.auth_account "))
			throw new Error("Simulated unavailable writer")
		return sql(statement, args)
	}
	await assert.rejects(
		importSupabaseAuth({
			source,
			sql: interrupted,
			encryptionSecret,
			apply: true,
		}),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.equal(error.report.status, "failed")
			assert.equal(error.report.after.users, 1)
			assert.equal(error.report.after.accounts, 0)
			assert.equal(error.report.after.emailClaims, 1)
			const hash = hashes.get(ids.password)
			assert.ok(hash)
			assert.ok(!JSON.stringify(error.report).includes(hash))
			return true
		},
	)
	const resumed = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(resumed.created, { users: 5, accounts: 7 })
	assert.deepEqual(resumed.unchanged, { users: 1, accounts: 0 })
})

test("a SELECT-only Postgres role imports successfully without source write privileges", async () => {
	await source.query(
		"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='source_reader') THEN CREATE ROLE source_reader LOGIN PASSWORD 'fake-read-only'; END IF; END $$; GRANT USAGE ON SCHEMA auth TO source_reader; GRANT SELECT ON ALL TABLES IN SCHEMA auth TO source_reader",
	)
	const readonly = new Client({
		host: "127.0.0.1",
		port: 15651,
		database: "auth_copy",
		user: "source_reader",
		password: "fake-read-only",
	})
	await readonly.connect()
	try {
		await assert.rejects(
			readonly.query("UPDATE auth.users SET email=email"),
			/permission denied/,
		)
		assert.equal(
			(
				await importSupabaseAuth({
					source: readonly,
					sql,
					encryptionSecret,
					apply: true,
				})
			).status,
			"complete",
		)
	} finally {
		await readonly.end()
	}
})

test("a password-authenticated CrateDB copy role imports users while wrong credentials fail", async () => {
	const authenticated = crateAuthTransport(["http://127.0.0.1:15648"], 15_000, {
		username: "importer_551",
		password: "fake-target-551",
	})
	const wrong = crateAuthTransport(["http://127.0.0.1:15648"], 15_000, {
		username: "importer_551",
		password: "wrong-fake-password",
	})
	await assert.rejects(wrong("SELECT current_user"))
	assert.equal(
		(await authenticated("SELECT current_user")).rows[0][0],
		"importer_551",
	)
	const report = await importSupabaseAuth({
		source,
		sql: authenticated,
		encryptionSecret,
		apply: true,
	})
	assert.equal(report.status, "complete")
	assert.equal(report.after.users, 6)
})

test("counts and reruns include more than 500 accounts without adapter enumeration truncation", async () => {
	await source.query(`INSERT INTO auth.users (id,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 SELECT ('55110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'bulk-'||n||'@example.test','',
 '2025-02-01T10:00:00Z'::timestamptz,'2025-02-01T10:00:00Z'::timestamptz,'2025-02-01T10:00:00Z'::timestamptz
 FROM generate_series(1,501) n;
 INSERT INTO auth.identities (id,provider_id,user_id,identity_data,provider,created_at,updated_at)
 SELECT gen_random_uuid(),id::text,id,jsonb_build_object('sub',id::text,'email',email),'email',created_at,updated_at
 FROM auth.users WHERE email LIKE 'bulk-%'`)
	const imported = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(imported.source, {
		users: 507,
		identities: 508,
		credential: 506,
		google: 2,
		verified: 506,
		unverified: 1,
	})
	assert.deepEqual(imported.after, {
		users: 507,
		accounts: 508,
		credential: 506,
		google: 2,
		emailClaims: 507,
	})
	const rerun = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: true,
	})
	assert.deepEqual(rerun.created, { users: 0, accounts: 0 })
	assert.deepEqual(rerun.before, rerun.after)
})

test("an imported user missing its email lookup claim rejects instead of reporting a usable account", async () => {
	await importSupabaseAuth({ source, sql, encryptionSecret, apply: true })
	await sql("DELETE FROM doc.auth_user_email WHERE user_id=?", [ids.password])
	await assert.rejects(
		importSupabaseAuth({ source, sql, encryptionSecret, apply: true }),
		(error: unknown) => {
			assert.ok(error instanceof SupabaseImportError)
			assert.ok(
				error.report.issues.some(
					(i) => i.code === "target_email_claim_missing",
				),
			)
			assert.deepEqual(error.report.created, { users: 0, accounts: 0 })
			return true
		},
	)
})

for (const changedSide of ["source", "target"] as const)
	test(`a rerun after the ${changedSide} email changes rejects before writes without stranding either address`, async () => {
		await importSupabaseAuth({ source, sql, encryptionSecret, apply: true })
		const auth = betterAuth({
			baseURL: "http://127.0.0.1:15680",
			secret: "disposable-better-auth-test-secret-for-551",
			database: crateAuthAdapter({ sql, encryptionSecret }),
			logger: { disabled: true },
		})
		const ctx = await auth.$context
		const originalEmail = "google@example.test"
		const changedEmail = "changed-google@example.test"
		if (changedSide === "source")
			await source.query(
				"UPDATE auth.users SET email=$1,updated_at='2026-10-14T12:00:00Z' WHERE id=$2",
				[changedEmail, ids.google],
			)
		else
			await ctx.internalAdapter.updateUser(ids.google, { email: changedEmail })
		let attemptedWrites = 0
		const preflightOnlySql: typeof sql = async (stmt, args) => {
			if (/^(INSERT|UPDATE|DELETE)\b/.test(stmt)) {
				attemptedWrites++
				throw new Error("Changed-email preflight must not write")
			}
			return sql(stmt, args)
		}
		await assert.rejects(
			importSupabaseAuth({
				source,
				sql: preflightOnlySql,
				encryptionSecret,
				apply: true,
			}),
			(error: unknown) => {
				assert.ok(error instanceof SupabaseImportError)
				assert.equal(error.report.status, "rejected")
				assert.ok(
					error.report.issues.some(
						(issue) =>
							issue.code === "target_row_mismatch" &&
							issue.userId === ids.google,
					),
				)
				assert.deepEqual(error.report.created, { users: 0, accounts: 0 })
				assert.deepEqual(error.report.after, error.report.before)
				return true
			},
		)
		assert.equal(attemptedWrites, 0)
		const activeEmail = changedSide === "source" ? originalEmail : changedEmail
		const unusedEmail = changedSide === "source" ? changedEmail : originalEmail
		assert.equal(
			(await ctx.internalAdapter.findUserByEmail(activeEmail.toUpperCase()))
				?.user.id,
			ids.google,
		)
		assert.equal(await ctx.internalAdapter.findUserByEmail(unusedEmail), null)
		const owner = await ctx.internalAdapter.findAccountOwnerByKey({
			providerId: "google",
			accountId: "105510000000000000003",
		})
		assert.ok(owner?.kind === "owned")
		assert.equal(owner.user.id, ids.google)
		const newMember = await ctx.internalAdapter.createUser(
			{ email: unusedEmail, name: "New address owner", emailVerified: true },
			{ method: "email-password" },
		)
		assert.notEqual(newMember.id, ids.google)
		assert.equal(
			(await ctx.internalAdapter.findUserByEmail(unusedEmail))?.user.id,
			newMember.id,
		)
	})

test("production source and target receipts reject drift before writes; versioned payloads import and rerun", async () => {
	const encryptionKeys = {
		active: "launch",
		keys: { launch: "fake-production-payload-key-at-least-32-characters" },
		allowLegacy: false,
	}
	const options = { source, sql, encryptionSecret, encryptionKeys }
	const dry = await importSupabaseAuth(options)
	let writes = 0
	const guardedSql: typeof sql = async (stmt, args) => {
		if (/^(INSERT|UPDATE|DELETE)\b/.test(stmt)) writes++
		return sql(stmt, args)
	}
	await source.query(
		'UPDATE auth.users SET raw_user_meta_data = \'{"name":"changed"}\' WHERE id=$1',
		[ids.password],
	)
	await assert.rejects(
		importSupabaseAuth({
			...options,
			sql: guardedSql,
			apply: true,
			expectedSourceFingerprint: dry.sourceFingerprint,
			expectedTargetCounts: dry.after,
		}),
		(error: unknown) =>
			error instanceof SupabaseImportError &&
			error.report.issues.some(
				(i) => i.code === "source_changed_since_receipt",
			),
	)
	assert.equal(writes, 0)
	const fresh = await importSupabaseAuth(options)
	await assert.rejects(
		importSupabaseAuth({
			...options,
			sql: guardedSql,
			apply: true,
			expectedTargetCounts: { ...fresh.after, users: 1 },
		}),
		(error: unknown) =>
			error instanceof SupabaseImportError &&
			error.report.issues.some(
				(i) => i.code === "target_changed_since_receipt",
			),
	)
	await assert.rejects(
		importSupabaseAuth({
			...options,
			sql: guardedSql,
			apply: true,
			requireExactRerun: true,
		}),
		(error: unknown) =>
			error instanceof SupabaseImportError &&
			error.report.issues.some((i) => i.code === "rerun_would_create_rows"),
	)
	assert.equal(writes, 0)
	const imported = await importSupabaseAuth({
		...options,
		apply: true,
		expectedSourceFingerprint: fresh.sourceFingerprint,
		expectedTargetCounts: fresh.after,
	})
	assert.equal(imported.created.users, 6)
	const payloads = (await sql("SELECT payload FROM doc.auth_user")).rows
	assert.ok(
		payloads.every(([payload]) => String(payload).startsWith("v3.launch.")),
	)
	const rerun = await importSupabaseAuth({
		...options,
		apply: true,
		expectedSourceFingerprint: imported.sourceFingerprint,
		expectedTargetCounts: imported.after,
		requireExactRerun: true,
	})
	assert.deepEqual(rerun.created, { users: 0, accounts: 0 })
	assert.deepEqual(rerun.before, rerun.after)
})

test("production preflight uses a real SELECT-only frozen source and receipts drive a real import", async () => {
	const { productionBinding, productionImport } = await import(
		"../../../scripts/auth-importer/production.ts"
	)
	const { mkdtemp, rm } = await import("node:fs/promises")
	const { tmpdir } = await import("node:os")
	const { join } = await import("node:path")
	const dir = await mkdtemp(join(tmpdir(), "gw-production-fixture-"))
	await source.query(`ALTER TABLE public.goodwatch_auth_import_copy ADD COLUMN IF NOT EXISTS snapshot_id text;
  ALTER TABLE public.goodwatch_auth_import_copy ADD COLUMN IF NOT EXISTS frozen_at timestamptz;
  UPDATE public.goodwatch_auth_import_copy SET kind='frozen-production-552',snapshot_id='fake-snapshot-552',frozen_at=now() WHERE id=551;
  CREATE ROLE auth_copy_reader LOGIN PASSWORD 'fake-source-only';
  GRANT USAGE ON SCHEMA auth,public TO auth_copy_reader;
  GRANT SELECT ON auth.users,auth.identities,public.goodwatch_auth_import_copy TO auth_copy_reader;`)
	const reader = new Client({
		host: "127.0.0.1",
		port: 15651,
		database: "auth_copy",
		user: "auth_copy_reader",
		password: "fake-source-only",
	})
	await reader.connect()
	// Only metadata identity is simulated; source privileges and every adapter
	// read/write use the disposable real databases. This is never a live profile test.
	const identitySql: typeof sql = async (stmt, args) =>
		stmt === "SELECT current_user"
			? { rows: [["goodwatch_auth"]], rowcount: 1, cols: ["current_user"] }
			: sql(stmt, args)
	const encryptionKeys = {
		active: "launch",
		keys: { launch: "fake-launch-payload-key-at-least-32-characters" },
		allowLegacy: false,
	}
	try {
		await assert.rejects(productionBinding(source, identitySql, encryptionKeys))
		await assert.rejects(productionBinding(reader, sql, encryptionKeys))
		for (const changed of [
			"frozen_at=now()-interval '25 hours'",
			"frozen_at=now()+interval '1 hour'",
			"snapshot_id=''",
			"kind='restored-copy'",
		]) {
			await source.query(
				`UPDATE public.goodwatch_auth_import_copy SET ${changed} WHERE id=551`,
			)
			await assert.rejects(
				productionBinding(reader, identitySql, encryptionKeys),
			)
			await source.query(
				"UPDATE public.goodwatch_auth_import_copy SET kind='frozen-production-552',snapshot_id='fake-snapshot-552',frozen_at=now() WHERE id=551",
			)
		}
		await source.query("GRANT UPDATE ON auth.users TO auth_copy_reader")
		await assert.rejects(productionBinding(reader, identitySql, encryptionKeys))
		await source.query("REVOKE UPDATE ON auth.users FROM auth_copy_reader")
		const binding = await productionBinding(reader, identitySql, encryptionKeys)
		for (const phase of ["dry", "apply", "rerun"] as const) {
			const report = await productionImport({
				phase,
				receiptPath: join(dir, "receipt.json"),
				secret: encryptionSecret,
				binding,
				run: (guards) =>
					importSupabaseAuth({
						source: reader,
						sql,
						encryptionSecret,
						encryptionKeys,
						apply: phase !== "dry",
						...guards,
					}),
			})
			assert.equal(report.status, phase === "dry" ? "planned" : "complete")
			assert.deepEqual(report.created, {
				users: phase === "apply" ? 6 : 0,
				accounts: phase === "apply" ? 7 : 0,
			})
		}
	} finally {
		await reader.end()
		await source.query(
			"UPDATE public.goodwatch_auth_import_copy SET kind='fake' WHERE id=551",
		)
		await rm(dir, { recursive: true, force: true })
	}
})
