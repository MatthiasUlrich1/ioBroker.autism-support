/**
 * Weekly schedule plan (Mon–Sun) built from daily SchedulePlan slots.
 */

import { EMPTY_SCHEDULE_PLAN, parseSchedulePlan, type SchedulePlan } from "./schedule-types";

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * JS Date.getDay(): 0=Sun … 6=Sat → our WeekdayKey
 *
 * @param date
 */
export function weekdayKeyFromDate(date: Date): WeekdayKey {
	const map: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	return map[date.getDay()] || "mon";
}

/**
 *
 */
export interface WeeklyPlanData {
	/**
	 *
	 */
	version: 1;
	/**
	 *
	 */
	days: Record<WeekdayKey, SchedulePlan>;
}

/**
 *
 */
export interface SavedWeeklyPlan {
	/**
	 *
	 */
	id: string;
	/**
	 *
	 */
	name: string;
	/**
	 *
	 */
	data: WeeklyPlanData;
	/**
	 *
	 */
	updatedAt: string;
}

/**
 *
 */
export interface WeeklyPlansLibrary {
	/**
	 *
	 */
	version: 1;
	/** Currently loaded / active saved plan id (null = untitled working copy) */
	activeId: string | null;
	/**
	 *
	 */
	plans: SavedWeeklyPlan[];
}

/**
 *
 */
export type WeekdayColors = Record<WeekdayKey, string>;

export const DEFAULT_WEEKDAY_COLORS: WeekdayColors = {
	mon: "#BBDEFB",
	tue: "#C8E6C9",
	wed: "#FFF9C4",
	thu: "#FFE0B2",
	fri: "#F8BBD0",
	sat: "#E1BEE7",
	sun: "#B2EBF2",
};

export const EMPTY_WEEKLY_PLAN: WeeklyPlanData = {
	version: 1,
	days: {
		mon: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		tue: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		wed: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		thu: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		fri: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		sat: { ...EMPTY_SCHEDULE_PLAN, items: [] },
		sun: { ...EMPTY_SCHEDULE_PLAN, items: [] },
	},
};

export const EMPTY_WEEKLY_PLANS_LIBRARY: WeeklyPlansLibrary = {
	version: 1,
	activeId: null,
	plans: [],
};

/**
 * @param seed Optional daily plan copied into every weekday
 */
export function createEmptyWeeklyPlan(seed?: SchedulePlan): WeeklyPlanData {
	const day = seed ? parseSchedulePlan(seed) : { ...EMPTY_SCHEDULE_PLAN, items: [] };
	const days = {} as Record<WeekdayKey, SchedulePlan>;
	for (const key of WEEKDAY_KEYS) {
		days[key] = {
			version: 1,
			items: day.items.map(item => ({ ...item, id: `${key}-${item.id}` })),
		};
	}
	return { version: 1, days };
}

/**
 * @param raw
 */
export function parseWeeklyPlan(raw: unknown): WeeklyPlanData {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return createEmptyWeeklyPlan();
		}
		const daysRaw = (data as WeeklyPlanData).days;
		const days = {} as Record<WeekdayKey, SchedulePlan>;
		for (const key of WEEKDAY_KEYS) {
			days[key] = parseSchedulePlan(daysRaw?.[key]);
		}
		return { version: 1, days };
	} catch {
		return createEmptyWeeklyPlan();
	}
}

/**
 * @param raw
 */
export function parseWeeklyPlansLibrary(raw: unknown): WeeklyPlansLibrary {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return { ...EMPTY_WEEKLY_PLANS_LIBRARY, plans: [] };
		}
		const plansIn = Array.isArray((data as WeeklyPlansLibrary).plans) ? (data as WeeklyPlansLibrary).plans : [];
		const plans: SavedWeeklyPlan[] = plansIn
			.filter(p => p && typeof p === "object" && p.id)
			.map(p => ({
				id: String(p.id),
				name: String(p.name || p.id),
				data: parseWeeklyPlan(p.data),
				updatedAt: String(p.updatedAt || new Date().toISOString()),
			}));
		const activeIdRaw = (data as WeeklyPlansLibrary).activeId;
		const activeId = activeIdRaw && plans.some(p => p.id === activeIdRaw) ? String(activeIdRaw) : null;
		return { version: 1, activeId, plans };
	} catch {
		return { ...EMPTY_WEEKLY_PLANS_LIBRARY, plans: [] };
	}
}

