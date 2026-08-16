import { arasaacImageUrl } from "./arasaac";

export type DayPeriodId = "morning" | "forenoon" | "noon" | "afternoon" | "evening" | "night";

export interface DayPeriodDefinition {
	id: DayPeriodId;
	enabled: boolean;
	start: string;
	end: string;
	color: string;
}

export type PictogramSource = "arasaac" | "custom";

export interface ScheduleItem {
	id: string;
	label: string;
	start: string;
	end: string;
	source: PictogramSource;
	arasaacId?: number;
	customRef?: string;
}

export interface SchedulePlan {
	version: 1;
	items: ScheduleItem[];
}

export const DEFAULT_DAY_PERIODS: DayPeriodDefinition[] = [
	{ id: "morning", enabled: true, start: "06:00", end: "09:00", color: "#FFE082" },
	{ id: "forenoon", enabled: true, start: "09:00", end: "12:00", color: "#FFCC80" },
	{ id: "noon", enabled: true, start: "12:00", end: "14:00", color: "#FFAB91" },
	{ id: "afternoon", enabled: true, start: "14:00", end: "17:00", color: "#81C784" },
	{ id: "evening", enabled: true, start: "17:00", end: "21:00", color: "#7986CB" },
	{ id: "night", enabled: true, start: "21:00", end: "06:00", color: "#5C6BC0" },
];

export function parseTimeToMinutes(value: string): number {
	const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
	if (!match) {
		return 0;
	}
	const h = Math.min(23, Math.max(0, Number(match[1])));
	const m = Math.min(59, Math.max(0, Number(match[2])));
	return h * 60 + m;
}

/** Format minutes-of-day as HH:MM (wraps at 24h). */
export function minutesToClock(totalMinutes: number): string {
	const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
	const hh = Math.floor(m / 60);
	const mm = m % 60;
	return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Duration in minutes; overnight supported. Empty/zero range → 60. */
export function scheduleItemDurationMin(item: Pick<ScheduleItem, "start" | "end">): number {
	const s = parseTimeToMinutes(item.start);
	const e = parseTimeToMinutes(item.end);
	if (e > s) {
		return Math.max(1, e - s);
	}
	if (e < s) {
		return Math.max(1, 1440 - s + e);
	}
	return 60;
}

/** Max nested columns for overlapping pictograms. */
export const MAX_PARALLEL_SCHEDULE_ITEMS = 3;

/**
 * Half-open interval overlap on a linear day timeline.
 * Overnight items are split into [start,1440) and [0,end).
 */
export function scheduleRangesOverlap(
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number,
): boolean {
	const expand = (s: number, e: number): Array<{ s: number; e: number }> => {
		if (s === e) {
			return [];
		}
		if (s < e) {
			return [{ s, e }];
		}
		return [
			{ s, e: 1440 },
			{ s: 0, e },
		];
	};
	for (const a of expand(aStart, aEnd)) {
		for (const b of expand(bStart, bEnd)) {
			if (a.s < b.e && b.s < a.e) {
				return true;
			}
		}
	}
	return false;
}

export function countItemsOverlappingRange(
	items: ScheduleItem[],
	start: string,
	end: string,
): number {
	const s = parseTimeToMinutes(start);
	const e = parseTimeToMinutes(end);
	return items.filter(item =>
		scheduleRangesOverlap(s, e, parseTimeToMinutes(item.start), parseTimeToMinutes(item.end)),
	).length;
}

/** True when duplicating `item` would stay within the parallel-column limit. */
export function canDuplicateScheduleItem(items: ScheduleItem[], item: ScheduleItem): boolean {
	return countItemsOverlappingRange(items, item.start, item.end) < MAX_PARALLEL_SCHEDULE_ITEMS;
}

/** New empty item starting where `anchor` ends (same duration). */
export function createScheduleItemAfter(anchor: ScheduleItem | null | undefined): ScheduleItem {
	if (!anchor) {
		return {
			id: `item-${Date.now()}`,
			label: "",
			start: "08:00",
			end: "09:00",
			source: "arasaac",
			arasaacId: undefined,
			customRef: "",
		};
	}
	const duration = scheduleItemDurationMin(anchor);
	const startMin = parseTimeToMinutes(anchor.end);
	return {
		id: `item-${Date.now()}`,
		label: "",
		start: minutesToClock(startMin),
		end: minutesToClock(startMin + duration),
		source: "arasaac",
		arasaacId: undefined,
		customRef: "",
	};
}

/** Deep-ish copy of an item with a new id (same time window and pictogram). */
export function duplicateScheduleItem(item: ScheduleItem): ScheduleItem {
	return {
		...item,
		id: `item-${Date.now()}`,
		label: item.label,
		start: item.start,
		end: item.end,
		source: item.source,
		arasaacId: item.arasaacId,
		customRef: item.customRef,
	};
}

/** True when clock time falls inside the item's [start, end) window (supports overnight). */
export function isItemActiveAt(item: ScheduleItem, nowMinutes: number): boolean {
	const s = parseTimeToMinutes(item.start);
	const e = parseTimeToMinutes(item.end);
	const t = ((nowMinutes % 1440) + 1440) % 1440;
	if (s === e) {
		return false;
	}
	if (s < e) {
		return t >= s && t < e;
	}
	return t >= s || t < e;
}

export function parseSchedulePlan(raw: unknown): SchedulePlan {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object" || !Array.isArray((data as SchedulePlan).items)) {
			return { version: 1, items: [] };
		}
		return {
			version: 1,
			items: (data as SchedulePlan).items.map((item, index) => ({
				id: String(item?.id || `item-${index}`),
				label: String(item?.label || ""),
				start: String(item?.start || "08:00"),
				end: String(item?.end || "09:00"),
				source: item?.source === "custom" ? "custom" : "arasaac",
				arasaacId: item?.arasaacId != null ? Number(item.arasaacId) : undefined,
				customRef: item?.customRef ? String(item.customRef) : undefined,
			})),
		};
	} catch {
		return { version: 1, items: [] };
	}
}

