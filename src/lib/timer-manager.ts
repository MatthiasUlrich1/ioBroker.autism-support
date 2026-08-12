export interface TimerSnapshot {
	duration: number;
	remaining: number;
	elapsed: number;
	running: boolean;
	paused: boolean;
	finished: boolean;
}

export class TimerManager {
	private durationSeconds = 3600;
	private remainingSeconds = 3600;
	private running = false;
	private paused = false;
	private finished = false;
	private tickHandle: NodeJS.Timeout | null = null;

	public constructor(
		private readonly onUpdate: (snapshot: TimerSnapshot) => Promise<void>,
	) {}

	public getSnapshot(): TimerSnapshot {
		return this.buildSnapshot();
	}

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

	public async pause(): Promise<void> {
		if (!this.running || this.paused) {
			return;
		}
		this.paused = true;
		this.running = false;
		this.stopTick();
		await this.emitUpdate();
	}

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

	public async stop(): Promise<void> {
		this.running = false;
		this.paused = false;
		this.finished = false;
		this.remainingSeconds = this.durationSeconds;
		this.stopTick();
		await this.emitUpdate();
	}

	public async reset(): Promise<void> {
		await this.stop();
	}

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
