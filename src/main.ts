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
	LIBRARY_FILE,
	PICTOGRAM_DIR,
	emptyLibrary,
	libraryFromNativeRows,
	mergePictogramSources,
	normalizeTags,
	parseLibrary,
	uniquePictogramFilename,
	type CustomPictogram,
	type PictogramLibrary,
} from "./lib/pictogram-library";

const TIMER_CHANNEL = "timer";
const SCHEDULE_CHANNEL = "schedule";

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
		const maxHours = this.config.maxDurationHours ?? 24;
		const defaultSeconds = this.getDefaultDurationSeconds(maxHours);
		this.dayPeriods = dayPeriodsFromConfig(this.config);

		await this.createTimerStates();
		await this.ensurePictogramStore();
		await this.createScheduleStates();

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

		this.log.info("Autism Support adapter ready – Visual Countdown + Daily Schedule");
	}

	private getDefaultDurationSeconds(maxHours: number): number {
		const hours = Math.min(maxHours, Math.max(0, this.config.defaultDurationHours ?? 1));
		const minutes = Math.min(59, Math.max(0, this.config.defaultDurationMinutes ?? 0));
		const total = hours * 3600 + minutes * 60;
		return Math.max(60, Math.min(maxHours * 3600, total));
	}

	private async createTimerStates(): Promise<void> {
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
				role: "timer",
				name: "Timer duration (seconds)",
				read: true,
				write: true,
				unit: "s",
				min: 60,
				max: 86400,
			},
			remaining: {
				type: "number",
				role: "timer",
				name: "Timer remaining (seconds)",
				read: true,
				write: false,
				unit: "s",
			},
			elapsed: {
				type: "number",
				role: "timer",
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
				read: true,
				write: true,
			},
			pause: {
				type: "boolean",
				role: "button.pause",
				name: "Pause timer",
				read: true,
				write: true,
			},
			resume: {
				type: "boolean",
				role: "button.start",
				name: "Resume timer",
				read: true,
				write: true,
			},
			stop: {
				type: "boolean",
				role: "button.stop",
				name: "Stop timer",
				read: true,
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
		// Publish admin period definitions once at start (times/colors); overrides stay separate.
		await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
		await this.publishPictogramLibrary();
	}

	private async ensurePictogramStore(): Promise<void> {
		try {
			await this.readDirAsync(this.namespace, PICTOGRAM_DIR);
		} catch {
			await this.writeFileAsync(this.namespace, LIBRARY_FILE, JSON.stringify(emptyLibrary(), null, 2));
			this.log.info(`Created file store ${this.namespace}/${PICTOGRAM_DIR}`);
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

	private async publishScheduleRuntime(): Promise<void> {
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
			const file = await this.readFileAsync(this.namespace, LIBRARY_FILE);
			const raw = typeof file.file === "string" ? file.file : Buffer.from(file.file).toString("utf8");
			return parseLibrary(raw);
		} catch {
			return emptyLibrary();
		}
	}

	private async savePictogramLibrary(library: PictogramLibrary): Promise<void> {
		await this.writeFileAsync(this.namespace, LIBRARY_FILE, JSON.stringify(library, null, 2));
		await this.setState(`${SCHEDULE_CHANNEL}.pictogramLibrary`, JSON.stringify(library), true);
	}

	private async listPictogramFiles(): Promise<string[] | null> {
		try {
			const result = await this.readDirAsync(this.namespace, PICTOGRAM_DIR);
			return (result || [])
				.filter(entry => !entry.isDir && entry.file !== "_library.json")
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
				path: `${PICTOGRAM_DIR}/${filename}`,
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
				const path = `${PICTOGRAM_DIR}/${filename}`;
				await this.writeFileAsync(this.namespace, path, buffer);
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
				this.log.info(`Custom pictogram stored: ${path} (${buffer.length} bytes)`);
				this.reply(obj, { ok: true, path, item: entry, library, namespace: this.namespace });
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
				const item = library.items.find(
					entry =>
						entry.path === key || entry.filename === key || `${PICTOGRAM_DIR}/${entry.filename}` === key,
				);
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
				const item = library.items.find(
					entry =>
						entry.path === key || entry.filename === key || `${PICTOGRAM_DIR}/${entry.filename}` === key,
				);
				if (!item) {
					throw new Error("pictogram not found");
				}
				try {
					await this.unlinkAsync(this.namespace, item.path);
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
