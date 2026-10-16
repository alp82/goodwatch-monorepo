// Harness document: no normal webapp root or production startup tasks. It renders the account pages an app's
// connection goes through (sign-in, consent, #570) without the site's styles.
import { Links, Meta, Outlet, Scripts } from "@remix-run/react"

export default function Root() {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<Outlet />
				<Scripts />
			</body>
		</html>
	)
}
