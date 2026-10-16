import { captureMessage } from "@sentry/remix"
import nodemailer from "nodemailer"
import type { SendMailOptions } from "nodemailer"
import { counter } from "../metrics/registry.server.ts"

const deliveries = counter(
	"goodwatch_auth_mail_total",
	"Auth mail delivery outcomes.",
	["outcome"],
	4,
)
export function smtpTransport(options: {
	host?: string
	port?: number
	user?: string
	password?: string
	localCatcher?: boolean
}) {
	const host = options.host ?? "smtp.purelymail.com"
	const port = options.port ?? 465
	if (
		options.localCatcher &&
		(host !== "127.0.0.1" || ![15525, 15625, 15925, 16225].includes(port))
	)
		throw new Error("Local SMTP catcher required")
	if (
		!options.localCatcher &&
		(host !== "smtp.purelymail.com" ||
			![465, 587].includes(port) ||
			!options.user ||
			!options.password)
	)
		throw new Error("Purelymail credentials and TLS SMTP port required")
	return nodemailer.createTransport({
		host,
		port,
		secure: port === 465,
		requireTLS: !options.localCatcher && port === 587,
		auth: options.user
			? { user: options.user, pass: options.password }
			: undefined,
		connectionTimeout: 5000,
		greetingTimeout: 5000,
		socketTimeout: 10000,
	})
}
export interface AuthMailTransport {
	sendMail(message: SendMailOptions): Promise<unknown>
}
export class AuthMailQueue {
	private readonly transport: AuthMailTransport
	private readonly retryDelayMs: number
	private readonly reportFailure: () => void
	private readonly jobs: {
		to: string
		subject: string
		text: string
		html?: string
	}[] = []
	private worker: Promise<void> | null = null
	constructor(
		transport: AuthMailTransport,
		options: { retryDelayMs?: number; reportFailure?: () => void } = {},
	) {
		this.transport = transport
		this.retryDelayMs = options.retryDelayMs ?? 1000
		this.reportFailure =
			options.reportFailure ??
			(() => {
				captureMessage("Auth SMTP delivery exhausted retries", "error")
			})
	}
	enqueue(to: string, subject: string, text: string, html?: string) {
		if (this.jobs.length >= 1000) {
			deliveries.inc(["failed"])
			this.reportFailure()
			throw new Error("Auth mail queue full")
		}
		this.jobs.push({ to, subject, text, html })
		this.worker ??= Promise.resolve().then(() => this.run())
	}
	private async run() {
		try {
			while (this.jobs.length) {
				const job = this.jobs.shift()!
				for (let attempt = 0; attempt < 3; attempt++) {
					try {
						await this.transport.sendMail({
							from: "GoodWatch <hello@goodwatch.app>",
							...job,
						})
						deliveries.inc(["sent"])
						break
					} catch {
						if (attempt === 2) {
							deliveries.inc(["failed"])
							this.reportFailure()
						} else {
							deliveries.inc(["retry"])
							await new Promise((resolve) =>
								setTimeout(resolve, this.retryDelayMs * 2 ** attempt),
							)
						}
					}
				}
			}
		} finally {
			this.worker = null
		}
	}
	async drain() {
		while (this.worker) await this.worker
	}
}
