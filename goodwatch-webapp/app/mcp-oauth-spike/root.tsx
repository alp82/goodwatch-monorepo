import { Outlet } from "@remix-run/react"

export default function Root() {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>GoodWatch MCP OAuth spike</title>
			</head>
			<body>
				<Outlet />
			</body>
		</html>
	)
}
