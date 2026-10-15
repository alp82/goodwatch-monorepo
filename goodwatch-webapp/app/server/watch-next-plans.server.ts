import { randomUUID } from "node:crypto"

/** Process-local plans: a restart, another instance, expiration or eviction asks the browser for a new list. */
export function createWatchNextPlanStore<T>({
	now = Date.now,
	ttl = 10 * 60_000,
	maxEntries = 300,
	maxTitles = 100_000,
} = {}) {
	const plans = new Map<
		string,
		{ member: string; choice: string; value: T; size: number; expires: number }
	>()
	let size = 0
	const remove = (id: string) => {
		size -= plans.get(id)!.size
		plans.delete(id)
	}
	return {
		put(member: string, choice: string, value: T, titles: number) {
			if (titles > maxTitles) return null
			for (const [id, plan] of plans) if (plan.expires <= now()) remove(id)
			while (plans.size >= maxEntries || size + titles > maxTitles)
				remove(plans.keys().next().value!)
			const id = randomUUID()
			plans.set(id, {
				member,
				choice,
				value,
				size: titles,
				expires: now() + ttl,
			})
			size += titles
			return id
		},
		get(id: string, member: string, choice: string) {
			const plan = plans.get(id)
			if (!plan) return null
			if (plan.expires <= now()) {
				remove(id)
				return null
			}
			return plan.member === member && plan.choice === choice
				? plan.value
				: null
		},
	}
}
