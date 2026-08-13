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
var arasaac_exports = {};
__export(arasaac_exports, {
  ARASAAC_API_BASE: () => ARASAAC_API_BASE,
  ARASAAC_ATTRIBUTION: () => ARASAAC_ATTRIBUTION,
  ARASAAC_ATTRIBUTION_DE: () => ARASAAC_ATTRIBUTION_DE,
  ARASAAC_SITE: () => ARASAAC_SITE,
  ARASAAC_STATIC_BASE: () => ARASAAC_STATIC_BASE,
  arasaacImageUrl: () => arasaacImageUrl,
  arasaacSearchUrl: () => arasaacSearchUrl
});
module.exports = __toCommonJS(arasaac_exports);
const ARASAAC_SITE = "https://arasaac.org";
const ARASAAC_API_BASE = "https://api.arasaac.org/v1";
const ARASAAC_STATIC_BASE = "https://static.arasaac.org/pictograms";
const ARASAAC_ATTRIBUTION = "The pictographic symbols used are the property of the Government of Aragon and have been created by Sergio Palao for ARASAAC (https://arasaac.org), which distributes them under a Creative Commons license (BY-NC-SA).";
const ARASAAC_ATTRIBUTION_DE = "Die verwendeten Piktogramme sind Eigentum der Regierung von Arag\xF3n und wurden von Sergio Palao f\xFCr ARASAAC (https://arasaac.org) erstellt; sie werden unter der Creative-Commons-Lizenz BY-NC-SA bereitgestellt.";
function arasaacImageUrl(pictogramId, size = 500) {
  const id = Math.max(1, Math.floor(Number(pictogramId) || 0));
  const safeSize = size === 300 ? 300 : 500;
  return `${ARASAAC_STATIC_BASE}/${id}/${id}_${safeSize}.png`;
}
function arasaacSearchUrl(language, query) {
  const lang = encodeURIComponent(language || "de");
  const q = encodeURIComponent(query.trim());
  return `${ARASAAC_API_BASE}/pictograms/${lang}/search/${q}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ARASAAC_API_BASE,
  ARASAAC_ATTRIBUTION,
  ARASAAC_ATTRIBUTION_DE,
  ARASAAC_SITE,
  ARASAAC_STATIC_BASE,
  arasaacImageUrl,
  arasaacSearchUrl
});
//# sourceMappingURL=arasaac.js.map
