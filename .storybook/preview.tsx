// Global story setup: the app's CSS and font, the two sizes Chromatic
// captures, and a clean slate (default stand-ins, empty storage) before every
// story.

import type { Preview } from "@storybook/nextjs-vite";
import isChromatic from "chromatic/isChromatic";
import "../app/globals.css";
import "./storybook.css";
import { resetActionMocks } from "./mocks/actions";
import { resetBrowserClientMocks } from "./mocks/browserClient";
import { resetPartyActionMocks } from "./mocks/party-actions";

if (isChromatic()) document.documentElement.classList.add("chromatic");

// The two layouts the app actually has: the phone column below 1024px, and
// the wide desktop layout above it. Heights matter because the game screens
// fill the window (h-dvh), so the capture height sets where everything sits.
const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        phone: { name: "Phone", styles: { width: `${PHONE.width}px`, height: `${PHONE.height}px` } },
        desktop: { name: "Desktop", styles: { width: `${DESKTOP.width}px`, height: `${DESKTOP.height}px` } },
      },
    },
    chromatic: {
      // Every story is captured at both sizes. A story with no responsive
      // styles can turn one off with `modes: { desktop: { disable: true } }`.
      modes: {
        phone: { viewport: PHONE },
        desktop: { viewport: DESKTOP },
      },
      // The app wraps every animation (clues sliding in, twinkling stars) in
      // prefers-reduced-motion: no-preference, so this captures the settled
      // screen instead of a random frame of an animation.
      prefersReducedMotion: "reduce",
    },
    a11y: {
      // Report violations in the Storybook panel and to Chromatic without
      // failing the story. Chromatic tracks them against a baseline.
      test: "todo",
    },
  },
  decorators: [
    // Components are designed to sit on the starlit background, so every
    // story that isn't a whole screen gets a strip of it. Screen stories set
    // `screen: true` and bring their own full-window frame.
    (Story, { parameters }) =>
      parameters.screen ? (
        <Story />
      ) : (
        <div className="stage px-5 py-8 lg:px-10 lg:py-10">
          <Story />
        </div>
      ),
  ],
  beforeEach() {
    resetActionMocks();
    resetPartyActionMocks();
    resetBrowserClientMocks();
    try {
      localStorage.clear();
    } catch {
      // storage blocked; stories that need it will seed and fail loudly
    }
  },
};

export default preview;
