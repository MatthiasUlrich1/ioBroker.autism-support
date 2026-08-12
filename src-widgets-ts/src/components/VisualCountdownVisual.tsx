import React from "react";

export interface VisualCountdownVisualProps {
	durationSeconds: number;
	remainingSeconds: number;
	size?: number;
	showDigital?: boolean;
	/** Progress / remaining color (default orange). */
	colorRemaining?: string;
	/** Track / elapsed color (default light gray). */
	colorElapsed?: string;
	colorDigital?: string;
	/**
	 * Ring stroke width as percent of widget size (5–100).
	 * Default 18% = ring. At 100% = filled disc.
	 */
	ringWidthPercent?: number;
}

/** Brand-neutral orange – deliberately not Time Timer red. */
export const DEFAULT_REMAINING_COLOR = "#FF8A00";
export const DEFAULT_TRACK_COLOR = "#E0E0E0";
export const DEFAULT_DIGITAL_COLOR = "#1A1A1A";
/** Twice the previous thin-ring default (~9% → 18%). */
export const DEFAULT_RING_WIDTH_PERCENT = 18;

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

/**
 * Main ring = current hour fragment only.
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
 * Small full-hour rings = complete hours beyond the main ring.
 */
export function getFullHourCircleCount(remainingSeconds: number): number {
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

/** Pie sector from 12 o'clock, clockwise. fraction in (0, 1]. */
function pieSectorPath(cx: number, cy: number, r: number, fraction: number): string {
	if (fraction >= 1) {
		return "";
	}
	const start = -Math.PI / 2;
	const end = start + fraction * 2 * Math.PI;
	const x1 = cx + r * Math.cos(start);
	const y1 = cy + r * Math.sin(start);
	const x2 = cx + r * Math.cos(end);
	const y2 = cy + r * Math.sin(end);
	const largeArc = fraction > 0.5 ? 1 : 0;
	return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function HourRing({
	diameter,
	colorRemaining,
	colorTrack,
	strokeRatio = 0.36,
}: {
	diameter: number;
	colorRemaining: string;
	colorTrack: string;
	strokeRatio?: number;
}): React.JSX.Element {
	const stroke = Math.max(3, diameter * strokeRatio);
	const r = Math.max(2, diameter / 2 - stroke / 2);
	const c = diameter / 2;
	return (
		<svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} role="img" aria-label="1 hour">
			<circle cx={c} cy={c} r={r} fill="none" stroke={colorTrack} strokeWidth={stroke} strokeLinecap="butt" />
			<circle
				cx={c}
				cy={c}
				r={r}
				fill="none"
				stroke={colorRemaining}
				strokeWidth={stroke}
				strokeLinecap="butt"
			/>
		</svg>
	);
}

/**
 * Ring-based countdown by default; at 100% width becomes a filled disc.
 * Square (butt) stroke ends so remaining time maps exactly to the arc.
 */
export default function VisualCountdownVisual({
	durationSeconds,
	remainingSeconds,
	size = 280,
	showDigital = true,
	colorRemaining = DEFAULT_REMAINING_COLOR,
	colorElapsed = DEFAULT_TRACK_COLOR,
	colorDigital = DEFAULT_DIGITAL_COLOR,
	ringWidthPercent = DEFAULT_RING_WIDTH_PERCENT,
}: VisualCountdownVisualProps): React.JSX.Element {
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const center = size / 2;
	const padding = 4;
	const outerLimit = Math.max(8, size / 2 - padding);

	const clampedPercent = Math.max(
		5,
		Math.min(100, Number(ringWidthPercent) || DEFAULT_RING_WIDTH_PERCENT),
	);
	const isDisc = clampedPercent >= 100;

	// Keep outer edge fixed so thick rings never clip outside the SVG.
	const stroke = isDisc ? outerLimit * 2 : Math.min(outerLimit * 2, Math.max(8, size * (clampedPercent / 100)));
	const radius = isDisc ? outerLimit : Math.max(1, outerLimit - stroke / 2);
	const innerRadius = Math.max(0, radius - stroke / 2);
	const circumference = 2 * Math.PI * radius;

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
	const hourCircleCount = getFullHourCircleCount(safeRemaining);
	const smallDiameter = Math.max(24, Math.min(48, Math.round(size * 0.13)));
	const progressLength = remainingFraction * circumference;
	const hourStrokeRatio = Math.max(0.2, Math.min(0.45, (clampedPercent / 100) * 2));

	const ticks = Array.from({ length: 12 }, (_, index) => {
		const angle = (index / 12) * 360;
		const rad = ((angle - 90) * Math.PI) / 180;
		const outer = isDisc ? outerLimit * 0.92 : radius + stroke * 0.15;
		const inner = isDisc ? outerLimit * 0.78 : Math.max(innerRadius + 2, radius - stroke * 0.35);
		return {
			key: `tick-${index}`,
			x1: center + Math.cos(rad) * inner,
			y1: center + Math.sin(rad) * inner,
			x2: center + Math.cos(rad) * outer,
			y2: center + Math.sin(rad) * outer,
			major: index % 3 === 0,
		};
	});

	const piePath =
		!isDisc || remainingFraction <= 0 || remainingFraction >= 1
			? ""
			: pieSectorPath(center, center, outerLimit, remainingFraction);

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
					flexWrap: "wrap",
					gap: 8,
					width: "100%",
					maxWidth: size,
					minHeight: smallDiameter,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{hourCircleCount > 0
					? Array.from({ length: hourCircleCount }, (_, index) => (
							<HourRing
								key={`hour-${index}`}
								diameter={smallDiameter}
								colorRemaining={colorRemaining}
								colorTrack={colorElapsed}
								strokeRatio={hourStrokeRatio}
							/>
						))
					: null}
			</div>

			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Visual Countdown">
				{isDisc ? (
					<>
						{/* Full disc track */}
						<circle cx={center} cy={center} r={outerLimit} fill={colorElapsed} />
						{remainingFraction >= 1 && (
							<circle cx={center} cy={center} r={outerLimit} fill={colorRemaining} />
						)}
						{remainingFraction > 0 && remainingFraction < 1 && piePath && (
							<path d={piePath} fill={colorRemaining} />
						)}
					</>
				) : (
					<>
						{/* Soft center plate */}
						{innerRadius > 4 && (
							<circle cx={center} cy={center} r={innerRadius} fill="#F7F7F7" />
						)}

						{/* Track ring – square ends */}
						<circle
							cx={center}
							cy={center}
							r={radius}
							fill="none"
							stroke={colorElapsed}
							strokeWidth={stroke}
							strokeLinecap="butt"
						/>

						{/* Remaining progress ring, starts at 12 o'clock, clockwise */}
						{remainingFraction > 0 && (
							<circle
								cx={center}
								cy={center}
								r={radius}
								fill="none"
								stroke={colorRemaining}
								strokeWidth={stroke}
								strokeLinecap="butt"
								strokeDasharray={`${progressLength} ${circumference}`}
								transform={`rotate(-90 ${center} ${center})`}
								style={{ transition: "stroke-dasharray 0.35s linear" }}
							/>
						)}
					</>
				)}

				{/* Subtle 5-minute ticks */}
				{ticks.map(tick => (
					<line
						key={tick.key}
						x1={tick.x1}
						y1={tick.y1}
						x2={tick.x2}
						y2={tick.y2}
						stroke="#9E9E9E"
						strokeWidth={tick.major ? 2 : 1}
						strokeLinecap="butt"
						opacity={0.7}
					/>
				))}
			</svg>

			{showDigital && (
				<div
					style={{
						fontSize: Math.max(28, size * 0.14),
						fontWeight: 700,
						fontFamily: "Segoe UI, system-ui, sans-serif",
						letterSpacing: 1,
						color: colorDigital || DEFAULT_DIGITAL_COLOR,
					}}
				>
					{formatDigital(safeRemaining)}
				</div>
			)}
		</div>
	);
}
