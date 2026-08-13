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
import { findCurrentItemIndex, parseSchedulePlan, type SchedulePlan } from "./lib/schedule-types";

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
	private scheduleTick: ReturnType<typeof setInterval> | null = null;
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
		await this.createScheduleStates();

		this.timerManager = new TimerManager(async snapshot => {
			await this.publishTimerSnapshot(snapshot);
		});

		await this.timerManager.setDuration(defaultSeconds, maxHours);
		await this.publishTimerSnapshot(this.timerManager.getSnapshot());
		await this.publishScheduleRuntime();

		this.subscribeStates(`${this.namespace}.${TIMER_CHANNEL}.*`);
		this.subscribeStates(`${this.namespace}.${SCHEDULE_CHANNEL}.*`);

		this.scheduleTick = setInterval(() => {
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

		const planState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.plan`);
		if (planState?.val == null || planState.val === "") {
			await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify({ version: 1, items: [] }), true);
		}
		const overridesState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.periodOverrides`);
		if (overridesState?.val == null || overridesState.val === "") {
			await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, "{}", true);
		}
		// Publish admin period definitions once at start (times/colors); overrides stay separate.
		await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
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
		const plan = await this.getPlan();
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
					const cleaned =
						raw && typeof raw === "object" ? (raw as Record<string, boolean>) : {};
					await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, JSON.stringify(cleaned), true);
					await this.publishScheduleRuntime();
				} catch (error) {
					this.log.error(`Invalid periodOverrides: ${(error as Error).message}`);
				}
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

	/**
	 * Custom pictogram upload (user-owned images only).
	 * ARASAAC images must never be uploaded here – use external IDs only.
	 */
	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj?.command) {
			return;
		}

		if (obj.command === "uploadPictogram") {
			try {
				const payload = obj.message as {
					filename?: string;
					base64?: string;
					mime?: string;
				};
				const filename = String(payload?.filename || "")
					.replace(/[^a-zA-Z0-9._-]/g, "_")
					.slice(0, 120);
				const base64 = String(payload?.base64 || "");
				if (!filename || !base64) {
					throw new Error("filename and base64 required");
				}
				const lower = filename.toLowerCase();
				if (!/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
					throw new Error("unsupported file type");
				}
				const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
				if (buffer.length > 5 * 1024 * 1024) {
					throw new Error("file too large (max 5 MB)");
				}
				const path = `pictograms/${filename}`;
				await this.writeFileAsync(this.namespace, path, buffer);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { ok: true, path, namespace: this.namespace }, obj.callback);
				}
			} catch (error) {
				if (obj.callback) {
					this.sendTo(
						obj.from,
						obj.command,
						{ ok: false, error: (error as Error).message },
						obj.callback,
					);
				}
			}
			return;
		}

		if (obj.command === "listPictograms") {
			try {
				const result = await this.readDirAsync(this.namespace, "pictograms");
				const files = (result || [])
					.filter(entry => !entry.isDir)
					.map(entry => entry.file);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { ok: true, files }, obj.callback);
				}
			} catch {
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { ok: true, files: [] }, obj.callback);
				}
			}
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
		if (this.scheduleTick) {
			clearInterval(this.scheduleTick);
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
