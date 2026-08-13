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
		return data as DayPeriodDefinition[];
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
		enabled: overrides[period.id] === undefined ? period.enabled : Boolean(overrides[period.id]),
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

/** Resolve image URL for a schedule item (ARASAAC CDN or custom file/URL). */
export function resolveItemImageUrl(
	item: ScheduleItem,
	adapterInstance = "autism-support.0",
): string | null {
	if (item.source === "arasaac" && item.arasaacId) {
		return arasaacImageUrl(item.arasaacId, 500);
	}
	if (item.source === "custom" && item.customRef) {
		const ref = item.customRef.trim();
		if (/^https?:\/\//i.test(ref) || ref.startsWith("data:")) {
			return ref;
		}
		const path = ref.replace(/^\/+/, "").replace(/^files\//, "");
		if (path.includes("pictograms/")) {
			const clean = path.slice(path.indexOf("pictograms/"));
			return `/files/${adapterInstance}/${clean}`;
		}
		return `/files/${adapterInstance}/pictograms/${path}`;
	}
	return null;
}
