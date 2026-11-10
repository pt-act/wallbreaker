import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-11-10 layout regression: App.tsx renders <a className="skip-link"> as the
// FIRST child of the .app grid container. Without an out-of-flow .skip-link rule it
// becomes a grid item, auto-places into cell 1/1, and shuffles the whole shell
// (skip-link → rail cell, rail → wide content column, main → narrow rail column).
// jsdom cannot verify visual CSS, so this pins the contract at the source level:
// as long as the markup exists, styles.css must ship the position:fixed rule that
// keeps the link out of grid flow (same pattern as .v2-skip in v2.css).
describe("skip-link CSS contract", () => {
  it("ships an out-of-flow .skip-link rule in styles.css", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");
    if (!app.includes('className="skip-link"')) {
      return; // markup removed → contract void
    }
    expect(css).toMatch(/\.skip-link\s*{[^}]*position:\s*fixed/);
  });
});
