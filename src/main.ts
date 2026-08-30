/*
 * ioBroker.autism-support – Visual Countdown + Daily Schedule
 */

import * as utils from "@iobroker/adapter-core";
import { TimerManager } from "./lib/timer-manager";
import {
	dayPeriodsFromConfig,
	findCurrentPeriod,
	parseTimeToMinutes,
	type DayPeriodDefinition,
} from "./lib/day-periods";
import { findCurrentItemIndex, isPlanFullyExpired, parseSchedulePlan, type SchedulePlan } from "./lib/schedule-types";
import {
	ADAPTER_LIBRARY_FILE,
	PICTOGRAM_DIR,
	PICTOGRAM_FILE_ADAPTER,
	PICTOGRAM_PLACEHOLDER_FILE,
	LEGACY_VIS_LIBRARY_FILE,
	emptyLibrary,
	isIgnoredPictogramFile,
	libraryFromNativeRows,
	matchesPictogramKey,
	mergePictogramSources,
	normalizeTags,
	parseLibrary,
	pictogramPublicUrl,
	pictogramStoragePath,
	syncCustomPictogramRows,
	uniquePictogramFilename,
	type CustomPictogram,
	type PictogramLibrary,
} from "./lib/pictogram-library";
import {
	applyWeeklyPlanRowsToLibrary,
	createEmptyWeeklyPlan,
	parseWeeklyPlan,
	parseWeeklyPlansLibrary,
	schedulePlansEqual,
	weekdayColorsFromConfig,
	weekdayKeyFromDate,
	weeklyPlanRowsFromLibrary,
	type WeekdayColors,
	type WeekdayKey,
	type WeeklyPlanData,
	type WeeklyPlansLibrary,
} from "./lib/weekly-plan";

const TIMER_CHANNEL = "timer";
const SCHEDULE_CHANNEL = "schedule";

function instanceConfigId(namespace: string): string {
	return `system.adapter.${namespace}`;
}

function legacyMisplacedInstanceConfigId(namespace: string): string {
	return `${namespace}.system.adapter.${namespace}`;
}

function nativeConfigEquals(left: unknown, right: unknown): boolean {
	return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function secondsToParts(totalSeconds: number): { hours: number; minutes: number } {
	const safe = Math.max(0, Math.round(totalSeconds));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
	};
}

