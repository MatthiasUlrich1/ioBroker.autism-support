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
var pictogram_library_exports = {};
__export(pictogram_library_exports, {
  LIBRARY_FILE: () => LIBRARY_FILE,
  PICTOGRAM_DIR: () => PICTOGRAM_DIR,
  emptyLibrary: () => emptyLibrary,
  fileRefToPath: () => fileRefToPath,
  libraryFromNativeRows: () => libraryFromNativeRows,
  matchesPictogramQuery: () => matchesPictogramQuery,
  normalizeTags: () => normalizeTags,
  parseLibrary: () => parseLibrary,
  uniquePictogramFilename: () => uniquePictogramFilename
});
module.exports = __toCommonJS(pictogram_library_exports);
const PICTOGRAM_DIR = "pictograms";
const LIBRARY_FILE = `${PICTOGRAM_DIR}/_library.json`;
function emptyLibrary() {
  return { version: 1, items: [] };
}
function normalizeTags(input) {
  let parts;
  if (Array.isArray(input)) {
    parts = input.map((entry) => typeof entry === "string" ? entry : "");
  } else if (typeof input === "string") {
    parts = input.split(/[,;]+/);
  } else {
    parts = [];
  }
  const seen = /* @__PURE__ */ new Set();
  const tags = [];
  for (const part of parts) {
    const tag = part.trim().toLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
function parseLibrary(raw) {
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
      return emptyLibrary();
    }
    return {
      version: 1,
      items: data.items.filter((item) => item && typeof item === "object" && item.filename).map((item) => ({
        id: String(item.id || item.filename),
        filename: String(item.filename),
        path: String(item.path || `${PICTOGRAM_DIR}/${item.filename}`),
        label: String(item.label || ""),
        tags: normalizeTags(item.tags),
        originalName: String(item.originalName || item.filename),
        mime: String(item.mime || ""),
        uploadedAt: Number(item.uploadedAt) || 0
      }))
    };
  } catch {
    return emptyLibrary();
  }
}
function matchesPictogramQuery(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const haystack = [item.label, item.originalName, item.filename, ...item.tags].join(" ").toLowerCase();
  return q.split(/\s+/).every((part) => haystack.includes(part));
}
function fileRefToPath(file) {
  const ref = String(file || "").trim().replace(/^\/+/, "").replace(/^files\//, "");
  if (!ref) {
    return "";
  }
  if (ref.includes(`${PICTOGRAM_DIR}/`)) {
    return ref.slice(ref.indexOf(`${PICTOGRAM_DIR}/`));
  }
  const filename = ref.split("/").pop() || "";
  return filename ? `${PICTOGRAM_DIR}/${filename}` : "";
}
function libraryFromNativeRows(rows) {
  if (!Array.isArray(rows)) {
    return emptyLibrary();
  }
  const items = [];
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      return;
    }
    const data = row;
    const path = fileRefToPath(String(data.file || ""));
    if (!path) {
      return;
    }
    const filename = path.split("/").pop() || `image-${index}`;
    items.push({
      id: filename,
      filename,
      path,
      label: String(data.label || filename.replace(/\.[^.]+$/, "")),
      tags: normalizeTags(data.tags),
      originalName: filename,
      mime: "",
      uploadedAt: 0
    });
  });
  return { version: 1, items };
}
function uniquePictogramFilename(original) {
  const sanitized = String(original || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const extMatch = /\.(png|jpe?g|gif|webp|svg)$/i.exec(sanitized);
  const ext = ((extMatch == null ? void 0 : extMatch[0]) || ".png").toLowerCase();
  const base = (extMatch ? sanitized.slice(0, -extMatch[0].length) : sanitized).replace(/_+$/g, "") || "image";
  return `${base}-${Date.now()}${ext}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LIBRARY_FILE,
  PICTOGRAM_DIR,
  emptyLibrary,
  fileRefToPath,
  libraryFromNativeRows,
  matchesPictogramQuery,
  normalizeTags,
  parseLibrary,
  uniquePictogramFilename
});
//# sourceMappingURL=pictogram-library.js.map
