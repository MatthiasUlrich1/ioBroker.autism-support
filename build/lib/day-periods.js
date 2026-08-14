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
var day_periods_exports = {};
__export(day_periods_exports, {
  DAY_PERIOD_IDS: () => DAY_PERIOD_IDS,
  DEFAULT_DAY_PERIODS: () => DEFAULT_DAY_PERIODS,
  dayPeriodsFromConfig: () => dayPeriodsFromConfig,
  findCurrentPeriod: () => findCurrentPeriod,
  isMinutesInPeriod: () => isMinutesInPeriod,
  minutesToTime: () => minutesToTime,
  parseTimeToMinutes: () => parseTimeToMinutes,
  periodToSegments: () => periodToSegments
});
module.exports = __toCommonJS(day_periods_exports);
const DAY_PERIOD_IDS = ["morning", "forenoon", "noon", "afternoon", "evening", "night"];
const DEFAULT_DAY_PERIODS = [
  { id: "morning", enabled: true, start: "06:00", end: "09:00", color: "#FFE082" },
  { id: "forenoon", enabled: true, start: "09:00", end: "12:00", color: "#FFCC80" },
  { id: "noon", enabled: true, start: "12:00", end: "14:00", color: "#FFAB91" },
  { id: "afternoon", enabled: true, start: "14:00", end: "17:00", color: "#81C784" },
  { id: "evening", enabled: true, start: "17:00", end: "21:00", color: "#7986CB" },
  { id: "night", enabled: true, start: "21:00", end: "06:00", color: "#5C6BC0" }
];
function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return 0;
  }
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return h * 60 + m;
}
function minutesToTime(total) {
  const safe = (Math.round(total) % 1440 + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function isMinutesInPeriod(minutes, start, end) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  const t = (minutes % 1440 + 1440) % 1440;
  if (s === e) {
    return true;
  }
  if (s < e) {
    return t >= s && t < e;
  }
  return t >= s || t < e;
}
function findCurrentPeriod(minutes, periods) {
  for (const period of periods) {
    if (period.enabled && isMinutesInPeriod(minutes, period.start, period.end)) {
      return period;
    }
  }
  return null;
}
function periodToSegments(period) {
  if (!period.enabled) {
    return [];
  }
  const s = parseTimeToMinutes(period.start);
  const e = parseTimeToMinutes(period.end);
  if (s === e) {
    return [{ startMin: 0, endMin: 1440, color: period.color, id: period.id }];
  }
  if (s < e) {
    return [{ startMin: s, endMin: e, color: period.color, id: period.id }];
  }
  return [
    { startMin: s, endMin: 1440, color: period.color, id: period.id },
    { startMin: 0, endMin: e, color: period.color, id: period.id }
  ];
}
function dayPeriodsFromConfig(config) {
  return DAY_PERIOD_IDS.map((id) => {
    const cap = id.charAt(0).toUpperCase() + id.slice(1);
    const enabledKey = `period${cap}Enabled`;
    const startKey = `period${cap}Start`;
    const endKey = `period${cap}End`;
    const colorKey = `period${cap}Color`;
    const fallback = DEFAULT_DAY_PERIODS.find((p) => p.id === id);
    const start = config[startKey];
    const end = config[endKey];
    const color = config[colorKey];
    return {
      id,
      enabled: config[enabledKey] !== false,
      start: typeof start === "string" ? start : fallback.start,
      end: typeof end === "string" ? end : fallback.end,
      color: typeof color === "string" ? color : fallback.color
    };
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DAY_PERIOD_IDS,
  DEFAULT_DAY_PERIODS,
  dayPeriodsFromConfig,
  findCurrentPeriod,
  isMinutesInPeriod,
  minutesToTime,
  parseTimeToMinutes,
  periodToSegments
});
//# sourceMappingURL=day-periods.js.map
