import React from "react";
import { ARASAAC_ATTRIBUTION_DE, ARASAAC_ATTRIBUTION_EN } from "../lib/arasaac";
import {
	type DayPeriodDefinition,
	type ScheduleItem,
	type SchedulePlan,
	parseTimeToMinutes,
	resolveItemImageUrl,
	isItemActiveAt,
} from "../lib/schedule";
import PeriodIcon from "./PeriodIcon";
import VisFileImage from "./VisFileImage";

export interface DailyScheduleVisualProps {
	plan: SchedulePlan;
	periods: DayPeriodDefinition[];
	nowMinutes: number;
	adapterInstance?: string;
	locale?: string;
	/** Pictogram display size in px (default 64). */
	pictogramSize?: number;
}

interface PeriodBlockLayout {
	id: string;
	periodId: string;
	color: string;
	enabled: boolean;
	startMin: number;
	endMin: number;
	topPx: number;
	heightPx: number;
	itemCount: number;
	/** Piecewise clock→Y map: empty head/tail compressed, content linear. */
	zones: Array<{ startMin: number; endMin: number; topPx: number; heightPx: number }>;
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

const DISABLED_PERIOD_COLOR = "#ECEFF1";
const ITEM_FRAME_PAD = 16;
/** Title + time above the pictogram. */
const LABEL_BLOCK_PX = 42;

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

/**
 * Compress empty lead/trail minutes so the bar barely extends past pictograms.
 * Edge of day (first/last period) compresses more aggressively.
 */
export function compressEmptyHeight(minutes: number, edge: boolean, minItemH: number): number {
	if (minutes <= 0) {
		return 0;
	}
	const scale = edge ? 10 : 16;
	const ref = edge ? 15 : 25;
	const raw = scale * Math.log2(1 + minutes / ref);
	const cap = edge ? minItemH * 0.55 : minItemH * 0.9;
	return Math.min(cap, Math.max(edge ? 6 : 8, raw));
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

/** Segments ignoring the period.enabled flag (caller decides visibility). */
function periodSegmentsRaw(period: DayPeriodDefinition): Array<{ startMin: number; endMin: number }> {
	const s = parseTimeToMinutes(period.start);
	const e = parseTimeToMinutes(period.end);
	if (s === e) {
		return [{ startMin: 0, endMin: 1440 }];
	}
	if (s < e) {
		return [{ startMin: s, endMin: e }];
	}
	return [
		{ startMin: s, endMin: 1440 },
		{ startMin: 0, endMin: e },
	];
}

function clipsInSegment(
	items: ScheduleItem[],
	segStart: number,
	segEnd: number,
): Array<{ startMin: number; endMin: number }> {
	const clips: Array<{ startMin: number; endMin: number }> = [];
	for (const item of items) {
		const s = itemStartMin(item);
		const e = itemEndMin(item);
		const clipStart = Math.max(s, segStart);
		const clipEnd = Math.min(e, segEnd);
		if (clipEnd > clipStart) {
			clips.push({ startMin: clipStart, endMin: clipEnd });
		}
	}
	return clips;
}

/** Map clock minutes onto piecewise period zones. */
export function minutesToY(minutes: number, blocks: PeriodBlockLayout[]): number {
	if (!blocks.length) {
		return 0;
	}
	if (minutes <= blocks[0].startMin) {
		return blocks[0].topPx;
	}
	for (const block of blocks) {
		if (minutes < block.startMin || minutes > block.endMin) {
			continue;
		}
		if (!block.zones.length) {
			const span = Math.max(1, block.endMin - block.startMin);
			const frac = clamp((minutes - block.startMin) / span, 0, 1);
			return block.topPx + frac * block.heightPx;
		}
		for (const zone of block.zones) {
			if (minutes <= zone.endMin && minutes >= zone.startMin) {
				const span = Math.max(1, zone.endMin - zone.startMin);
				const frac = clamp((minutes - zone.startMin) / span, 0, 1);
				return zone.topPx + frac * zone.heightPx;
			}
		}
		// Exact end of block
		if (minutes === block.endMin) {
			const last = block.zones[block.zones.length - 1];
			return last.topPx + last.heightPx;
		}
	}
	const last = blocks[blocks.length - 1];
	return last.topPx + last.heightPx;
}

export function computeNowMarkerTop(blocks: PeriodBlockLayout[], nowMinutes: number): number | null {
	for (const block of blocks) {
		if (isNowInSegment(nowMinutes, block.startMin, block.endMin)) {
			return minutesToY(nowMinutes, blocks);
		}
	}
	return null;
}

/** Greedy lane packing for overlaps; at most 3 nested columns. */
export function assignLanes(placements: Array<{ startMin: number; endMin: number }>, maxLanes = 3): number[] {
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

type DraftBlock = {
	period: DayPeriodDefinition;
	segStart: number;
	segEnd: number;
	clips: Array<{ startMin: number; endMin: number }>;
	hasNow: boolean;
};

/**
 * Period content stays linear (pictogram-sized); empty lead/trail is log-compressed
 * so the bar does not extend far past the first/last pictogram.
 */
export function buildScheduleLayout(
	items: ScheduleItem[],
	periods: DayPeriodDefinition[],
	nowMinutes: number,
	pictoPx: number,
): { blocks: PeriodBlockLayout[]; placements: ItemPlacement[]; laneCount: number; totalHeight: number } {
	const minItemH = pictoPx + ITEM_FRAME_PAD + LABEL_BLOCK_PX;
	const minPeriodH = minItemH;
	const drafts: DraftBlock[] = [];

	for (const period of periods) {
		for (const seg of periodSegmentsRaw(period)) {
			const clips = clipsInSegment(items, seg.startMin, seg.endMin);
			const hasNow = isNowInSegment(nowMinutes, seg.startMin, seg.endMin);
			if (!clips.length && !hasNow) {
				continue;
			}
			drafts.push({
				period,
				segStart: seg.startMin,
				segEnd: seg.endMin,
				clips,
				hasNow,
			});
		}
	}

	const blocks: PeriodBlockLayout[] = [];
	let topPx = 0;

	drafts.forEach((draft, draftIndex) => {
		const isFirst = draftIndex === 0;
		const isLast = draftIndex === drafts.length - 1;
		const { period, segStart, segEnd, clips, hasNow } = draft;

		let zones: PeriodBlockLayout["zones"] = [];
		let heightPx = minPeriodH;

		if (!clips.length) {
			heightPx = minPeriodH;
			zones = [{ startMin: segStart, endMin: segEnd, topPx, heightPx }];
		} else {
			const contentStart = Math.min(...clips.map(c => c.startMin));
			const contentEnd = Math.max(...clips.map(c => c.endMin));
			const contentDur = Math.max(1, contentEnd - contentStart);
			const headDur = Math.max(0, contentStart - segStart);
			const tailDur = Math.max(0, segEnd - contentEnd);

			let contentH = clips.length * minItemH;
			for (const clip of clips) {
				const dur = Math.max(1, clip.endMin - clip.startMin);
				// Size from content window only (not full period incl. empty margins).
				contentH = Math.max(contentH, (minItemH * contentDur) / dur);
			}

			const headH = compressEmptyHeight(headDur, isFirst, minItemH);
			const tailH = compressEmptyHeight(tailDur, isLast, minItemH);
			heightPx = Math.max(minPeriodH, headH + contentH + tailH);

			let y = topPx;
			if (headH > 0 && headDur > 0) {
				zones.push({ startMin: segStart, endMin: contentStart, topPx: y, heightPx: headH });
				y += headH;
			}
			zones.push({
				startMin: contentStart,
				endMin: contentEnd,
				topPx: y,
				heightPx: contentH,
			});
			y += contentH;
			if (tailH > 0 && tailDur > 0) {
				zones.push({ startMin: contentEnd, endMin: segEnd, topPx: y, heightPx: tailH });
			}
		}

		blocks.push({
			id: `${period.id}-${segStart}`,
			periodId: period.id,
			color: period.enabled ? period.color : DISABLED_PERIOD_COLOR,
			enabled: period.enabled,
			startMin: segStart,
			endMin: segEnd,
			topPx,
			heightPx,
			itemCount: clips.length,
			zones,
		});
		topPx += heightPx;
	});

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
	const laneCount = laneAssignments.length ? Math.max(...laneAssignments) + 1 : 1;

	const placements: ItemPlacement[] = visible.map((entry, i) => {
		const top = minutesToY(entry.startMin, blocks);
		const bottom = minutesToY(entry.endMin, blocks);
		return {
			...entry,
			topPx: top,
			heightPx: Math.max(minItemH, bottom - top),
			lane: laneAssignments[i] ?? 0,
		};
	});

	return { blocks, placements, laneCount, totalHeight };
}

function renderItemCard(
	placement: ItemPlacement,
	_laneCount: number,
	nowMinutes: number,
	adapterInstance: string,
	pictoPx: number,
): React.JSX.Element {
	const { item, topPx, heightPx, lane } = placement;
	const active = isItemActiveAt(item, nowMinutes);
	const img = resolveItemImageUrl(item, adapterInstance);
	const inset = 2;
	// Each further lane starts after the previous pictogram so images never overlap,
	// but frames still reach the time bar (nested columns).
	const leftPx = inset + lane * (pictoPx + 12);
	const zIndex = (lane + 1) * 4 + (active ? 2 : 0);

	return (
		<div
			style={{
				position: "absolute",
				top: topPx,
				left: leftPx,
				right: inset,
				height: heightPx,
				boxSizing: "border-box",
				borderRadius: 10,
				border: active ? "2px solid #FF8A00" : "1.5px solid rgba(255,255,255,0.35)",
				background: active ? "rgba(255,138,0,0.16)" : "rgba(0,0,0,0.28)",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				gap: 4,
				padding: "6px 8px 8px",
				overflow: "hidden",
				zIndex,
			}}
			title={`${item.label || "—"} · ${item.start} – ${item.end}`}
		>
			<div style={{ width: "100%", textAlign: "left", flexShrink: 0 }}>
				<div
					style={{
						fontWeight: 700,
						fontSize: Math.max(12, Math.min(16, pictoPx * 0.2)),
						lineHeight: 1.15,
						overflow: "hidden",
						display: "-webkit-box",
						WebkitLineClamp: 2,
						WebkitBoxOrient: "vertical" as const,
					}}
				>
					{item.label || "—"}
				</div>
				<div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.2 }}>
					{item.start} – {item.end}
				</div>
			</div>
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
					<VisFileImage
						src={img}
						alt=""
						style={{ width: "100%", height: "100%", objectFit: "contain" }}
						referrerPolicy="no-referrer"
					/>
				) : (
					<span style={{ fontSize: 12, opacity: 0.5 }}>?</span>
				)}
			</div>
		</div>
	);
}

