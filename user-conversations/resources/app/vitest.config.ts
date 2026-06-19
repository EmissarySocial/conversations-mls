import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",

			// Count every included source file, not just the ones a test happens to
			// import. Without this (`all: false` is the default), the coverage
			// denominator changes whenever a test imports a new file, so the headline
			// number lurches around instead of reflecting the true state.
			all: true,

			include: ["src/**/*.ts", "src/**/*.tsx"],

			// Measure "how well-tested is the logic we intend to test." Excluded:
			exclude: [
				// Test files and the test-only harness.
				"src/**/*.test.ts",
				"src/service/testHarness.ts",

				// Render-heavy Mithril components. Their view() methods are mostly JSX
				// markup; unit-testing render output is brittle and low-value, so they
				// are tested (if at all) via behavior, not line coverage. NOTE: the
				// logic-only view/*.ts files (mentionToken, caretCoordinates, utils)
				// are intentionally NOT excluded.
				"src/view/**/*.tsx",

				// The app entry point — DOM mount / bootstrap glue, not logic.
				"src/app.tsx",

				// The MLS (encrypted) codec is deferred: it depends on real ts-mls
				// crypto that is impractical to fake, so it is not unit-tested for now.
				"src/service/codecMls.ts",
			],
		},
	},
})
