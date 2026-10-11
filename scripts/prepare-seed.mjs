import crypto from "node:crypto";
import fs from "node:fs";
const pin = "fe5b037e96a9c8c4a66a92693141a9192e359269";
const manualPin = "8ea59e8f721c77848de71a7cc7de722d3bd1ad8e";
const book = JSON.parse(
  fs.readFileSync("../recombiner-donor/chapters.json", "utf8"),
)[0];
if (book.title !== "TeachBooks Manual")
  throw new Error("Unexpected donor catalogue");
book.logo = "./images/TeachBooks_logo.svg";
book.author = "TeachBooks Development Team and TeachBooks users";
book.license = "CC-BY-4.0";
book.license_url = "https://creativecommons.org/licenses/by/4.0/";
book.source_url = `https://github.com/TeachBooks/recombiner/blob/${pin}/chapters.json`;
book.source_revision = pin;
book.deleteable = false;
const json = `${JSON.stringify([book], null, 2)}\n`;
fs.writeFileSync("chapters.json", json);
fs.writeFileSync("samples/manual.catalog.json", json);
fs.mkdirSync("public/samples", { recursive: true });
fs.writeFileSync("public/samples/manual.catalog.json", json);
let nodes = 0;
let reusable = 0;
function count(node) {
  nodes++;
  if (node.external_url) reusable++;
  node.children.forEach(count);
}
count(book.toc);
const provenance = `TeachBooks Recombiner software\nAuthors: Stefan Verhoeven and Bart Schilperoort, Netherlands eScience Center\nRepository: https://github.com/TeachBooks/recombiner\nCommit: ${pin}\nSoftware license: Apache-2.0 (LICENSE.txt).\n\nTeachBooks Manual catalogue and logo\nAuthors: TeachBooks Development Team and TeachBooks users\nOriginal catalogue: ${book.source_url}\nManual: https://github.com/TeachBooks/manual/tree/${manualPin}\nLicense evidence: https://github.com/TeachBooks/manual/blob/${manualPin}/LICENSE\nLicense: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/\nFull original license, including listed external-material notices, is retained as Manual-CC-BY-4.0.txt.\nChanges: filtered catalogue to the Manual only; author HTML normalized to plain text; logo vendored locally; attribution fields added; book deletion disabled for the demo. Chapter titles, hierarchy and URLs are unchanged from donor. ${nodes} TOC nodes (${reusable} nodes have external-source links). Root remains unselectable as in donor. No chapter full text is republished. No HOS workbook is included.\nOriginal logo URL: https://raw.githubusercontent.com/TeachBooks/manual/${manualPin}/book/images/TeachBooks_logo.svg\nLocal logo SHA-256: ${crypto.createHash("sha256").update(fs.readFileSync("public/images/TeachBooks_logo.svg")).digest("hex")}\n\nHouse modifications (2026-10-11): runtime persistence, local catalogue imports, explicit Room state and sync/refusal UI, responsive width fixes, local assets and retained attributions.\n`;
fs.writeFileSync("public/licenses/PROVENANCE.txt", provenance);
console.log({ nodes, reusable });
