import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // The react plugin is only needed for component tests; those opt into jsdom
  // with a per-file `@vitest-environment` docblock so the pure lib tests keep
  // running on node.
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environment: "node",
  },
});
