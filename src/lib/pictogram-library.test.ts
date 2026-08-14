import { expect } from "chai";
import {
	fileRefToPath,
	libraryFromNativeRows,
	matchesPictogramQuery,
	mergePictogramSources,
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

	it("maps native admin rows to library paths", () => {
		const library = libraryFromNativeRows([
			{ file: "autism-support.0/pictograms/brush.png", label: "Zähne", tags: "hygiene, morgen" },
		]);
		expect(fileRefToPath("/files/autism-support.0/pictograms/brush.png")).to.equal("pictograms/brush.png");
		expect(library.items[0].path).to.equal("pictograms/brush.png");
		expect(library.items[0].tags).to.deep.equal(["hygiene", "morgen"]);
	});

	it("parses an empty library on invalid JSON", () => {
		expect(parseLibrary("not-json").items).to.deep.equal([]);
	});

	it("merges disk files with admin name and tags", () => {
		const disk = parseLibrary({
			version: 1,
			items: [
				{
					id: "brush.png",
					filename: "brush.png",
					path: "pictograms/brush.png",
					label: "brush",
					tags: [],
					originalName: "brush.png",
					mime: "",
					uploadedAt: 0,
				},
			],
		});
		const configRows = libraryFromNativeRows([{ file: "pictograms/brush.png", label: "Zähne", tags: "hygiene" }]);
		const merged = mergePictogramSources(disk, configRows);
		expect(merged.items).to.have.length(1);
		expect(merged.items[0].label).to.equal("Zähne");
		expect(merged.items[0].tags).to.deep.equal(["hygiene"]);
	});
});
