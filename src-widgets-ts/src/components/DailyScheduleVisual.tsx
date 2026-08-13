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

interface PeriodBlockLayout {
	id: string;
	periodId: string;
	color: string;
	startMin: number;
	endMin: number;
	topPx: number;
	heightPx: number;
	itemCount: number;
}

interface ItemPlacement {
	item: ScheduleItem;
	itemIndex: number;
	startMin: number;
	endMin: number;
	topPx: number;
	heightPx: number;
	lane: number;
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

function formatClock(minutes: number): string {
	const m = clamp(Math.round(minutes), 0, 1440);
	const hh = Math.floor(m / 60) % 24;
	const mm = m % 60;
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isNowInSegment(nowMinutes: number, segStart: number, segEnd: number): boolean {
	return nowMinutes >= segStart && nowMinutes < segEnd;
}

function countItemsInSegment(items: ScheduleItem[], segStart: number, segEnd: number): number {
	return items.reduce((count, item) => {
		const s = itemStartMin(item);
		const e = itemEndMin(item);
		return e > segStart && s < segEnd ? count + 1 : count;
	}, 0);
}

/** Map clock minutes onto stretched period blocks (clock-linear within each period). */
export function minutesToY(minutes: number, blocks: PeriodBlockLayout[]): number {
	if (!blocks.length) {
		return 0;
	}
	if (minutes <= blocks[0].startMin) {
		return blocks[0].topPx;
	}
	for (const block of blocks) {
		if (minutes <= block.endMin) {
			if (minutes >= block.startMin) {
				const span = Math.max(1, block.endMin - block.startMin);
				const frac = clamp((minutes - block.startMin) / span, 0, 1);
				return block.topPx + frac * block.heightPx;
			}
		}
	}
	const last = blocks[blocks.length - 1];
	return last.topPx + last.heightPx;
}

export function computeNowMarkerTop(
	blocks: PeriodBlockLayout[],
	nowMinutes: number,
): number | null {
	for (const block of blocks) {
		if (isNowInSegment(nowMinutes, block.startMin, block.endMin)) {
			return minutesToY(nowMinutes, blocks);
		}
	}
	return null;
}

/** Greedy lane packing for overlaps; at most 2 columns (extra overlaps share column 2). */
export function assignLanes(
	placements: Array<{ startMin: number; endMin: number }>,
	maxLanes = 2,
): number[] {
	const order = placements
		.map((p, index) => ({ index, startMin: p.startMin, endMin: p.endMin }))
		.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

	const laneEnds: number[] = [];
	const lanes = new Array(placements.length).fill(0);

	for (const entry of order) {
		let lane = 0;
		while (lane < maxLanes && lane < laneEnds.length && laneEnds[lane] > entry.startMin) {
			lane += 1;
		}
		if (lane >= maxLanes) {
			lane = maxLanes - 1;
			laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, entry.endMin);
		} else if (lane === laneEnds.length) {
			laneEnds.push(entry.endMin);
		} else {
			laneEnds[lane] = entry.endMin;
		}
		lanes[entry.index] = lane;
	}

	return lanes;
}

/**
 * Period blocks stretch by pictogram count; items are placed once across the full span.
 */
export function buildScheduleLayout(
	items: ScheduleItem[],
	periods: DayPeriodDefinition[],
	nowMinutes: number,
	pictoPx: number,
): { blocks: PeriodBlockLayout[]; placements: ItemPlacement[]; laneCount: number; totalHeight: number } {
	const enabled = periods.filter(p => p.enabled);
	const rowUnit = pictoPx + 24;
	const minPeriodH = Math.max(48, pictoPx + 8);
	const blocks: PeriodBlockLayout[] = [];
	let topPx = 0;

	for (const period of enabled) {
		for (const seg of periodToSegments(period)) {
			const itemCount = countItemsInSegment(items, seg.startMin, seg.endMin);
			const hasNow = isNowInSegment(nowMinutes, seg.startMin, seg.endMin);
			if (!itemCount && !hasNow) {
				continue;
			}

			// Stretch by count (not linear clock height between periods).
			const heightPx = Math.max(minPeriodH, Math.max(1, itemCount) * rowUnit);

			blocks.push({
				id: `${period.id}-${seg.startMin}`,
				periodId: period.id,
				color: period.color,
				startMin: seg.startMin,
				endMin: seg.endMin,
				topPx,
				heightPx,
				itemCount,
			});
			topPx += heightPx;
		}
	}

	const totalHeight = topPx;
	const indexed = items.map((item, itemIndex) => ({
		item,
		itemIndex,
		startMin: itemStartMin(item),
		endMin: itemEndMin(item),
	}));

	const visible = indexed.filter(entry => {
		if (!blocks.length) {
			return false;
		}
		const viewStart = blocks[0].startMin;
		const viewEnd = blocks[blocks.length - 1].endMin;
		return entry.endMin > viewStart && entry.startMin < viewEnd;
	});

	const laneAssignments = assignLanes(visible);
	const laneCount = laneAssignments.length
		? Math.max(...laneAssignments) + 1
		: 1;

	const placements: ItemPlacement[] = visible.map((entry, i) => {
		const top = minutesToY(entry.startMin, blocks);
		const bottom = minutesToY(entry.endMin, blocks);
		return {
			...entry,
			topPx: top,
			heightPx: Math.max(pictoPx * 0.55, bottom - top),
			lane: laneAssignments[i] ?? 0,
		};
	});

	return { blocks, placements, laneCount, totalHeight };
}

function renderItemCard(
	placement: ItemPlacement,
	laneCount: number,
	currentItemIndex: number,
	adapterInstance: string,
	pictoPx: number,
): React.JSX.Element {
	const { item, itemIndex, topPx, heightPx, lane } = placement;
	const active = itemIndex === currentItemIndex;
	const img = resolveItemImageUrl(item, adapterInstance);
	const slotPicto = Math.min(pictoPx, Math.max(28, Math.min(pictoPx, heightPx - 10)));
	const widthPct = 100 / laneCount;
	const leftPct = lane * widthPct;

	return (
		<div
			style={{
				position: "absolute",
				top: topPx,
				left: `calc(${leftPct}% + 2px)`,
				width: `calc(${widthPct}% - 4px)`,
				height: heightPx,
				boxSizing: "border-box",
				borderRadius: 10,
				border: active ? "2px solid #FF8A00" : "1.5px solid rgba(0,0,0,0.28)",
				background: active ? "rgba(255,138,0,0.12)" : "rgba(255,255,255,0.55)",
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "4px 8px",
				overflow: "hidden",
				zIndex: active ? 2 : 1,
			}}
			title={`${item.label || "—"} · ${item.start} – ${item.end}`}
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
						fontSize: Math.max(12, Math.min(16, slotPicto * 0.22)),
						lineHeight: 1.2,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{item.label || "—"}
				</div>
				<div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.2 }}>
					{item.start} – {item.end}
				</div>
			</div>
		</div>
	);
}