export function parseDayPeriods(raw: unknown): DayPeriodDefinition[] {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!Array.isArray(data) || data.length === 0) {
			return DEFAULT_DAY_PERIODS;
		}
		return (data as DayPeriodDefinition[]).map(period => ({
			...period,
			enabled: period.enabled !== false,
		}));
	} catch {
		return DEFAULT_DAY_PERIODS;
	}
}

export function parsePeriodOverrides(raw: unknown): Record<string, boolean> {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object" || Array.isArray(data)) {
			return {};
		}
		return data as Record<string, boolean>;
	} catch {
		return {};
	}
}

/** Merge admin periods with Config on/off overrides. */
export function applyPeriodOverrides(
	periods: DayPeriodDefinition[],
	overrides: Record<string, boolean>,
): DayPeriodDefinition[] {
	return periods.map(period => ({
		...period,
		enabled: overrides[period.id] === undefined ? period.enabled !== false : Boolean(overrides[period.id]),
	}));
}

export function periodToSegments(
	period: DayPeriodDefinition,
): Array<{ startMin: number; endMin: number; color: string; id: DayPeriodId }> {
	if (!period.enabled) {
		return [];
	}
	const s = parseTimeToMinutes(period.start);
	const e = parseTimeToMinutes(period.end);
	if (s === e) {
		return [{ startMin: 0, endMin: 1440, color: period.color, id: period.id }];
	}
	if (s < e) {
		return [{ startMin: s, endMin: e, color: period.color, id: period.id }];
	}
	return [
		{ startMin: s, endMin: 1440, color: period.color, id: period.id },
		{ startMin: 0, endMin: e, color: period.color, id: period.id },
	];
}

/** Encode each path segment so spaces/umlauts work in img src. */
export function encodeIoBrokerFileUrl(urlPath: string): string {
	return `/${urlPath
		.replace(/^\/+/, "")
		.split("/")
		.filter(Boolean)
		.map(segment => encodeURIComponent(segment))
		.join("/")}`;
}

function visPictogramRelativePath(path: string): string {
	const p = path
		.replace(/^\/+/, "")
		.replace(/^files\//, "")
		.replace(/^vis-2\.0\//, "");
	if (p.startsWith("Autismus Unterstützung/")) {
		return p;
	}
	if (p.startsWith("main/autism-support/pictograms/")) {
		return p;
	}
	const filename = p.split("/").pop() || p;
	return `Autismus Unterstützung/pictograms/${filename}`;
}

/** Resolve image URL for a schedule item (ARASAAC CDN or custom file/URL). */
export function resolveItemImageUrl(item: ScheduleItem, _adapterInstance = "autism-support.0"): string | null {
	if (item.source === "arasaac" && item.arasaacId) {
		return arasaacImageUrl(item.arasaacId, 500);
	}
	if (item.source === "custom" && item.customRef) {
		const ref = item.customRef.trim();
		if (/^https?:\/\//i.test(ref) || ref.startsWith("data:")) {
			return ref;
		}
		return encodeIoBrokerFileUrl(`vis-2.0/${visPictogramRelativePath(ref)}`);
	}
	return null;
}
