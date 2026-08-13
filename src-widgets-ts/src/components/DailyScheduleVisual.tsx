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

/**
 * Visible window from earliest pictogram start to latest end, with padding.
 * Falls back to full day when plan is empty.
 */
export function computeViewWindow(items: ScheduleItem[]): { viewStartMin: number; viewEndMin: number } {
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
	const pad = 15;
	const viewStartMin = clamp(minStart - pad, 0, 1439);
	const viewEndMin = clamp(Math.max(maxEnd + pad, viewStartMin + 60), viewStartMin + 60, 1440);
	return { viewStartMin, viewEndMin };
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

/** Colors along an item's time span (splits if it crosses day periods). */
function itemBarSlices(
	item: ScheduleItem,
	periods: DayPeriodDefinition[],
): Array<{ weight: number; color: string; id: string }> {
	const start = itemStartMin(item);
	const duration = itemDurationMin(item);
	const end = Math.min(1440, start + duration);
	const enabled = periods.filter(p => p.enabled);
	const cuts = new Set<number>([start, end]);
	for (const period of enabled) {
		for (const seg of periodToSegments(period)) {
			if (seg.endMin > start && seg.startMin < end) {
				cuts.add(clamp(seg.startMin, start, end));
				cuts.add(clamp(seg.endMin, start, end));
			}
		}
	}
	const points = [...cuts].sort((a, b) => a - b);
	const slices: Array<{ weight: number; color: string; id: string }> = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		if (b <= a) {
			continue;
		}
		const mid = (a + b) / 2;
		slices.push({
			weight: b - a,
			color: periodColorAt(mid, periods),
			id: `${item.id}-${a}-${b}`,
		});
	}
	if (!slices.length) {
		slices.push({ weight: duration, color: periodColorAt(start, periods), id: `${item.id}-full` });
	}
	return slices;
}

function formatClock(minutes: number): string {
	const m = clamp(Math.round(minutes), 0, 1440);
	const hh = Math.floor(m / 60) % 24;
	const mm = m % 60;
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Row-aligned schedule: one continuous bar divided by pictogram count/duration;
 * time window and colors follow pictogram times and enabled day periods.
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
	const { viewStartMin, viewEndMin } = computeViewWindow(sorted);
	const viewSpan = Math.max(60, viewEndMin - viewStartMin);

	const usesArasaac = plan.items.some(item => item.source === "arasaac" && item.arasaacId);
	const attribution = locale.startsWith("de") ? ARASAAC_ATTRIBUTION_DE : ARASAAC_ATTRIBUTION_EN;
	const activePeriods = periods.filter(p => p.enabled);

	const totalWeight = sorted.reduce((sum, item) => sum + itemDurationMin(item), 0) || 1;
	const avgWeight = totalWeight / Math.max(1, sorted.length);

	let nowFrac: number | null = null;
	if (sorted.length && nowMinutes >= viewStartMin && nowMinutes < viewEndMin) {
		let acc = 0;
		for (const item of sorted) {
			const s = itemStartMin(item);
			const d = itemDurationMin(item);
			const e = s + d;
			if (nowMinutes >= s && nowMinutes < e) {
				nowFrac = (acc + (nowMinutes - s)) / totalWeight;
				break;
			}
			if (nowMinutes < s) {
				nowFrac = acc / totalWeight;
				break;
			}
			acc += d;
		}
		if (nowFrac == null && nowMinutes >= itemEndMin(sorted[sorted.length - 1])) {
			nowFrac = 1;
		}
	} else if (!sorted.length) {
		nowFrac = clamp((nowMinutes - viewStartMin) / viewSpan, 0, 1);
	}

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
				{/* Pictogram rows — flex share matches bar segments */}
				<div
					style={{
						flex: 1,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						gap: 6,
						minWidth: 0,
					}}
				>
					{sorted.length === 0 ? (
						<div style={{ opacity: 0.7, padding: 12 }}>—</div>
					) : (
						sorted.map((item, index) => {
							const originalIndex = plan.items.findIndex(p => p.id === item.id);
							const active = originalIndex === currentItemIndex;
							const img = resolveItemImageUrl(item, adapterInstance);
							const weight = itemDurationMin(item);
							const flexGrow = Math.max(0.4, weight / avgWeight);

							return (
								<div
									key={item.id || index}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										flex: `${flexGrow} 1 0`,
										minHeight: pictoPx + 16,
										padding: "6px 10px",
										borderRadius: 10,
										background: active ? "rgba(255,138,0,0.15)" : "rgba(0,0,0,0.04)",
										outline: active ? "2px solid #FF8A00" : "1px solid transparent",
										minWidth: 0,
									}}
								>
									<div
										style={{
											width: pictoPx,
											height: pictoPx,
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
										<div style={{ fontWeight: 700, fontSize: Math.max(14, pictoPx * 0.22) }}>
											{item.label || "—"}
										</div>
										<div style={{ fontSize: 13, opacity: 0.75 }}>
											{item.start} – {item.end}
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>

				{/* Continuous bar: one segment per pictogram, height ∝ duration */}
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
								display: "flex",
								flexDirection: "column",
								borderRadius: 10,
								overflow: "hidden",
								border: "1px solid #CFD8DC",
								position: "relative",
								background: "#ECEFF1",
								minHeight: 0,
							}}
						>
							{sorted.map((item, index) => {
								const weight = itemDurationMin(item);
								const flexGrow = Math.max(0.4, weight / avgWeight);
								const slices = itemBarSlices(item, periods);
								const sliceTotal = slices.reduce((s, x) => s + x.weight, 0) || 1;
								const isLast = index === sorted.length - 1;

								return (
									<div
										key={item.id || index}
										style={{
											flex: `${flexGrow} 1 0`,
											minHeight: 8,
											display: "flex",
											flexDirection: "column",
											borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.55)",
											boxSizing: "border-box",
										}}
										title={`${item.label || "—"} · ${item.start}–${item.end}`}
									>
										{slices.map(slice => (
											<div
												key={slice.id}
												style={{
													flex: `${slice.weight / sliceTotal} 1 0`,
													background: slice.color,
													minHeight: 2,
												}}
											/>
										))}
									</div>
								);
							})}

							{nowFrac != null && (
								<>
									<div
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											top: `${nowFrac * 100}%`,
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
											top: `calc(${nowFrac * 100}% - 7px)`,
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
