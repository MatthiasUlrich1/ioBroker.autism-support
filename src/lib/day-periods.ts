/**
 * Day periods for the daily schedule timeline.
 * Times are "HH:MM" in local time. Night may wrap past midnight.
 */

export type DayPeriodId = "morning" | "forenoon" | "noon" | "afternoon" | "evening" | "night";

/**
 *
 */
export interface DayPeriodDefinition {
	/**
	 *
	 */
	id: DayPeriodId;
	/**
	 *
	 */
	enabled: boolean;
	/** Start time HH:MM (inclusive) */
	start: string;
	/** End time HH:MM (exclusive), may be earlier than start if wraps midnight */
	end: string;
	/**
	 *
	 */
	color: string;
}

export const DAY_PERIOD_IDS: DayPeriodId[] = ["morning", "forenoon", "noon", "afternoon", "evening", "night"];

export const DEFAULT_DAY_PERIODS: DayPeriodDefinition[] = [
	{ id: "morning", enabled: true, start: "06:00", end: "09:00", color: "#FFE082" },
	{ id: "forenoon", enabled: true, start: "09:00", end: "12:00", color: "#FFCC80" },
	{ id: "noon", enabled: true, start: "12:00", end: "14:00", color: "#FFAB91" },
	{ id: "afternoon", enabled: true, start: "14:00", end: "17:00", color: "#81C784" },
	{ id: "evening", enabled: true, start: "17:00", end: "21:00", color: "#7986CB" },
	{ id: "night", enabled: true, start: "21:00", end: "06:00", color: "#5C6BC0" },
];

/**
 * Parse HH:MM to minutes since midnight (0–1440).
 *
 * @param value
 */
export function parseTimeToMinutes(value: string): number {
	const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
	if (!match) {
		return 0;
	}
	const h = Math.min(23, Math.max(0, Number(match[1])));
	const m = Math.min(59, Math.max(0, Number(match[2])));
	return h * 60 + m;
}

/**
 *
 * @param total
 */
export function minutesToTime(total: number): string {
	const safe = ((Math.round(total) % 1440) + 1440) % 1440;
	const h = Math.floor(safe / 60);
	const m = safe % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Whether `minutes` lies in [start, end) supporting midnight wrap.
 *
 * @param minutes
 * @param start
 * @param end
 */
export function isMinutesInPeriod(minutes: number, start: string, end: string): boolean {
	const s = parseTimeToMinutes(start);
	const e = parseTimeToMinutes(end);
	const t = ((minutes % 1440) + 1440) % 1440;
	if (s === e) {
		return true;
	}
	if (s < e) {
		return t >= s && t < e;
	}
	// wraps midnight
	return t >= s || t < e;
}

/**
 *
 * @param minutes
 * @param periods
 */
export function findCurrentPeriod(minutes: number, periods: DayPeriodDefinition[]): DayPeriodDefinition | null {
	for (const period of periods) {
		if (period.enabled && isMinutesInPeriod(minutes, period.start, period.end)) {
			return period;
		}
	}
	return null;
}

/**
 * Expand periods into non-wrapping segments for a 0–1440 timeline bar.
 * Night 21:00–06:00 → [21:00–1440) and [0–06:00).
 *
 * @param period
 */
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

/**
 *
 * @param config
 */
export function dayPeriodsFromConfig(config: ioBroker.AdapterConfig): DayPeriodDefinition[] {
	return DAY_PERIOD_IDS.map(id => {
		const cap = id.charAt(0).toUpperCase() + id.slice(1);
		const enabledKey = `period${cap}Enabled` as keyof ioBroker.AdapterConfig;
		const startKey = `period${cap}Start` as keyof ioBroker.AdapterConfig;
		const endKey = `period${cap}End` as keyof ioBroker.AdapterConfig;
		const colorKey = `period${cap}Color` as keyof ioBroker.AdapterConfig;
		const fallback = DEFAULT_DAY_PERIODS.find(p => p.id === id)!;
		return {
			id,
			enabled: config[enabledKey] !== false,
			start: String(config[startKey] ?? fallback.start),
			end: String(config[endKey] ?? fallback.end),
			color: String(config[colorKey] ?? fallback.color),
		};
	});
}
