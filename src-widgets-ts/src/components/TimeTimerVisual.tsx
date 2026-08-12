import React from "react";

export interface TimeTimerVisualProps {
	durationSeconds: number;
	remainingSeconds: number;
	size?: number;
	showDigital?: boolean;
	colorRemaining?: string;
	colorElapsed?: string;
}

function formatDigital(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	}
	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
	const angleRad = ((angleDeg - 90) * Math.PI) / 180;
	return {
		x: cx + radius * Math.cos(angleRad),
		y: cy + radius * Math.sin(angleRad),
	};
}

function describeWedge(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
	if (endAngle - startAngle >= 359.99) {
		return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
	}
	const start = polarToCartesian(cx, cy, radius, endAngle);
	const end = polarToCartesian(cx, cy, radius, startAngle);
	const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
	return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function TimeTimerVisual({
	durationSeconds,
	remainingSeconds,
	size = 280,
	showDigital = true,
	colorRemaining = "#E53935",
	colorElapsed = "#FFFFFF",
}: TimeTimerVisualProps): React.JSX.Element {
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const elapsed = safeDuration - safeRemaining;
	const hourCount = Math.min(24, Math.max(1, Math.ceil(safeDuration / 3600)));
	const circleRadius = size * 0.38;
	const center = size / 2;

	const hourBars = Array.from({ length: hourCount }, (_, index) => {
		const segmentStart = index * 3600;
		const segmentEnd = Math.min((index + 1) * 3600, safeDuration);
		const segmentDuration = segmentEnd - segmentStart;
		const segmentElapsed = Math.max(0, Math.min(segmentDuration, elapsed - segmentStart));
		const remainingFraction = segmentDuration > 0 ? 1 - segmentElapsed / segmentDuration : 0;
		return {
			key: `hour-${index}`,
			remainingFraction,
		};
	});

	const remainingFraction = safeRemaining / safeDuration;
	const wedgeEnd = -90 + remainingFraction * 360;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 12,
				padding: 8,
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					display: "flex",
					gap: 4,
					width: "100%",
					maxWidth: size,
					height: 18,
					alignItems: "flex-end",
				}}
			>
				{hourBars.map((bar) => (
					<div
						key={bar.key}
						style={{
							flex: 1,
							height: "100%",
							background: colorElapsed,
							border: "1px solid #BDBDBD",
							borderRadius: 2,
							overflow: "hidden",
							position: "relative",
						}}
					>
						<div
							style={{
								position: "absolute",
								left: 0,
								right: 0,
								bottom: 0,
								height: `${Math.max(0, Math.min(100, bar.remainingFraction * 100))}%`,
								background: colorRemaining,
								transition: "height 0.4s linear",
							}}
						/>
					</div>
				))}
			</div>

			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Time Timer">
				<circle cx={center} cy={center} r={circleRadius} fill={colorElapsed} stroke="#424242" strokeWidth={3} />
				{remainingFraction > 0 && (
					<path d={describeWedge(center, center, circleRadius, -90, wedgeEnd)} fill={colorRemaining} />
				)}
				<circle cx={center} cy={center} r={circleRadius * 0.08} fill="#424242" />
			</svg>

			{showDigital && (
				<div
					style={{
						fontSize: Math.max(28, size * 0.14),
						fontWeight: 700,
						fontFamily: "Consolas, 'Courier New', monospace",
						letterSpacing: 2,
						color: "#212121",
					}}
				>
					{formatDigital(safeRemaining)}
				</div>
			)}
		</div>
	);
}
