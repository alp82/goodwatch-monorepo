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
export const proposalAdmissionSchema = z
	.object({
		contractVersion: z.literal(3),
		commandId: id,
		admissionSecret: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
		nickname: z.string().trim().min(1).max(40),
	})
	.strict()
export const proposalJoinSchema = proposalAdmissionSchema.extend({
	inviteCode: z.string().max(200),
	screenId: id.optional(),
})
export const proposalCommandSchema = z
	.object({
		commandId: id,
		sequence: n.min(1),
		command: z.discriminatedUnion("type", [
			z.object({ type: z.literal("leave") }).strict(),
			z
				.object({
					type: z.literal("configure"),
					expectedContextVersion: n,
					country: z.string().regex(/^[A-Z]{2}$/),
					serviceIds: z.array(z.number().int().positive()).min(1).max(100),
					constraints,
					prompt: z.string().trim().max(1000),
				})
				.strict(),
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
					activeExposureMs: z
						.number()
						.int()
						.min(0)
						.max(1200000)
						.nullable()
						.optional(),
					value: z.enum(["watch", "pass"]).nullable(),
				})
				.strict(),
			z
				.object({
					type: z.literal("propose"),
					generation: n,
					expectedRosterVersion: n,
					expectedProposalVersion: n,
					candidateId: id,
				})
				.strict(),
			z
				.object({
					type: z.literal("agree"),
					generation: n,
					expectedRosterVersion: n,
					expectedProposalVersion: n,
					candidateId: id,
					expectedOwnAgreementRevision: n,
					agreed: z.boolean(),
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
					expectedProposalVersion: n,
				})
				.strict(),
			z.object({ type: z.literal("restart"), expectedRevision: n }).strict(),
			z.object({ type: z.literal("resume_voting"), expectedRevision: n }).strict(),
		]),
	})
	.strict()

export const proposalPreviewSchema = z.object({
	prompt: z.string().trim().min(2).max(1000),
	country: z.string().regex(/^[A-Z]{2}$/),
	serviceIds: z.array(z.number().int().positive()).max(100),
}).strict()
