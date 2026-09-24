export function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

export function titleToDashed(title: string) {
	return title
		.toLowerCase()
		.replace(/[^\w- ]+/g, "")
		.replace(/ +/g, "-");
}

// Canonical cast and crew page path. Names without Latin letters get no slug.
export function personPath(id: number, name: string) {
	const slug = titleToDashed(name).replace(/^-+|-+$/g, "");
	return slug ? `/person/${id}-${slug}` : `/person/${id}`;
}
