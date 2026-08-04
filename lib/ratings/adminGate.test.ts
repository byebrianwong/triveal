import { describe, expect, it } from "vitest";
import { adminAccessAllowed, tokenMatches } from "./adminGate";

const TOKEN = "C1UozxTSs-yVWgmXACorMcMAxg4Smk6f";

describe("tokenMatches", () => {
  it("accepts the exact token", () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
  });

  it("forgives whitespace around either side", () => {
    // The case this exists for: a token pasted into a hosting dashboard
    // arrives with a trailing newline and every request 404s, looking for all
    // the world like the page was never deployed.
    expect(tokenMatches(TOKEN, `${TOKEN}\n`)).toBe(true);
    expect(tokenMatches(TOKEN, `  ${TOKEN}  `)).toBe(true);
    expect(tokenMatches(` ${TOKEN} `, TOKEN)).toBe(true);
    expect(tokenMatches(`${TOKEN}\r\n`, `\n${TOKEN}`)).toBe(true);
  });

  it("still rejects anything else", () => {
    expect(tokenMatches("wrong", TOKEN)).toBe(false);
    expect(tokenMatches(TOKEN.slice(0, -1), TOKEN)).toBe(false);
    expect(tokenMatches(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(tokenMatches(undefined, TOKEN)).toBe(false);
  });

  it("does not treat whitespace inside the token as noise", () => {
    expect(tokenMatches("abc def", "abcdef")).toBe(false);
  });

  it("never matches on an empty side", () => {
    expect(tokenMatches("", TOKEN)).toBe(false);
    expect(tokenMatches("   ", TOKEN)).toBe(false);
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches("anything", "   ")).toBe(false);
  });
});

describe("adminAccessAllowed", () => {
  it("lets the right key through wherever it runs", () => {
    expect(adminAccessAllowed(TOKEN, TOKEN, true)).toBe(true);
    expect(adminAccessAllowed(TOKEN, TOKEN, false)).toBe(true);
  });

  it("survives a token stored with a trailing newline", () => {
    expect(adminAccessAllowed(TOKEN, `${TOKEN}\n`, true)).toBe(true);
  });

  it("turns away a wrong or missing key when a token is configured", () => {
    expect(adminAccessAllowed("nope", TOKEN, true)).toBe(false);
    expect(adminAccessAllowed(undefined, TOKEN, true)).toBe(false);
    // Configured means configured — dev is no exemption.
    expect(adminAccessAllowed(undefined, TOKEN, false)).toBe(false);
  });

  it("is open in development and absent in production with no token set", () => {
    expect(adminAccessAllowed(undefined, undefined, false)).toBe(true);
    expect(adminAccessAllowed(undefined, undefined, true)).toBe(false);
    expect(adminAccessAllowed("whatever", undefined, true)).toBe(false);
  });

  it("treats a whitespace-only token as unset rather than unmatchable", () => {
    // Otherwise the page would be silently unreachable everywhere, including
    // dev, with no way to tell that from a wrong key.
    expect(adminAccessAllowed(undefined, "   ", false)).toBe(true);
    expect(adminAccessAllowed(undefined, "   ", true)).toBe(false);
    expect(adminAccessAllowed("   ", "   ", true)).toBe(false);
  });
});
