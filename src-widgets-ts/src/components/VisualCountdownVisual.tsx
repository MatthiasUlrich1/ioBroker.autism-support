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
	/** Draw a border around the geometry. */
	showBorder?: boolean;
	/** Border color when showBorder is enabled. */
	colorBorder?: string;
}

/** Brand-neutral orange – deliberately not Time Timer red. */
export const DEFAULT_REMAINING_COLOR = "#FF8A00";
export const DEFAULT_TRACK_COLOR = "#E0E0E0";
export const DEFAULT_DIGITAL_COLOR = "#1A1A1A";
export const DEFAULT_BORDER_COLOR = "#424242";
export const DEFAULT_RING_WIDTH_PERCENT = 18;
export const DEFAULT_GEOMETRY: CountdownGeometry = "square";
/** Cap so a circular outline can never become a filled disc. */
export const MAX_STROKE_WIDTH_PERCENT = 45;

const SECONDS_PER_HOUR = 3600;

interface Point {
	x: number;
	y: number;
}

interface TickMark {
	key: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	major: boolean;
}

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

function sideCount(geometry: CountdownGeometry): number {
	switch (geometry) {
		case "triangle":
			return 3;
		case "square":
		case "diamond":
			return 4;
		case "pentagon":
			return 5;
		case "hexagon":
			return 6;
		case "octagon":
			return 8;
		default:
			return 4;
	}
}

/** Minor ticks per edge (vertices are always major). */
function minorsPerSide(geometry: CountdownGeometry): number {
	switch (geometry) {
		case "triangle":
			return 3;
		case "square":
		case "diamond":
			return 2;
		case "pentagon":
			return 1;
		case "hexagon":
			return 1;
		case "octagon":
			return 0;
		default:
			return 2;
	}
}

/** Regular polygon, vertex on top, clockwise. */
function regularPolygonPath(cx: number, cy: number, r: number, sides: number): string {
	const verts = regularPolygonVertices(cx, cy, r, sides);
	return `${verts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} Z`;
}

function regularPolygonVertices(cx: number, cy: number, r: number, sides: number): Point[] {
	const start = -Math.PI / 2;
	const verts: Point[] = [];
	for (let i = 0; i < sides; i++) {
		const a = start + (i * 2 * Math.PI) / sides;
		verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
	}
	return verts;
}

/** Axis-aligned square vertices, clockwise from top-left. */
function flatSquareVertices(cx: number, cy: number, halfSide: number): Point[] {
	return [
		{ x: cx - halfSide, y: cy - halfSide },
		{ x: cx + halfSide, y: cy - halfSide },
		{ x: cx + halfSide, y: cy + halfSide },
		{ x: cx - halfSide, y: cy + halfSide },
	];
}

