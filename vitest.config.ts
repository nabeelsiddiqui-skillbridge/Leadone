import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The `server-only` sentinel package throws unconditionally when its
      // main entry is required; it only resolves to a no-op `empty.js`
      // under the `react-server` export condition, which Next's bundler
      // sets and Vitest's SSR module resolution doesn't reliably pick up.
      // Our unit tests exercise pure logic in files that carry
      // `import "server-only"` purely as a guard against being pulled into
      // a Client Component bundle - safe to no-op directly here since
      // nothing in these tests runs in a browser.
      "server-only": path.resolve(__dirname, "./test/empty-module.ts"),
    },
  },
});
