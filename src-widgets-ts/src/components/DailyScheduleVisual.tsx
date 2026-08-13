import React from "react";
import {
	ARASAAC_ATTRIBUTION_DE,
	ARASAAC_ATTRIBUTION_EN,
} from "../lib/arasaac";
import {
	type DayPeriodDefinition,
	type ScheduleItem,
	type SchedulePlan,
	parseTimeToMinutes,
	periodToSegments,
	resolveItemImageUrl,
} from "../lib/schedule";

export interface DailyScheduleVisualProps {
	plan: SchedulePlan;
	periods: DayPeriodDefinition[];
	nowMinutes: number;
	currentItemIndex: number;
	adapterInstance?: string;
	locale?: string;
	/** Pictogram display size in px (default 64). */
	pictogramSize?: number;
}

interface TimelineSlice {
	id: string;
	startMin: number;
	endMin: number;
	color: string;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function periodLabel(id: string, locale: string): string {
	const de: Record<string, string> = {
		morning: "Morgens",
		forenoon: "Vormittag",
		noon: "Mittag",
		afternoon: "Nachmittag",
		evening: "Abend",
		night: "Nacht",
	};
	const en: Record<string, string> = {
		morning: "Morning",
		forenoon: "Forenoon",
		noon: "Noon",
		afternoon: "Afternoon",
		evening: "Evening",
		night: "Night",
	};
	return (locale.startsWith("de") ? de : en)[id] || id;
}

export function itemDurationMin(item: ScheduleItem): number {
	const s = parseTimeToMinutes(item.start);
	const e = parseTimeToMinutes(item.end);
	if (e > s) {
		return Math.max(1, e - s);
	}
	if (e < s) {
		return Math.max(1, 1440 - s + e);
	}
	return 30;
}

export function itemStartMin(item: ScheduleItem): number {
	return parseTimeToMinutes(item.start);
}

/** Inclusive end on timeline (handles wrap as start+duration). */
export function itemEndMin(item: ScheduleItem): number {
	return itemStartMin(item) + itemDurationMin(item);
}

function periodColorAt(minutes: number, periods: DayPeriodDefinition[]): string {
	const enabled = periods.filter(p => p.enabled);
	for (const period of enabled) {
		const segs = periodToSegments(period);
		if (segs.some(seg => minutes >= seg.startMin && minutes < seg.endMin)) {
			return period.color;
		}
	}
	return "#CFD8DC";
}

/**
 * Visible window from pictogram times, extended over gaps and to period boundaries
 * so e.g. Mittag (12:00–14:00) continues through a gap until the next period starts.
 */
export function computeViewWindow(
	items: ScheduleItem[],
	periods: DayPeriodDefinition[],
): { viewStartMin: number; viewEndMin: number } {
	if (!items.length) {
		return { viewStartMin: 0, viewEndMin: 1440 };
	}

	let minStart = Infinity;
	let maxEnd = -Infinity;

	for (const item of items) {
		const s = itemStartMin(item);
		const e = itemEndMin(item);
		minStart = Math.min(minStart, s);
		maxEnd = Math.max(maxEnd, Math.min(1440, e));
	}

	const enabled = periods.filter(p => p.enabled);

	// Extend to full period end when a pictogram overlaps that period (e.g. Mittag until 14:00).
	for (const item of items) {
		const s = itemStartMin(item);
		const e = itemEndMin(item);
		for (const period of enabled) {
			for (const seg of periodToSegments(period)) {
				if (e > seg.startMin && s < seg.endMin) {
					maxEnd = Math.max(maxEnd, Math.min(1440, seg.endMin));
				}
			}
		}
	}

	// Extend over gaps between consecutive pictograms to the next start time.
	const sorted = [...items].sort((a, b) => itemStartMin(a) - itemStartMin(b));
	for (let i = 0; i < sorted.length - 1; i++) {
		const gapEnd = itemStartMin(sorted[i + 1]);
		const gapStart = itemEndMin(sorted[i]);
		if (gapEnd > gapStart) {
			maxEnd = Math.max(maxEnd, gapEnd);
		}
	}

	const pad = 15;
	const viewStartMin = clamp(minStart - pad, 0, 1439);
	const viewEndMin = clamp(Math.max(maxEnd + pad, viewStartMin + 60), viewStartMin + 60, 1440);
	return { viewStartMin, viewEndMin };
}

/** Period-colored slices on the shared timeline (time-proportional heights). */
function buildTimelineBarSlices(
	viewStartMin: number,
	viewEndMin: number,
	periods: DayPeriodDefinition[],
): TimelineSlice[] {
	const enabled = periods.filter(p => p.enabled);
	const cuts = new Set<number>([viewStartMin, viewEndMin]);

	for (const period of enabled) {
		for (const seg of periodToSegments(period)) {
			if (seg.endMin > viewStartMin && seg.startMin < viewEndMin) {
				cuts.add(clamp(seg.startMin, viewStartMin, viewEndMin));
				cuts.add(clamp(seg.endMin, viewStartMin, viewEndMin));
			}
		}
	}

	const points = [...cuts].sort((a, b) => a - b);
	const slices: TimelineSlice[] = [];

	for (let i = 0; i < points.length - 1; i++) {
		const startMin = points[i];
		const endMin = points[i + 1];
		if (endMin <= startMin) {
			continue;
		}
		slices.push({
			id: `bar-${startMin}-${endMin}`,
			startMin,
			endMin,
			color: periodColorAt((startMin + endMin) / 2, periods),
		});
	}

	if (!slices.length) {
		slices.push({
			id: "bar-full",
			startMin: viewStartMin,
			endMin: viewEndMin,
			color: "#CFD8DC",
		});
	}

	return slices;
}

function formatClock(minutes: number): string {
	const m = clamp(Math.round(minutes), 0, 1440);
	const hh = Math.floor(m / 60) % 24;
	const mm = m % 60;
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToTop(minutes: number, viewStartMin: number, pxPerMin: number): number {
	return (minutes - viewStartMin) * pxPerMin;
}

function timeToHeight(startMin: number, endMin: number, pxPerMin: number): number {
	return Math.max(1, (endMin - startMin) * pxPerMin);
}

/**
 * Shared time axis: pictograms and period bar use the same minute scale.
 * Gaps between pictograms stay empty on the left; the period bar continues through them.
 */
export default function DailyScheduleVisual({
	plan,
	periods,
	nowMinutes,
	currentItemIndex,
	adapterInstance = "autism-support.0",
	locale = "de",
	pictogramSize = 64,
}: DailyScheduleVisualProps): React.JSX.Element {
	const pictoPx = Math.max(32, Math.min(200, Number(pictogramSize) || 64));
	const sorted = [...plan.items].sort((a, b) => itemStartMin(a) - itemStartMin(b));
	const { viewStartMin, viewEndMin } = computeViewWindow(sorted, periods);
	const viewSpan = Math.max(60, viewEndMin - viewStartMin);

	const usesArasaac = plan.items.some(item => item.source === "arasaac" && item.arasaacId);
	const attribution = locale.startsWith("de") ? ARASAAC_ATTRIBUTION_DE : ARASAAC_ATTRIBUTION_EN;
	const activePeriods = periods.filter(p => p.enabled);
	const barSlices = buildTimelineBarSlices(viewStartMin, viewEndMin, periods);

	const minItemDuration =
		sorted.length > 0 ? Math.min(...sorted.map(item => itemDurationMin(item))) : 30;
	const pxPerMin = Math.max(2.5, (pictoPx + 20) / Math.max(15, minItemDuration));
	const timelineHeight = viewSpan * pxPerMin;

	const nowTop =
		nowMinutes >= viewStartMin && nowMinutes <= viewEndMin
			? timeToTop(nowMinutes, viewStartMin, pxPerMin)
			: null;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 8,
				padding: 8,
				boxSizing: "border-box",
				fontFamily: "Segoe UI, system-ui, sans-serif",
			}}
		>
			<div
				style={{
					display: "flex",
					gap: 10,
					flex: 1,
					minHeight: 0,
					alignItems: "stretch",
				}}
			>
				<div
					style={{
						flex: 1,
						overflowY: "auto",
						minWidth: 0,
					}}
				>
					{sorted.length === 0 ? (
						<div style={{ opacity: 0.7, padding: 12 }}>—</div>
					) : (
						<div
							style={{
								position: "relative",
								height: timelineHeight,
								minHeight: "100%",
							}}
						>
							{sorted.map((item, index) => {
								const originalIndex = plan.items.findIndex(p => p.id === item.id);
								const active = originalIndex === currentItemIndex;
								const img = resolveItemImageUrl(item, adapterInstance);
								const startMin = itemStartMin(item);
								const endMin = itemEndMin(item);
								const top = timeToTop(startMin, viewStartMin, pxPerMin);
								const height = timeToHeight(startMin, endMin, pxPerMin);
								const slotPicto = Math.min(pictoPx, Math.max(28, height - 12));

								return (
									<div
										key={item.id || index}
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											top,
											height,
											display: "flex",
											alignItems: "center",
											gap: 10,
											padding: "4px 10px",
											boxSizing: "border-box",
											borderRadius: 10,
											background: active ? "rgba(255,138,0,0.15)" : "rgba(0,0,0,0.04)",
											outline: active ? "2px solid #FF8A00" : "1px solid transparent",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												width: slotPicto,
												height: slotPicto,
												flexShrink: 0,
												borderRadius: 8,
												background: "#fff",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												overflow: "hidden",
											}}
										>
											{img ? (
												<img
													src={img}
													alt=""
													style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
													referrerPolicy="no-referrer"
												/>
											) : (
												<span style={{ fontSize: 12, opacity: 0.5 }}>?</span>
											)}
										</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													fontWeight: 700,
													fontSize: Math.max(12, Math.min(18, slotPicto * 0.22)),
													lineHeight: 1.2,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{item.label || "—"}
											</div>
											<div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.2 }}>
												{item.start} – {item.end}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{sorted.length > 0 && (
					<div
						style={{
							flex: "0 0 88px",
							width: 88,
							display: "flex",
							flexDirection: "column",
							alignSelf: "stretch",
							minHeight: 0,
						}}
					>
						<div style={{ fontSize: 10, opacity: 0.65, marginBottom: 4, textAlign: "center" }}>
							{formatClock(viewStartMin)}
						</div>
						<div
							style={{
								flex: 1,
								overflowY: "auto",
								minHeight: 0,
							}}
						>
							<div
								style={{
									position: "relative",
									height: timelineHeight,
									borderRadius: 10,
									overflow: "hidden",
									border: "1px solid #CFD8DC",
									background: "#ECEFF1",
								}}
							>
								{barSlices.map(slice => {
									const top = timeToTop(slice.startMin, viewStartMin, pxPerMin);
									const height = timeToHeight(slice.startMin, slice.endMin, pxPerMin);
									return (
										<div
											key={slice.id}
											style={{
												position: "absolute",
												left: 0,
												right: 0,
												top,
												height,
												background: slice.color,
												boxSizing: "border-box",
												borderBottom: "1px solid rgba(255,255,255,0.45)",
											}}
											title={`${formatClock(slice.startMin)} – ${formatClock(slice.endMin)}`}
										/>
									);
								})}

								{nowTop != null && (
									<>
										<div
											style={{
												position: "absolute",
												left: 0,
												right: 0,
												top: nowTop,
												height: 3,
												background: "#D32F2F",
												boxShadow: "0 0 0 1px rgba(255,255,255,0.85)",
												zIndex: 2,
												pointerEvents: "none",
											}}
										/>
										<div
											style={{
												position: "absolute",
												left: "50%",
												marginLeft: -7,
												top: nowTop - 7,
												width: 14,
												height: 14,
												borderRadius: "50%",
												background: "#D32F2F",
												border: "2px solid #fff",
												zIndex: 3,
												pointerEvents: "none",
											}}
										/>
									</>
								)}
							</div>
						</div>
						<div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: "center" }}>
							{formatClock(viewEndMin)}
						</div>
					</div>
				)}
			</div>

			<div style={{ fontSize: 11, opacity: 0.7 }}>
				{locale.startsWith("de")
					? `Zeitfenster: ${formatClock(viewStartMin)} – ${formatClock(viewEndMin)} · ${sorted.length} Piktogramm${sorted.length === 1 ? "" : "e"}`
					: `Window: ${formatClock(viewStartMin)} – ${formatClock(viewEndMin)} · ${sorted.length} pictogram${sorted.length === 1 ? "" : "s"}`}
			</div>

			<div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
				{activePeriods.map(p => (
					<span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
						<span
							style={{
								width: 12,
								height: 12,
								borderRadius: 2,
								background: p.color,
								display: "inline-block",
							}}
						/>
						{periodLabel(p.id, locale)}
					</span>
				))}
				<span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
					<span style={{ width: 12, height: 3, background: "#D32F2F", display: "inline-block" }} />
					{locale.startsWith("de") ? "jetzt" : "now"}
				</span>
			</div>

			{usesArasaac && (
				<div style={{ fontSize: 10, lineHeight: 1.35, opacity: 0.75 }}>{attribution}</div>
			)}
		</div>
	);
}