/**
 * Stretched period bar + fixed-size pictograms; overlaps use up to 3 nested columns.
 * Pictograms and bar share one scroll container.
 */
export default function DailyScheduleVisual({
	plan,
	periods,
	nowMinutes,
	adapterInstance = "autism-support.0",
	locale = "de",
	pictogramSize = 64,
}: DailyScheduleVisualProps): React.JSX.Element {
	const pictoPx = Math.max(32, Math.min(200, Number(pictogramSize) || 64));
	const sorted = [...plan.items].sort((a, b) => itemStartMin(a) - itemStartMin(b));
	const { blocks, placements, laneCount, totalHeight } = buildScheduleLayout(sorted, periods, nowMinutes, pictoPx);
	const nowTop = computeNowMarkerTop(blocks, nowMinutes);

	const usesArasaac = plan.items.some(item => item.source === "arasaac" && item.arasaacId);
	const attribution = locale.startsWith("de") ? ARASAAC_ATTRIBUTION_DE : ARASAAC_ATTRIBUTION_EN;
	const activePeriods = periods.filter(p => p.enabled);
	const barBlocks = blocks.filter(b => b.enabled);

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
					flex: 1,
					minHeight: 0,
					overflowY: "auto",
					overflowX: "hidden",
				}}
			>
				{blocks.length === 0 ? (
					<div style={{ opacity: 0.7, padding: 12 }}>—</div>
				) : (
					<div style={{ display: "flex", gap: 4, height: totalHeight }}>
						<div
							style={{
								flex: 1,
								position: "relative",
								height: totalHeight,
								minWidth: pictoPx * Math.max(1, laneCount) + (Math.max(1, laneCount) - 1) * 12 + 36,
							}}
						>
							{placements.map(placement => (
								<React.Fragment key={placement.item.id || placement.itemIndex}>
									{renderItemCard(placement, laneCount, nowMinutes, adapterInstance, pictoPx)}
								</React.Fragment>
							))}
						</div>

						<div
							style={{
								flex: "0 0 96px",
								width: 96,
								position: "relative",
								height: totalHeight,
								borderRadius: 10,
								overflow: "hidden",
								border: "1px solid #CFD8DC",
								background: "#ECEFF1",
							}}
							title={`${formatClock(viewStartMin)} – ${formatClock(viewEndMin)}`}
						>
							{/* Full stack keeps Y alignment; only enabled periods show their color */}
							{blocks.map((block, index) => {
								const iconSize = Math.min(64, Math.max(0, block.heightPx - 8));
								return (
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
												index < blocks.length - 1 ? "1px solid rgba(255,255,255,0.55)" : "none",
											opacity: block.enabled ? 1 : 0.35,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
										title={
											block.enabled
												? `${periodLabel(block.periodId, locale)} · ${formatClock(block.startMin)} – ${formatClock(block.endMin)}`
												: `${periodLabel(block.periodId, locale)} (${locale.startsWith("de") ? "aus" : "off"})`
										}
									>
										<PeriodIcon
											periodId={block.periodId}
											size={iconSize}
											alt={periodLabel(block.periodId, locale)}
										/>
									</div>
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
				)}
			</div>

			<div style={{ fontSize: 11, opacity: 0.7 }}>
				{locale.startsWith("de")
					? `${sorted.length} Piktogramm${sorted.length === 1 ? "" : "e"} · ${barBlocks.length} Tagesbereich${barBlocks.length === 1 ? "" : "e"}${laneCount > 1 ? ` · ${laneCount} Spalten` : ""}`
					: `${sorted.length} pictogram${sorted.length === 1 ? "" : "s"} · ${barBlocks.length} day period${barBlocks.length === 1 ? "" : "s"}${laneCount > 1 ? ` · ${laneCount} columns` : ""}`}
			</div>

			<div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
				{activePeriods.map(p => (
					<span
						key={p.id}
						style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
					>
						<PeriodIcon
							periodId={p.id}
							size={18}
							alt=""
						/>
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

			{usesArasaac && <div style={{ fontSize: 10, lineHeight: 1.35, opacity: 0.75 }}>{attribution}</div>}
		</div>
	);
}
