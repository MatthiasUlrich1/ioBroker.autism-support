"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var timer_manager_exports = {};
__export(timer_manager_exports, {
  TimerManager: () => TimerManager
});
module.exports = __toCommonJS(timer_manager_exports);
class TimerManager {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
  }
  durationSeconds = 3600;
  remainingSeconds = 3600;
  running = false;
  paused = false;
  finished = false;
  tickHandle = null;
  getSnapshot() {
    return this.buildSnapshot();
  }
  async setDuration(seconds, maxHours) {
    const maxSeconds = maxHours * 3600;
    this.durationSeconds = Math.max(60, Math.min(maxSeconds, Math.round(seconds)));
    if (!this.running) {
      this.remainingSeconds = this.durationSeconds;
      this.finished = false;
      this.paused = false;
    }
    await this.emitUpdate();
  }
  async start() {
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
  async pause() {
    if (!this.running || this.paused) {
      return;
    }
    this.paused = true;
    this.running = false;
    this.stopTick();
    await this.emitUpdate();
  }
  async resume() {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.running = true;
    this.finished = false;
    this.startTick();
    await this.emitUpdate();
  }
  async stop() {
    this.running = false;
    this.paused = false;
    this.finished = false;
    this.remainingSeconds = this.durationSeconds;
    this.stopTick();
    await this.emitUpdate();
  }
  async reset() {
    await this.stop();
  }
  destroy() {
    this.stopTick();
  }
  startTick() {
    this.stopTick();
    this.tickHandle = setInterval(() => {
      void this.tick();
    }, 1e3);
  }
  stopTick() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }
  async tick() {
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
  buildSnapshot() {
    const elapsed = Math.max(0, this.durationSeconds - this.remainingSeconds);
    return {
      duration: this.durationSeconds,
      remaining: this.remainingSeconds,
      elapsed,
      running: this.running,
      paused: this.paused,
      finished: this.finished
    };
  }
  async emitUpdate() {
    await this.onUpdate(this.buildSnapshot());
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TimerManager
});
//# sourceMappingURL=timer-manager.js.map
