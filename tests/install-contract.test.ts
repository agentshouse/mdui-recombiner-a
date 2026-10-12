import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("clean installs retain a matching direct Solid compiler override", () => {
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const compiler = "babel-preset-solid";

  // npm requires identical specs for overrides of direct dependencies,
  // even when a version range includes the overridden version.
  assert.equal(manifest.devDependencies[compiler], "1.9.5");
  assert.equal(manifest.overrides[compiler], manifest.devDependencies[compiler]);
  assert.equal(lock.packages[`node_modules/${compiler}`].version, "1.9.5");
  assert.equal(lock.lockfileVersion, 3);
  for (const field of ["dependencies", "devDependencies", "engines"]) {
    assert.deepEqual(lock.packages[""][field], manifest[field]);
  }
});
