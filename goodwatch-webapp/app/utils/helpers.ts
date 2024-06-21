export function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

export function titleToDashed(title: string) {
	return title
		.toLowerCase()
		.replace(/[^\w- ]+/g, "")
		.replace(/ +/g, "-");
}
