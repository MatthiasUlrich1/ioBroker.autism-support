import { parseSchedulePlan, type SchedulePlan } from "./schedule";

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function weekdayKeyFromDate(date: Date): WeekdayKey {
	const map: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	return map[date.getDay()] || "mon";
}

export interface WeeklyPlanData {
	version: 1;
	days: Record<WeekdayKey, SchedulePlan>;
}

export interface SavedWeeklyPlan {
	id: string;
	name: string;
	data: WeeklyPlanData;
	updatedAt: string;
}

export interface WeeklyPlansLibrary {
	version: 1;
	activeId: string | null;
	plans: SavedWeeklyPlan[];
}

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

export const WEEKDAY_LABELS_DE: Record<WeekdayKey, string> = {
	mon: "Mo",
	tue: "Di",
	wed: "Mi",
	thu: "Do",
	fri: "Fr",
	sat: "Sa",
	sun: "So",
};

export const WEEKDAY_LABELS_EN: Record<WeekdayKey, string> = {
	mon: "Mon",
	tue: "Tue",
	wed: "Wed",
	thu: "Thu",
	fri: "Fri",
	sat: "Sat",
	sun: "Sun",
};

export function createEmptyWeeklyPlan(seed?: SchedulePlan): WeeklyPlanData {
	const day = seed ? parseSchedulePlan(seed) : { version: 1 as const, items: [] };
	const days = {} as Record<WeekdayKey, SchedulePlan>;
	for (const key of WEEKDAY_KEYS) {
		days[key] = {
			version: 1,
			items: day.items.map(item => ({ ...item, id: `${key}-${item.id}` })),
		};
	}
	return { version: 1, days };
}

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

export function parseWeeklyPlansLibrary(raw: unknown): WeeklyPlansLibrary {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return { version: 1, activeId: null, plans: [] };
		}
		const plansIn = Array.isArray((data as WeeklyPlansLibrary).plans)
			? (data as WeeklyPlansLibrary).plans
			: [];
		const plans: SavedWeeklyPlan[] = plansIn
			.filter(p => p && typeof p === "object" && p.id)
			.map(p => ({
				id: String(p.id),
				name: String(p.name || p.id),
				data: parseWeeklyPlan(p.data),
				updatedAt: String(p.updatedAt || new Date().toISOString()),
			}));
		const activeIdRaw = (data as WeeklyPlansLibrary).activeId;
		const activeId =
			activeIdRaw && plans.some(p => p.id === activeIdRaw) ? String(activeIdRaw) : null;
		return { version: 1, activeId, plans };
	} catch {
		return { version: 1, activeId: null, plans: [] };
	}
}

export function parseWeekdayColors(raw: unknown): WeekdayColors {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object") {
			return { ...DEFAULT_WEEKDAY_COLORS };
		}
		const out = { ...DEFAULT_WEEKDAY_COLORS };
		for (const key of WEEKDAY_KEYS) {
			const value = (data as Record<string, unknown>)[key];
			if (typeof value === "string" && value.trim()) {
				out[key] = value.trim();
			}
		}
		return out;
	} catch {
		return { ...DEFAULT_WEEKDAY_COLORS };
	}
}

export function cloneDayPlan(plan: SchedulePlan, targetDay: WeekdayKey): SchedulePlan {
	return {
		version: 1,
		items: plan.items.map(item => ({
			...item,
			id: `${targetDay}-${item.id}-${Math.random().toString(36).slice(2, 7)}`,
		})),
	};
}
