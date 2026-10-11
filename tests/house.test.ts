import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { stringify } from "yaml";
import {
  type Change,
  type Runtime,
  clear,
  importBook,
  queueChanges,
  removeBook,
  toggle,
} from "../src/house.ts";
import {
  type Book,
  type Document,
  type SelectedExternal,
  bookFields,
  decodeCatalog,
  findEntry,
  selectionPath,
  validateBook,
} from "../src/model.ts";
const sample = JSON.parse(
  fs.readFileSync("tests/support/samples/manual.catalog.json", "utf8"),
)[0];
const fields = bookFields(validateBook(sample, "manual"));
const doc: Document = {
  room: "r",
  path: "books/manual.md",
  type: "recombiner_book",
  fields,
  markdown: `---\n${stringify({ type: "recombiner_book", ...fields }, { lineWidth: 0 })}---\n`,
};
const book = decodeCatalog([doc], "r").books[0] as Book;
const entry = findEntry(book, "0.0").entry;
const selected: SelectedExternal = {
  book,
  entry,
  parents: "Original parents",
  room: "r",
  path: selectionPath(book, entry),
  markdown: "exact opened selection markdown",
};
function fake(
  options: {
    existing?: string;
    raceAt?: number;
    refused?: string;
    documents?: Document[];
    transportFailure?: boolean;
  } = {},
) {
  const writes: unknown[][] = [];
  const saves: unknown[][] = [];
  const md = {
    roomDraft: {
      read: async (_room: string, path: string) =>
        options.existing === path ? { revision: "existing" } : null,
      write: async (...args: unknown[]) => {
        writes.push(args);
        if (options.transportFailure) throw new Error("port closed");
        return writes.length === options.raceAt
          ? { outcome: "stale" }
          : {
              outcome: "written",
              roomDraft: { revision: `draft-${writes.length}` },
            };
      },
    },
    save: async (...args: unknown[]) => {
      saves.push(args);
      return options.refused
        ? { outcome: "refused", rule: options.refused }
        : { outcome: "saved", identifier: "queued-id" };
    },
    query: async () => ({ documents: options.documents ?? [doc] }),
  } as unknown as Runtime;
  return { md, writes, saves };
}
test("toggle creates one stable shared selection through null draft CAS and grouped save", async () => {
  const mock = fake();
  assert.equal(await toggle(mock.md, book, entry, []), "queued-id");
  assert.deepEqual(mock.writes, [
    [
      "r",
      selected.path,
      null,
      {
        creation: {
          type: "recombiner_selection",
          fields: { book: "../books/manual.md", chapter_key: "0.0" },
          sections: {},
        },
      },
    ],
  ]);
  assert.deepEqual(mock.saves, [
    ["r", [{ path: selected.path, revision: "draft-1" }]],
  ]);
});
test("unselect uses exact opened Markdown base, independent of object identity", async () => {
  const mock = fake();
  await toggle(mock.md, { ...book }, { ...entry }, [selected]);
  assert.deepEqual(mock.writes[0]?.[3], {
    removal: { base: "exact opened selection markdown" },
  });
});
test("clear groups removals and preserves their exact bases", async () => {
  const mock = fake();
  const second = {
    ...selected,
    path: "selections/manual--0.1.md",
    markdown: "second exact base",
  };
  await clear(mock.md, "r", [selected, second]);
  assert.equal(mock.saves.length, 1);
  assert.equal(mock.writes.length, 2);
  assert.deepEqual(mock.writes[1]?.[3], {
    removal: { base: "second exact base" },
  });
  await assert.rejects(
    () => clear(mock.md, "foreign", [selected]),
    /more than one/,
  );
});
test("all paths preflight existing drafts before any write", async () => {
  const mock = fake({ existing: "later.md" });
  const changes: Change[] = [
    { path: "first.md", parts: { removal: { base: "first" } } },
    { path: "later.md", parts: { removal: { base: "later" } } },
  ];
  await assert.rejects(() => queueChanges(mock.md, "r", changes), /unfinished/);
  assert.equal(mock.writes.length, 0);
  assert.equal(mock.saves.length, 0);
});
test("cross-tab draft races preserve prepared drafts without saving or discarding", async () => {
  const mock = fake({ raceAt: 2 });
  await assert.rejects(
    () => clear(mock.md, "r", [selected, { ...selected, path: "other.md" }]),
    /another tab/,
  );
  assert.equal(mock.writes.length, 2);
  assert.equal(mock.saves.length, 0);
  assert(!("discard" in mock.md.roomDraft));
});
for (const refused of ["stale", "changed-underneath", "invalid-field"])
  test(`save ${refused} preserves drafts and reports no success`, async () => {
    const mock = fake({ refused });
    await assert.rejects(
      () => toggle(mock.md, book, entry, []),
      /drafts have been kept/,
    );
    assert.equal(mock.saves.length, 1);
  });
test("transport failure never becomes fake local state or retry", async () => {
  const mock = fake({ transportFailure: true });
  await assert.rejects(() => toggle(mock.md, book, entry, []), /port closed/);
  assert.equal(mock.writes.length, 1);
  assert.equal(mock.saves.length, 0);
});
test("imports validated local catalogues with attribution and no loaded external logo", async () => {
  const mock = fake();
  await importBook(mock.md, "r", {
    ...sample,
    logo: "https://outside.invalid/pixel",
  });
  const parts = mock.writes[0]?.[3] as {
    creation: { fields: Record<string, unknown> };
  };
  assert.equal(parts.creation.fields.deleteable, true);
  assert.equal(parts.creation.fields.logo, "");
  assert.equal(parts.creation.fields.license, "CC-BY-4.0");
  assert.match(String(parts.creation.fields.id), /^book-/);
  await assert.rejects(
    () => importBook(mock.md, "r", { ...sample, author: undefined }),
    /author/,
  );
});
test("seed cannot be deleted and stale book selections stop deletion", async () => {
  const mock = fake();
  await assert.rejects(
    () => removeBook(mock.md, book, []),
    /cannot be removed/,
  );
  const stale = fake({
    documents: [
      doc,
      {
        room: "r",
        path: selected.path,
        type: "recombiner_selection",
        fields: { book: "../books/manual.md", chapter_key: "0.0" },
        markdown: "new",
      },
    ],
  });
  await assert.rejects(
    () => removeBook(stale.md, { ...book, deleteable: true }, []),
    /selection changed/,
  );
  assert.equal(stale.writes.length, 0);
});
test("deleting an imported book and selections is one exact-base save", async () => {
  const fresh = fake({
    documents: [
      doc,
      {
        room: "r",
        path: selected.path,
        type: "recombiner_selection",
        fields: { book: "../books/manual.md", chapter_key: "0.0" },
        markdown: selected.markdown,
      },
    ],
  });
  await removeBook(fresh.md, { ...book, deleteable: true }, [selected]);
  assert.equal(fresh.writes.length, 2);
  assert.equal(fresh.saves.length, 1);
  assert.deepEqual(fresh.writes[1]?.[3], { removal: { base: book.markdown } });
});
