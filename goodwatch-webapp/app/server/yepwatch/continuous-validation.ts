import { z } from "zod"
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const n = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const screen = z
	.object({
		id,
		label: z.string().trim().min(1).max(40),
		country: z
			.string()
			.regex(/^[A-Z]{2}$/)
			.nullable(),
		serviceIds: z.array(z.number().int().positive()).max(2000),
		confirmed: z.boolean(),
	})
	.strict()
const constraints = z
	.object({
		kinds: z
			.array(z.enum(["movie", "show_start", "show_continue"]))
			.min(1)
			.max(3),
		maxMinutes: z.number().int().positive().max(1440).nullable(),
		moods: z.array(z.string().max(80)).max(20),
	})
	.strict()
export const continuousAdmissionSchema = z
	.object({
		contractVersion: z.literal(2),
		commandId: id,
		admissionSecret: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
		nickname: z.string().trim().min(1).max(40),
	})
	.strict()
export const continuousJoinSchema = continuousAdmissionSchema.extend({
	inviteCode: z.string().max(200),
	screenId: id.optional(),
})
export const continuousCommandSchema = z
	.object({
		commandId: id,
		sequence: n.min(1),
		command: z.discriminatedUnion("type", [
			z
				.object({
					type: z.literal("setup"),
					expectedContextVersion: n,
					screens: z.array(screen).min(1).max(12),
					constraints,
					screenId: id.nullable(),
				})
				.strict(),
			z
				.object({
					type: z.literal("assign_screen"),
					expectedContextVersion: n,
					screenId: id,
				})
				.strict(),
			z
				.object({
					type: z.literal("ready"),
					expectedContextVersion: n,
					ready: z.boolean(),
				})
				.strict(),
			z
				.object({
					type: z.literal("start"),
					expectedRosterVersion: n,
					expectedContextVersion: n,
					hostReady: z.boolean().optional(),
				})
				.strict(),
			z
				.object({
					type: z.literal("vote"),
					generation: n,
					candidateId: id,
					expectedVoteRevision: n,
					value: z.enum(["watch", "pass"]).nullable(),
				})
				.strict(),
			z
				.object({
					type: z.literal("pick"),
					generation: n,
					expectedRosterVersion: n,
					candidateId: id.nullable(),
					expectedPickRevision: n,
				})
				.strict(),
			z
				.object({
					type: z.literal("refill"),
					generation: n,
					expectedStreamVersion: n,
				})
				.strict(),
			z
				.object({
					type: z.literal("retry_agreement"),
					generation: n,
					expectedAgreementVersion: n,
				})
				.strict(),
			z.object({ type: z.literal("restart"), expectedRevision: n }).strict(),
		]),
	})
	.strict()
