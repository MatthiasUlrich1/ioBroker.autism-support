import react from "@vitejs/plugin-react";
import commonjs from "vite-plugin-commonjs";
import { federation } from "@module-federation/vite";
import { moduleFederationShared } from "@iobroker/gui-components/modulefederation.admin.config";
import { readFileSync } from "node:fs";

export default {
	plugins: [
		federation({
			manifest: true,
			name: "AutismSupportAdminSet",
			filename: "customComponents.js",
			exposes: {
				"./Components": "./src/Components.tsx",
			},
			remotes: {},
			shared: moduleFederationShared(JSON.parse(readFileSync("./package.json", "utf8"))),
		}),
		react(),
		commonjs(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	base: "./",
	build: {
		target: "chrome89",
		outDir: "./build",
	},
};
