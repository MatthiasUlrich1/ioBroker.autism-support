/**
 * ARASAAC helpers for VIS widgets.
 * Images are loaded only from the official CDN – never from this package.
 */

export const ARASAAC_SITE = "https://arasaac.org";
export const ARASAAC_API_BASE = "https://api.arasaac.org/v1";
export const ARASAAC_STATIC_BASE = "https://static.arasaac.org/pictograms";

export const ARASAAC_ATTRIBUTION_DE =
	"Piktogramme: Eigentum der Regierung von Aragón, erstellt von Sergio Palao für ARASAAC (https://arasaac.org), Lizenz CC BY-NC-SA.";

export const ARASAAC_ATTRIBUTION_EN =
	"Pictograms: property of the Government of Aragon, created by Sergio Palao for ARASAAC (https://arasaac.org), license CC BY-NC-SA.";

export function arasaacImageUrl(pictogramId: number, size: 300 | 500 = 500): string {
	const id = Math.max(1, Math.floor(Number(pictogramId) || 0));
	const safeSize = size === 300 ? 300 : 500;
	return `${ARASAAC_STATIC_BASE}/${id}/${id}_${safeSize}.png`;
}

export function arasaacSearchUrl(language: string, query: string): string {
	const lang = encodeURIComponent(language || "de");
	const q = encodeURIComponent(query.trim());
	return `${ARASAAC_API_BASE}/pictograms/${lang}/search/${q}`;
}

export interface ArasaacSearchHit {
	id: number;
	keyword: string;
}

export async function searchArasaac(language: string, query: string): Promise<ArasaacSearchHit[]> {
	const q = query.trim();
	if (q.length < 2) {
		return [];
	}
	const response = await fetch(arasaacSearchUrl(language, q));
	if (!response.ok) {
		throw new Error(`ARASAAC search failed (${response.status})`);
	}
	const data = (await response.json()) as Array<{
		_id: number;
		keywords?: Array<{ keyword?: string }>;
	}>;
	return (data || []).slice(0, 24).map(entry => ({
		id: entry._id,
		keyword: entry.keywords?.[0]?.keyword || String(entry._id),
	}));
}
