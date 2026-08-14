import { expect } from "chai";
import { TimerManager } from "./lib/timer-manager";

describe("TimerManager", () => {
	it("should set duration and reset remaining when idle", async () => {
		const updates: number[] = [];
		const manager = new TimerManager(
			snapshot => {
				updates.push(snapshot.remaining);
				return Promise.resolve();
			},
			{ setInterval, clearInterval },
		);

		await manager.setDuration(120, 24);
		const snapshot = manager.getSnapshot();
		expect(snapshot.duration).to.equal(120);
		expect(snapshot.remaining).to.equal(120);
		expect(snapshot.running).to.be.false;
		expect(updates.length).to.be.greaterThan(0);

		manager.destroy();
	});
});
