// Opt-in: runs the generated integration tests against the generated product code in Chromium.
//   npm run example:integration   (once: npx playwright install chromium)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./order-cancel.generated",
  testMatch: "*.integration.ts",
  reporter: [["list"], ["junit", { outputFile: "order-cancel.integration-results.xml" }]],
  use: { browserName: "chromium" },
});
