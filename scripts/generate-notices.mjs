import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");
const lock = JSON.parse(
  fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const sections = [
  "THIRD-PARTY NOTICES\n\nTeachBooks Recombiner House port. Donor Apache-2.0 license: LICENSE.txt. Manual catalogue and local logo: CC BY 4.0, full source attribution and adaptation record in licenses/PROVENANCE.txt. Runtime is supplied by House. Dependency notices below conservatively include the installed production closure, even though the Runtime itself is not bundled. Build/test-only tools are not distributed.\n",
  fs.readFileSync(path.join(root, "LICENSE"), "utf8"),
  fs.readFileSync(path.join(root, "public/licenses/PROVENANCE.txt"), "utf8"),
];
let count = 0;
for (const [rel, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!rel || entry.dev) continue;
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir) && entry.optional) continue;
  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8"),
  );
  assert.equal(pkg.version, entry.version);
  assert(
    pkg.license && pkg.license !== "UNLICENSED",
    `Missing license ${pkg.name}`,
  );
  count++;
  const files = fs
    .readdirSync(dir)
    .filter(
      (name) =>
        /^(licen[cs]e|copying|copyright|notice|ofl)(?:[.\-_]|$)/i.test(name) &&
        fs.statSync(path.join(dir, name)).isFile(),
    );
  sections.push(
    `\n${"=".repeat(70)}\n${pkg.name} ${pkg.version}\nLicense: ${pkg.license}\n`,
  );
  if (!files.length) {
    assert(
      pkg.name === "@cfworker/json-schema" && pkg.version === "4.1.1",
      `Missing license text ${pkg.name}`,
    );
    const contents = fs.readFileSync(
      path.join(root, "public/licenses/cfworker-json-schema-MIT.txt"),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(contents).digest("hex"),
      "376944252ab78ca6b41aee44ddea8894927ee67891e77e61eb9d59af63e35094",
    );
    sections.push(
      "Upstream publication commit license: https://github.com/cfworker/cfworker/blob/5409fdc2bd144f68e8b28c61c71fcb16600000a6/LICENSE.md\n",
      contents,
    );
  }
  for (const file of files)
    sections.push(`\n${file}\n`, fs.readFileSync(path.join(dir, file), "utf8"));
}
const dest = path.join(root, "public/THIRD_PARTY_NOTICES.txt");
const output = sections.join("\n");
if (check) assert.equal(fs.readFileSync(dest, "utf8"), output);
else fs.writeFileSync(dest, output);
console.log(`Production dependency license texts verified: ${count}`);
