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
var import_day_periods = require("./lib/day-periods");
var import_schedule_types = require("./lib/schedule-types");
var import_pictogram_library = require("./lib/pictogram-library");
const TIMER_CHANNEL = "timer";
const SCHEDULE_CHANNEL = "schedule";
function secondsToParts(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor(safe % 3600 / 60)
  };
}
class AutismSupport extends utils.Adapter {
  timerManager = null;
  scheduleTick = null;
  dayPeriods = [];
  constructor(options = {}) {
    super({
      ...options,
      name: "autism-support"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a;
    const maxHours = (_a = this.config.maxDurationHours) != null ? _a : 24;
    const defaultSeconds = this.getDefaultDurationSeconds(maxHours);
    this.dayPeriods = (0, import_day_periods.dayPeriodsFromConfig)(this.config);
    await this.createTimerStates();
    await this.createScheduleStates();
    this.timerManager = new import_timer_manager.TimerManager(
      async (snapshot) => {
        await this.publishTimerSnapshot(snapshot);
      },
      {
        setInterval: (handler, ms) => this.setInterval(handler, ms),
        clearInterval: (handle) => this.clearInterval(handle)
      }
    );
    await this.timerManager.setDuration(defaultSeconds, maxHours);
    await this.publishTimerSnapshot(this.timerManager.getSnapshot());
    await this.publishScheduleRuntime();
    this.subscribeStates(`${this.namespace}.${TIMER_CHANNEL}.*`);
    this.subscribeStates(`${this.namespace}.${SCHEDULE_CHANNEL}.*`);
    this.scheduleTick = this.setInterval(() => {
      void this.publishScheduleRuntime();
    }, 3e4);
    this.log.info("Autism Support adapter ready \u2013 Visual Countdown + Daily Schedule");
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
  async createScheduleStates() {
    await this.setObjectNotExistsAsync(SCHEDULE_CHANNEL, {
      type: "channel",
      common: { name: "Daily schedule" },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.plan`, {
      type: "state",
      common: {
        name: "Schedule plan (JSON)",
        type: "string",
        role: "json",
        read: true,
        write: true,
        def: JSON.stringify({ version: 1, items: [] })
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.periods`, {
      type: "state",
      common: {
        name: "Day periods from admin (JSON)",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.periodOverrides`, {
      type: "state",
      common: {
        name: "Day period on/off overrides from schedule config (JSON)",
        type: "string",
        role: "json",
        read: true,
        write: true,
        def: "{}"
      },
      native: {}
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
        max: 1439
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.currentPeriod`, {
      type: "state",
      common: {
        name: "Current day period id",
        type: "string",
        role: "text",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.currentItemIndex`, {
      type: "state",
      common: {
        name: "Index of active schedule item (-1 = none)",
        type: "number",
        role: "value",
        read: true,
        write: false,
        min: -1
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`, {
      type: "state",
      common: {
        name: "Clear plan automatically after last pictogram ends",
        type: "boolean",
        role: "switch",
        read: true,
        write: true,
        def: false
      },
      native: {}
    });
    await this.setObjectNotExistsAsync(`${SCHEDULE_CHANNEL}.pictogramLibrary`, {
      type: "state",
      common: {
        name: "Custom pictogram library (JSON)",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    const planState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.plan`);
    if ((planState == null ? void 0 : planState.val) == null || planState.val === "") {
      await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify({ version: 1, items: [] }), true);
    }
    const overridesState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.periodOverrides`);
    if ((overridesState == null ? void 0 : overridesState.val) == null || overridesState.val === "") {
      await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, "{}", true);
    }
    const clearAfterState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`);
    if ((clearAfterState == null ? void 0 : clearAfterState.val) == null) {
      await this.setState(`${SCHEDULE_CHANNEL}.clearAfterLast`, false, true);
    }
    await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
    await this.publishPictogramLibrary();
  }
  async publishPictogramLibrary() {
    const fromConfig = (0, import_pictogram_library.libraryFromNativeRows)(this.config.customPictograms);
    let library = fromConfig;
    if (!library.items.length) {
      library = await this.getMergedPictogramLibrary();
    }
    await this.setState(`${SCHEDULE_CHANNEL}.pictogramLibrary`, JSON.stringify(library), true);
  }
  async publishTimerSnapshot(snapshot) {
    await this.setState(`${TIMER_CHANNEL}.duration`, snapshot.duration, true);
    await this.setState(`${TIMER_CHANNEL}.remaining`, snapshot.remaining, true);
    await this.setState(`${TIMER_CHANNEL}.elapsed`, snapshot.elapsed, true);
    await this.setState(`${TIMER_CHANNEL}.running`, snapshot.running, true);
    await this.setState(`${TIMER_CHANNEL}.paused`, snapshot.paused, true);
    await this.setState(`${TIMER_CHANNEL}.finished`, snapshot.finished, true);
  }
  async getPlan() {
    const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.plan`);
    return (0, import_schedule_types.parseSchedulePlan)(state == null ? void 0 : state.val);
  }
  async getPeriodOverrides() {
    const state = await this.getStateAsync(`${SCHEDULE_CHANNEL}.periodOverrides`);
    try {
      const raw = typeof (state == null ? void 0 : state.val) === "string" ? JSON.parse(state.val) : state == null ? void 0 : state.val;
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }
  async getEffectivePeriods() {
    const overrides = await this.getPeriodOverrides();
    return this.dayPeriods.map((period) => ({
      ...period,
      enabled: overrides[period.id] === void 0 ? period.enabled : Boolean(overrides[period.id])
    }));
  }
  async publishScheduleRuntime() {
    var _a;
    const now = /* @__PURE__ */ new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const periods = await this.getEffectivePeriods();
    const period = (0, import_day_periods.findCurrentPeriod)(minutes, periods);
    let plan = await this.getPlan();
    const clearAfterState = await this.getStateAsync(`${SCHEDULE_CHANNEL}.clearAfterLast`);
    const clearAfterLast = Boolean(clearAfterState == null ? void 0 : clearAfterState.val);
    if (clearAfterLast && (0, import_schedule_types.isPlanFullyExpired)(plan, minutes, import_day_periods.parseTimeToMinutes)) {
      plan = { version: 1, items: [] };
      await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify(plan), true);
      this.log.info("Schedule plan cleared automatically after last pictogram ended");
    }
    const itemIndex = (0, import_schedule_types.findCurrentItemIndex)(plan, minutes, import_day_periods.parseTimeToMinutes);
    await this.setState(`${SCHEDULE_CHANNEL}.periods`, JSON.stringify(this.dayPeriods), true);
    await this.setState(`${SCHEDULE_CHANNEL}.nowMinutes`, minutes, true);
    await this.setState(`${SCHEDULE_CHANNEL}.currentPeriod`, (_a = period == null ? void 0 : period.id) != null ? _a : "", true);
    await this.setState(`${SCHEDULE_CHANNEL}.currentItemIndex`, itemIndex, true);
  }
  async onStateChange(id, state) {
    var _a;
    if (!state || state.ack) {
      return;
    }
    if (id.startsWith(`${this.namespace}.${SCHEDULE_CHANNEL}.`)) {
      const localId2 = id.replace(`${this.namespace}.${SCHEDULE_CHANNEL}.`, "");
      if (localId2 === "plan") {
        const plan = (0, import_schedule_types.parseSchedulePlan)(state.val);
        await this.setState(`${SCHEDULE_CHANNEL}.plan`, JSON.stringify(plan), true);
        await this.publishScheduleRuntime();
      } else if (localId2 === "periodOverrides") {
        try {
          const raw = typeof state.val === "string" ? JSON.parse(String(state.val)) : state.val;
          const cleaned = raw && typeof raw === "object" ? raw : {};
          await this.setState(`${SCHEDULE_CHANNEL}.periodOverrides`, JSON.stringify(cleaned), true);
          await this.publishScheduleRuntime();
        } catch (error) {
          this.log.error(`Invalid periodOverrides: ${error.message}`);
        }
      } else if (localId2 === "clearAfterLast") {
        await this.setState(`${SCHEDULE_CHANNEL}.clearAfterLast`, Boolean(state.val), true);
        await this.publishScheduleRuntime();
      }
      return;
    }
    if (!this.timerManager || !id.startsWith(`${this.namespace}.${TIMER_CHANNEL}.`)) {
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
  reply(obj, payload) {
    if (obj.callback) {
      this.sendTo(obj.from, obj.command, payload, obj.callback);
    }
  }
  async loadPictogramLibrary() {
    try {
      const file = await this.readFileAsync(this.namespace, import_pictogram_library.LIBRARY_FILE);
      const raw = typeof file.file === "string" ? file.file : Buffer.from(file.file).toString("utf8");
      return (0, import_pictogram_library.parseLibrary)(raw);
    } catch {
      return (0, import_pictogram_library.emptyLibrary)();
    }
  }
  async savePictogramLibrary(library) {
    await this.writeFileAsync(this.namespace, import_pictogram_library.LIBRARY_FILE, JSON.stringify(library, null, 2));
    await this.setState(`${SCHEDULE_CHANNEL}.pictogramLibrary`, JSON.stringify(library), true);
  }
  async listPictogramFiles() {
    try {
      const result = await this.readDirAsync(this.namespace, import_pictogram_library.PICTOGRAM_DIR);
      return (result || []).filter((entry) => !entry.isDir && entry.file !== "_library.json").map((entry) => entry.file);
    } catch {
      return null;
    }
  }
  async getMergedPictogramLibrary() {
    const library = await this.loadPictogramLibrary();
    const files = await this.listPictogramFiles();
    if (!files) {
      return library;
    }
    const known = new Set(library.items.map((item) => item.filename));
    for (const filename of files) {
      if (known.has(filename)) {
        continue;
      }
      library.items.push({
        id: filename,
        filename,
        path: `${import_pictogram_library.PICTOGRAM_DIR}/${filename}`,
        label: filename.replace(/\.[^.]+$/, "").replace(/-\d+$/, ""),
        tags: [],
        originalName: filename,
        mime: "",
        uploadedAt: 0
      });
    }
    library.items = library.items.filter((item) => files.includes(item.filename));
    library.items.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    return library;
  }
  /**
   * Custom pictogram library (user-owned images only).
   * ARASAAC images must never be uploaded here – use external IDs only.
   *
   * @param obj
   */
  async onMessage(obj) {
    if (!(obj == null ? void 0 : obj.command)) {
      return;
    }
    try {
      if (obj.command === "uploadPictogram") {
        const payload = obj.message;
        const originalName = String((payload == null ? void 0 : payload.filename) || "image.png");
        const filename = (0, import_pictogram_library.uniquePictogramFilename)(originalName);
        const base64 = String((payload == null ? void 0 : payload.base64) || "");
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
        const path = `${import_pictogram_library.PICTOGRAM_DIR}/${filename}`;
        await this.writeFileAsync(this.namespace, path, buffer);
        const library = await this.getMergedPictogramLibrary();
        const entry = {
          id: filename,
          filename,
          path,
          label: String((payload == null ? void 0 : payload.label) || originalName.replace(/\.[^.]+$/, "")),
          tags: (0, import_pictogram_library.normalizeTags)(payload == null ? void 0 : payload.tags),
          originalName,
          mime: String((payload == null ? void 0 : payload.mime) || ""),
          uploadedAt: Date.now()
        };
        library.items = [entry, ...library.items.filter((item) => item.filename !== filename)];
        await this.savePictogramLibrary(library);
        this.log.info(`Custom pictogram stored: ${path} (${buffer.length} bytes)`);
        this.reply(obj, { ok: true, path, item: entry, library, namespace: this.namespace });
        return;
      }
      if (obj.command === "listPictograms") {
        const fromConfig = (0, import_pictogram_library.libraryFromNativeRows)(this.config.customPictograms);
        const library = fromConfig.items.length ? fromConfig : await this.getMergedPictogramLibrary();
        this.reply(obj, {
          ok: true,
          files: library.items.map((item) => item.filename),
          library
        });
        return;
      }
      if (obj.command === "updatePictogram") {
        const payload = obj.message;
        const key = String((payload == null ? void 0 : payload.path) || (payload == null ? void 0 : payload.filename) || "");
        if (!key) {
          throw new Error("path required");
        }
        const library = await this.getMergedPictogramLibrary();
        const item = library.items.find(
          (entry) => entry.path === key || entry.filename === key || `${import_pictogram_library.PICTOGRAM_DIR}/${entry.filename}` === key
        );
        if (!item) {
          throw new Error("pictogram not found");
        }
        if (payload.label !== void 0) {
          item.label = String(payload.label);
        }
        if (payload.tags !== void 0) {
          item.tags = (0, import_pictogram_library.normalizeTags)(payload.tags);
        }
        await this.savePictogramLibrary(library);
        this.reply(obj, { ok: true, item, library });
        return;
      }
      if (obj.command === "deletePictogram") {
        const payload = obj.message;
        const key = String((payload == null ? void 0 : payload.path) || (payload == null ? void 0 : payload.filename) || "");
        if (!key) {
          throw new Error("path required");
        }
        const library = await this.getMergedPictogramLibrary();
        const item = library.items.find(
          (entry) => entry.path === key || entry.filename === key || `${import_pictogram_library.PICTOGRAM_DIR}/${entry.filename}` === key
        );
        if (!item) {
          throw new Error("pictogram not found");
        }
        try {
          await this.unlinkAsync(this.namespace, item.path);
        } catch (error) {
          this.log.warn(`Could not delete pictogram file ${item.path}: ${error.message}`);
        }
        library.items = library.items.filter((entry) => entry.filename !== item.filename);
        await this.savePictogramLibrary(library);
        this.reply(obj, { ok: true, library });
      }
    } catch (error) {
      this.log.error(`Pictogram command ${obj.command} failed: ${error.message}`);
      this.reply(obj, { ok: false, error: error.message });
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
    if (this.scheduleTick !== void 0 && this.scheduleTick !== null) {
      this.clearInterval(this.scheduleTick);
      this.scheduleTick = null;
    }
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
