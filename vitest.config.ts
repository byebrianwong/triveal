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
    // Node 25 turns on its own Web Storage by default, which puts a
    // `localStorage` on the global object. Started without
    // `--localstorage-file`, that object is empty and has no methods. vitest's
    // jsdom environment does not replace a global that already exists, so
    // component tests got Node's empty object instead of jsdom's working
    // storage. Turning Node's storage off in the test workers lets jsdom's
    // through. Node 22 and older have it off already, and Node 20 rejects the
    // flag, so it is only passed when this Node defines `localStorage`.
    execArgv: "localStorage" in globalThis ? ["--no-experimental-webstorage"] : [],
  },
});
