/**
 * Guards ioBroker repository / adapter-check rules (E1032, E2004-ish).
 * Run via: npm run test:package
 */
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ioPackage = JSON.parse(fs.readFileSync(path.join(root, "io-package.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const MAX_NEWS_ENTRIES = 7;
const version = ioPackage.common.version;
const newsKeys = Object.keys(ioPackage.common.news || {});

describe("io-package policy", () => {
	it("package.json and io-package.json versions match", () => {
		assert.strictEqual(pkg.version, version);
	});

	it(`common.news has at most ${MAX_NEWS_ENTRIES} entries (E1032)`, () => {
		assert.ok(
			newsKeys.length <= MAX_NEWS_ENTRIES,
			`Found ${newsKeys.length} news entries; max is ${MAX_NEWS_ENTRIES}`,
		);
	});

	it("common.news includes the current version", () => {
		assert.ok(newsKeys.includes(version), `news missing current version ${version}`);
	});

	it("common.titleLang.en is set (English short name)", () => {
		const title = ioPackage.common.titleLang?.en || ioPackage.common.title;
		assert.ok(typeof title === "string" && title.length > 0);
		assert.ok(!/iobroker|adapter/i.test(title));
	});

	it("common.desc.en is English (not German boilerplate)", () => {
		const en = ioPackage.common.desc?.en || "";
		assert.ok(en.length > 10);
		assert.ok(!en.startsWith("Unterstützung für Menschen"));
	});
});
