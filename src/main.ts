/*
 * ioBroker.autism-support – Time Timer (MVP)
 */

import * as utils from "@iobroker/adapter-core";
import { TimerManager } from "./lib/timer-manager";

const TIMER_CHANNEL = "timer";

function secondsToParts(totalSeconds: number): { hours: number; minutes: number } {
	const safe = Math.max(0, Math.round(totalSeconds));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
	};
}

class AutismSupport extends utils.Adapter {
	private timerManager: TimerManager | null = null;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "autism-support",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		const maxHours = this.config.maxDurationHours ?? 24;
		const defaultSeconds = this.getDefaultDurationSeconds(maxHours);

		await this.createTimerStates();
		this.timerManager = new TimerManager(async (snapshot) => {
			await this.publishTimerSnapshot(snapshot);
		});

		await this.timerManager.setDuration(defaultSeconds, maxHours);
		await this.publishTimerSnapshot(this.timerManager.getSnapshot());

		this.subscribeStates(`${this.namespace}.${TIMER_CHANNEL}.*`);
		this.log.info("Autism Support adapter ready – Time Timer initialized");
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

	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack || !this.timerManager) {
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
