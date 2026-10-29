/** A free-age edit commits after it rests; other choices can discard it. */
export function createAgeCommit() {
	let timer: ReturnType<typeof setTimeout> | undefined
	const cancel = () => {
		clearTimeout(timer)
		timer = undefined
	}
	return {
		cancel,
		schedule(age: number, commit: (age: number) => void) {
			cancel()
			timer = setTimeout(() => {
				timer = undefined
				commit(age)
			}, 300)
		},
	}
}
