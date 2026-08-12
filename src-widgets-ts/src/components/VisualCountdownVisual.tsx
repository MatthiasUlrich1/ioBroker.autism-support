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
	 * Ring stroke width as percent of widget size.
	 * Previous default was ~9%; new default is 18% (twice as wide).
	 */
	ringWidthPercent?: number;
}

/** Brand-neutral orange – deliberately not Time Timer red. */
export const DEFAULT_REMAINING_COLOR = "#FF8A00";
export const DEFAULT_TRACK_COLOR = "#E0E0E0";
export const DEFAULT_DIGITAL_COLOR = "#1A1A1A";
/** Twice the previous default (~9% → 18%). */
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
	const r = Math.max(2, diameter / 2 - stroke);
	const c = diameter / 2;
	return (
		<svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} role="img" aria-label="1 hour">
			<circle cx={c} cy={c} r={r} fill="none" stroke={colorTrack} strokeWidth={stroke} />
			<circle
				cx={c}
				cy={c}
				r={r}
				fill="none"
				stroke={colorRemaining}
				strokeWidth={stroke}
				strokeLinecap="round"
			/>
		</svg>
	);
}

/**
 * Ring-based countdown (not a filled pie disk) to avoid resemblance to commercial Time Timer products.
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
	const widthRatio = Math.max(0.05, Math.min(0.35, Number(ringWidthPercent) / 100 || DEFAULT_RING_WIDTH_PERCENT / 100));
	const stroke = Math.max(8, size * widthRatio);
	const radius = Math.max(stroke, size * 0.36 - (widthRatio - 0.09) * size * 0.15);
	const circumference = 2 * Math.PI * radius;

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
	const hourCircleCount = getFullHourCircleCount(safeRemaining);
	const smallDiameter = Math.max(24, Math.min(48, Math.round(size * 0.13)));
	const progressLength = remainingFraction * circumference;
	const hourStrokeRatio = Math.max(0.2, Math.min(0.45, widthRatio * 2));

	const ticks = Array.from({ length: 12 }, (_, index) => {
		const angle = (index / 12) * 360;
		const rad = ((angle - 90) * Math.PI) / 180;
		const outer = radius + stroke * 0.15;
		const inner = radius - stroke * 0.35;
		return {
			key: `tick-${index}`,
			x1: center + Math.cos(rad) * inner,
			y1: center + Math.sin(rad) * inner,
			x2: center + Math.cos(rad) * outer,
			y2: center + Math.sin(rad) * outer,
			major: index % 3 === 0,
		};
	});

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
				{/* Soft center plate – not a white timer disk */}
				<circle cx={center} cy={center} r={Math.max(4, radius - stroke * 0.55)} fill="#F7F7F7" />

				{/* Track ring */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke={colorElapsed}
					strokeWidth={stroke}
					strokeLinecap="round"
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
						strokeLinecap="round"
						strokeDasharray={`${progressLength} ${circumference}`}
						transform={`rotate(-90 ${center} ${center})`}
						style={{ transition: "stroke-dasharray 0.35s linear" }}
					/>
				)}

				{/* Subtle 5-minute ticks on the ring */}
				{ticks.map(tick => (
					<line
						key={tick.key}
						x1={tick.x1}
						y1={tick.y1}
						x2={tick.x2}
						y2={tick.y2}
						stroke="#9E9E9E"
						strokeWidth={tick.major ? 2 : 1}
						strokeLinecap="round"
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
