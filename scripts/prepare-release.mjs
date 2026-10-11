import { execFileSync } from "node:child_process";
import fs from "node:fs";
execFileSync(process.execPath, ["scripts/generate-notices.mjs"], {
  stdio: "inherit",
});
for (const name of ["app.json", "schema.yaml"])
  fs.copyFileSync(name, `public/${name}`);