class AutismSupport extends utils.Adapter {
	private timerManager: TimerManager | null = null;
	private scheduleTick: ioBroker.Interval | undefined | null = null;
	private dayPeriods: DayPeriodDefinition[] = [];
	private weekdayColors: WeekdayColors = weekdayColorsFromConfig({} as ioBroker.AdapterConfig);
	private lastAppliedWeekday: WeekdayKey | null = null;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "autism-support",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		try {
			const maxHours = this.config.maxDurationHours ?? 24;
			const defaultSeconds = this.getDefaultDurationSeconds(maxHours);
			this.dayPeriods = dayPeriodsFromConfig(this.config);
			this.weekdayColors = weekdayColorsFromConfig(this.config);

			await this.migrateMisplacedInstanceConfig();
			await this.createTimerStates();
			await this.ensurePictogramStore();
			await this.syncCustomPictogramsConfig();
			await this.createScheduleStates();
			// Only apply Admin name/delete edits when the table already lists plans (avoid wiping on first boot).
			if (Array.isArray(this.config.weeklyPlanRows) && this.config.weeklyPlanRows.length > 0) {
				await this.applyWeeklyPlanRowsFromConfig();
			}
			await this.syncWeeklyPlansTableToNative();

			this.timerManager = new TimerManager(
				async snapshot => {
					await this.publishTimerSnapshot(snapshot);
				},
				{
					setInterval: (handler, ms) => this.setInterval(handler, ms),
					clearInterval: handle => this.clearInterval(handle as ioBroker.Interval),
				},
			);

			await this.timerManager.setDuration(defaultSeconds, maxHours);
			await this.publishTimerSnapshot(this.timerManager.getSnapshot());
			await this.publishScheduleRuntime();

			this.subscribeStates(`${this.namespace}.${TIMER_CHANNEL}.*`);
			this.subscribeStates(`${this.namespace}.${SCHEDULE_CHANNEL}.*`);

			this.scheduleTick = this.setInterval(() => {
				void this.publishScheduleRuntime();
			}, 30_000);

			this.log.info("Autism Support adapter ready – Visual Countdown + Weekly Schedule");
		} catch (error) {
			this.log.error(`Startup failed: ${(error as Error).message}`);
			throw error;
		}
	}

	/** Write instance native config only when changed — avoids restart loop on every boot. */
	private async patchInstanceNativeIfChanged(
		patch: Partial<Pick<ioBroker.AdapterConfig, "customPictograms" | "weeklyPlanRows">>,
	): Promise<boolean> {
		const id = instanceConfigId(this.namespace);
		const current = await this.getForeignObjectAsync(id);
		const currentNative = (current?.native || {}) as Partial<ioBroker.AdapterConfig>;
		const nextNative: Partial<ioBroker.AdapterConfig> = {};
		let changed = false;

		for (const [key, value] of Object.entries(patch) as Array<
			["customPictograms" | "weeklyPlanRows", ioBroker.AdapterConfig["customPictograms"] | ioBroker.AdapterConfig["weeklyPlanRows"]]
		>) {
			if (!nativeConfigEquals(currentNative[key], value)) {
				nextNative[key] = value;
				changed = true;
			}
		}

		if (!changed) {
			return false;
		}

		await this.extendForeignObjectAsync(id, { native: nextNative });
		return true;
	}

	private getDefaultDurationSeconds(maxHours: number): number {
		const hours = Math.min(maxHours, Math.max(0, this.config.defaultDurationHours ?? 1));
		const minutes = Math.min(59, Math.max(0, this.config.defaultDurationMinutes ?? 0));
		const total = hours * 3600 + minutes * 60;
		return Math.max(60, Math.min(maxHours * 3600, total));
	}

	private async createTimerStates(): Promise<void> {
		await this.setObjectNotExistsAsync(TIMER_CHANNEL, {
			type: "channel",
			common: { name: "Visual Countdown" },
			native: {},
		});

		const states: Record<
			string,
			{
				type: "number" | "boolean";
				role: string;
				name: string;
				read: boolean;
				write: boolean;
				unit?: string;
				min?: number;
				max?: number;
			}
		> = {
			duration: {
				type: "number",
				role: "level.timer",
				name: "Timer duration (seconds)",
				read: true,
				write: true,
				unit: "s",
				min: 60,
				max: 86400,
			},
			remaining: {
				type: "number",
				role: "value.timer",
				name: "Timer remaining (seconds)",
				read: true,
				write: false,
				unit: "s",
			},
			elapsed: {
				type: "number",
				role: "value.timer",
				name: "Timer elapsed (seconds)",
				read: true,
				write: false,
				unit: "s",
			},
			running: {
				type: "boolean",
				role: "indicator",
				name: "Timer running",
				read: true,
				write: false,
			},
			paused: {
				type: "boolean",
				role: "indicator",
				name: "Timer paused",
				read: true,
				write: false,
			},
			finished: {
				type: "boolean",
				role: "indicator",
				name: "Timer finished",
				read: true,
				write: false,
			},
			start: {
				type: "boolean",
				role: "button.start",
				name: "Start timer",
				read: false,
				write: true,
			},
			pause: {
				type: "boolean",
				role: "button.pause",
				name: "Pause timer",
				read: false,
				write: true,
			},
			resume: {
				type: "boolean",
				role: "button.start",
				name: "Resume timer",
				read: false,
				write: true,
			},
			stop: {
				type: "boolean",
				role: "button.stop",
				name: "Stop timer",
				read: false,
				write: true,
			},
			setDurationHours: {
				type: "number",
				role: "level",
				name: "Set timer duration (hours)",
				read: true,
				write: true,
				unit: "h",
				min: 0,
				max: 24,
			},
			setDurationMinutes: {
				type: "number",
				role: "level",
				name: "Set timer duration (minutes)",
				read: true,
				write: true,
				unit: "min",
				min: 0,
				max: 59,
			},
		};

		for (const [id, def] of Object.entries(states)) {
			await this.setObjectNotExistsAsync(`${TIMER_CHANNEL}.${id}`, {
				type: "state",
				common: {
					name: def.name,
					type: def.type,
					role: def.role,
					read: def.read,
					write: def.write,
					unit: def.unit,
					min: def.min,
					max: def.max,
				},
				native: {},
			});
		}

		await this.migrateTimerStateRoles();
	}

	/**
	 * Earlier versions used extendObject() for system.adapter.* which ioBroker resolves
	 * relative to the instance namespace (autism-support.0.system.adapter...).
	 */
	private async migrateMisplacedInstanceConfig(): Promise<void> {
		const legacyId = legacyMisplacedInstanceConfigId(this.namespace);
		const legacy = await this.getObjectAsync(legacyId);
		if (!legacy?.native) {
			return;
		}

		const native = legacy.native as {
			customPictograms?: ioBroker.AdapterConfig["customPictograms"];
			weeklyPlanRows?: ioBroker.AdapterConfig["weeklyPlanRows"];
		};
		const patch: Partial<ioBroker.AdapterConfig> = {};
		if (Array.isArray(native.customPictograms)) {
			patch.customPictograms = native.customPictograms;
		}
		if (Array.isArray(native.weeklyPlanRows)) {
			patch.weeklyPlanRows = native.weeklyPlanRows;
		}
		if (Object.keys(patch).length) {
			await this.patchInstanceNativeIfChanged(patch);
			if (patch.customPictograms) {
				this.config.customPictograms = patch.customPictograms;
			}
			if (patch.weeklyPlanRows) {
				this.config.weeklyPlanRows = patch.weeklyPlanRows;
			}
			this.log.info(`Migrated instance native config from misplaced object ${legacyId}`);
		}

		await this.delObjectAsync(legacyId);
		for (const folderId of [`${this.namespace}.system.adapter`, `${this.namespace}.system`]) {
			try {
				await this.delObjectAsync(folderId);
			} catch {
				// folder may not exist or is not empty
			}
		}
	}

	/** Update roles/read flags on existing timer states (object-structure compliance). */
	private async migrateTimerStateRoles(): Promise<void> {
		const patches: Record<string, { role?: string; read?: boolean }> = {
			duration: { role: "level.timer" },
			remaining: { role: "value.timer" },
			elapsed: { role: "value.timer" },
			start: { read: false },
			pause: { read: false },
			resume: { read: false },
			stop: { read: false },
		};
		for (const [id, patch] of Object.entries(patches)) {
			const common: Partial<ioBroker.StateCommon> = {};
			if (patch.role) {
				common.role = patch.role;
			}
			if (patch.read !== undefined) {
				common.read = patch.read;
			}
			await this.extendObjectAsync(`${TIMER_CHANNEL}.${id}`, { common });
		}
	}

	private async createScheduleStates(): Promise<void> {
		await this.setObjectNotExistsAsync(SCHEDULE_CHANNEL, {
			type: "channel",
			common: { name: "Daily schedule" },
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.plan`, {
			type: "state",
			common: {
				name: "Schedule plan (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: true,
				def: JSON.stringify({ version: 1, items: [] }),
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.periods`, {
			type: "state",
			common: {
				name: "Day periods from admin (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.periodOverrides`, {
			type: "state",
			common: {
				name: "Day period on/off overrides from schedule config (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: true,
				def: "{}",
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.nowMinutes`, {
			type: "state",
			common: {
				name: "Minutes since midnight (local)",
				type: "number",
				role: "value",
				read: true,
				write: false,
				unit: "min",
				min: 0,
				max: 1439,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.currentPeriod`, {
			type: "state",
			common: {
				name: "Current day period id",
				type: "string",
				role: "text",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.currentItemIndex`, {
			type: "state",
			common: {
				name: "Index of active schedule item (-1 = none)",
				type: "number",
				role: "value",
				read: true,
				write: false,
				min: -1,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`, {
			type: "state",
			common: {
				name: "Clear plan automatically after last pictogram ends",
				type: "boolean",
				role: "switch",
				read: true,
				write: true,
				def: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.pictogramLibrary`, {
			type: "state",
			common: {
				name: "Custom pictogram library (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.weeklyPlan`, {
			type: "state",
			common: {
				name: "Active weekly plan (JSON, Mon–Sun)",
				type: "string",
				role: "json",
				read: true,
				write: true,
				def: JSON.stringify(createEmptyWeeklyPlan()),
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`, {
			type: "state",
			common: {
				name: "Saved weekly plans library (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: true,
				def: JSON.stringify({ version: 1, activeId: null, plans: [] }),
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.loadDailyFromWeekly`, {
			type: "state",
			common: {
				name: "Load daily plan from active weekly plan each day",
				type: "boolean",
				role: "switch",
				read: true,
				write: true,
				def: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.weekdayColors`, {
			type: "state",
			common: {
				name: "Weekday background colors from admin (JSON)",
				type: "string",
				role: "json",
				read: true,
				write: false,
			},
			native: {},
		});

		const planState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.plan`);
		if (planState?.val == null || planState.val === "") {
			await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify({ version: 1, items: [] }), true);
		}
		const overridesState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.periodOverrides`);
		if (overridesState?.val == null || overridesState.val === "") {
			await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, "{}", true);
		}
		const clearAfterState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`);
		if (clearAfterState?.val == null) {
			await this.setState(`${SCHEDULE_CHANNEL}.clearAfterLast`, false, true);
		}
		const loadDailyState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.loadDailyFromWeekly`);
		if (loadDailyState?.val == null) {
			await this.setState(`${SCHEDULE_CHANNEL}.loadDailyFromWeekly`, false, true);
		}

		const weeklyState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.weeklyPlan`);
		if (weeklyState?.val == null || weeklyState.val === "") {
			const seed = parseSchedulePlan(planState?.val);
			await this.setState(
				`${SCHEDULE_CHANNEL}.weeklyPlan`,
				JSON.stringify(createEmptyWeeklyPlan(seed.items.length ? seed : undefined)),
				true,
			);
		}
		const libraryState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`);
		if (libraryState?.val == null || libraryState.val === "") {
			await this.setState(
				`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`,
				JSON.stringify({ version: 1, activeId: null, plans: [] }),
				true,
			);
		}

		// Publish admin period definitions once at start (times/colors); overrides stay separate.
		await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
		await this.setState(`${SCHEDULE_CHANNEL}.weekdayColors`, JSON.stringify(this.weekdayColors), true);
		await this.publishPictogramLibrary();
	}

	private async buildCustomPictogramRows(): Promise<Array<{ file: string; label: string; tags: string }>> {
		const files = await this.listPictogramFiles();
		return syncCustomPictogramRows(files || [], this.config.customPictograms);
	}

	private async syncCustomPictogramsConfig(): Promise<void> {
		const rows = await this.buildCustomPictogramRows();
		await this.patchInstanceNativeIfChanged({ customPictograms: rows });
		this.config.customPictograms = rows;
		await this.publishPictogramLibrary();
	}

	private async ensurePictogramStore(): Promise<void> {
		try {
			await this.readFileAsync(this.namespace, ADAPTER_LIBRARY_FILE);
		} catch {
			try {
				await this.writeFileAsync(
					this.namespace,
					ADAPTER_LIBRARY_FILE,
					JSON.stringify(emptyLibrary(), null, 2),
				);
				this.log.info(`Created adapter pictogram library ${this.namespace}/${ADAPTER_LIBRARY_FILE}`);
			} catch (error) {
				this.log.error(`Could not create adapter pictogram library: ${(error as Error).message}`);
			}
		}

		try {
			const legacy = await this.readFileAsync(PICTOGRAM_FILE_ADAPTER, LEGACY_VIS_LIBRARY_FILE);
			const raw = typeof legacy.file === "string" ? legacy.file : Buffer.from(legacy.file).toString("utf8");
			const migrated = parseLibrary(raw);
			if (migrated.items.length) {
				await this.writeFileAsync(this.namespace, ADAPTER_LIBRARY_FILE, JSON.stringify(migrated, null, 2));
				this.log.info(`Migrated pictogram library from vis-2 to ${this.namespace}`);
			}
		} catch {
			// no legacy library in vis-2
		}

		try {
			await this.unlinkAsync(PICTOGRAM_FILE_ADAPTER, LEGACY_VIS_LIBRARY_FILE);
		} catch {
			// ignore
		}

		try {
			const hint =
				"Piktogramm-Bilder (PNG, JPEG, GIF, WebP, SVG) hier hochladen.\n" +
				"Keine neuen Ordner anlegen (Dateimanager zeigt dann oft „doppelter Name“).\n" +
				"Stattdessen oben auf Hochladen klicken und Bilder in DIESEN Ordner legen.\n";
			const placeholderPath = `${PICTOGRAM_DIR}/${PICTOGRAM_PLACEHOLDER_FILE}`;
			let needsWrite = true;
			try {
				const existing = await this.readFileAsync(PICTOGRAM_FILE_ADAPTER, placeholderPath);
				const current = typeof existing.file === "string" ? existing.file : Buffer.from(existing.file).toString("utf8");
				needsWrite = current !== hint;
			} catch {
				// file missing
			}
			if (needsWrite) {
				await this.writeFileAsync(PICTOGRAM_FILE_ADAPTER, placeholderPath, hint);
				this.log.info(`Ensured vis-2 pictogram folder ${PICTOGRAM_FILE_ADAPTER}/${PICTOGRAM_DIR}`);
			}
		} catch (error) {
			this.log.error(
				`Could not write ${PICTOGRAM_FILE_ADAPTER}/${PICTOGRAM_DIR}/${PICTOGRAM_PLACEHOLDER_FILE}: ${(error as Error).message}`,
			);
		}
	}

	private async getPublishedPictogramLibrary(): Promise<PictogramLibrary> {
		return mergePictogramSources(
			await this.getMergedPictogramLibrary(),
			libraryFromNativeRows(this.config.customPictograms),
		);
	}

	private async publishPictogramLibrary(): Promise<void> {
		const library = await this.getPublishedPictogramLibrary();
		await this.setState(`${SCHEDULE_CHANNEL}.pictogramLibrary`, JSON.stringify(library), true);
	}

	private async publishTimerSnapshot(snapshot: {
		duration: number;
		remaining: number;
		elapsed: number;
		running: boolean;
		paused: boolean;
		finished: boolean;
	}): Promise<void> {
		await this.setState(`${TIMER_CHANNEL}.duration`, snapshot.duration, true);
		await this.setState(`${TIMER_CHANNEL}.remaining`, snapshot.remaining, true);
		await this.setState(`${TIMER_CHANNEL}.elapsed`, snapshot.elapsed, true);
		await this.setState(`${TIMER_CHANNEL}.running`, snapshot.running, true);
		await this.setState(`${TIMER_CHANNEL}.paused`, snapshot.paused, true);
		await this.setState(`${TIMER_CHANNEL}.finished`, snapshot.finished, true);
	}

	private async getPlan(): Promise<SchedulePlan> {
		const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.plan`);
		return parseSchedulePlan(state?.val);
	}

	private async getPeriodOverrides(): Promise<Record<string, boolean>> {
		const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.periodOverrides`);
		try {
			const raw = typeof state?.val === "string" ? JSON.parse(state.val) : state?.val;
			return raw && typeof raw === "object" ? (raw as Record<string, boolean>) : {};
		} catch {
			return {};
		}
	}

	private async getEffectivePeriods(): Promise<DayPeriodDefinition[]> {
		const overrides = await this.getPeriodOverrides();
		return this.dayPeriods.map(period => ({
			...period,
			enabled: overrides[period.id] === undefined ? period.enabled : Boolean(overrides[period.id]),
		}));
	}

	private async getWeeklyPlan(): Promise<WeeklyPlanData> {
		const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.weeklyPlan`);
		return parseWeeklyPlan(state?.val);
	}

	private async getWeeklyPlansLibrary(): Promise<WeeklyPlansLibrary> {
		const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`);
		return parseWeeklyPlansLibrary(state?.val);
	}

	private async syncWeeklyPlansTableToNative(): Promise<void> {
		const library = await this.getWeeklyPlansLibrary();
		const rows = weeklyPlanRowsFromLibrary(library);
		await this.patchInstanceNativeIfChanged({ weeklyPlanRows: rows });
		this.config.weeklyPlanRows = rows;
	}

	private async applyWeeklyPlanRowsFromConfig(): Promise<void> {
		const library = await this.getWeeklyPlansLibrary();
		const next = applyWeeklyPlanRowsToLibrary(library, this.config.weeklyPlanRows);
		if (JSON.stringify(next) !== JSON.stringify(library)) {
			await this.setState(`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`, JSON.stringify(next), true);
		}
	}

	private async maybeApplyWeeklyToDaily(): Promise<void> {
		const loadState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.loadDailyFromWeekly`);
		if (!loadState?.val) {
			return;
		}
		const weekday = weekdayKeyFromDate(new Date());
		const weekly = await this.getWeeklyPlan();
		const dayPlan = weekly.days[weekday];
		const current = await this.getPlan();
		if (this.lastAppliedWeekday === weekday && schedulePlansEqual(current, dayPlan)) {
			return;
		}
		await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify(dayPlan), true);
		this.lastAppliedWeekday = weekday;
		this.log.debug(`Daily plan loaded from weekly plan (${weekday})`);
	}

	private async publishScheduleRuntime(): Promise<void> {
		await this.maybeApplyWeeklyToDaily();

		const now = new Date();
		const minutes = now.getHours() * 60 + now.getMinutes();
		const periods = await this.getEffectivePeriods();
		const period = findCurrentPeriod(minutes, periods);
		let plan = await this.getPlan();

		const clearAfterState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`);
		const clearAfterLast = Boolean(clearAfterState?.val);
		if (clearAfterLast && isPlanFullyExpired(plan, minutes, parseTimeToMinutes)) {
			plan = { version: 1, items: [] };
			await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify(plan), true);
			this.log.info("Schedule plan cleared automatically after last pictogram ended");
		}

		const itemIndex = findCurrentItemIndex(plan, minutes, parseTimeToMinutes);

		// Keep admin period metadata available; do not wipe Config overrides.
		await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
		await this.setState(`${SCHEDULE_CHANNEL}.weekdayColors`, JSON.stringify(this.weekdayColors), true);
		await this.setState(`${SCHEDULE_CHANNEL}.nowMinutes`, minutes, true);
		await this.setState(`${SCHEDULE_CHANNEL}.currentPeriod`, period?.id ?? "", true);
		await this.setState(`${SCHEDULE_CHANNEL}.currentItemIndex`, itemIndex, true);
	}

	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}

		if (id.startsWith(`${this.namespace}.${SCHEDULE_CHANNEL}.`)) {
			const localId = id.replace(`${this.namespace}.${SCHEDULE_CHANNEL}.`, "");
			if (localId === "plan") {
				const plan = parseSchedulePlan(state.val);
				await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify(plan), true);
				await this.publishScheduleRuntime();
			} else if (localId === "periodOverrides") {
				try {
					const raw = typeof state.val === "string" ? JSON.parse(String(state.val)) : state.val;
					const cleaned = raw && typeof raw === "object" ? (raw as Record<string, boolean>) : {};
					await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, JSON.stringify(cleaned), true);
					await this.publishScheduleRuntime();
				} catch (error) {
					this.log.error(`Invalid periodOverrides: ${(error as Error).message}`);
				}
			} else if (localId === "clearAfterLast") {
				await this.setState(`${SCHEDULE_CHANNEL}.clearAfterLast`, Boolean(state.val), true);
				await this.publishScheduleRuntime();
			} else if (localId === "weeklyPlan") {
				const weekly = parseWeeklyPlan(state.val);
				await this.setState(`${SCHEDULE_CHANNEL}.weeklyPlan`, JSON.stringify(weekly), true);
				this.lastAppliedWeekday = null;
				await this.publishScheduleRuntime();
			} else if (localId === "weeklyPlansLibrary") {
				const library = parseWeeklyPlansLibrary(state.val);
				await this.setState(`${SCHEDULE_CHANNEL}.weeklyPlansLibrary`, JSON.stringify(library), true);
				await this.syncWeeklyPlansTableToNative();
			} else if (localId === "loadDailyFromWeekly") {
				await this.setState(`${SCHEDULE_CHANNEL}.loadDailyFromWeekly`, Boolean(state.val), true);
				this.lastAppliedWeekday = null;
				await this.publishScheduleRuntime();
			}
			return;
		}

		if (!this.timerManager || !id.startsWith(`${this.namespace}.${TIMER_CHANNEL}.`)) {
			return;
		}

		const localId = id.replace(`${this.namespace}.${TIMER_CHANNEL}.`, "");
		const maxHours = this.config.maxDurationHours ?? 24;

		try {
			switch (localId) {
				case "start":
					if (state.val === true) {
						await this.timerManager.start();
					}
					await this.setState(`${TIMER_CHANNEL}.start`, false, true);
					break;
				case "pause":
					if (state.val === true) {
						await this.timerManager.pause();
					}
					await this.setState(`${TIMER_CHANNEL}.pause`, false, true);
					break;
				case "resume":
					if (state.val === true) {
						await this.timerManager.resume();
					}
					await this.setState(`${TIMER_CHANNEL}.resume`, false, true);
					break;
				case "stop":
					if (state.val === true) {
						await this.timerManager.stop();
					}
					await this.setState(`${TIMER_CHANNEL}.stop`, false, true);
					break;
				case "duration":
					if (typeof state.val === "number") {
						await this.timerManager.setDuration(state.val, maxHours);
					}
					break;
				case "setDurationHours":
					if (typeof state.val === "number") {
						await this.applyDurationParts(Math.round(state.val), undefined, maxHours);
					}
					await this.setState(`${TIMER_CHANNEL}.setDurationHours`, 0, true);
					break;
				case "setDurationMinutes":
					if (typeof state.val === "number") {
						await this.applyDurationParts(undefined, Math.round(state.val), maxHours);
					}
					await this.setState(`${TIMER_CHANNEL}.setDurationMinutes`, 0, true);
					break;
				default:
					break;
			}
		} catch (error) {
			this.log.error(`Timer command failed (${localId}): ${(error as Error).message}`);
		}
	}

	private reply(obj: ioBroker.Message, payload: unknown): void {
		if (obj.callback) {
			this.sendTo(obj.from, obj.command, payload, obj.callback);
		}
	}

	private async loadPictogramLibrary(): Promise<PictogramLibrary> {
		try {
			const file = await this.readFileAsync(this.namespace, ADAPTER_LIBRARY_FILE);
			const raw = typeof file.file === "string" ? file.file : Buffer.from(file.file).toString("utf8");
			return parseLibrary(raw);
		} catch {
			return emptyLibrary();
		}
	}

	private async savePictogramLibrary(library: PictogramLibrary): Promise<void> {
		await this.writeFileAsync(this.namespace, ADAPTER_LIBRARY_FILE, JSON.stringify(library, null, 2));
		await this.setState(`${SCHEDULE_CHANNEL}.pictogramLibrary`, JSON.stringify(library), true);
	}

	private async listPictogramFiles(): Promise<string[] | null> {
		try {
			const result = await this.readDirAsync(PICTOGRAM_FILE_ADAPTER, PICTOGRAM_DIR);
			return (result || [])
				.filter(entry => !entry.isDir && !isIgnoredPictogramFile(entry.file))
				.map(entry => entry.file);
		} catch {
			return null;
		}
	}

	private async getMergedPictogramLibrary(): Promise<PictogramLibrary> {
		const library = await this.loadPictogramLibrary();
		const files = await this.listPictogramFiles();
		if (!files) {
			return library;
		}
		const known = new Set(library.items.map(item => item.filename));
		for (const filename of files) {
			if (known.has(filename)) {
				continue;
			}
			library.items.push({
				id: filename,
				filename,
				path: pictogramStoragePath(filename),
				label: filename.replace(/\.[^.]+$/, "").replace(/-\d+$/, ""),
				tags: [],
				originalName: filename,
				mime: "",
				uploadedAt: 0,
			});
		}
		library.items = library.items.filter(item => files.includes(item.filename));
		library.items.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
		return library;
	}

	/**
	 * Custom pictogram library (user-owned images only).
	 * ARASAAC images must never be uploaded here – use external IDs only.
	 *
	 * @param obj
	 */
	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj?.command) {
			return;
		}

		try {
			if (obj.command === "syncPictogramTable") {
				await this.ensurePictogramStore();
				const rows = await this.buildCustomPictogramRows();
				await this.patchInstanceNativeIfChanged({ customPictograms: rows });
				this.config.customPictograms = rows;
				await this.publishPictogramLibrary();
				this.reply(obj, { ok: true, native: { customPictograms: rows } });
				return;
			}

			if (obj.command === "syncWeeklyPlansTable") {
				const nativeMsg = obj.message as {
					weeklyPlanRows?: Array<{ id?: string; name?: string; active?: string }>;
				};
				if (Array.isArray(nativeMsg?.weeklyPlanRows)) {
					this.config.weeklyPlanRows = nativeMsg.weeklyPlanRows;
					await this.applyWeeklyPlanRowsFromConfig();
				}
				await this.syncWeeklyPlansTableToNative();
				const library = await this.getWeeklyPlansLibrary();
				this.reply(obj, {
					ok: true,
					native: { weeklyPlanRows: this.config.weeklyPlanRows || [] },
					activeId: library.activeId,
				});
				return;
			}

			if (obj.command === "uploadPictogram") {
				const payload = obj.message as {
					filename?: string;
					base64?: string;
					mime?: string;
					label?: string;
					tags?: string[] | string;
				};
				const originalName = String(payload?.filename || "image.png");
				const filename = uniquePictogramFilename(originalName);
				const base64 = String(payload?.base64 || "");
				if (!base64) {
					throw new Error("filename and base64 required");
				}
				if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) {
					throw new Error("unsupported file type");
				}
				const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
				if (!buffer.length) {
					throw new Error("empty file");
				}
				if (buffer.length > 5 * 1024 * 1024) {
					throw new Error("file too large (max 5 MB)");
				}
				const path = pictogramStoragePath(filename);
				await this.writeFileAsync(PICTOGRAM_FILE_ADAPTER, path, buffer);
				const library = await this.getMergedPictogramLibrary();
				const entry: CustomPictogram = {
					id: filename,
					filename,
					path,
					label: String(payload?.label || originalName.replace(/\.[^.]+$/, "")),
					tags: normalizeTags(payload?.tags),
					originalName,
					mime: String(payload?.mime || ""),
					uploadedAt: Date.now(),
				};
				library.items = [entry, ...library.items.filter(item => item.filename !== filename)];
				await this.savePictogramLibrary(library);
				await this.syncCustomPictogramsConfig();
				this.log.info(`Custom pictogram stored: ${PICTOGRAM_FILE_ADAPTER}/${path} (${buffer.length} bytes)`);
				this.reply(obj, {
					ok: true,
					path,
					url: pictogramPublicUrl(path),
					item: entry,
					library,
					adapter: PICTOGRAM_FILE_ADAPTER,
				});
				return;
			}

			if (obj.command === "listPictograms") {
				const library = await this.getPublishedPictogramLibrary();
				this.reply(obj, {
					ok: true,
					files: library.items.map(item => item.filename),
					library,
				});
				return;
			}

			if (obj.command === "updatePictogram") {
				const payload = obj.message as {
					path?: string;
					filename?: string;
					label?: string;
					tags?: string[] | string;
				};
				const key = String(payload?.path || payload?.filename || "");
				if (!key) {
					throw new Error("path required");
				}
				const library = await this.getMergedPictogramLibrary();
				const item = library.items.find(entry => matchesPictogramKey(entry, key));
				if (!item) {
					throw new Error("pictogram not found");
				}
				if (payload.label !== undefined) {
					item.label = String(payload.label);
				}
				if (payload.tags !== undefined) {
					item.tags = normalizeTags(payload.tags);
				}
				await this.savePictogramLibrary(library);
				this.reply(obj, { ok: true, item, library });
				return;
			}

			if (obj.command === "deletePictogram") {
				const payload = obj.message as { path?: string; filename?: string };
				const key = String(payload?.path || payload?.filename || "");
				if (!key) {
					throw new Error("path required");
				}
				const library = await this.getMergedPictogramLibrary();
				const item = library.items.find(entry => matchesPictogramKey(entry, key));
				if (!item) {
					throw new Error("pictogram not found");
				}
				try {
					await this.unlinkAsync(PICTOGRAM_FILE_ADAPTER, item.path);
				} catch (error) {
					this.log.warn(`Could not delete pictogram file ${item.path}: ${(error as Error).message}`);
				}
				library.items = library.items.filter(entry => entry.filename !== item.filename);
				await this.savePictogramLibrary(library);
				this.reply(obj, { ok: true, library });
			}
		} catch (error) {
			this.log.error(`Pictogram command ${obj.command} failed: ${(error as Error).message}`);
			this.reply(obj, { ok: false, error: (error as Error).message });
		}
	}

	private async applyDurationParts(
		hours: number | undefined,
		minutes: number | undefined,
		maxHours: number,
	): Promise<void> {
		if (!this.timerManager) {
			return;
		}
		const snapshot = this.timerManager.getSnapshot();
		const current = secondsToParts(snapshot.duration);
		const nextHours = hours ?? current.hours;
		const nextMinutes = minutes ?? current.minutes;
		const totalSeconds = nextHours * 3600 + nextMinutes * 60;
		await this.timerManager.setDuration(totalSeconds, maxHours);
	}

	private onUnload(callback: () => void): void {
		if (this.scheduleTick !== undefined && this.scheduleTick !== null) {
			this.clearInterval(this.scheduleTick);
			this.scheduleTick = null;
		}
		this.timerManager?.destroy();
		this.timerManager = null;
		callback();
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AutismSupport(options);
} else {
	(() => new AutismSupport())();
}
