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

interface ItemClip {
	item: ScheduleItem;
	itemIndex: number;
	startMin: number;
	endMin: number;
}

interface LayoutRow {
	kind: "item" | "gap";
	startMin: number;
	endMin: number;
	topPx: number;
	heightPx: number;
	clip?: ItemClip;
}

interface PeriodBlockLayout {
	id: string;
	periodId: string;
	color: string;
	startMin: number;
	endMin: number;
	topPx: number;
	heightPx: number;
	rows: LayoutRow[];
}

const PERIOD_BLOCK_GAP_PX = 4;

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

function getClipsInSegment(
	items: ScheduleItem[],
	segStart: number,
	segEnd: number,
): ItemClip[] {
	const clips: ItemClip[] = [];
	items.forEach((item, itemIndex) => {
		const itemStart = itemStartMin(item);
		const itemEnd = itemEndMin(item);
		const clipStart = Math.max(itemStart, segStart);
		const clipEnd = Math.min(itemEnd, segEnd);
		if (clipEnd > clipStart) {
			clips.push({ item, itemIndex, startMin: clipStart, endMin: clipEnd });
		}
	});
	return clips.sort((a, b) => a.startMin - b.startMin);
}

function isNowInSegment(nowMinutes: number, segStart: number, segEnd: number): boolean {
	return nowMinutes >= segStart && nowMinutes < segEnd;
}

/** Build ordered item + gap slots inside a period segment (gaps include tail until period end). */
function buildSegmentSlots(
	clips: ItemClip[],
	segStart: number,
	segEnd: number,
): Array<{ kind: "item" | "gap"; startMin: number; endMin: number; clip?: ItemClip }> {
	if (!clips.length) {
		return [{ kind: "gap", startMin: segStart, endMin: segEnd }];
	}

	const slots: Array<{ kind: "item" | "gap"; startMin: number; endMin: number; clip?: ItemClip }> =
		[];
	let cursor = segStart;

	for (const clip of clips) {
		if (clip.startMin > cursor) {
			slots.push({ kind: "gap", startMin: cursor, endMin: clip.startMin });
		}
		slots.push({
			kind: "item",
			startMin: clip.startMin,
			endMin: clip.endMin,
			clip,
		});
		cursor = Math.max(cursor, clip.endMin);
	}

	if (cursor < segEnd) {
		slots.push({ kind: "gap", startMin: cursor, endMin: segEnd });
	}

	return slots;
}

/**
 * Period blocks stretch with pictogram count and gaps; only the now marker
 * uses real clock position within each period segment.
 */
export function buildPeriodBlockLayout(
	items: ScheduleItem[],
	periods: DayPeriodDefinition[],
	nowMinutes: number,
	pictoPx: number,
): PeriodBlockLayout[] {
	const enabled = periods.filter(p => p.enabled);
	const minItemH = pictoPx + 16;
	const minGapH = 10;
	const pxPerMin = 1.8;
	const blocks: PeriodBlockLayout[] = [];
	let topPx = 0;

	for (const period of enabled) {
		for (const seg of periodToSegments(period)) {
			const clips = getClipsInSegment(items, seg.startMin, seg.endMin);
			const hasNow = isNowInSegment(nowMinutes, seg.startMin, seg.endMin);
			if (!clips.length && !hasNow) {
				continue;
			}

			const slotDefs = buildSegmentSlots(clips, seg.startMin, seg.endMin);
			const weights = slotDefs.map(slot => {
				const duration = Math.max(1, slot.endMin - slot.startMin);
				if (slot.kind === "item") {
					return Math.max(minItemH, duration * pxPerMin);
				}
				return Math.max(minGapH, duration * pxPerMin);
			});
			const blockHeight = weights.reduce((sum, w) => sum + w, 0) || minItemH;

			let rowTop = 0;
			const rows: LayoutRow[] = slotDefs.map((slot, index) => {
				const row: LayoutRow = {
					kind: slot.kind,
					startMin: slot.startMin,
					endMin: slot.endMin,
					topPx: rowTop,
					heightPx: weights[index],
					clip: slot.clip,
				};
				rowTop += weights[index];
				return row;
			});

			blocks.push({
				id: `${period.id}-${seg.startMin}`,
				periodId: period.id,
				color: period.color,
				startMin: seg.startMin,
				endMin: seg.endMin,
				topPx,
				heightPx: blockHeight,
				rows,
			});
			topPx += blockHeight + PERIOD_BLOCK_GAP_PX;
		}
	}

	return blocks;
}

