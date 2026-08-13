/**
 * Daily schedule plan item.
 * ARASAAC images are NEVER bundled – only external IDs/URLs are stored.
 */

export type PictogramSource = "arasaac" | "custom";

/**
 *
 */
export interface ScheduleItem {
	/**
	 *
	 */
	id: string;
	/**
	 *
	 */
	label: string;
	/** Start HH:MM */
	start: string;
	/** End HH:MM */
	end: string;
	/**
	 *
	 */
	source: PictogramSource;
	/** ARASAAC pictogram numeric id (external CDN only) */
	arasaacId?: number;
	/**
	 * Custom image reference:
	 * - adapter file path like `pictograms/foo.png`
	 * - or https URL (user-provided)
	 */
	customRef?: string;
}

/**
 *
 */
export interface SchedulePlan {
	/**
	 *
	 */
	version: 1;
	/**
	 *
	 */
	items: ScheduleItem[];
}

export const EMPTY_SCHEDULE_PLAN: SchedulePlan = {
	version: 1,
	items: [],
};

/**
 *
 * @param raw
 */
export function parseSchedulePlan(raw: unknown): SchedulePlan {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return { ...EMPTY_SCHEDULE_PLAN, items: [] };
		}
		const items = Array.isArray((data as SchedulePlan).items)
			? (data as SchedulePlan).items.filter(item => item && typeof item === "object")
			: [];
		return {
			version: 1,
			items: items.map((item, index) => normalizeItem(item, index)),
		};
	} catch {
		return { ...EMPTY_SCHEDULE_PLAN, items: [] };
	}
}

function normalizeItem(item: ScheduleItem, index: number): ScheduleItem {
	const source: PictogramSource = item.source === "custom" ? "custom" : "arasaac";
	return {
		id: String(item.id || `item-${index}`),
		label: String(item.label || ""),
		start: String(item.start || "08:00"),
		end: String(item.end || "09:00"),
		source,
		arasaacId:
			source === "arasaac" && item.arasaacId != null && Number.isFinite(Number(item.arasaacId))
				? Number(item.arasaacId)
				: undefined,
		customRef: source === "custom" ? String(item.customRef || "") : undefined,
	};
}

/**
 * Absolute end minute on a linear timeline (wrap past midnight → +1440).
 *
 * @param item Schedule item
 * @param parseTime HH:MM → minutes
 */
export function itemEndAbsoluteMinutes(item: ScheduleItem, parseTime: (t: string) => number): number {
	const s = parseTime(item.start);
	const e = parseTime(item.end);
	if (e > s) {
		return e;
	}
	if (e < s) {
		return e + 1440;
	}
	return s + 30;
}

/**
 * Latest absolute end among all plan items, or null if empty.
 *
 * @param plan Schedule plan
 * @param parseTime HH:MM → minutes
 */
export function getLatestItemEndMinutes(plan: SchedulePlan, parseTime: (t: string) => number): number | null {
	if (!plan.items.length) {
		return null;
	}
	return Math.max(...plan.items.map(item => itemEndAbsoluteMinutes(item, parseTime)));
}

/**
 * True when now is at/after the end of the chronologically last pictogram.
 *
 * @param plan Schedule plan
 * @param minutes Now minutes since midnight
 * @param parseTime HH:MM → minutes
 */
export function isPlanFullyExpired(plan: SchedulePlan, minutes: number, parseTime: (t: string) => number): boolean {
	const lastEnd = getLatestItemEndMinutes(plan, parseTime);
	if (lastEnd == null) {
		return false;
	}
	let nowAbs = ((minutes % 1440) + 1440) % 1440;
	// Overnight schedules: after midnight, compare on the +1440 continuum.
	if (lastEnd > 1440 && nowAbs < 12 * 60) {
		nowAbs += 1440;
	}
	return nowAbs >= lastEnd;
}

/**
 *
 * @param plan
 * @param minutes
 * @param parseTime
 */
export function findCurrentItemIndex(plan: SchedulePlan, minutes: number, parseTime: (t: string) => number): number {
	return plan.items.findIndex(item => {
		const s = parseTime(item.start);
		const e = parseTime(item.end);
		const t = ((minutes % 1440) + 1440) % 1440;
		if (s === e) {
			return false;
		}
		if (s < e) {
			return t >= s && t < e;
		}
		return t >= s || t < e;
	});
}
