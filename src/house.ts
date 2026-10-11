import { connectHouseBridge } from "@agentshouse/app-bridge";
import {
  type Book,
  type Document,
  type SelectedExternal,
  type TocEntry,
  bookFields,
  selectionPath,
  validateBook,
} from "./model.ts";
export type Runtime = Awaited<ReturnType<typeof connectHouseBridge>["runtime"]>;
export type Room = Awaited<ReturnType<Runtime["rooms"]>>[number];
export type Draft = Awaited<ReturnType<Runtime["roomDraft"]["read"]>>;
type Parts = Parameters<Runtime["roomDraft"]["write"]>[3];
export type Change = { path: string; parts: Parts };
export const catalogQuery = {
  types: ["recombiner_book", "recombiner_selection"],
  select: { fields: "all" as const, markdown: true as const },
  orderBy: [{ by: "path" as const, direction: "asc" as const }],
};
export async function connect(): Promise<Runtime> {
  const bridge = connectHouseBridge();
  bridge.setTab({ title: "Book Recombiner" });
  return bridge.runtime;
}
/** Writes use an exact null draft precondition and exact opened document bases. Save means queued. */
export async function queueChanges(
  md: Runtime,
  room: string,
  changes: Change[],
): Promise<string> {
  if (
    !room ||
    !changes.length ||
    new Set(changes.map((row) => row.path)).size !== changes.length
  )
    throw new Error("Invalid grouped change.");
  for (const change of changes)
    if (await md.roomDraft.read(room, change.path))
      throw new Error(
        "An unfinished House draft exists. Resolve it in House before editing again.",
      );
  const drafts = [];
  for (const change of changes) {
    const result = await md.roomDraft.write(
      room,
      change.path,
      null,
      change.parts,
    );
    if (result.outcome !== "written" || !result.roomDraft)
      throw new Error(
        "A draft changed in another tab. Prepared drafts have been kept. Review them in House.",
      );
    drafts.push({ path: change.path, revision: result.roomDraft.revision });
  }
  const result = await md.save(room, drafts);
  if (result.outcome !== "saved")
    throw new Error(
      `House refused this save: ${result.rule}. Your drafts have been kept. ${JSON.stringify(result)}`,
    );
  return result.identifier;
}
export function removal(row: { path: string; markdown: string }): Change {
  return { path: row.path, parts: { removal: { base: row.markdown } } };
}
export async function toggle(
  md: Runtime,
  book: Book,
  entry: TocEntry,
  opened: readonly SelectedExternal[],
): Promise<string> {
  if (!entry.external_url || !entry.key)
    throw new Error("This chapter cannot be selected.");
  const path = selectionPath(book, entry);
  const existing = opened.find(
    (row) => row.room === book.room && row.path === path,
  );
  return queueChanges(md, book.room, [
    existing
      ? removal(existing)
      : {
          path,
          parts: {
            creation: {
              type: "recombiner_selection",
              fields: { book: `../${book.path}`, chapter_key: entry.key },
              sections: {},
            },
          },
        },
  ]);
}
export async function clear(
  md: Runtime,
  room: string,
  opened: readonly SelectedExternal[],
): Promise<string> {
  if (opened.some((row) => row.room !== room))
    throw new Error("Selection spans more than one Room.");
  return queueChanges(md, room, opened.map(removal));
}
export async function removeBook(
  md: Runtime,
  book: Book,
  opened: readonly SelectedExternal[],
): Promise<string> {
  if (!book.deleteable)
    throw new Error(
      "The licensed demo catalogue cannot be removed in this App.",
    );
  const selected = opened.filter(
    (row) => row.book.id === book.id && row.room === book.room,
  );
  const fresh = await md.query({ ...catalogQuery, rooms: [book.room] });
  const references = fresh.documents.filter(
    (doc: Document) =>
      doc.type === "recombiner_selection" &&
      doc.fields?.book === `../${book.path}`,
  );
  if (
    references.length !== selected.length ||
    references.some(
      (doc) =>
        !selected.some(
          (old) => old.path === doc.path && old.markdown === doc.markdown,
        ),
    )
  )
    throw new Error(
      "This book selection changed. Review the current selection before removing the book.",
    );
  return queueChanges(md, book.room, [...selected.map(removal), removal(book)]);
}
export async function importBook(
  md: Runtime,
  room: string,
  raw: unknown,
): Promise<string> {
  const id = `book-${crypto.randomUUID()}`;
  const parsed = validateBook(raw, id);
  parsed.deleteable = true;
  return queueChanges(md, room, [
    {
      path: `books/${id}.md`,
      parts: {
        creation: {
          type: "recombiner_book",
          fields: bookFields(parsed),
          sections: {},
        },
      },
    },
  ]);
}
