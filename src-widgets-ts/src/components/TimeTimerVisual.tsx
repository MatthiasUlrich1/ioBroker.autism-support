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

/** Angle 0 = top (12 o'clock), clockwise positive – like a clock. */
function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
	const angleRad = ((angleDeg - 90) * Math.PI) / 180;
	return {
		x: cx + radius * Math.cos(angleRad),
		y: cy + radius * Math.sin(angleRad),
	};
}

/**
 * Clockwise wedge from startAngle to endAngle (degrees, 0 = top).
 */
function describeWedge(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
	const sweep = endAngle - startAngle;
	if (sweep >= 359.99) {
		return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
	}
	const start = polarToCartesian(cx, cy, radius, startAngle);
	const end = polarToCartesian(cx, cy, radius, endAngle);
	const largeArc = sweep <= 180 ? 0 : 1;
	// sweep-flag 1 = clockwise
	return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/**
 * Circle = current hour fragment only (always one hour face).
 * 30 min → 0.5, 90 min → 0.5, exact hours → 1.0
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

/**
 * Full-hour bars = complete hours beyond the circle.
 * 1:30 → 1 bar, 1:00 → 0 bars (+ full circle), 2:00 → 1 bar (+ full circle), 0:30 → 0 bars
 */
export function getFullHourBarCount(remainingSeconds: number): number {
	const safeRemaining = Math.max(0, remainingSeconds);
	if (safeRemaining <= 0) {
		return 0;
	}
	const mod = safeRemaining % SECONDS_PER_HOUR;
	if (mod === 0) {
		return Math.max(0, Math.floor(safeRemaining / SECONDS_PER_HOUR) - 1);
	}
	return Math.floor(safeRemaining / SECONDS_PER_HOUR);
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
	const circleRadius = size * 0.38;
	const center = size / 2;

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
	const hourBarCount = getFullHourBarCount(safeRemaining);
	// Start at top (0°) and sweep clockwise for remaining time
	const wedgeEnd = remainingFraction * 360;

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
					minHeight: 18,
					height: 18,
					alignItems: "flex-end",
					justifyContent: "center",
				}}
			>
				{hourBarCount > 0
					? Array.from({ length: hourBarCount }, (_, index) => (
							<div
								key={`hour-${index}`}
								style={{
									flex: 1,
									maxWidth: 48,
									height: "100%",
									background: colorRemaining,
									border: "1px solid #BDBDBD",
									borderRadius: 2,
								}}
								title="1 h"
							/>
						))
					: null}
			</div>

			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Time Timer">
				{/* White base = elapsed part of the current hour */}
				<circle cx={center} cy={center} r={circleRadius} fill={colorElapsed} stroke="#424242" strokeWidth={3} />
				{/* Thin tick at 12 o'clock so the start position is visible */}
				<line
					x1={center}
					y1={center - circleRadius}
					x2={center}
					y2={center - circleRadius + 10}
					stroke="#424242"
					strokeWidth={2}
				/>
				{remainingFraction > 0 && remainingFraction < 1 && (
					<path d={describeWedge(center, center, circleRadius, 0, wedgeEnd)} fill={colorRemaining} />
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
