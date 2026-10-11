import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
test("Recombiner retains actionable notices without added Room or sync chrome", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const store = fs.readFileSync("src/store.ts", "utf8");
  assert.doesNotMatch(
    app,
    /room-select|Shared Room:|\{room\.name\}|aria-label="House status"/,
  );
  assert.doesNotMatch(
    store,
    /Synchronized with House|Synchronizing with House|House is unreachable/,
  );
  assert.match(store, /rooms\(\).length === 1/);
  assert.match(store, /multiple data bindings/);
  assert.match(app, /Unfinished or returned drafts/);
  assert.match(app, /House has paused writes/);
  assert.match(store, /storage loss/);
  assert.match(store, /connection refused/);
});

test("external book and code references never replace the single-page App", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  for (const field of ["html_url", "code_url"]) {
    const tag = app.match(
      new RegExp(`<a[^>]+href=\\{props\\.book\\.${field}\\}[^>]+>`, "s"),
    )?.[0];
    assert.ok(tag);
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  }
});
