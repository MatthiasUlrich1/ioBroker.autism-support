import { resolveItemImageUrl } from "./schedule";

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
					path: String(item.path || `pictograms/${item.filename}`),
					label: String(item.label || ""),
					tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag)) : [],
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
	const haystack = [item.label, item.originalName, item.filename, ...(item.tags || [])].join(" ").toLowerCase();
	return q.split(/\s+/).every(part => haystack.includes(part));
}

export function customPictogramUrl(item: CustomPictogram, adapterInstance: string): string {
	return (
		resolveItemImageUrl(
			{ id: item.id, label: item.label, start: "00:00", end: "00:01", source: "custom", customRef: item.path },
			adapterInstance,
		) || ""
	);
}
