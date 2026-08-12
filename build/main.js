"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_timer_manager = require("./lib/timer-manager");
const TIMER_CHANNEL = "timer";
function secondsToParts(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor(safe % 3600 / 60)
  };
}
class AutismSupport extends utils.Adapter {
  timerManager = null;
  constructor(options = {}) {
    super({
      ...options,
      name: "autism-support"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a;
    const maxHours = (_a = this.config.maxDurationHours) != null ? _a : 24;
    const defaultSeconds = this.getDefaultDurationSeconds(maxHours);
    await this.createTimerStates();
    this.timerManager = new import_timer_manager.TimerManager(async (snapshot) => {
      await this.publishTimerSnapshot(snapshot);
    });
    await this.timerManager.setDuration(defaultSeconds, maxHours);
    await this.publishTimerSnapshot(this.timerManager.getSnapshot());
    this.subscribeStates(`${this.namespace}.${TIMER_CHANNEL}.*`);
    this.log.info("Autism Support adapter ready \u2013 Visual Countdown initialized");
  }
  getDefaultDurationSeconds(maxHours) {
    var _a, _b;
    const hours = Math.min(maxHours, Math.max(0, (_a = this.config.defaultDurationHours) != null ? _a : 1));
    const minutes = Math.min(59, Math.max(0, (_b = this.config.defaultDurationMinutes) != null ? _b : 0));
    const total = hours * 3600 + minutes * 60;
    return Math.max(60, Math.min(maxHours * 3600, total));
  }
  async createTimerStates() {
    const states = {
      duration: {
        type: "number",
        role: "timer",
        name: "Timer duration (seconds)",
        read: true,
        write: true,
        unit: "s",
        min: 60,
        max: 86400
      },
      remaining: {
        type: "number",
        role: "timer",
        name: "Timer remaining (seconds)",
        read: true,
        write: false,
        unit: "s"
      },
      elapsed: {
        type: "number",
        role: "timer",
        name: "Timer elapsed (seconds)",
        read: true,
        write: false,
        unit: "s"
      },
      running: {
        type: "boolean",
        role: "indicator",
        name: "Timer running",
        read: true,
        write: false
      },
      paused: {
        type: "boolean",
        role: "indicator",
        name: "Timer paused",
        read: true,
        write: false
      },
      finished: {
        type: "boolean",
        role: "indicator",
        name: "Timer finished",
        read: true,
        write: false
      },
      start: {
        type: "boolean",
        role: "button.start",
        name: "Start timer",
        read: true,
        write: true
      },
      pause: {
        type: "boolean",
        role: "button.pause",
        name: "Pause timer",
        read: true,
        write: true
      },
      resume: {
        type: "boolean",
        role: "button.start",
        name: "Resume timer",
        read: true,
        write: true
      },
      stop: {
        type: "boolean",
        role: "button.stop",
        name: "Stop timer",
        read: true,
        write: true
      },
      setDurationHours: {
        type: "number",
        role: "level",
        name: "Set timer duration (hours)",
        read: true,
        write: true,
        unit: "h",
        min: 0,
        max: 24
      },
      setDurationMinutes: {
        type: "number",
        role: "level",
        name: "Set timer duration (minutes)",
        read: true,
        write: true,
        unit: "min",
        min: 0,
        max: 59
      }
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
          max: def.max
        },
        native: {}
      });
    }
  }
  async publishTimerSnapshot(snapshot) {
    await this.setState(`${TIMER_CHANNEL}.duration`, snapshot.duration, true);
    await this.setState(`${TIMER_CHANNEL}.remaining`, snapshot.remaining, true);
    await this.setState(`${TIMER_CHANNEL}.elapsed`, snapshot.elapsed, true);
    await this.setState(`${TIMER_CHANNEL}.running`, snapshot.running, true);
    await this.setState(`${TIMER_CHANNEL}.paused`, snapshot.paused, true);
    await this.setState(`${TIMER_CHANNEL}.finished`, snapshot.finished, true);
  }
  async onStateChange(id, state) {
    var _a;
    if (!state || state.ack || !this.timerManager) {
      return;
    }
    const localId = id.replace(`${this.namespace}.${TIMER_CHANNEL}.`, "");
    const maxHours = (_a = this.config.maxDurationHours) != null ? _a : 24;
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
            await this.applyDurationParts(Math.round(state.val), void 0, maxHours);
          }
          await this.setState(`${TIMER_CHANNEL}.setDurationHours`, 0, true);
          break;
        case "setDurationMinutes":
          if (typeof state.val === "number") {
            await this.applyDurationParts(void 0, Math.round(state.val), maxHours);
          }
          await this.setState(`${TIMER_CHANNEL}.setDurationMinutes`, 0, true);
          break;
        default:
          break;
      }
    } catch (error) {
      this.log.error(`Timer command failed (${localId}): ${error.message}`);
    }
  }
  async applyDurationParts(hours, minutes, maxHours) {
    if (!this.timerManager) {
      return;
    }
    const snapshot = this.timerManager.getSnapshot();
    const current = secondsToParts(snapshot.duration);
    const nextHours = hours != null ? hours : current.hours;
    const nextMinutes = minutes != null ? minutes : current.minutes;
    const totalSeconds = nextHours * 3600 + nextMinutes * 60;
    await this.timerManager.setDuration(totalSeconds, maxHours);
  }
  onUnload(callback) {
    var _a;
    (_a = this.timerManager) == null ? void 0 : _a.destroy();
    this.timerManager = null;
    callback();
  }
}
if (require.main !== module) {
  module.exports = (options) => new AutismSupport(options);
} else {
  (() => new AutismSupport())();
}
//# sourceMappingURL=main.js.map
