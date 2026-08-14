import { expect } from "chai";
import {
	fileRefToPath,
	libraryFromNativeRows,
	matchesPictogramQuery,
	mergePictogramSources,
	normalizeTags,
	parseLibrary,
	pictogramPublicUrl,
	pictogramStoragePath,
	syncCustomPictogramRows,
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
			path: "main/autism-support/pictograms/brush-1.png",
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

	it("maps native admin rows to vis-2 storage paths", () => {
		const library = libraryFromNativeRows([
			{
				file: "vis-2.0/main/autism-support/pictograms/brush.png",
				label: "Zähne",
				tags: "hygiene, morgen",
			},
		]);
		expect(fileRefToPath("/vis-2.0/main/autism-support/pictograms/brush.png")).to.equal(
			"main/autism-support/pictograms/brush.png",
		);
		expect(library.items[0].path).to.equal("main/autism-support/pictograms/brush.png");
		expect(library.items[0].tags).to.deep.equal(["hygiene", "morgen"]);
	});

	it("maps legacy adapter paths to vis-2 storage paths", () => {
		expect(fileRefToPath("autism-support.0/pictograms/brush.png")).to.equal(
			"main/autism-support/pictograms/brush.png",
		);
		expect(pictogramStoragePath("brush.png")).to.equal("main/autism-support/pictograms/brush.png");
		expect(pictogramPublicUrl("main/autism-support/pictograms/brush.png")).to.equal(
			"/vis-2.0/main/autism-support/pictograms/brush.png",
		);
	});

	it("parses an empty library on invalid JSON", () => {
		expect(parseLibrary("not-json").items).to.deep.equal([]);
	});

	it("builds admin table rows from disk files and keeps tags", () => {
		const rows = syncCustomPictogramRows(
			["brush.png", "readme.txt", "other.jpg"],
			[{ file: "main/autism-support/pictograms/brush.png", label: "Zähne", tags: "hygiene, morgen" }],
		);
		expect(rows).to.deep.equal([
			{
				file: "main/autism-support/pictograms/brush.png",
				label: "Zähne",
				tags: "hygiene, morgen",
			},
			{
				file: "main/autism-support/pictograms/other.jpg",
				label: "other",
				tags: "",
			},
		]);
	});

	it("merges disk files with admin name and tags", () => {
		const disk = parseLibrary({
			version: 1,
			items: [
				{
					id: "brush.png",
					filename: "brush.png",
					path: "main/autism-support/pictograms/brush.png",
					label: "brush",
					tags: [],
					originalName: "brush.png",
					mime: "",
					uploadedAt: 0,
				},
			],
		});
		const configRows = libraryFromNativeRows([
			{ file: "main/autism-support/pictograms/brush.png", label: "Zähne", tags: "hygiene" },
		]);
		const merged = mergePictogramSources(disk, configRows);
		expect(merged.items).to.have.length(1);
		expect(merged.items[0].label).to.equal("Zähne");
		expect(merged.items[0].tags).to.deep.equal(["hygiene"]);
	});
});
