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
	/** Visible window start (minutes), default 0 */
	viewStartMin?: number;
	/** Visible window end (minutes), default 1440 */
	viewEndMin?: number;
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

function itemDurationMin(item: ScheduleItem): number {
	const s = parseTimeToMinutes(item.start);
	const e = parseTimeToMinutes(item.end);
	if (e > s) {
		return e - s;
	}
	if (e < s) {
		return 1440 - s + e;
	}
	return 30;
}

export default function DailyScheduleVisual({
	plan,
	periods,
	nowMinutes,
	currentItemIndex,
	adapterInstance = "autism-support.0",
	locale = "de",
	viewStartMin = 0,
	viewEndMin = 1440,
}: DailyScheduleVisualProps): React.JSX.Element {
	const span = Math.max(60, viewEndMin - viewStartMin);
	const nowPct = clamp(((nowMinutes - viewStartMin) / span) * 100, 0, 100);
	const sorted = [...plan.items].sort(
		(a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start),
	);
	const usesArasaac = plan.items.some(item => item.source === "arasaac" && item.arasaacId);
	const attribution = locale.startsWith("de") ? ARASAAC_ATTRIBUTION_DE : ARASAAC_ATTRIBUTION_EN;

	const segments = periods.flatMap(periodToSegments).filter(seg => {
		return seg.endMin > viewStartMin && seg.startMin < viewEndMin;
	});

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
			<div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
				{/* Pictogram column */}
				<div
					style={{
						flex: "1 1 58%",
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						gap: 8,
					}}
				>
					{sorted.length === 0 ? (
						<div style={{ opacity: 0.7, padding: 12 }}>—</div>
					) : (
						sorted.map((item, index) => {
							const originalIndex = plan.items.findIndex(p => p.id === item.id);
							const active = originalIndex === currentItemIndex;
							const img = resolveItemImageUrl(item, adapterInstance);
							const height = Math.max(56, Math.min(120, itemDurationMin(item) * 0.9));
							return (
								<div
									key={item.id || index}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										minHeight: height,
										padding: "6px 10px",
										borderRadius: 10,
										background: active ? "rgba(255,138,0,0.15)" : "rgba(0,0,0,0.04)",
										outline: active ? "2px solid #FF8A00" : "1px solid transparent",
									}}
								>
									<div
										style={{
											width: 64,
											height: 64,
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
												alt={item.label || "pictogram"}
												style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
												referrerPolicy="no-referrer"
											/>
										) : (
											<span style={{ fontSize: 12, opacity: 0.5 }}>?</span>
										)}
									</div>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontWeight: 700, fontSize: 16 }}>{item.label || "—"}</div>
										<div style={{ fontSize: 13, opacity: 0.75 }}>
											{item.start} – {item.end}
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>

				{/* Time bar */}
				<div
					style={{
						flex: "0 0 28%",
						minWidth: 72,
						maxWidth: 140,
						position: "relative",
						borderRadius: 10,
						overflow: "hidden",
						background: "#ECEFF1",
						border: "1px solid #CFD8DC",
					}}
				>
					{segments.map((seg, i) => {
						const top = ((Math.max(seg.startMin, viewStartMin) - viewStartMin) / span) * 100;
						const bottom = ((Math.min(seg.endMin, viewEndMin) - viewStartMin) / span) * 100;
						const height = Math.max(0, bottom - top);
						return (
							<div
								key={`${seg.id}-${i}`}
								title={seg.id}
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									top: `${top}%`,
									height: `${height}%`,
									background: seg.color,
									opacity: 0.92,
								}}
							/>
						);
					})}

					{/* Item markers on the bar */}
					{sorted.map(item => {
						const s = parseTimeToMinutes(item.start);
						const e = parseTimeToMinutes(item.end);
						const start = s < e ? s : s;
						const end = s < e ? e : s + itemDurationMin(item);
						const top = ((clamp(start, viewStartMin, viewEndMin) - viewStartMin) / span) * 100;
						const height =
							((clamp(end, viewStartMin, viewEndMin) - clamp(start, viewStartMin, viewEndMin)) /
								span) *
							100;
						return (
							<div
								key={`mark-${item.id}`}
								style={{
									position: "absolute",
									left: 8,
									right: 8,
									top: `${top}%`,
									height: `${Math.max(2, height)}%`,
									borderRadius: 4,
									background: "rgba(0,0,0,0.22)",
									pointerEvents: "none",
								}}
							/>
						);
					})}

					{/* Now indicator */}
					<div
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							top: `${nowPct}%`,
							height: 3,
							background: "#D32F2F",
							boxShadow: "0 0 0 1px rgba(255,255,255,0.8)",
							zIndex: 2,
						}}
					/>
					<div
						style={{
							position: "absolute",
							right: 4,
							top: `calc(${nowPct}% - 7px)`,
							width: 14,
							height: 14,
							borderRadius: "50%",
							background: "#D32F2F",
							border: "2px solid #fff",
							zIndex: 3,
						}}
					/>
				</div>
			</div>

			{/* Period legend */}
			<div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
				{periods
					.filter(p => p.enabled)
					.map(p => (
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
