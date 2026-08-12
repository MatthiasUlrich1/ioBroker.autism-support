import React from "react";

/** Allowed countdown outlines. Full circle / filled disc is intentionally excluded. */
export type CountdownGeometry =
	| "square"
	| "ring"
	| "triangle"
	| "diamond"
	| "pentagon"
	| "hexagon"
	| "octagon";

export const COUNTDOWN_GEOMETRIES: CountdownGeometry[] = [
	"square",
	"ring",
	"triangle",
	"diamond",
	"pentagon",
	"hexagon",
	"octagon",
];

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
	 * Stroke width as percent of widget size (5–45).
	 * Always leaves an open center – never a filled circle.
	 */
	ringWidthPercent?: number;
	/** Outline geometry. Default square. Full circle is not allowed. */
	geometry?: CountdownGeometry | string;
}

/** Brand-neutral orange – deliberately not Time Timer red. */
export const DEFAULT_REMAINING_COLOR = "#FF8A00";
export const DEFAULT_TRACK_COLOR = "#E0E0E0";
export const DEFAULT_DIGITAL_COLOR = "#1A1A1A";
export const DEFAULT_RING_WIDTH_PERCENT = 18;
export const DEFAULT_GEOMETRY: CountdownGeometry = "square";
/** Cap so a circular outline can never become a filled disc. */
export const MAX_STROKE_WIDTH_PERCENT = 45;

const SECONDS_PER_HOUR = 3600;
const PATH_LENGTH = 1000;

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
 * Main display = current hour fragment only.
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
 * Small full-hour markers = complete hours beyond the main display.
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

export function normalizeGeometry(value: unknown): CountdownGeometry {
	const raw = String(value ?? DEFAULT_GEOMETRY)
		.trim()
		.toLowerCase();
	// Explicitly reject full-circle / disc variants
	if (raw === "circle" || raw === "disc" || raw === "disk" || raw === "pie" || raw === "full") {
		return DEFAULT_GEOMETRY;
	}
	if ((COUNTDOWN_GEOMETRIES as string[]).includes(raw)) {
		return raw as CountdownGeometry;
	}
	return DEFAULT_GEOMETRY;
}

/** Regular polygon, vertex on top, clockwise. */
function regularPolygonPath(cx: number, cy: number, r: number, sides: number): string {
	const start = -Math.PI / 2;
	const parts: string[] = [];
	for (let i = 0; i < sides; i++) {
		const a = start + (i * 2 * Math.PI) / sides;
		const x = cx + r * Math.cos(a);
		const y = cy + r * Math.sin(a);
		parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
	}
	return `${parts.join(" ")} Z`;
}

/** Axis-aligned square, path starts at top-center (12 o'clock), clockwise. */
function flatSquarePath(cx: number, cy: number, halfSide: number): string {
	const top = cy - halfSide;
	const bottom = cy + halfSide;
	const left = cx - halfSide;
	const right = cx + halfSide;
	return `M ${cx} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} L ${left} ${top} Z`;
}

function shapePath(geometry: CountdownGeometry, cx: number, cy: number, r: number): string {
	switch (geometry) {
		case "ring":
			return "";
		case "square":
			return flatSquarePath(cx, cy, r / Math.SQRT2);
		case "diamond":
			return regularPolygonPath(cx, cy, r, 4);
		case "triangle":
			return regularPolygonPath(cx, cy, r, 3);
		case "pentagon":
			return regularPolygonPath(cx, cy, r, 5);
		case "hexagon":
			return regularPolygonPath(cx, cy, r, 6);
		case "octagon":
			return regularPolygonPath(cx, cy, r, 8);
		default:
			return flatSquarePath(cx, cy, r / Math.SQRT2);
	}
}

