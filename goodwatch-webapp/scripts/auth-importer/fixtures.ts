import { hashSync } from "bcryptjs"
import type { Client } from "pg"

export const fakePassword = "Fake-password-551!"
export const ids = {
	password: "55100000-0000-4000-8000-000000000001",
	unconfirmed: "55100000-0000-4000-8000-000000000002",
	google: "55100000-0000-4000-8000-000000000003",
	both: "55100000-0000-4000-8000-000000000004",
	mixedCase: "55100000-0000-4000-8000-000000000005",
	magic: "55100000-0000-4000-8000-000000000006",
}

// Relevant real auth columns, including nullable/defaulted lifecycle fields.
// Fake values only; this helper is imported solely by the disposable test suite.
export async function seedFakeAuth(source: Client) {
	await source.query(`DROP SCHEMA IF EXISTS auth CASCADE;
 CREATE SCHEMA auth;
 CREATE TABLE auth.users (
  id uuid PRIMARY KEY, instance_id uuid, aud varchar(255), role varchar(255),
  email varchar(255), encrypted_password varchar(255), email_confirmed_at timestamptz,
  phone varchar(255), phone_confirmed_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  deleted_at timestamptz, banned_until timestamptz, is_anonymous boolean DEFAULT false,
  is_sso_user boolean DEFAULT false, is_super_admin boolean DEFAULT false
 );
 CREATE TABLE auth.identities (
  id uuid PRIMARY KEY, provider_id text NOT NULL, user_id uuid REFERENCES auth.users(id),
  identity_data jsonb, provider varchar(255) NOT NULL, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  UNIQUE(provider_id,provider)
 )`)
	const hashes = new Map<string, string>()
	for (const [kind, id] of Object.entries(ids)) {
		const password = ["password", "unconfirmed", "both", "mixedCase"].includes(
			kind,
		)
			? hashSync(fakePassword, 6).replace(
					/^\$2b\$/,
					kind === "both" ? "$2a$" : kind === "mixedCase" ? "$2y$" : "$2b$",
				)
			: ""
		hashes.set(id, password)
		const email =
			kind === "mixedCase" ? "Mixed.Case@Example.TEST" : `${kind}@example.test`
		await source.query(
			`INSERT INTO auth.users
   (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
   VALUES ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,$3,$4,$5,$6,'2025-02-01T10:00:00Z','2026-10-01T12:30:00Z')`,
			[
				id,
				email,
				password,
				kind === "unconfirmed" ? null : "2025-02-01T10:01:00Z",
				{
					providers:
						kind === "both"
							? ["email", "google"]
							: [kind === "google" ? "google" : "email"],
				},
				{
					full_name: `Fake ${kind}`,
					avatar_url: "https://example.test/fake.png",
					email_verified: true,
				},
			],
		)
		const providers =
			kind === "both"
				? ["email", "google"]
				: [kind === "google" ? "google" : "email"]
		for (const provider of providers) {
			const sub =
				provider === "email"
					? id
					: kind === "both"
						? "105510000000000000004"
						: "105510000000000000003"
			await source.query(
				`INSERT INTO auth.identities
    (id,provider_id,user_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
    VALUES (gen_random_uuid(),$1,$2,$3,$4,'2025-02-01T10:00:00Z','2026-10-01T12:30:00Z','2026-10-01T12:30:00Z')`,
				[
					sub,
					id,
					{ sub, email, email_verified: kind !== "unconfirmed" },
					provider,
				],
			)
		}
	}
	return hashes
}