function flatSquarePath(cx: number, cy: number, halfSide: number): string {
	const [a, b, c, d] = flatSquareVertices(cx, cy, halfSide);
	return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`;
}

function shapeVertices(geometry: CountdownGeometry, cx: number, cy: number, r: number): Point[] {
	switch (geometry) {
		case "ring":
			return [];
		case "square":
			return flatSquareVertices(cx, cy, r / Math.SQRT2);
		case "diamond":
			return regularPolygonVertices(cx, cy, r, 4);
		case "triangle":
			return regularPolygonVertices(cx, cy, r, 3);
		case "pentagon":
			return regularPolygonVertices(cx, cy, r, 5);
		case "hexagon":
			return regularPolygonVertices(cx, cy, r, 6);
		case "octagon":
			return regularPolygonVertices(cx, cy, r, 8);
		default:
			return flatSquareVertices(cx, cy, r / Math.SQRT2);
	}
}

function outerShapePath(geometry: CountdownGeometry, cx: number, cy: number, r: number): string {
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

/**
 * Frame path = outer shape minus inner hole (evenodd).
 */
function framePath(
	geometry: CountdownGeometry,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
): string {
	if (geometry === "ring") {
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

/**
 * Segment ticks follow the geometry outline (across the frame band),
 * not a circle – except for ring, which keeps radial clock ticks.
 */
function buildGeometryTicks(
	geometry: CountdownGeometry,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
): TickMark[] {
	const thickness = Math.max(1, outerR - innerR);

	if (geometry === "ring") {
		return Array.from({ length: 12 }, (_, index) => {
			const rad = ((index / 12) * 360 - 90) * (Math.PI / 180);
			const outer = outerR - thickness * 0.12;
			const inner = innerR + thickness * 0.12;
			return {
				key: `tick-${index}`,
				x1: cx + Math.cos(rad) * inner,
				y1: cy + Math.sin(rad) * inner,
				x2: cx + Math.cos(rad) * outer,
				y2: cy + Math.sin(rad) * outer,
				major: index % 3 === 0,
			};
		});
	}

	const outerVerts = shapeVertices(geometry, cx, cy, outerR - thickness * 0.1);
	const innerVerts = shapeVertices(geometry, cx, cy, innerR + thickness * 0.1);
	const sides = sideCount(geometry);
	const minors = minorsPerSide(geometry);
	const ticks: TickMark[] = [];
	let tickIndex = 0;

	for (let s = 0; s < sides; s++) {
		const oa = outerVerts[s];
		const ob = outerVerts[(s + 1) % sides];
		const ia = innerVerts[s];
		const ib = innerVerts[(s + 1) % sides];
		const samples = minors + 1; // start vertex; end belongs to next side

		for (let m = 0; m < samples; m++) {
			const t = m / samples;
			const ox = oa.x + (ob.x - oa.x) * t;
			const oy = oa.y + (ob.y - oa.y) * t;
			const ix = ia.x + (ib.x - ia.x) * t;
			const iy = ia.y + (ib.y - ia.y) * t;
			ticks.push({
				key: `tick-${tickIndex++}`,
				x1: ix,
				y1: iy,
				x2: ox,
				y2: oy,
				major: m === 0,
			});
		}
	}

	return ticks;
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
 * wipe from the center (sector clip). Segment ticks follow the geometry edges.
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
	showBorder = false,
	colorBorder = DEFAULT_BORDER_COLOR,
}: VisualCountdownVisualProps): React.JSX.Element {
	const reactId = useId().replace(/:/g, "");
	const clipId = `as-cd-sector-${reactId}`;

	const geometry = normalizeGeometry(geometryProp);
	const safeDuration = Math.max(1, durationSeconds);
	const safeRemaining = Math.max(0, Math.min(safeDuration, remainingSeconds));
	const center = size / 2;
	const borderWidth = showBorder ? Math.max(3, size * 0.018) : 0;
	const borderGap = showBorder ? Math.max(2, size * 0.01) : 0;
	const padding = 4 + (showBorder ? borderWidth + borderGap : 0);
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
	const sectorR = outerR * 1.15;
	const sectorD = circularSectorPath(center, center, sectorR, remainingFraction);
	const ticks = buildGeometryTicks(geometry, center, center, outerR, innerR);
	const borderR = outerR + borderGap + borderWidth / 2;
	const borderPath =
		geometry === "ring" ? "" : outerShapePath(geometry, center, center, borderR);

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
						{remainingFraction >= 1 && <circle cx={center} cy={center} r={sectorR} />}
					</clipPath>
				</defs>

				{/* Optional outer border matching geometry */}
				{showBorder &&
					(geometry === "ring" ? (
						<circle
							cx={center}
							cy={center}
							r={borderR}
							fill="none"
							stroke={colorBorder || DEFAULT_BORDER_COLOR}
							strokeWidth={borderWidth}
						/>
					) : (
						<path
							d={borderPath}
							fill="none"
							stroke={colorBorder || DEFAULT_BORDER_COLOR}
							strokeWidth={borderWidth}
							strokeLinejoin="miter"
						/>
					))}

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
						opacity={0.75}
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
