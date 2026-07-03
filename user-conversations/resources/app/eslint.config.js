import vitest from "@vitest/eslint-plugin"
import tseslint from "typescript-eslint"

export default tseslint.config(
	// Generated and vendored output is not lintable source
	{
		ignores: ["dist/", "coverage/", "node_modules/", "src/coverage/", "src/node_modules/"],
	},

	// Type-checked rules are the point: without them, no-floating-promises,
	// no-misused-promises, and await-thenable are silently absent (ts-vet gate 2)
	...tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				// projectService type-checks each file against the tsconfig that owns it;
				// vitest.config.ts is excluded from tsconfig.json, so it gets the default project
				projectService: {
					allowDefaultProject: ["vitest.config.ts", "eslint.config.js"],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	// Test files: a committed .only would silently skip the rest of the suite
	{
		files: ["**/*.test.ts", "**/*.test.tsx"],
		plugins: { vitest },
		rules: {
			"vitest/no-focused-tests": "error",
			"vitest/no-disabled-tests": "warn",
		},
	},

	// Plain JS (this config file): type-aware rules need a TS program, so switch them off
	{
		files: ["**/*.js"],
		extends: [tseslint.configs.disableTypeChecked],
	},
)