function HourMarker({
	diameter,
	colorRemaining,
	colorTrack,
	strokeRatio = 0.36,
	geometry,
}: {
	diameter: number;
	colorRemaining: string;
	colorTrack: string;
	strokeRatio?: number;
	geometry: CountdownGeometry;
}): React.JSX.Element {
	const stroke = Math.max(3, diameter * strokeRatio);
	const c = diameter / 2;
	const r = Math.max(2, diameter / 2 - stroke / 2);
	const d = shapePath(geometry, c, c, r);

	return (
		<svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} role="img" aria-label="1 hour">
			{geometry === "ring" ? (
				<>
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
				</>
			) : (
				<>
					<path
						d={d}
						fill="none"
						stroke={colorTrack}
						strokeWidth={stroke}
						strokeLinecap="butt"
						strokeLinejoin="miter"
					/>
					<path
						d={d}
						fill="none"
						stroke={colorRemaining}
						strokeWidth={stroke}
						strokeLinecap="butt"
						strokeLinejoin="miter"
					/>
				</>
			)}
		</svg>
	);
}

/**
 * Outline countdown. Default geometry is square.
 * Full circle / filled disc is not offered.
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
	geometry: geometryProp = DEFAULT_GEOMETRY,
}: VisualCountdownVisualProps): React.JSX.Element {
	const geometry = normalizeGeometry(geometryProp);
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const center = size / 2;
	const padding = 4;
	const outerLimit = Math.max(8, size / 2 - padding);

	const clampedPercent = Math.max(
		5,
		Math.min(MAX_STROKE_WIDTH_PERCENT, Number(ringWidthPercent) || DEFAULT_RING_WIDTH_PERCENT),
	);
	const stroke = Math.min(outerLimit * 0.9, Math.max(8, size * (clampedPercent / 100)));
	const radius = Math.max(1, outerLimit - stroke / 2);
	const innerRadius = Math.max(0, radius - stroke / 2);
	const pathD = shapePath(geometry, center, center, radius);

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
	const hourCircleCount = getFullHourCircleCount(safeRemaining);
	const smallDiameter = Math.max(24, Math.min(48, Math.round(size * 0.13)));
	const progressLength = remainingFraction * PATH_LENGTH;
	const hourStrokeRatio = Math.max(0.2, Math.min(0.45, (clampedPercent / 100) * 2));

	const ticks = Array.from({ length: 12 }, (_, index) => {
		const angle = (index / 12) * 360;
		const rad = ((angle - 90) * Math.PI) / 180;
		const outer = radius + stroke * 0.15;
		const inner = Math.max(innerRadius + 2, radius - stroke * 0.35);
		return {
			key: `tick-${index}`,
			x1: center + Math.cos(rad) * inner,
			y1: center + Math.sin(rad) * inner,
			x2: center + Math.cos(rad) * outer,
			y2: center + Math.sin(rad) * outer,
			major: index % 3 === 0,
		};
	});

	const progressStrokeProps = {
		fill: "none" as const,
		stroke: colorRemaining,
		strokeWidth: stroke,
		strokeLinecap: "butt" as const,
		strokeLinejoin: "miter" as const,
		pathLength: PATH_LENGTH,
		strokeDasharray: remainingFraction >= 1 ? undefined : `${progressLength} ${PATH_LENGTH}`,
		style: { transition: "stroke-dasharray 0.35s linear" },
	};

	const trackStrokeProps = {
		fill: "none" as const,
		stroke: colorElapsed,
		strokeWidth: stroke,
		strokeLinecap: "butt" as const,
		strokeLinejoin: "miter" as const,
	};

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
							<HourMarker
								key={`hour-${index}`}
								diameter={smallDiameter}
								colorRemaining={colorRemaining}
								colorTrack={colorElapsed}
								strokeRatio={hourStrokeRatio}
								geometry={geometry}
							/>
						))
					: null}
			</div>

			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Visual Countdown">
				{/* Soft center plate matching geometry */}
				{innerRadius > 4 &&
					(geometry === "ring" ? (
						<circle cx={center} cy={center} r={innerRadius} fill="#F7F7F7" />
					) : (
						<path d={shapePath(geometry, center, center, innerRadius)} fill="#F7F7F7" stroke="none" />
					))}

				{geometry === "ring" ? (
					<>
						<circle cx={center} cy={center} r={radius} {...trackStrokeProps} />
						{remainingFraction > 0 && (
							<circle
								cx={center}
								cy={center}
								r={radius}
								{...progressStrokeProps}
								transform={`rotate(-90 ${center} ${center})`}
							/>
						)}
					</>
				) : (
					<>
						<path d={pathD} {...trackStrokeProps} />
						{remainingFraction > 0 && <path d={pathD} {...progressStrokeProps} />}
					</>
				)}

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