/** Real-clock position of the now marker within stretched period blocks. */
export function computeNowMarkerTop(
	blocks: PeriodBlockLayout[],
	nowMinutes: number,
): number | null {
	for (const block of blocks) {
		if (isNowInSegment(nowMinutes, block.startMin, block.endMin)) {
			const span = Math.max(1, block.endMin - block.startMin);
			const frac = clamp((nowMinutes - block.startMin) / span, 0, 1);
			return block.topPx + frac * block.heightPx;
		}
	}
	return null;
}

function renderPictogramRow(
	row: LayoutRow,
	currentItemIndex: number,
	adapterInstance: string,
	pictoPx: number,
): React.JSX.Element | null {
	if (row.kind !== "item" || !row.clip) {
		return null;
	}

	const { item, itemIndex } = row.clip;
	const active = itemIndex === currentItemIndex;
	const img = resolveItemImageUrl(item, adapterInstance);
	const slotPicto = Math.min(pictoPx, Math.max(28, row.heightPx - 12));

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				top: row.topPx,
				height: row.heightPx,
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
}

/**
 * Stretched period blocks (by pictogram count); now marker is clock-accurate inside each period.
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
	const blocks = buildPeriodBlockLayout(sorted, periods, nowMinutes, pictoPx);
	const totalHeight =
		blocks.length > 0
			? blocks[blocks.length - 1].topPx + blocks[blocks.length - 1].heightPx
			: 0;
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
			<div
				style={{
					display: "flex",
					gap: 10,
					flex: 1,
					minHeight: 0,
					alignItems: "stretch",
				}}
			>
				<div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
					{blocks.length === 0 ? (
						<div style={{ opacity: 0.7, padding: 12 }}>—</div>
					) : (
						<div style={{ position: "relative", height: totalHeight, minHeight: "100%" }}>
							{blocks.map(block => (
								<div
									key={block.id}
									style={{
										position: "absolute",
										left: 0,
										right: 0,
										top: block.topPx,
										height: block.heightPx,
									}}
								>
									{block.rows.map(row =>
										row.kind === "item" ? (
											<React.Fragment key={`${block.id}-item-${row.clip?.item.id}-${row.startMin}`}>
												{renderPictogramRow(
													row,
													currentItemIndex,
													adapterInstance,
													pictoPx,
												)}
											</React.Fragment>
										) : null,
									)}
								</div>
							))}
						</div>
					)}
				</div>

				{blocks.length > 0 && (
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
						<div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
							<div
								style={{
									position: "relative",
									height: totalHeight,
									borderRadius: 10,
									overflow: "hidden",
									border: "1px solid #CFD8DC",
									background: "#ECEFF1",
								}}
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
													? "1px solid rgba(255,255,255,0.45)"
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
						<div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: "center" }}>
							{formatClock(viewEndMin)}
						</div>
					</div>
				)}
			</div>

			<div style={{ fontSize: 11, opacity: 0.7 }}>
				{locale.startsWith("de")
					? `${sorted.length} Piktogramm${sorted.length === 1 ? "" : "e"} · ${blocks.length} Tagesbereich${blocks.length === 1 ? "" : "e"}`
					: `${sorted.length} pictogram${sorted.length === 1 ? "" : "s"} · ${blocks.length} day period${blocks.length === 1 ? "" : "s"}`}
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