/**
 * @param raw
 * @param fallback
 */
export function parseWeekdayColors(raw: unknown, fallback: WeekdayColors = DEFAULT_WEEKDAY_COLORS): WeekdayColors {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return { ...fallback };
		}
		const out = { ...fallback };
		for (const key of WEEKDAY_KEYS) {
			const value = (data as Record<string, unknown>)[key];
			if (typeof value === "string" && value.trim()) {
				out[key] = value.trim();
			}
		}
		return out;
	} catch {
		return { ...fallback };
	}
}

/**
 * @param config Adapter native config
 */
export function weekdayColorsFromConfig(config: ioBroker.AdapterConfig): WeekdayColors {
	const out = { ...DEFAULT_WEEKDAY_COLORS };
	const map: Record<WeekdayKey, keyof ioBroker.AdapterConfig> = {
		mon: "weekdayColorMon",
		tue: "weekdayColorTue",
		wed: "weekdayColorWed",
		thu: "weekdayColorThu",
		fri: "weekdayColorFri",
		sat: "weekdayColorSat",
		sun: "weekdayColorSun",
	};
	for (const key of WEEKDAY_KEYS) {
		const value = config[map[key]];
		if (typeof value === "string" && value.trim()) {
			out[key] = value.trim();
		}
	}
	return out;
}

/**
 * Stable compare for schedule plans (ignore item id differences that are cosmetic).
 *
 * @param a
 * @param b
 */
export function schedulePlansEqual(a: SchedulePlan, b: SchedulePlan): boolean {
	if (a.items.length !== b.items.length) {
		return false;
	}
	for (let i = 0; i < a.items.length; i++) {
		const x = a.items[i];
		const y = b.items[i];
		if (
			x.label !== y.label ||
			x.start !== y.start ||
			x.end !== y.end ||
			x.source !== y.source ||
			x.arasaacId !== y.arasaacId ||
			(x.customRef || "") !== (y.customRef || "")
		) {
			return false;
		}
	}
	return true;
}

/**
 * Admin table rows derived from library.
 *
 * @param library
 */
export function weeklyPlanRowsFromLibrary(
	library: WeeklyPlansLibrary,
): Array<{ id: string; name: string; active: string }> {
	return library.plans.map(plan => ({
		id: plan.id,
		name: plan.name,
		active: library.activeId === plan.id ? "●" : "",
	}));
}

/**
 * Apply Admin table edits (names / removed rows) onto library. Keeps data for surviving ids.
 *
 * @param library
 * @param rows
 */
export function applyWeeklyPlanRowsToLibrary(
	library: WeeklyPlansLibrary,
	rows: Array<{ id?: string; name?: string; active?: string }> | undefined,
): WeeklyPlansLibrary {
	const list = Array.isArray(rows) ? rows : [];
	const byId = new Map(library.plans.map(p => [p.id, p]));
	const nextPlans: SavedWeeklyPlan[] = [];
	for (const row of list) {
		const id = String(row?.id || "").trim();
		if (!id || !byId.has(id)) {
			continue;
		}
		const prev = byId.get(id)!;
		nextPlans.push({
			...prev,
			name: String(row.name || prev.name || id).trim() || prev.name,
		});
	}
	const ids = new Set(nextPlans.map(p => p.id));
	const activeId = library.activeId && ids.has(library.activeId) ? library.activeId : null;
	return { version: 1, activeId, plans: nextPlans };
}
