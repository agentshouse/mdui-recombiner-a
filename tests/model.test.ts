import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { validate, verify } from "@agentshouse/mdmodel";
import { parse as parseYaml, stringify } from "yaml";
import {
  type Book,
  type Document,
  bookFields,
  decodeCatalog,
  findEntry,
  instructions,
  parseToc,
  rawToc,
  safeUrl,
  selectionPath,
  validateBook,
} from "../src/model.ts";
const sample = JSON.parse(
  fs.readFileSync("samples/manual.catalog.json", "utf8"),
)[0];
const fields = bookFields(validateBook(sample, "manual"));
const markdown = `---\n${stringify({ type: "recombiner_book", ...fields }, { lineWidth: 0 })}---\n`;
const document: Document = {
  room: "r",
  path: "books/manual.md",
  type: "recombiner_book",
  fields,
  markdown,
};
const book = decodeCatalog([document], "r").books[0] as Book;
const entry = findEntry(book, "0.0").entry;
const selection: Document = {
  room: "r",
  path: selectionPath(book, entry),
  type: "recombiner_selection",
  fields: { book: "../books/manual.md", chapter_key: "0.0" },
  markdown:
    '---\ntype: recombiner_selection\nbook: ../books/manual.md\nchapter_key: "0.0"\n---\n',
};
test("licensed seed retains 109 donor tree nodes and exact chapter URLs", () => {
  let count = 0;
  const visit = (node: { children: unknown[] }) => {
    count++;
    for (const child of node.children) visit(child as typeof node);
  };
  visit(sample.toc);
  assert.equal(count, 109);
  assert.deepEqual(rawToc(book.toc), sample.toc);
  assert.equal(book.author, "TeachBooks Development Team and TeachBooks users");
  assert.equal(book.license, "CC-BY-4.0");
  assert.equal(entry.title, "What is a TeachBook?");
  assert.equal(
    entry.external_url,
    "https://github.com/TeachBooks/manual/blob/release/book/intro/book.md",
  );
});
test("JSON Schema and book/selection documents validate using current MD Model", () => {
  const schema = fs.readFileSync("schema.yaml", "utf8");
  const checked = verify(schema);
  assert.equal(checked.verdict, "accept");
  if (checked.verdict !== "accept") throw new Error(JSON.stringify(checked));
  assert.deepEqual(
    validate(
      {
        "books/manual.md": markdown,
        [selection.path]: selection.markdown as string,
      },
      undefined,
      checked.model,
    ),
    { verdict: "accept" },
  );
  assert.equal(
    validate(
      { [selection.path]: selection.markdown as string },
      undefined,
      checked.model,
    ).verdict,
    "refuse",
  );
  assert.equal(Object.hasOwn(parseYaml(schema), "types"), false);
});
test("shared selections reconstruct donor parents and instructions after reload", () => {
  const result = decodeCatalog([document, selection], "r");
  assert.equal(
    result.externals[0]?.parents,
    "Your First TeachBook! / What is a TeachBook?",
  );
  assert.equal(
    instructions(result.externals),
    "- external: https://github.com/TeachBooks/manual/blob/release/book/intro/book.md",
  );
  assert.equal(instructions([]), "");
  assert.deepEqual(decodeCatalog([document, selection], "other"), {
    books: [],
    externals: [],
  });
});
test("rejects invalid identities, orphaned/misplaced/duplicate selections and books", () => {
  assert.throws(() => validateBook(sample, "../evil"));
  assert.throws(() => decodeCatalog([document, document], "r"), /Duplicate/);
  assert.throws(() => decodeCatalog([selection], "r"), /missing book/);
  assert.throws(
    () => decodeCatalog([document, { ...selection, path: "wrong.md" }], "r"),
    /misplaced/,
  );
  assert.throws(() => findEntry(book, "0.999"), /no longer exists/);
  assert.throws(() => findEntry(book, "0"), /no reusable/);
  assert.throws(() => findEntry(book, "__proto__"));
});
test("rejects unsafe URLs, overlarge trees and missing attribution", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/png,x",
    "https://user:secret@example.com/",
  ])
    assert.throws(() => safeUrl(url, "test"));
  assert.throws(() => validateBook({ ...sample, license: "" }, "manual"));
  assert.throws(() =>
    validateBook(
      { ...sample, toc: { ...sample.toc, children: "not array" } },
      "manual",
    ),
  );
  assert.throws(() =>
    parseToc({
      title: "too large",
      children: Array.from({ length: 2001 }, () => ({
        title: "x",
        children: [],
      })),
    }),
  );
});
test("local import omits remote logo and does not render author HTML", () => {
  const imported = validateBook(
    {
      ...sample,
      logo: "https://tracker.invalid/pixel",
      author: "<b>Author</b>",
    },
    "new",
  );
  assert.equal(imported.logo, "");
  assert.equal(imported.author, "Author");
});
test("the served path contains no donor network harvester or fallback seed import", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  const store = fs.readFileSync("src/store.ts", "utf8");
  assert(!/fetch\(|axios|harvestBook|books_url/.test(app));
  assert(!/chapters\.json|localStorage|indexedDB|fetch\(/.test(store));
  for (const name of [
    "TocEntryItem",
    "BookCard",
    "InstructionActions",
    "MailInstructions",
    "DiyInstructions",
    "AddBookCard",
  ])
    assert(app.includes(name));
});
