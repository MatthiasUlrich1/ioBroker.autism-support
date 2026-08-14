import { expect } from "chai";
import {
	matchesPictogramQuery,
	normalizeTags,
	parseLibrary,
	uniquePictogramFilename,
} from "./pictogram-library";

describe("pictogram-library", () => {
	it("normalizes tags from comma-separated text", () => {
		expect(normalizeTags(" Hygiene, Morgen, hygiene ")).to.deep.equal(["hygiene", "morgen"]);
	});

	it("matches search against label and tags", () => {
		const item = {
			id: "1",
			filename: "brush-1.png",
			path: "pictograms/brush-1.png",
			label: "Zähneputzen",
			tags: ["hygiene", "morgen"],
			originalName: "zaehne.png",
			mime: "image/png",
			uploadedAt: 1,
		};
		expect(matchesPictogramQuery(item, "morgen")).to.equal(true);
		expect(matchesPictogramQuery(item, "zähne")).to.equal(true);
		expect(matchesPictogramQuery(item, "abend")).to.equal(false);
	});

	it("keeps a unique filename with original extension", () => {
		const name = uniquePictogramFilename("Zähne putzen.PNG");
		expect(name.endsWith(".png")).to.equal(true);
		expect(name).to.match(/-\d+\.png$/);
	});

	it("parses an empty library on invalid JSON", () => {
		expect(parseLibrary("not-json").items).to.deep.equal([]);
	});
});
