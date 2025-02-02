import React from "react"

export default function RemoteControl() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 300 800"
			title="Remote Control"
		>
			{/* Definitions for gradients and effects */}
			<defs>
				<linearGradient id="remote-body" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#2c2c2c", stopOpacity: 1 }} />
					<stop
						offset="100%"
						style={{ stopColor: "#1c1c1c", stopOpacity: 1 }}
					/>
				</linearGradient>

				<linearGradient id="button-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#555", stopOpacity: 1 }} />
					<stop offset="100%" style={{ stopColor: "#333", stopOpacity: 1 }} />
				</linearGradient>

				<linearGradient
					id="button-grad-active"
					x1="0%"
					y1="0%"
					x2="0%"
					y2="100%"
				>
					<stop offset="0%" style={{ stopColor: "#55a", stopOpacity: 1 }} />
					<stop offset="100%" style={{ stopColor: "#338", stopOpacity: 1 }} />
				</linearGradient>

				<linearGradient id="screen-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#000", stopOpacity: 1 }} />
					<stop offset="100%" style={{ stopColor: "#111", stopOpacity: 1 }} />
				</linearGradient>

				<linearGradient id="netflix-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#E50914", stopOpacity: 1 }} />
					<stop
						offset="100%"
						style={{ stopColor: "#B00710", stopOpacity: 1 }}
					/>
				</linearGradient>

				<linearGradient id="prime-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#00A8E1", stopOpacity: 1 }} />
					<stop
						offset="100%"
						style={{ stopColor: "#0077BE", stopOpacity: 1 }}
					/>
				</linearGradient>

				<linearGradient id="disney-grad" x1="0%" y1="0%" x2="0%" y2="100%">
					<stop offset="0%" style={{ stopColor: "#113CCF", stopOpacity: 1 }} />
					<stop
						offset="100%"
						style={{ stopColor: "#0A2B9E", stopOpacity: 1 }}
					/>
				</linearGradient>

				<radialGradient id="power-glow">
					<stop offset="0%" style={{ stopColor: "#ff3b30", stopOpacity: 1 }} />
					<stop
						offset="100%"
						style={{ stopColor: "#b01712", stopOpacity: 1 }}
					/>
				</radialGradient>
			</defs>

			{/* Remote body */}
			<rect
				x="20"
				y="20"
				width="260"
				height="760"
				rx="40"
				ry="40"
				fill="url(#remote-body)"
				stroke="#222"
				strokeWidth="3"
			/>

			{/* Power button */}
			<circle
				cx="150"
				cy="60"
				r="15"
				fill="url(#power-glow)"
				stroke="white"
				strokeWidth="2"
			/>
			<path
				d="M150 45 v12 M142 52 a12 12 0 0 1 16 0"
				stroke="white"
				strokeWidth="2"
				strokeLinecap="round"
				fill="none"
			/>

			{/* Category buttons */}
			<g transform="translate(0,90)">
				{["Genre", "Release", "Mood", "Theme"].map((label, index) => (
					<g key={label}>
						<rect
							x={index % 2 === 0 ? 45 : 155}
							y={Math.floor(index / 2) * 50}
							width="100"
							height="40"
							rx="20"
							ry="20"
							fill={`url(#button-grad${index === 3 ? "-active" : ""})`}
							stroke="#222"
						/>
						<text
							x={index % 2 === 0 ? 95 : 205}
							y={Math.floor(index / 2) * 50 + 25}
							fontFamily="Arial"
							fontSize="14"
							fill="white"
							textAnchor="middle"
						>
							{label}
						</text>
					</g>
				))}
			</g>

			{/* OLED Screen */}
			<rect
				x="40"
				y="190"
				width="220"
				height="120"
				rx="15"
				ry="15"
				fill="url(#screen-grad)"
				stroke="#444"
				strokeWidth="2"
			/>
			<text
				x="150"
				y="240"
				fontFamily="Arial"
				fontSize="26"
				fill="white"
				textAnchor="middle"
			>
				Dystopian
			</text>
			<text
				x="150"
				y="270"
				fontFamily="Arial"
				fontSize="14"
				fill="#888"
				textAnchor="middle"
			>
				Movies and Shows
			</text>

			{/* Navigation Pad */}
			<g transform="translate(0,420)">
				<circle
					cx="150"
					cy="0"
					r="80"
					fill="#222"
					stroke="#444"
					strokeWidth="2"
				/>
				<circle cx="150" cy="0" r="25" fill="#333" stroke="#666" />
				<text
					x="150"
					y="5"
					fontFamily="Arial"
					fontSize="14"
					fill="white"
					textAnchor="middle"
				>
					OK
				</text>
			</g>

			{/* Streaming Buttons */}
			<g transform="translate(0,660)">
				{[
					{ id: "netflix-grad", label: "NETFLIX", x: 40 },
					{ id: "prime-grad", label: "PRIME", x: 115 },
					{ id: "disney-grad", label: "DISNEY+", x: 190 },
				].map(({ id, label, x }) => (
					<g key={label}>
						<rect
							x={x}
							y="0"
							width="70"
							height="45"
							rx="10"
							ry="10"
							fill={`url(#${id})`}
							stroke="#500"
						/>
						<text
							x={x + 35}
							y="28"
							fontFamily="Arial"
							fontSize="14"
							fill="white"
							textAnchor="middle"
						>
							{label}
						</text>
					</g>
				))}
			</g>
		</svg>
	)
}
