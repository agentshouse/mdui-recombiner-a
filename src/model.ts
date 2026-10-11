/** Adapted from TeachBooks/recombiner store.ts (Apache-2.0). */
export interface TocEntry {
  title: string;
  html_url: string | null;
  external_url: string | null;
  children: TocEntry[];
  key: string;
}
export interface BookMeta {
  html_url: string;
  code_url: string;
  release: string;
  toc_path: string;
}
export interface Book extends BookMeta {
  id: string;
  title: string;
  logo: string;
  author: string;
  toc: TocEntry;
  deleteable: boolean;
  license: string;
  license_url: string;
  source_url: string;
  source_revision: string;
  room: string;
  path: string;
  markdown: string;
}
export interface SelectedExternal {
  book: Book;
  parents: string;
  entry: TocEntry;
  room: string;
  path: string;
  markdown: string;
}
export interface Document {
  room: string;
  path: string;
  type?: string;
  fields?: Readonly<Record<string, unknown>>;
  markdown?: string;
}
export interface Catalog {
  books: Book[];
  externals: SelectedExternal[];
}
export function text(value: unknown, field: string, max = 4096): string {
  if (typeof value !== "string" || value.length > max || !value.trim())
    throw new Error(`Invalid ${field}.`);
  return value;
}
export function safeUrl(value: unknown, field: string): string {
  const str = text(value, field);
  const url = new URL(str);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(`Unsafe ${field}. Use a public HTTP(S) link.`);
  return str;
}
export function identifier(value: unknown): string {
  const str = text(value, "book id", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(str)) throw new Error("Invalid book id.");
  return str;
}
export function parseToc(raw: unknown): TocEntry {
  let count = 0;
  const read = (value: unknown, key: string, depth: number): TocEntry => {
    if (
      ++count > 2000 ||
      depth > 30 ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      throw new Error("Invalid or oversized chapter tree.");
    const row = value as Record<string, unknown>;
    if (!Array.isArray(row.children))
      throw new Error("A chapter must contain a children array.");
    return {
      key,
      title: text(row.title, "chapter title"),
      html_url:
        row.html_url == null ? null : safeUrl(row.html_url, "chapter link"),
      external_url:
        row.external_url == null
          ? null
          : safeUrl(row.external_url, "chapter source"),
      children: row.children.map((child, i) =>
        read(child, key ? `${key}.${i}` : `${i}`, depth + 1),
      ),
    };
  };
  return read(raw, "", 0);
}
export function rawToc(entry: TocEntry): unknown {
  return {
    title: entry.title,
    html_url: entry.html_url,
    external_url: entry.external_url,
    children: entry.children.map(rawToc),
  };
}
export function validateBook(
  value: unknown,
  id: string,
): Omit<Book, "room" | "path" | "markdown"> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Book must be a JSON object.");
  const row = value as Record<string, unknown>;
  const toc = parseToc(row.toc);
  // Only the bundled verified logo can be rendered; imported resources never load from outside House.
  return {
    id: identifier(id),
    title: text(row.title, "title"),
    html_url: safeUrl(row.html_url, "website"),
    code_url: safeUrl(row.code_url, "code repository"),
    release: text(row.release, "release"),
    toc_path: text(row.toc_path, "TOC path"),
    logo:
      row.logo === "./images/TeachBooks_logo.svg"
        ? "./images/TeachBooks_logo.svg"
        : "",
    author: text(row.author, "author").replace(/<[^>]*>/g, ""),
    toc,
    deleteable: row.deleteable === true,
    license: text(row.license, "license"),
    license_url: safeUrl(row.license_url, "license link"),
    source_url: safeUrl(row.source_url, "catalogue source"),
    source_revision: text(row.source_revision, "source revision"),
  };
}
export function bookFields(
  book: Omit<Book, "room" | "path" | "markdown">,
): Record<string, unknown> {
  const { toc, ...fields } = book;
  return { ...fields, toc_json: JSON.stringify(rawToc(toc)) };
}
export function findEntry(
  book: Book,
  key: string,
): { entry: TocEntry; parents: string } {
  if (!/^\d+(?:\.\d+)*$/.test(key))
    throw new Error("Invalid selected chapter key.");
  let node = book.toc;
  const parents: string[] = [];
  for (const part of key.split(".")) {
    const child = node.children[Number(part)];
    if (!child)
      throw new Error(
        "A selected chapter no longer exists. Resolve it in House.",
      );
    node = child;
    parents.push(node.title);
  }
  if (!node.external_url)
    throw new Error("This chapter has no reusable source URL.");
  return { entry: node, parents: parents.join(" / ") };
}
export function selectionPath(book: Book, entry: TocEntry): string {
  return `selections/${book.id}--${entry.key}.md`;
}
export function decodeCatalog(
  documents: readonly Document[],
  room: string,
): Catalog {
  const selected = documents.filter((doc) => doc.room === room);
  const books: Book[] = [];
  const ids = new Set<string>();
  for (const doc of selected.filter((row) => row.type === "recombiner_book")) {
    const fields = doc.fields ?? {};
    const parsed = validateBook(
      {
        ...fields,
        toc: JSON.parse(text(fields.toc_json, "chapter JSON", 1_000_000)),
      },
      identifier(fields.id),
    );
    if (ids.has(parsed.id) || doc.path !== `books/${parsed.id}.md`)
      throw new Error(
        "Duplicate or misplaced catalogue book. Resolve it in House.",
      );
    ids.add(parsed.id);
    books.push({
      ...parsed,
      room,
      path: doc.path,
      markdown: text(doc.markdown, "book document", 1_100_000),
    });
  }
  const externals = selected
    .filter((doc) => doc.type === "recombiner_selection")
    .map((doc): SelectedExternal => {
      const fields = doc.fields ?? {};
      const book = books.find(
        (candidate) => fields.book === `../${candidate.path}`,
      );
      if (!book)
        throw new Error(
          "A selection refers to a missing book. Resolve it in House.",
        );
      const found = findEntry(book, text(fields.chapter_key, "chapter key"));
      if (doc.path !== selectionPath(book, found.entry))
        throw new Error(
          "Duplicate or misplaced selected chapter. Resolve it in House.",
        );
      return {
        book,
        ...found,
        room,
        path: doc.path,
        markdown: text(doc.markdown, "selection document", 100_000),
      };
    });
  return { books, externals };
}
export function instructions(
  selections: readonly Pick<SelectedExternal, "entry">[],
): string {
  return selections
    .map((external) => `- external: ${external.entry.external_url}`)
    .join("\n");
}
