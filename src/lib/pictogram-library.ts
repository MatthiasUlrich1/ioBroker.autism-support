/**
 * Metadata for user-uploaded pictograms (never ARASAAC files).
 * Images live next to this JSON in the instance file store.
 */

export const PICTOGRAM_DIR = "pictograms";
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

export function normalizeTags(input: unknown): string[] {
	const parts = Array.isArray(input)
		? input.map(entry => String(entry))
		: String(input || "").split(/[,;]+/);
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
					path: String(item.path || `${PICTOGRAM_DIR}/${item.filename}`),
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

export function uniquePictogramFilename(original: string): string {
	const sanitized = String(original || "image")
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.slice(0, 80);
	const extMatch = /\.(png|jpe?g|gif|webp|svg)$/i.exec(sanitized);
	const ext = (extMatch?.[0] || ".png").toLowerCase();
	const base = (extMatch ? sanitized.slice(0, -extMatch[0].length) : sanitized).replace(/_+$/g, "") || "image";
	return `${base}-${Date.now()}${ext}`;
}
