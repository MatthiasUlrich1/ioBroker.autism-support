import React, { useId } from "react";

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
	 * Frame thickness as percent of widget size (5–45).
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

/** Axis-aligned square. */
function flatSquarePath(cx: number, cy: number, halfSide: number): string {
	const top = cy - halfSide;
	const bottom = cy + halfSide;
	const left = cx - halfSide;
	const right = cx + halfSide;
	return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
}

function outerShapePath(geometry: CountdownGeometry, cx: number, cy: number, r: number): string {
	switch (geometry) {
		case "ring":
			return ""; // circle handled separately
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

/**
 * Frame path = outer shape minus inner hole (evenodd).
 * Inner hole uses the same geometry so the open center matches.
 */
function framePath(
	geometry: CountdownGeometry,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
): string {
	if (geometry === "ring") {
		// Two circles for evenodd fill
		const outer = `M ${cx + outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy} A ${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy} Z`;
		const inner = `M ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} Z`;
		return `${outer} ${inner}`;
	}
	const outer = outerShapePath(geometry, cx, cy, outerR);
	const inner = outerShapePath(geometry, cx, cy, Math.max(1, innerR));
	return `${outer} ${inner}`;
}

/**
 * Circular sector from 12 o'clock, clockwise.
 * Remaining color is always cut by radii from the center – never mid-edge polygon stubs.
 */
function circularSectorPath(cx: number, cy: number, r: number, fraction: number): string {
	if (fraction <= 0) {
		return "";
	}
	if (fraction >= 1) {
		return `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;
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
	const c = diameter / 2;
	const outerR = Math.max(4, diameter / 2 - 1);
	const thickness = Math.max(2, diameter * strokeRatio * 0.5);
	const innerR = Math.max(1, outerR - thickness);
	const d = framePath(geometry, c, c, outerR, innerR);

	return (
		<svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} role="img" aria-label="1 hour">
			<path d={d} fill={colorTrack} fillRule="evenodd" />
			<path d={d} fill={colorRemaining} fillRule="evenodd" />
		</svg>
	);
}

/**
 * Geometry defines the outer frame; remaining color is revealed with a circular
 * wipe from the center (sector clip) so cuts stay radial – no odd partial edges.
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
	const reactId = useId().replace(/:/g, "");
	const clipId = `as-cd-sector-${reactId}`;

	const geometry = normalizeGeometry(geometryProp);
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const center = size / 2;
	const padding = 4;
	const outerR = Math.max(8, size / 2 - padding);

	const clampedPercent = Math.max(
		5,
		Math.min(MAX_STROKE_WIDTH_PERCENT, Number(ringWidthPercent) || DEFAULT_RING_WIDTH_PERCENT),
	);
	const thickness = Math.min(outerR * 0.9, Math.max(8, size * (clampedPercent / 100)));
	const innerR = Math.max(2, outerR - thickness);

	const remainingFraction = getCircleRemainingFraction(safeRemaining);
	const hourCircleCount = getFullHourCircleCount(safeRemaining);
	const smallDiameter = Math.max(24, Math.min(48, Math.round(size * 0.13)));
	const hourStrokeRatio = Math.max(0.2, Math.min(0.45, (clampedPercent / 100) * 2));

	const frameD = framePath(geometry, center, center, outerR, innerR);
	const sectorR = outerR * 1.15; // slightly past outer edge so clip fully covers frame
	const sectorD = circularSectorPath(center, center, sectorR, remainingFraction);

	const ticks = Array.from({ length: 12 }, (_, index) => {
		const angle = (index / 12) * 360;
		const rad = ((angle - 90) * Math.PI) / 180;
		const outer = outerR - thickness * 0.15;
		const inner = innerR + thickness * 0.15;
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
				<defs>
					<clipPath id={clipId}>
						{remainingFraction > 0 && remainingFraction < 1 && <path d={sectorD} />}
						{remainingFraction >= 1 && (
							<circle cx={center} cy={center} r={sectorR} />
						)}
					</clipPath>
				</defs>

				{/* Soft center plate */}
				{geometry === "ring" ? (
					<circle cx={center} cy={center} r={innerR} fill="#F7F7F7" />
				) : (
					<path d={outerShapePath(geometry, center, center, innerR)} fill="#F7F7F7" />
				)}

				{/* Full frame track (elapsed / empty) */}
				<path d={frameD} fill={colorElapsed} fillRule="evenodd" />

				{/* Remaining: same frame, circular wipe from center */}
				{remainingFraction > 0 && (
					<path
						d={frameD}
						fill={colorRemaining}
						fillRule="evenodd"
						clipPath={`url(#${clipId})`}
						style={{ transition: "opacity 0.2s linear" }}
					/>
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
