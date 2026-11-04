// Opt-in: runs the graph walk (src/walk.ts) against the generated product code in Chromium.
//   npm run example:walk   (once: npx playwright install chromium)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./order-cancel.generated",
  testMatch: "*.walk.ts",
  reporter: [["list"]],
  use: { browserName: "chromium" },
});
