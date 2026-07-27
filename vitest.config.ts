import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // The react plugin is only needed for component tests; those opt into jsdom
  // with a per-file `@vitest-environment` docblock so the pure lib tests keep
  // running on node.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The `server-only` marker throws outside a React Server Component
      // bundle; point it at the package's own no-op so server modules can be
      // unit tested directly.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environment: "node",
  },
});
