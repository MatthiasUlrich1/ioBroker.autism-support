/**
 * ARASAAC pictograms are loaded ONLY from the official CDN / API.
 * This adapter never ships, copies, or redistributes ARASAAC image files.
 *
 * License: Creative Commons BY-NC-SA (author Sergio Palao, owner Government of Aragon).
 * @see https://arasaac.org
 * @see https://creativecommons.org/licenses/by-nc-sa/4.0/
 */

export const ARASAAC_SITE = "https://arasaac.org";
export const ARASAAC_API_BASE = "https://api.arasaac.org/v1";
export const ARASAAC_STATIC_BASE = "https://static.arasaac.org/pictograms";

/** Official attribution text (CC BY-NC-SA). */
export const ARASAAC_ATTRIBUTION =
	"The pictographic symbols used are the property of the Government of Aragon and have been created by Sergio Palao for ARASAAC (https://arasaac.org), which distributes them under a Creative Commons license (BY-NC-SA).";

export const ARASAAC_ATTRIBUTION_DE =
	"Die verwendeten Piktogramme sind Eigentum der Regierung von Aragón und wurden von Sergio Palao für ARASAAC (https://arasaac.org) erstellt; sie werden unter der Creative-Commons-Lizenz BY-NC-SA bereitgestellt.";

/**
 * Build external image URL for an ARASAAC pictogram id.
 * Images are hotlinked from static.arasaac.org – not stored in this package.
 */
export function arasaacImageUrl(pictogramId: number, size: 100 | 300 | 500 = 300): string {
	const id = Math.max(1, Math.floor(Number(pictogramId) || 0));
	return `${ARASAAC_STATIC_BASE}/${id}/${id}_${size}.png`;
}

export function arasaacSearchUrl(language: string, query: string): string {
	const lang = encodeURIComponent(language || "de");
	const q = encodeURIComponent(query.trim());
	return `${ARASAAC_API_BASE}/pictograms/${lang}/search/${q}`;
}
