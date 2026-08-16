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
var weekly_plan_exports = {};
__export(weekly_plan_exports, {
  DEFAULT_WEEKDAY_COLORS: () => DEFAULT_WEEKDAY_COLORS,
  EMPTY_WEEKLY_PLAN: () => EMPTY_WEEKLY_PLAN,
  EMPTY_WEEKLY_PLANS_LIBRARY: () => EMPTY_WEEKLY_PLANS_LIBRARY,
  WEEKDAY_KEYS: () => WEEKDAY_KEYS,
  applyWeeklyPlanRowsToLibrary: () => applyWeeklyPlanRowsToLibrary,
  createEmptyWeeklyPlan: () => createEmptyWeeklyPlan,
  parseWeekdayColors: () => parseWeekdayColors,
  parseWeeklyPlan: () => parseWeeklyPlan,
  parseWeeklyPlansLibrary: () => parseWeeklyPlansLibrary,
  schedulePlansEqual: () => schedulePlansEqual,
  weekdayColorsFromConfig: () => weekdayColorsFromConfig,
  weekdayKeyFromDate: () => weekdayKeyFromDate,
  weeklyPlanRowsFromLibrary: () => weeklyPlanRowsFromLibrary
});
module.exports = __toCommonJS(weekly_plan_exports);
var import_schedule_types = require("./schedule-types");
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function weekdayKeyFromDate(date) {
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[date.getDay()] || "mon";
}
const DEFAULT_WEEKDAY_COLORS = {
  mon: "#BBDEFB",
  tue: "#C8E6C9",
  wed: "#FFF9C4",
  thu: "#FFE0B2",
  fri: "#F8BBD0",
  sat: "#E1BEE7",
  sun: "#B2EBF2"
};
const EMPTY_WEEKLY_PLAN = {
  version: 1,
  days: {
    mon: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    tue: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    wed: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    thu: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    fri: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    sat: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] },
    sun: { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] }
  }
};
const EMPTY_WEEKLY_PLANS_LIBRARY = {
  version: 1,
  activeId: null,
  plans: []
};
function createEmptyWeeklyPlan(seed) {
  const day = seed ? (0, import_schedule_types.parseSchedulePlan)(seed) : { ...import_schedule_types.EMPTY_SCHEDULE_PLAN, items: [] };
  const days = {};
  for (const key of WEEKDAY_KEYS) {
    days[key] = {
      version: 1,
      items: day.items.map((item) => ({ ...item, id: `${key}-${item.id}` }))
    };
  }
  return { version: 1, days };
}
function parseWeeklyPlan(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") {
      return createEmptyWeeklyPlan();
    }
    const daysRaw = data.days;
    const days = {};
    for (const key of WEEKDAY_KEYS) {
      days[key] = (0, import_schedule_types.parseSchedulePlan)(daysRaw == null ? void 0 : daysRaw[key]);
    }
    return { version: 1, days };
  } catch {
    return createEmptyWeeklyPlan();
  }
}
function parseWeeklyPlansLibrary(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") {
      return { ...EMPTY_WEEKLY_PLANS_LIBRARY, plans: [] };
    }
    const plansIn = Array.isArray(data.plans) ? data.plans : [];
    const plans = plansIn.filter((p) => p && typeof p === "object" && p.id).map((p) => ({
      id: String(p.id),
      name: String(p.name || p.id),
      data: parseWeeklyPlan(p.data),
      updatedAt: String(p.updatedAt || (/* @__PURE__ */ new Date()).toISOString())
    }));
    const activeIdRaw = data.activeId;
    const activeId = activeIdRaw && plans.some((p) => p.id === activeIdRaw) ? String(activeIdRaw) : null;
    return { version: 1, activeId, plans };
  } catch {
    return { ...EMPTY_WEEKLY_PLANS_LIBRARY, plans: [] };
  }
}
function parseWeekdayColors(raw, fallback = DEFAULT_WEEKDAY_COLORS) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") {
      return { ...fallback };
    }
    const out = { ...fallback };
    for (const key of WEEKDAY_KEYS) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    return { ...fallback };
  }
}
function weekdayColorsFromConfig(config) {
  const out = { ...DEFAULT_WEEKDAY_COLORS };
  const map = {
    mon: "weekdayColorMon",
    tue: "weekdayColorTue",
    wed: "weekdayColorWed",
    thu: "weekdayColorThu",
    fri: "weekdayColorFri",
    sat: "weekdayColorSat",
    sun: "weekdayColorSun"
  };
  for (const key of WEEKDAY_KEYS) {
    const value = config[map[key]];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}
function schedulePlansEqual(a, b) {
  if (a.items.length !== b.items.length) {
    return false;
  }
  for (let i = 0; i < a.items.length; i++) {
    const x = a.items[i];
    const y = b.items[i];
    if (x.label !== y.label || x.start !== y.start || x.end !== y.end || x.source !== y.source || x.arasaacId !== y.arasaacId || (x.customRef || "") !== (y.customRef || "")) {
      return false;
    }
  }
  return true;
}
function weeklyPlanRowsFromLibrary(library) {
  return library.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    active: library.activeId === plan.id ? "\u25CF" : ""
  }));
}
function applyWeeklyPlanRowsToLibrary(library, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byId = new Map(library.plans.map((p) => [p.id, p]));
  const nextPlans = [];
  for (const row of list) {
    const id = String((row == null ? void 0 : row.id) || "").trim();
    if (!id || !byId.has(id)) {
      continue;
    }
    const prev = byId.get(id);
    nextPlans.push({
      ...prev,
      name: String(row.name || prev.name || id).trim() || prev.name
    });
  }
  const ids = new Set(nextPlans.map((p) => p.id));
  const activeId = library.activeId && ids.has(library.activeId) ? library.activeId : null;
  return { version: 1, activeId, plans: nextPlans };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_WEEKDAY_COLORS,
  EMPTY_WEEKLY_PLAN,
  EMPTY_WEEKLY_PLANS_LIBRARY,
  WEEKDAY_KEYS,
  applyWeeklyPlanRowsToLibrary,
  createEmptyWeeklyPlan,
  parseWeekdayColors,
  parseWeeklyPlan,
  parseWeeklyPlansLibrary,
  schedulePlansEqual,
  weekdayColorsFromConfig,
  weekdayKeyFromDate,
  weeklyPlanRowsFromLibrary
});
//# sourceMappingURL=weekly-plan.js.map
