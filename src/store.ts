/** House-backed replacement for the donor's in-memory signal store. */
import { createMemo, createSignal } from "solid-js";
import {
  type Draft,
  type Room,
  type Runtime,
  catalogQuery,
  clear,
  connect,
  importBook,
  removeBook,
  toggle,
} from "./house.ts";
import {
  type Book,
  type Document,
  type TocEntry,
  decodeCatalog,
} from "./model.ts";
export type { Book, BookMeta, TocEntry } from "./model.ts";
const [documents, setDocuments] = createSignal<readonly Document[]>([]);
export const [rooms, setRooms] = createSignal<readonly Room[]>([]);
export const [roomId, setRoomId] = createSignal("");
export const [busy, setBusy] = createSignal(false);
const [queryLoaded, setQueryLoaded] = createSignal(false);
const [syncCompleted, setSyncCompleted] = createSignal(false);
export const loaded = () =>
  syncCompleted() && rooms().length === 1 && queryLoaded();
export const loading = () => !syncCompleted();
export const bindingError = () =>
  !syncCompleted() || rooms().length === 1
    ? ""
    : rooms().length > 1
      ? "Recombiner received multiple data bindings. Check this App’s configuration in House."
      : "No Room is bound. Bind exactly one compatible Room in House.";
export const [error, setError] = createSignal("");
export const [receipt, setReceipt] = createSignal("");
export const [sync, setSync] = createSignal("");
export const [halted, setHalted] = createSignal(false);
export const [warning, setWarning] = createSignal("");
export const [drafts, setDrafts] = createSignal<NonNullable<Draft>[]>([]);
let md: Runtime | undefined;
const catalog = createMemo(() => {
  try {
    return { ...decodeCatalog(documents(), roomId()), error: "" };
  } catch (caught) {
    return { books: [], externals: [], error: message(caught) };
  }
});
export const books = () => catalog().books;
export const externals = () => catalog().externals;
export const catalogError = () => catalog().error;
export const writable = () =>
  loaded() &&
  rooms().some(
    (room) =>
      room.locator === roomId() &&
      room.operations.write.length > 0 &&
      room.replica.admission === "admitted" &&
      !room.refusal,
  ) &&
  !busy() &&
  !catalogError() &&
  !warning();
function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
export async function initializeStore(
  provider: () => Promise<Runtime> = connect,
): Promise<() => void> {
  const handles: { close(): void }[] = [];
  setQueryLoaded(false);
  setSyncCompleted(false);
  setRooms([]);
  setRoomId("");
  setDocuments([]);
  let disposed = false;
  setError("");
  try {
    md = await provider();
    const watch = async <T>(
      promise: Promise<{
        current(): T;
        subscribe(fn: (value: T) => void): () => void;
        close(): void;
      }>,
      update: (value: T) => void,
    ) => {
      const observation = await promise;
      if (disposed) {
        observation.close();
        return;
      }
      handles.push(observation);
      update(observation.current());
      observation.subscribe(update);
    };
    const client = md;
    let latestQuery: readonly Document[] | undefined;
    let queryStarted = false;
    let pendingQuery: Promise<void> | undefined;
    const redraw = () => {
      if (disposed || !syncCompleted() || rooms().length !== 1) return;
      setRoomId(rooms()[0]?.locator ?? "");
      if (latestQuery) {
        setDocuments(latestQuery);
        setQueryLoaded(true);
      }
      if (!queryStarted) {
        queryStarted = true;
        pendingQuery = watch(client.observe("query", catalogQuery), (value) => {
          latestQuery = value.documents;
          redraw();
        }).catch((caught) => {
          if (!disposed) setError(message(caught));
        });
      }
    };
    await watch(client.observe("rooms"), (value) => {
      setRooms(value);
      redraw();
    });
    await watch(client.observe("sync-status"), (value) => {
      setSyncCompleted(value.lastCompleted !== null);
      setSync(
        value.attentionRequired.length
          ? `Attention required: ${value.attentionRequired.length} returned draft(s)`
          : "",
      );
      redraw();
    });
    await pendingQuery;
    await watch(client.observe("service-mode"), (value) =>
      setHalted(value === "write-halted"),
    );
    await watch(client.observe("room-drafts"), (value) =>
      setDrafts([...value]),
    );
    await watch(client.observe("storage-loss"), (value) => {
      if (value) setWarning(`House reported storage loss: ${value}`);
    });
    await watch(client.observe("connection-refusal"), (value) => {
      if (value)
        setWarning(
          `House connection refused: ${value.code}. Reopen the App after resolving access.`,
        );
    });
    if (!(await client.persistence()))
      setWarning(
        "House reports non-durable browser storage. Saved work may be lost if this session closes.",
      );
  } catch (caught) {
    setError(message(caught));
  }
  return () => {
    disposed = true;
    for (const handle of handles) handle.close();
    md = undefined;
  };
}
async function action(
  run: (client: Runtime) => Promise<string>,
): Promise<boolean> {
  if (!md || !writable()) {
    setError("Wait for a writable House Room and resolve any warning first.");
    return false;
  }
  setBusy(true);
  setError("");
  setReceipt("");
  try {
    await run(md);
    setReceipt("Changes queued in House.");
    return true;
  } catch (caught) {
    setError(message(caught));
    return false;
  } finally {
    setBusy(false);
  }
}
export const toggleExternal = (book: Book, entry: TocEntry) =>
  action((client) => toggle(client, book, entry, externals()));
export const checkedExternal = (book: Book, entry: TocEntry) =>
  externals().some(
    (row) =>
      row.book.id === book.id &&
      row.room === book.room &&
      row.entry.key === entry.key,
  );
export const clearExternals = () =>
  action((client) => clear(client, roomId(), externals()));
export const deleteBook = (book: Book) =>
  action((client) => removeBook(client, book, externals()));
export const addBook = (raw: unknown) =>
  action((client) => importBook(client, roomId(), raw));
