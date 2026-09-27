// Storybook renders the app's real components in a browser, bundled by Vite.
// This is the build Chromatic snapshots. The Next.js app itself is untouched.

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

// Storybook loads this file as an ES module, so __dirname does not exist.
const here = path.dirname(fileURLToPath(import.meta.url));

// Modules that can't run in a browser, swapped for test versions. The server
// actions read the question bank, Supabase and Wikipedia on the server; the
// browser Supabase client opens a realtime connection. The stand-ins return
// fixed data from `fixtures.ts`, and each story can change what they return.
const MOCKED_MODULES: Record<string, string> = {
  "@/app/actions": path.resolve(here, "mocks/actions.ts"),
  "@/app/party-actions": path.resolve(here, "mocks/party-actions.ts"),
  "@/lib/supabase/browserClient": path.resolve(here, "mocks/browserClient.ts"),
};

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: [
    // Runs axe against every story. Chromatic reads its accessibility results
    // from this addon; without it a build reports no accessibility data at all.
    "@storybook/addon-a11y",
    // Shows Chromatic's visual test results inside Storybook.
    "@chromatic-com/storybook",
  ],
  framework: "@storybook/nextjs-vite",
  staticDirs: ["../public", { from: "./assets", to: "/storybook-assets" }],
  viteFinal: (viteConfig) => {
    // Exact matches only, so "@/app/actions" is swapped but nothing that merely
    // starts with it is.
    const mocks = Object.entries(MOCKED_MODULES).map(([find, replacement]) => ({
      find: new RegExp(`^${find.replace(/[/\\]/g, "\\$&")}$`),
      replacement,
    }));
    const alias = viteConfig.resolve?.alias;
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: Array.isArray(alias)
        ? [...mocks, ...alias]
        : [...mocks, ...Object.entries(alias ?? {}).map(([find, replacement]) => ({ find, replacement }))],
    };
    return viteConfig;
  },
};

export default config;