/**
 * Stretched period bar + single pictogram cards (border spans full time; overlaps use a 2nd column).
 * Pictograms and bar share one scroll container.
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
	const { blocks, placements, laneCount, totalHeight } = buildScheduleLayout(
		sorted,
		periods,
		nowMinutes,
		pictoPx,
	);
	const nowTop = computeNowMarkerTop(blocks, nowMinutes);

	const usesArasaac = plan.items.some(item => item.source === "arasaac" && item.arasaacId);
	const attribution = locale.startsWith("de") ? ARASAAC_ATTRIBUTION_DE : ARASAAC_ATTRIBUTION_EN;
	const activePeriods = periods.filter(p => p.enabled);

	const viewStartMin = blocks.length ? blocks[0].startMin : 0;
	const viewEndMin = blocks.length ? blocks[blocks.length - 1].endMin : 1440;

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
			{/* Single scroll: pictograms + bar move together */}
			<div
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: "auto",
					overflowX: "hidden",
				}}
			>
				{blocks.length === 0 ? (
					<div style={{ opacity: 0.7, padding: 12 }}>—</div>
				) : (
					<div style={{ display: "flex", gap: 10, height: totalHeight }}>
						<div
							style={{
								flex: 1,
								position: "relative",
								height: totalHeight,
								minWidth: 0,
							}}
						>
							{placements.map(placement => (
								<React.Fragment key={placement.item.id || placement.itemIndex}>
									{renderItemCard(
										placement,
										laneCount,
										currentItemIndex,
										adapterInstance,
										pictoPx,
									)}
								</React.Fragment>
							))}
						</div>

						<div
							style={{
								flex: "0 0 88px",
								width: 88,
								position: "relative",
								height: totalHeight,
								borderRadius: 10,
								overflow: "hidden",
								border: "1px solid #CFD8DC",
								background: "#ECEFF1",
							}}
							title={`${formatClock(viewStartMin)} – ${formatClock(viewEndMin)}`}
						>
							{blocks.map((block, index) => (
								<div
									key={block.id}
									style={{
										position: "absolute",
										left: 0,
										right: 0,
										top: block.topPx,
										height: block.heightPx,
										background: block.color,
										boxSizing: "border-box",
										borderBottom:
											index < blocks.length - 1
												? "1px solid rgba(255,255,255,0.55)"
												: "none",
									}}
									title={`${periodLabel(block.periodId, locale)} · ${formatClock(block.startMin)} – ${formatClock(block.endMin)}`}
								/>
							))}

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
				)}
			</div>

			<div style={{ fontSize: 11, opacity: 0.7 }}>
				{locale.startsWith("de")
					? `${sorted.length} Piktogramm${sorted.length === 1 ? "" : "e"} · ${blocks.length} Tagesbereich${blocks.length === 1 ? "" : "e"}${laneCount > 1 ? " · 2 Spalten" : ""}`
					: `${sorted.length} pictogram${sorted.length === 1 ? "" : "s"} · ${blocks.length} day period${blocks.length === 1 ? "" : "s"}${laneCount > 1 ? " · 2 columns" : ""}`}
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
