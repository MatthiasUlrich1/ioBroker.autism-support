/** Current timer values published to ioBroker states. */
export interface TimerSnapshot {
	/**
	 *
	 */
	duration: number;
	/**
	 *
	 */
	remaining: number;
	/**
	 *
	 */
	elapsed: number;
	/**
	 *
	 */
	running: boolean;
	/**
	 *
	 */
	paused: boolean;
	/**
	 *
	 */
	finished: boolean;
}

/** Countdown timer with second ticks and state callbacks. */
export class TimerManager {
	private durationSeconds = 3600;
	private remainingSeconds = 3600;
	private running = false;
	private paused = false;
	private finished = false;
	private tickHandle: NodeJS.Timeout | null = null;

	/**
	 * @param onUpdate Called whenever the timer snapshot changes
	 */
	public constructor(private readonly onUpdate: (snapshot: TimerSnapshot) => Promise<void>) {}

	/** Returns the current timer snapshot. */
	public getSnapshot(): TimerSnapshot {
		return this.buildSnapshot();
	}

	/**
	 * Sets the total duration. Resets remaining time when the timer is idle.
	 *
	 * @param seconds Desired duration in seconds
	 * @param maxHours Upper limit in hours
	 */
	public async setDuration(seconds: number, maxHours: number): Promise<void> {
		const maxSeconds = maxHours * 3600;
		this.durationSeconds = Math.max(60, Math.min(maxSeconds, Math.round(seconds)));
		if (!this.running) {
			this.remainingSeconds = this.durationSeconds;
			this.finished = false;
			this.paused = false;
		}
		await this.emitUpdate();
	}

	/** Starts or restarts the countdown. */
	public async start(): Promise<void> {
		if (this.running && !this.paused) {
			return;
		}
		if (this.remainingSeconds <= 0) {
			this.remainingSeconds = this.durationSeconds;
		}
		this.running = true;
		this.paused = false;
		this.finished = false;
		this.startTick();
		await this.emitUpdate();
	}

	/** Pauses a running countdown. */
	public async pause(): Promise<void> {
		if (!this.running || this.paused) {
			return;
		}
		this.paused = true;
		this.running = false;
		this.stopTick();
		await this.emitUpdate();
	}

	/** Continues a paused countdown. */
	public async resume(): Promise<void> {
		if (!this.paused) {
			return;
		}
		this.paused = false;
		this.running = true;
		this.finished = false;
		this.startTick();
		await this.emitUpdate();
	}

	/** Stops and resets remaining time to the configured duration. */
	public async stop(): Promise<void> {
		this.running = false;
		this.paused = false;
		this.finished = false;
		this.remainingSeconds = this.durationSeconds;
		this.stopTick();
		await this.emitUpdate();
	}

	/** Alias for stop(). */
	public async reset(): Promise<void> {
		await this.stop();
	}

	/** Clears the internal tick interval. */
	public destroy(): void {
		this.stopTick();
	}

	private startTick(): void {
		this.stopTick();
		this.tickHandle = setInterval(() => {
			void this.tick();
		}, 1000);
	}

	private stopTick(): void {
		if (this.tickHandle) {
			clearInterval(this.tickHandle);
			this.tickHandle = null;
		}
	}

	private async tick(): Promise<void> {
		if (!this.running || this.paused) {
			return;
		}
		if (this.remainingSeconds <= 0) {
			this.running = false;
			this.finished = true;
			this.remainingSeconds = 0;
			this.stopTick();
			await this.emitUpdate();
			return;
		}
		this.remainingSeconds -= 1;
		if (this.remainingSeconds <= 0) {
			this.remainingSeconds = 0;
			this.running = false;
			this.finished = true;
			this.stopTick();
		}
		await this.emitUpdate();
	}

	private buildSnapshot(): TimerSnapshot {
		const elapsed = Math.max(0, this.durationSeconds - this.remainingSeconds);
		return {
			duration: this.durationSeconds,
			remaining: this.remainingSeconds,
			elapsed,
			running: this.running,
			paused: this.paused,
			finished: this.finished,
		};
	}

	private async emitUpdate(): Promise<void> {
		await this.onUpdate(this.buildSnapshot());
	}
}
