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
var schedule_types_exports = {};
__export(schedule_types_exports, {
  EMPTY_SCHEDULE_PLAN: () => EMPTY_SCHEDULE_PLAN,
  findCurrentItemIndex: () => findCurrentItemIndex,
  getLatestItemEndMinutes: () => getLatestItemEndMinutes,
  isPlanFullyExpired: () => isPlanFullyExpired,
  itemEndAbsoluteMinutes: () => itemEndAbsoluteMinutes,
  parseSchedulePlan: () => parseSchedulePlan
});
module.exports = __toCommonJS(schedule_types_exports);
const EMPTY_SCHEDULE_PLAN = {
  version: 1,
  items: []
};
function parseSchedulePlan(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") {
      return { ...EMPTY_SCHEDULE_PLAN, items: [] };
    }
    const items = Array.isArray(data.items) ? data.items.filter((item) => item && typeof item === "object") : [];
    return {
      version: 1,
      items: items.map((item, index) => normalizeItem(item, index))
    };
  } catch {
    return { ...EMPTY_SCHEDULE_PLAN, items: [] };
  }
}
function normalizeItem(item, index) {
  const source = item.source === "custom" ? "custom" : "arasaac";
  return {
    id: String(item.id || `item-${index}`),
    label: String(item.label || ""),
    start: String(item.start || "08:00"),
    end: String(item.end || "09:00"),
    source,
    arasaacId: source === "arasaac" && item.arasaacId != null && Number.isFinite(Number(item.arasaacId)) ? Number(item.arasaacId) : void 0,
    customRef: source === "custom" ? String(item.customRef || "") : void 0
  };
}
function itemEndAbsoluteMinutes(item, parseTime) {
  const s = parseTime(item.start);
  const e = parseTime(item.end);
  if (e > s) {
    return e;
  }
  if (e < s) {
    return e + 1440;
  }
  return s + 30;
}
function getLatestItemEndMinutes(plan, parseTime) {
  if (!plan.items.length) {
    return null;
  }
  return Math.max(...plan.items.map((item) => itemEndAbsoluteMinutes(item, parseTime)));
}
function isPlanFullyExpired(plan, minutes, parseTime) {
  const lastEnd = getLatestItemEndMinutes(plan, parseTime);
  if (lastEnd == null) {
    return false;
  }
  let nowAbs = (minutes % 1440 + 1440) % 1440;
  if (lastEnd > 1440 && nowAbs < 12 * 60) {
    nowAbs += 1440;
  }
  return nowAbs >= lastEnd;
}
function findCurrentItemIndex(plan, minutes, parseTime) {
  return plan.items.findIndex((item) => {
    const s = parseTime(item.start);
    const e = parseTime(item.end);
    const t = (minutes % 1440 + 1440) % 1440;
    if (s === e) {
      return false;
    }
    if (s < e) {
      return t >= s && t < e;
    }
    return t >= s || t < e;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EMPTY_SCHEDULE_PLAN,
  findCurrentItemIndex,
  getLatestItemEndMinutes,
  isPlanFullyExpired,
  itemEndAbsoluteMinutes,
  parseSchedulePlan
});
//# sourceMappingURL=schedule-types.js.map
