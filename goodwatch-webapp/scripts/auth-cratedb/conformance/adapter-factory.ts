import type { BetterAuthOptions } from "better-auth"
import type { DBAdapter } from "@better-auth/core/db/adapter"
import { crateAuthAdapter } from "../../../app/server/auth/crate-adapter.server.ts"

// The isolated harness and webapp each install core 1.7.7. OAuth's type registry
// augments only the harness copy, making its generic plugin registry invariant.
// Bridge that package boundary without changing any runtime options or calls.
export const isolatedCrateAuthAdapter = crateAuthAdapter as unknown as (
	input: Parameters<typeof crateAuthAdapter>[0],
) => (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>
