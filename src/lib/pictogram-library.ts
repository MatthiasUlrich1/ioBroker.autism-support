/**
 * Metadata for user-uploaded pictograms (never ARASAAC files).
 * Image files live in the vis-2 file store: vis-2.0/main/autism-support/pictograms/
 */

export const PICTOGRAM_FILE_ADAPTER = "vis-2.0";
export const VIS_PROJECT = "main";
export const PICTOGRAM_SUBFOLDER = "autism-support/pictograms";
/** Path inside vis-2.0, e.g. main/autism-support/pictograms */
export const PICTOGRAM_DIR = `${VIS_PROJECT}/${PICTOGRAM_SUBFOLDER}`;
export const LIBRARY_FILE = `${PICTOGRAM_DIR}/_library.json`;

export interface CustomPictogram {
	id: string;
	filename: string;
	path: string;
	label: string;
	tags: string[];
	originalName: string;
	mime: string;
	uploadedAt: number;
}

export interface PictogramLibrary {
	version: 1;
	items: CustomPictogram[];
}

export function emptyLibrary(): PictogramLibrary {
	return { version: 1, items: [] };
}

export function pictogramStoragePath(filename: string): string {
	return `${PICTOGRAM_DIR}/${filename}`;
}

/** Public URL as used in vis-2 views, e.g. /vis-2.0/main/autism-support/pictograms/foo.png */
export function pictogramPublicUrl(storagePath: string): string {
	const path = fileRefToPath(storagePath);
	return path ? `/${PICTOGRAM_FILE_ADAPTER}/${path}` : "";
}

export function normalizeTags(input: unknown): string[] {
	let parts: string[];
	if (Array.isArray(input)) {
		parts = input.map(entry => (typeof entry === "string" ? entry : ""));
	} else if (typeof input === "string") {
		parts = input.split(/[,;]+/);
	} else {
		parts = [];
	}
	const seen = new Set<string>();
	const tags: string[] = [];
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

export function parseLibrary(raw: unknown): PictogramLibrary {
	try {
		const data = typeof raw === "string" ? JSON.parse(raw) : raw;
		if (!data || typeof data !== "object" || !Array.isArray((data as PictogramLibrary).items)) {
			return emptyLibrary();
		}
		return {
			version: 1,
			items: (data as PictogramLibrary).items
				.filter(item => item && typeof item === "object" && item.filename)
				.map(item => ({
					id: String(item.id || item.filename),
					filename: String(item.filename),
					path: fileRefToPath(String(item.path || item.filename)),
					label: String(item.label || ""),
					tags: normalizeTags(item.tags),
					originalName: String(item.originalName || item.filename),
					mime: String(item.mime || ""),
					uploadedAt: Number(item.uploadedAt) || 0,
				})),
		};
	} catch {
		return emptyLibrary();
	}
}

export function matchesPictogramQuery(item: CustomPictogram, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) {
		return true;
	}
	const haystack = [item.label, item.originalName, item.filename, ...item.tags].join(" ").toLowerCase();
	return q.split(/\s+/).every(part => haystack.includes(part));
}

/** Normalize admin/config references to vis-2 storage path (main/autism-support/pictograms/…). */
export function fileRefToPath(file: string): string {
	const ref = String(file || "")
		.trim()
		.replace(/^\/+/, "")
		.replace(/^files\//, "");
	if (!ref) {
		return "";
	}

	const visPrefix = `${PICTOGRAM_FILE_ADAPTER}/`;
	if (ref.startsWith(visPrefix)) {
		return ref.slice(visPrefix.length);
	}

	if (ref.startsWith(`${PICTOGRAM_DIR}/`)) {
		return ref;
	}

	if (ref.includes(`${PICTOGRAM_SUBFOLDER}/`)) {
		const tail = ref.slice(ref.indexOf(`${PICTOGRAM_SUBFOLDER}/`));
		return `${VIS_PROJECT}/${tail}`;
	}

	// Legacy adapter store: pictograms/file.png or autism-support.0/pictograms/file.png
	if (ref.includes("pictograms/")) {
		const filename = ref.slice(ref.indexOf("pictograms/") + "pictograms/".length);
		return filename ? pictogramStoragePath(filename) : "";
	}

	const filename = ref.split("/").pop() || "";
	return filename ? pictogramStoragePath(filename) : "";
}

export function matchesPictogramKey(entry: CustomPictogram, key: string): boolean {
	const normalized = fileRefToPath(key);
	if (!normalized) {
		return false;
	}
	return (
		entry.path === key ||
		entry.filename === key ||
		fileRefToPath(entry.path) === normalized ||
		pictogramStoragePath(entry.filename) === normalized
	);
}

export function libraryFromNativeRows(rows: unknown): PictogramLibrary {
	if (!Array.isArray(rows)) {
		return emptyLibrary();
	}
	const items: CustomPictogram[] = [];
	rows.forEach((row, index) => {
		if (!row || typeof row !== "object") {
			return;
		}
		const data = row as { file?: string; label?: string; tags?: unknown };
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
			uploadedAt: 0,
		});
	});
	return { version: 1, items };
}

export function mergePictogramSources(disk: PictogramLibrary, configRows: PictogramLibrary): PictogramLibrary {
	const items = new Map<string, CustomPictogram>();
	for (const item of disk.items) {
		items.set(item.filename, { ...item });
	}
	for (const item of configRows.items) {
		const existing = items.get(item.filename);
		if (existing) {
			items.set(item.filename, {
				...existing,
				label: item.label || existing.label,
				tags: item.tags.length ? item.tags : existing.tags,
			});
		} else {
			items.set(item.filename, item);
		}
	}
	return { version: 1, items: [...items.values()] };
}

export function uniquePictogramFilename(original: string): string {
	const sanitized = String(original || "image")
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.slice(0, 80);
	const extMatch = /\.(png|jpe?g|gif|webp|svg)$/i.exec(sanitized);
	const ext = (extMatch?.[0] || ".png").toLowerCase();
	const base = (extMatch ? sanitized.slice(0, -extMatch[0].length) : sanitized).replace(/_+$/g, "") || "image";
	return `${base}-${Date.now()}${ext}`;
}

export interface CustomPictogramConfigRow {
	file: string;
	label: string;
	tags: string;
}

/** Build admin table rows from files on disk, preserving existing labels/tags. */
export function syncCustomPictogramRows(filenames: string[], existingRows: unknown): CustomPictogramConfigRow[] {
	const existing = libraryFromNativeRows(existingRows);
	const byFilename = new Map(existing.items.map(item => [item.filename, item]));

	return filenames
		.filter(name => /\.(png|jpe?g|gif|webp|svg)$/i.test(name))
		.sort((a, b) => a.localeCompare(b))
		.map(filename => {
			const prev = byFilename.get(filename);
			const path = pictogramStoragePath(filename);
			return {
				file: path,
				label: prev?.label || filename.replace(/\.[^.]+$/, "").replace(/-\d+$/, ""),
				tags: prev?.tags.length ? prev.tags.join(", ") : "",
			};
		});
}
