import React from "react";

export interface TimeTimerVisualProps {
	durationSeconds: number;
	remainingSeconds: number;
	size?: number;
	showDigital?: boolean;
	colorRemaining?: string;
	colorElapsed?: string;
	colorDigital?: string;
}

const SECONDS_PER_HOUR = 3600;

function formatDigital(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const hours = Math.floor(total / SECONDS_PER_HOUR);
	const minutes = Math.floor((total % SECONDS_PER_HOUR) / 60);
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

/**
 * Circle always represents one hour.
 * Uses the current hour fragment (modulo 3600): 30 min → half red, 90 min → half red (+ hour bars).
 * Exact hour boundaries (60/120/…) stay fully red.
 */
export function getCircleRemainingFraction(remainingSeconds: number): number {
	const safeRemaining = Math.max(0, remainingSeconds);
	if (safeRemaining <= 0) {
		return 0;
	}
	const mod = safeRemaining % SECONDS_PER_HOUR;
	if (mod === 0) {
		return 1;
	}
	return Math.min(1, mod / SECONDS_PER_HOUR);
}

export default function TimeTimerVisual({
	durationSeconds,
	remainingSeconds,
	size = 280,
	showDigital = true,
	colorRemaining = "#E53935",
	colorElapsed = "#FFFFFF",
	colorDigital = "#000000",
}: TimeTimerVisualProps): React.JSX.Element {
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const elapsed = safeDuration - safeRemaining;
	const hourCount = Math.min(24, Math.max(1, Math.ceil(safeDuration / SECONDS_PER_HOUR)));
	const circleRadius = size * 0.38;
	const center = size / 2;

	const hourBars = Array.from({ length: hourCount }, (_, index) => {
		const segmentStart = index * SECONDS_PER_HOUR;
		const segmentEnd = Math.min((index + 1) * SECONDS_PER_HOUR, safeDuration);
		const segmentDuration = segmentEnd - segmentStart;
		const segmentElapsed = Math.max(0, Math.min(segmentDuration, elapsed - segmentStart));
		const remainingFraction = segmentDuration > 0 ? 1 - segmentElapsed / segmentDuration : 0;
		return {
			key: `hour-${index}`,
			remainingFraction,
		};
	});

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
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
				{/* Elapsed / empty part is always white (or configured) under the red remaining wedge */}
				<circle cx={center} cy={center} r={circleRadius} fill={colorElapsed} stroke="#424242" strokeWidth={3} />
				{remainingFraction > 0 && remainingFraction < 1 && (
					<path d={describeWedge(center, center, circleRadius, -90, wedgeEnd)} fill={colorRemaining} />
				)}
				{remainingFraction >= 1 && (
					<circle cx={center} cy={center} r={circleRadius} fill={colorRemaining} stroke="#424242" strokeWidth={3} />
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
						color: colorDigital || "#000000",
					}}
				>
					{formatDigital(safeRemaining)}
				</div>
			)}
		</div>
	);
}
